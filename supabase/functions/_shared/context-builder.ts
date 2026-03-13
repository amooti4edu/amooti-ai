// ============================================================================
//  context-builder.ts
//  Assembles curriculum context from Qdrant + Supabase before the LLM call.
//
//  Search architecture:
//    1. embedQuery()  — BGE-M3 dense vector via embedding.ts
//    2. Qdrant        — semantic topic search (dense, with retry + timeout)
//    3. Supabase RPCs — full structured context, edges, quiz outcomes
//
//  Three modes:
//    query   — concept-anchored: find topic → fetch context + prereqs + cross-subject
//    quiz    — outcome-anchored: find topic → fetch quiz outcomes + distractor hints
//    teacher — breadth-first:   find top N topics → full context + sequence neighbours
//
//  Replaces: Supabase pgvector match_concept_nodes / match_topic_nodes
//  Keeps:    all RPC calls, BuiltContext shape, buildContext() signature
// ============================================================================

import { embedQuery }       from "./embedding.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PREREQ_DEPTH,
  PROGRESS_TIMEOUT_MS,
  type Mode,
} from "./models.config.ts";

// ── Qdrant constants (internal — Qdrant-specific, not in models.config) ───────

const QDRANT_COLLECTION    = "curriculum_topics";
const QDRANT_TOP_K         = 5;    // candidates fetched per search
const TEACHER_TOPIC_LIMIT  = 3;    // full contexts fetched for teacher mode
const SCORE_THRESHOLD      = 0.52; // below this → topic not in curriculum
const QDRANT_TIMEOUT_MS    = 8_000;
const QDRANT_RETRIES       = 2;
const CACHE_TTL_MS         = 60_000;
const CACHE_MAX_ENTRIES    = 200;

// ── Secrets from edge function environment ────────────────────────────────────

function getQdrantUrl(): string {
  const url = Deno.env.get("QDRANT_URL");
  if (!url) throw new Error("QDRANT_URL secret is not set");
  return url;
}

function getQdrantKey(): string {
  const key = Deno.env.get("QDRANT_API_KEY");
  if (!key) throw new Error("QDRANT_API_KEY secret is not set");
  return key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

// Kept for backwards compatibility — callers that type-check against
// ConceptNode / TopicNode will still compile.
export interface ConceptNode {
  node_id:      string;
  name:         string;
  definition:   string;
  concept_type: string;
  subject:      string;
  class:        string;
  term:         string;
  topic:        string;
  vocabulary:   string[];
  skills:       string[];
  similarity:   number;
}

export interface TopicNode {
  topic_id:                string;
  subject:                 string;
  class:                   string;
  term:                    string;
  theme:                   string;
  topic:                   string;
  periods:                 string;
  sequence_position:       number;
  concept_count:           number;
  outcome_count:           number;
  blooms_tag_count:        number;
  application_count:       number;
  activity_count:          number;
  difficulty_distribution: Record<string, number>;
  blooms_levels_covered:   string[];
  similarity:              number;
}

export interface QdrantResult {
  id:      number;
  score:   number;
  payload: {
    topic_id:          string;
    subject:           string;
    class:             string;
    term:              string;
    theme:             string;
    topic:             string;
    periods:           string;
    sequence_position: number;
    concept_count:     number;
    outcome_count:     number;
    activity_count:    number;
  };
}

export interface BuiltContext {
  // Always present
  found:   boolean;
  topics:  TopicNode[] | QdrantResult[];  // shape depends on search path used

  // Present when found = true
  subject?:          string;
  class?:            string;
  term?:             string;
  topic?:            string;

  // Supabase payloads
  topicContext?:     Record<string, unknown>;
  allTopicContexts?: Record<string, unknown>[];  // teacher mode: top N topics
  concepts:          ConceptNode[];
  prerequisites?:    unknown[];
  crossSubject?:     unknown[];
  quizOutcomes?:     unknown[];
  studentProgress?:  unknown[];

  // Best single IDs for prompt builders
  bestTopicId?:   string;
  bestConceptId?: string;
}

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry { result: BuiltContext; expiresAt: number }
const _cache = new Map<string, CacheEntry>();

function _cacheKey(mode: Mode, query: string, subject = "", classVal = ""): string {
  return `${mode}::${query.toLowerCase().trim()}::${subject}::${classVal}`;
}

function _cacheGet(key: string): BuiltContext | null {
  const entry = _cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.result;
}

function _cacheSet(key: string, result: BuiltContext): void {
  // Evict oldest entry when cap is reached
  if (_cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = [..._cache.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    _cache.delete(oldest[0]);
  }
  _cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Qdrant search ─────────────────────────────────────────────────────────────
//
// Soft-filter strategy:
//   1. Search WITH subject + class filters (most precise).
//   2. If nothing above SCORE_THRESHOLD, retry with ONLY class filter.
//      Catches subject name mismatches like "H&P" vs
//      "History and Political Education".
//   3. If still nothing, retry with NO filters (pure semantic fallback).
//
// A wrong subject string now degrades gracefully instead of returning an empty
// context and letting the model hallucinate the curriculum.

async function qdrantSearchRaw(
  dense: number[],
  must:  unknown[],
  limit: number,
): Promise<QdrantResult[]> {
  const body: Record<string, unknown> = {
    query:        dense,
    using:        "dense",
    limit,
    with_payload: true,
    ...(must.length ? { filter: { must } } : {}),
  };

  const url = `${getQdrantUrl()}/collections/${QDRANT_COLLECTION}/points/query`;
  const key = getQdrantKey();

  for (let attempt = 0; attempt <= QDRANT_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1_000 * attempt));
      console.log(`[Qdrant] retry ${attempt}`);
    }
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), QDRANT_TIMEOUT_MS);

      const res = await fetch(url, {
        method:  "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 502 || res.status === 503) {
        console.warn(`[Qdrant] ${res.status} — will retry`);
        continue;
      }
      if (!res.ok) {
        console.warn(`[Qdrant] ${res.status}:`, await res.text());
        return [];
      }
      return ((await res.json()).result?.points ?? []) as QdrantResult[];
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      console.warn("[Qdrant]", isAbort ? `timeout after ${QDRANT_TIMEOUT_MS}ms` : err);
    }
  }

  console.warn("[Qdrant] all retries exhausted");
  return [];
}

async function qdrantSearch(
  dense:     number[],
  subject?:  string,
  classVal?: string,
  limit      = QDRANT_TOP_K,
): Promise<QdrantResult[]> {
  const subjectFilter = subject  ? [{ key: "subject", match: { value: subject  } }] : [];
  const classFilter   = classVal ? [{ key: "class",   match: { value: classVal } }] : [];

  // Pass 1 — fully filtered
  if (subjectFilter.length || classFilter.length) {
    const r1 = await qdrantSearchRaw(dense, [...subjectFilter, ...classFilter], limit);
    const best1 = r1[0];
    if (best1 && best1.score >= SCORE_THRESHOLD) {
      console.log(`[Qdrant] Soft-filter pass 1 hit (score: ${best1.score.toFixed(3)})`);
      return r1;
    }
    console.log(`[Qdrant] Pass 1 miss (best: ${best1?.score?.toFixed(3) ?? "—"}) — trying pass 2`);
  }

  // Pass 2 — class only (subject name may not match database value)
  if (classFilter.length) {
    const r2 = await qdrantSearchRaw(dense, classFilter, limit);
    const best2 = r2[0];
    if (best2 && best2.score >= SCORE_THRESHOLD) {
      console.log(`[Qdrant] Soft-filter pass 2 hit (class-only, score: ${best2.score.toFixed(3)})`);
      return r2;
    }
    console.log(`[Qdrant] Pass 2 miss (best: ${best2?.score?.toFixed(3) ?? "—"}) — trying pass 3`);
  }

  // Pass 3 — no filters, pure semantic match
  const r3 = await qdrantSearchRaw(dense, [], limit);
  console.log(`[Qdrant] Soft-filter pass 3 (unfiltered, best: ${r3[0]?.score?.toFixed(3) ?? "—"})`);
  return r3;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function rpc(
  sb:     SupabaseClient,
  fn:     string,
  params: Record<string, unknown>,
): Promise<unknown[]> {
  try {
    const { data, error } = await sb.rpc(fn, params);
    if (error) { console.warn(`[RPC] ${fn}:`, error.message); return []; }
    return data ?? [];
  } catch (err) {
    console.warn(`[RPC] ${fn} exception:`, err);
    return [];
  }
}

async function fetchTopicContext(
  sb:      SupabaseClient,
  topicId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await sb.rpc("get_topic_context", { p_topic_id: topicId });
    if (error) { console.warn("[RPC] get_topic_context:", error.message); return null; }
    return (data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

async function fetchProgressSafe(
  sb:       SupabaseClient,
  userId:   string,
  subject?: string,
  classVal?: string,
): Promise<unknown[]> {
  return Promise.race([
    rpc(sb, "get_student_progress", {
      p_user_id:      userId,
      subject_filter: subject  ?? "",
      class_filter:   classVal ?? "",
    }),
    new Promise<unknown[]>(resolve =>
      setTimeout(() => resolve([]), PROGRESS_TIMEOUT_MS)
    ),
  ]);
}

// ── Concept anchor selection ──────────────────────────────────────────────────
// Prefer the concept whose name appears in the query; fall back to longest
// partial word match; final fallback is first concept alphabetically.

function pickAnchorConcept(
  concepts: ConceptNode[],
  query:    string,
): ConceptNode | undefined {
  if (!concepts.length) return undefined;
  const q     = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 3);

  return (
    concepts.find(c => q.includes(c.name.toLowerCase()))
    ?? concepts.find(c => words.some(w => c.name.toLowerCase().includes(w)))
    ?? concepts[0]
  );
}

// ── Difficulty inference from student progress ────────────────────────────────

function inferDifficulty(
  progress:  unknown[],
  topicName: string,
): "low" | "medium" | "high" | undefined {
  const match = (progress as Array<{ topic?: string; mastery_pct?: number }>)
    .find(p => p.topic?.toLowerCase() === topicName.toLowerCase());
  if (!match?.mastery_pct) return undefined;
  return match.mastery_pct < 30 ? "low" : match.mastery_pct < 70 ? "medium" : "high";
}

// ── Shape adapter ─────────────────────────────────────────────────────────────
// buildQueryContext uses concept anchor from topicContext.concepts (already
// ConceptNode shape). Qdrant results become the topics array.

function qdrantToTopicNode(r: QdrantResult): TopicNode {
  return {
    topic_id:                r.payload.topic_id,
    subject:                 r.payload.subject,
    class:                   r.payload.class,
    term:                    r.payload.term,
    theme:                   r.payload.theme,
    topic:                   r.payload.topic,
    periods:                 r.payload.periods,
    sequence_position:       r.payload.sequence_position,
    concept_count:           r.payload.concept_count,
    outcome_count:           r.payload.outcome_count,
    blooms_tag_count:        0,
    application_count:       0,
    activity_count:          r.payload.activity_count,
    difficulty_distribution: {},
    blooms_levels_covered:   [],
    similarity:              r.score,
  };
}

// ── QUERY mode ────────────────────────────────────────────────────────────────
// Concept-level granularity: find topic via Qdrant, anchor on best concept
// match within that topic, then build outward — prereqs + cross-subject links.

export async function buildQueryContext(
  sb:        SupabaseClient,
  query:     string,
  subject?:  string,
  classVal?: string,
  userId?:   string,
): Promise<BuiltContext> {
  const t0  = Date.now();
  const key = _cacheKey("query", query, subject, classVal);
  const hit = _cacheGet(key);
  if (hit) { console.log("[Context/query] cache hit"); return hit; }

  const embedding = await embedQuery(query);
  if (!embedding) {
    console.warn("[Context/query] no embedding — returning empty context");
    return { found: false, concepts: [], topics: [] };
  }

  // Qdrant search + student progress in parallel
  const [qdrantResults, studentProgress] = await Promise.all([
    qdrantSearch(embedding, subject, classVal),
    userId
      ? fetchProgressSafe(sb, userId, subject, classVal)
      : Promise.resolve([]),
  ]);

  const best = qdrantResults[0];
  if (!best || best.score < SCORE_THRESHOLD) {
    console.log(`[Context/query] no match above threshold (best: ${best?.score?.toFixed(3) ?? "—"}) in ${Date.now() - t0}ms`);
    const result: BuiltContext = {
      found:           false,
      concepts:        [],
      topics:          qdrantResults.map(qdrantToTopicNode),
      studentProgress,
    };
    _cacheSet(key, result);
    return result;
  }

  // ── Sequential: full topic context + prerequisites + cross-subject ─────────
  let topicContext: any = null;
  try {
    const r = await sb.rpc("get_topic_context", { p_topic_id: best.payload.topic_id });
    topicContext = r.data ?? null;
  } catch { /* ignore */ }

  const rawConcepts = (topicContext?.concepts as ConceptNode[]) ?? [];
  const anchor = rawConcepts.length > 0 ? rawConcepts[0] : null;

  const [prerequisites, crossSubject] = await Promise.all([
    anchor
      ? rpc(sb, "get_prerequisites", { p_node_id: anchor.node_id, max_depth: PREREQ_DEPTH })
      : Promise.resolve([]),
    anchor
      ? rpc(sb, "get_interdisciplinary_links", { p_node_id: anchor.node_id })
      : Promise.resolve([]),
  ]);

  console.log(
    `[Context/query] ${Date.now() - t0}ms | ` +
    `topic: ${best.payload.topic} (${best.score.toFixed(3)}) | ` +
    `anchor: "${anchor?.name ?? "—"}" | ` +
    `prereqs: ${prerequisites.length} | cross: ${crossSubject.length}`
  );

  const result: BuiltContext = {
    found:           true,
    subject:         best.payload.subject,
    class:           best.payload.class,
    term:            best.payload.term,
    topic:           best.payload.topic,
    topicContext:    topicContext ?? undefined,
    concepts:        rawConcepts,
    topics:          qdrantResults.map(qdrantToTopicNode),
    prerequisites,
    crossSubject,
    studentProgress,
    bestTopicId:     best.payload.topic_id,
    bestConceptId:   anchor?.node_id,
  };
  _cacheSet(key, result);
  return result;
}

// ── QUIZ mode ─────────────────────────────────────────────────────────────────
// Outcome-level granularity: find topic, infer or accept difficulty,
// fetch quiz outcomes with distractor hints for MCQ generation.

export async function buildQuizContext(
  sb:          SupabaseClient,
  query:       string,
  subject?:    string,
  classVal?:   string,
  userId?:     string,
  difficulty?: "low" | "medium" | "high",
): Promise<BuiltContext> {
  const t0  = Date.now();
  const key = _cacheKey("quiz", query, subject, classVal);
  const hit = _cacheGet(key);
  if (hit) { console.log("[Context/quiz] cache hit"); return hit; }

  const embedding = await embedQuery(query);
  if (!embedding) {
    return { found: false, concepts: [], topics: [] };
  }

  const [qdrantResults, studentProgress] = await Promise.all([
    qdrantSearch(embedding, subject, classVal),
    userId
      ? fetchProgressSafe(sb, userId, subject, classVal)
      : Promise.resolve([]),
  ]);

  const best = qdrantResults[0];
  if (!best || best.score < SCORE_THRESHOLD) {
    console.log(`[Context/quiz] no match (best: ${best?.score?.toFixed(3) ?? "—"}) in ${Date.now() - t0}ms`);
    const result: BuiltContext = {
      found: false, concepts: [], topics: qdrantResults.map(qdrantToTopicNode), studentProgress,
    };
    _cacheSet(key, result);
    return result;
  }

  const effectiveDifficulty =
    difficulty ?? inferDifficulty(studentProgress, best.payload.topic);

  if (effectiveDifficulty && !difficulty) {
    console.log(`[Context/quiz] inferred difficulty: ${effectiveDifficulty}`);
  }

  const [topicContext, quizOutcomes] = await Promise.all([
    fetchTopicContext(sb, best.payload.topic_id),
    rpc(sb, "get_quiz_outcomes", {
      p_topic_id:        best.payload.topic_id,
      difficulty_filter: effectiveDifficulty ?? "",
      blooms_filter:     "",
      result_limit:      12,
    }),
  ]);

  console.log(
    `[Context/quiz] ${Date.now() - t0}ms | ` +
    `topic: ${best.payload.topic} (${best.score.toFixed(3)}) | ` +
    `outcomes: ${quizOutcomes.length} | difficulty: ${effectiveDifficulty ?? "any"}`
  );

  const result: BuiltContext = {
    found:           true,
    subject:         best.payload.subject,
    class:           best.payload.class,
    term:            best.payload.term,
    topic:           best.payload.topic,
    topicContext:    topicContext ?? undefined,
    concepts:        [],
    topics:          qdrantResults.map(qdrantToTopicNode),
    quizOutcomes,
    studentProgress,
    bestTopicId:     best.payload.topic_id,
  };
  _cacheSet(key, result);
  return result;
}

// ── TEACHER mode ──────────────────────────────────────────────────────────────
// Breadth-first: fetch full context for top N topics + sequence neighbours.
// Raw text fields (outcomes_raw, activities_raw, assessment_raw) are passed
// through to the teacher prompt for professional document generation.

export async function buildTeacherContext(
  sb:        SupabaseClient,
  query:     string,
  subject?:  string,
  classVal?: string,
): Promise<BuiltContext> {
  const t0  = Date.now();
  const key = _cacheKey("teacher", query, subject, classVal);
  const hit = _cacheGet(key);
  if (hit) { console.log("[Context/teacher] cache hit"); return hit; }

  const embedding = await embedQuery(query);
  if (!embedding) {
    return { found: false, concepts: [], topics: [] };
  }

  const qdrantResults = await qdrantSearch(
    embedding, subject, classVal, TEACHER_TOPIC_LIMIT + 2
  );

  const best = qdrantResults[0];
  if (!best || best.score < SCORE_THRESHOLD) {
    console.log(`[Context/teacher] no match (best: ${best?.score?.toFixed(3) ?? "—"}) in ${Date.now() - t0}ms`);
    const result: BuiltContext = {
      found: false, concepts: [], topics: qdrantResults.map(qdrantToTopicNode),
    };
    _cacheSet(key, result);
    return result;
  }

  // Full context for top N + sequence neighbours in parallel
  const [topContexts, neighbours] = await Promise.all([
    Promise.all(
      qdrantResults
        .slice(0, TEACHER_TOPIC_LIMIT)
        .map(r => fetchTopicContext(sb, r.payload.topic_id))
    ),
    rpc(sb, "get_topic_neighbours", { p_topic_id: best.payload.topic_id }),
  ]);

  const validContexts = topContexts.filter(
    (c): c is Record<string, unknown> => c !== null
  );

  console.log(
    `[Context/teacher] ${Date.now() - t0}ms | ` +
    `topic: ${best.payload.topic} (${best.score.toFixed(3)}) | ` +
    `contexts: ${validContexts.length} | neighbours: ${neighbours.length}`
  );

  const result: BuiltContext = {
    found:             true,
    subject:           best.payload.subject,
    class:             best.payload.class,
    term:              best.payload.term,
    topic:             best.payload.topic,
    topicContext:      validContexts[0],
    allTopicContexts:  validContexts,
    concepts:          [],
    topics:            qdrantResults.map(qdrantToTopicNode),
    crossSubject:      neighbours,   // sequence neighbours reuse this field
    bestTopicId:       best.payload.topic_id,
  };
  _cacheSet(key, result);
  return result;
}

// ── Mode dispatcher ───────────────────────────────────────────────────────────
// Signature kept identical to the original for drop-in replacement.
// topicHint param accepted but not used — Qdrant semantic search makes it
// redundant; kept so callers don't need updating.

export async function buildContext(
  mode:        Mode,
  sb:          SupabaseClient,
  query:       string,
  subject?:    string,
  classVal?:   string,
  userId?:     string,
  difficulty?: "low" | "medium" | "high",
  _topicHint?: string,   // deprecated — no-op
): Promise<BuiltContext> {
  switch (mode) {
    case "quiz":
      return buildQuizContext(sb, query, subject, classVal, userId, difficulty);
    case "teacher":
      return buildTeacherContext(sb, query, subject, classVal);
    case "query":
    default:
      return buildQueryContext(sb, query, subject, classVal, userId);
  }
}
