// ============================================================================
//  harness.ts  v4 — Qdrant + Supabase hybrid
//
//  Flow:
//    1. Embed query with BGE-M3 (OpenRouter) — dense vector
//    2. Qdrant hybrid search (dense + approx sparse, RRF) → best topic_id
//    3. Supabase RPCs → full context, prerequisites, cross-subject links
//
//  Run: npx ts-node harness.ts
// ============================================================================

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.SUPABASE_URL        ?? "https://ehswpksboxyzqztdhofh.supabase.co";
const SUPABASE_KEY        = process.env.SUPABASE_KEY        ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3dwa3Nib3h5enF6dGRob2ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE0Mzk1NCwiZXhwIjoyMDg2NzE5OTU0fQ.6U7F_MNoZMrly24Tk4k8TQbKOTrM9rgHsSnZxP8xpYE";
const OPENROUTER_API_KEY  = process.env.OPENROUTER_API_KEY  ?? "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";
const QDRANT_URL         = "https://3a438841-fc3f-4f83-bbd8-cd7c591dcd30.europe-west3-0.gcp.cloud.qdrant.io:6333";
const QDRANT_KEY         = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.j9fho2p9R37D8Oxc57T0ivjmYavjVvTohVL1QepW-j4";
const QDRANT_COLLECTION  = "curriculum_topics";

if (!process.env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = OPENROUTER_API_KEY;

// ── Constants ─────────────────────────────────────────────────────────────────

const QDRANT_TOP_K        = 5;
const QDRANT_SCORE_MIN    = 0.5;
const QDRANT_TIMEOUT_MS   = 8000;
const QDRANT_RETRIES      = 2;
const QUERY_DELAY_MS      = 600;   // pause between harness queries
const PREREQ_DEPTH        = 2;
const PROGRESS_TIMEOUT_MS = 300;

// ── Types ─────────────────────────────────────────────────────────────────────

interface QdrantResult {
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

interface BuiltContext {
  found:            boolean;
  subject?:         string;
  class?:           string;
  term?:            string;
  topic?:           string;
  qdrantScore?:     number;
  topicContext?:    Record<string, unknown>;
  topics:           QdrantResult[];
  concepts:         unknown[];
  prerequisites?:   unknown[];
  crossSubject?:    unknown[];
  quizOutcomes?:    unknown[];
  studentProgress?: unknown[];
  bestTopicId?:     string;
  bestConceptId?:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.warn("[Embed] OPENROUTER_API_KEY not set"); return null; }

  console.log(`[Embed] "${text.slice(0, 60)}…"`);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ model: "baai/bge-m3", input: text }),
    });
    if (!res.ok) { console.warn(`[Embed] error ${res.status}`); return null; }
    const data  = await res.json();
    const dense: number[] = data.data?.[0]?.embedding ?? null;
    if (!dense || dense.length !== 1024) { console.warn("[Embed] unexpected response"); return null; }
    console.log(`[Embed] ✓ 1024d`);
    return dense;
  } catch (err) {
    console.warn("[Embed] exception:", err);
    return null;
  }
}

// ── Qdrant search — dense only, with retry ────────────────────────────────────

async function qdrantSearch(
  dense:     number[],
  subject?:  string,
  classVal?: string,
  limit      = QDRANT_TOP_K,
): Promise<QdrantResult[]> {
  const must: unknown[] = [];
  if (subject)  must.push({ key: "subject", match: { value: subject } });
  if (classVal) must.push({ key: "class",   match: { value: classVal } });

  // Dense-only query — no fusion, no approx sparse
  const body: Record<string, unknown> = {
    query:        dense,
    using:        "dense",
    limit,
    with_payload: true,
    ...(must.length ? { filter: { must } } : {}),
  };

  for (let attempt = 0; attempt <= QDRANT_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Qdrant] retry ${attempt}...`);
      await sleep(1000 * attempt);
    }
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), QDRANT_TIMEOUT_MS);

      const res = await fetch(
        `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/query`,
        {
          method:  "POST",
          headers: { "api-key": QDRANT_KEY, "Content-Type": "application/json" },
          body:    JSON.stringify(body),
          signal:  controller.signal,
        }
      );
      clearTimeout(timeout);

      if (res.status === 502 || res.status === 503) {
        console.warn(`[Qdrant] ${res.status} — will retry`);
        continue;
      }
      if (!res.ok) {
        console.warn(`[Qdrant] ${res.status}:`, await res.text());
        return [];
      }
      const data = await res.json();
      return (data.result?.points ?? []) as QdrantResult[];
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.warn(`[Qdrant] timeout after ${QDRANT_TIMEOUT_MS}ms`);
      } else {
        console.warn("[Qdrant] exception:", err);
      }
    }
  }
  console.warn("[Qdrant] all retries exhausted");
  return [];
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function rpc(sb: any, fn: string, params: Record<string, unknown>): Promise<unknown[]> {
  try {
    const { data, error } = await sb.rpc(fn, params);
    if (error) { console.warn(`[RPC] ${fn}:`, error.message); return []; }
    return data ?? [];
  } catch (err) { console.warn(`[RPC] ${fn}:`, err); return []; }
}

async function fetchTopicContext(sb: any, topicId: string): Promise<Record<string, unknown> | null> {
  try {
    const { data } = await sb.rpc("get_topic_context", { p_topic_id: topicId });
    return data ?? null;
  } catch { return null; }
}

async function fetchProgressSafe(
  sb: any, userId: string, subject?: string, classVal?: string
): Promise<unknown[]> {
  try {
    return await Promise.race([
      rpc(sb, "get_student_progress", {
        p_user_id: userId, subject_filter: subject ?? "", class_filter: classVal ?? "",
      }),
      new Promise<unknown[]>(resolve => setTimeout(() => resolve([]), PROGRESS_TIMEOUT_MS)),
    ]);
  } catch { return []; }
}

function inferDifficulty(
  progress: unknown[], topicName: string
): "low" | "medium" | "high" | undefined {
  const match = (progress as Array<{ topic?: string; mastery_pct?: number }>)
    .find(p => p.topic?.toLowerCase() === topicName.toLowerCase());
  if (!match) return undefined;
  const pct = match.mastery_pct ?? 0;
  return pct < 30 ? "low" : pct < 70 ? "medium" : "high";
}

// Pick best concept anchor: prefer concept whose name appears in the query,
// fallback to the concept with the most specific/longest name match
function pickAnchorConcept(concepts: any[], query: string): any | undefined {
  if (!concepts.length) return undefined;
  const q = query.toLowerCase();

  // Exact word match first
  const exact = concepts.find(c => q.includes(c.name.toLowerCase()));
  if (exact) return exact;

  // Partial match — any query word appears in concept name
  const queryWords = q.split(/\s+/).filter(w => w.length > 3);
  const partial = concepts.find(c =>
    queryWords.some(w => c.name.toLowerCase().includes(w))
  );
  if (partial) return partial;

  // Fallback: first concept
  return concepts[0];
}

// ── Build functions ───────────────────────────────────────────────────────────

async function buildQueryContext(
  sb: any, query: string, subject?: string, classVal?: string, userId?: string
): Promise<BuiltContext> {
  const t0 = Date.now();
  const dense = await embedQuery(query);
  if (!dense) return { found: false, concepts: [], topics: [] };

  const [qdrantResults, studentProgress] = await Promise.all([
    qdrantSearch(dense, subject, classVal),
    userId ? fetchProgressSafe(sb, userId, subject, classVal) : Promise.resolve([]),
  ]);

  const best = qdrantResults[0];
  if (!best || best.score < QDRANT_SCORE_MIN) {
    console.log(`[Query] No match (best: ${best?.score?.toFixed(3) ?? "none"}) in ${Date.now() - t0}ms`);
    return { found: false, concepts: [], topics: qdrantResults, studentProgress };
  }

  const topicContext  = await fetchTopicContext(sb, best.payload.topic_id);
  const topicConcepts = (topicContext?.concepts as any[]) ?? [];
  const anchor        = pickAnchorConcept(topicConcepts, query);
  const anchorId      = anchor?.node_id as string | undefined;

  const [prerequisites, crossSubject] = await Promise.all([
    anchorId
      ? rpc(sb, "get_prerequisites",           { p_node_id: anchorId, max_depth: PREREQ_DEPTH })
      : Promise.resolve([]),
    anchorId
      ? rpc(sb, "get_interdisciplinary_links",  { p_node_id: anchorId })
      : Promise.resolve([]),
  ]);

  console.log(
    `[Query] ${Date.now() - t0}ms | ${best.payload.topic} | score: ${best.score.toFixed(3)} | ` +
    `anchor: "${anchor?.name ?? "—"}" | prereqs: ${prerequisites.length} | cross: ${crossSubject.length}`
  );

  return {
    found: true,
    subject: best.payload.subject, class: best.payload.class,
    term:    best.payload.term,    topic: best.payload.topic,
    qdrantScore: best.score,
    topicContext, concepts: topicConcepts, topics: qdrantResults,
    prerequisites, crossSubject, studentProgress,
    bestTopicId: best.payload.topic_id, bestConceptId: anchorId,
  };
}

async function buildQuizContext(
  sb: any, query: string, subject?: string, classVal?: string,
  userId?: string, difficulty?: "low" | "medium" | "high"
): Promise<BuiltContext> {
  const t0 = Date.now();
  const dense = await embedQuery(query);
  if (!dense) return { found: false, concepts: [], topics: [] };

  const [qdrantResults, studentProgress] = await Promise.all([
    qdrantSearch(dense, subject, classVal),
    userId ? fetchProgressSafe(sb, userId, subject, classVal) : Promise.resolve([]),
  ]);

  const best = qdrantResults[0];
  if (!best || best.score < QDRANT_SCORE_MIN) {
    console.log(`[Quiz] No match (best: ${best?.score?.toFixed(3) ?? "none"}) in ${Date.now() - t0}ms`);
    return { found: false, concepts: [], topics: qdrantResults, studentProgress };
  }

  const effectiveDifficulty = difficulty ?? inferDifficulty(studentProgress, best.payload.topic);
  if (effectiveDifficulty && !difficulty) {
    console.log(`[Quiz] Inferred difficulty: ${effectiveDifficulty}`);
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
    `[Quiz] ${Date.now() - t0}ms | ${best.payload.topic} | score: ${best.score.toFixed(3)} | ` +
    `outcomes: ${quizOutcomes.length} | difficulty: ${effectiveDifficulty ?? "any"}`
  );

  return {
    found: true,
    subject: best.payload.subject, class: best.payload.class,
    term:    best.payload.term,    topic: best.payload.topic,
    qdrantScore:  best.score,
    topicContext, concepts: [], topics: qdrantResults,
    quizOutcomes, studentProgress,
    bestTopicId:  best.payload.topic_id,
  };
}

async function buildTeacherContext(
  sb: any, query: string, subject?: string, classVal?: string
): Promise<BuiltContext> {
  const t0 = Date.now();
  const dense = await embedQuery(query);
  if (!dense) return { found: false, concepts: [], topics: [] };

  const qdrantResults = await qdrantSearch(dense, subject, classVal, 5);

  const best = qdrantResults[0];
  if (!best || best.score < QDRANT_SCORE_MIN) {
    console.log(`[Teacher] No match (best: ${best?.score?.toFixed(3) ?? "none"}) in ${Date.now() - t0}ms`);
    return { found: false, concepts: [], topics: qdrantResults };
  }

  const [topContexts, neighbours] = await Promise.all([
    Promise.all(qdrantResults.slice(0, 3).map(r => fetchTopicContext(sb, r.payload.topic_id))),
    rpc(sb, "get_topic_neighbours", { p_topic_id: best.payload.topic_id }),
  ]);

  console.log(
    `[Teacher] ${Date.now() - t0}ms | ${best.payload.topic} | score: ${best.score.toFixed(3)} | ` +
    `contexts: ${topContexts.filter(Boolean).length}`
  );

  return {
    found: true,
    subject: best.payload.subject, class: best.payload.class,
    term:    best.payload.term,    topic: best.payload.topic,
    qdrantScore:  best.score,
    topicContext: topContexts[0] ?? undefined,
    concepts: [], topics: qdrantResults, crossSubject: neighbours,
    bestTopicId: best.payload.topic_id,
    ...(topContexts.length > 1 && { allTopicContexts: topContexts.filter(Boolean) }),
  } as BuiltContext & { allTopicContexts?: unknown[] };
}

// ── Queries ───────────────────────────────────────────────────────────────────

const QUERIES = [
  {
    mode: "query" as const, label: "Student — meiosis (known topic)",
    query: "What is meiosis?", subject: "", class: "",
    userId: "0f5750ff-efe7-410b-a0f8-11c7f165b79d",
  },
  {
    mode: "query" as const, label: "Student — energy transfer (vague)",
    query: "How does energy transfer work?", subject: "", class: "", userId: undefined,
  },
  {
    mode: "query" as const, label: "Student — unknown topic",
    query: "Explain quantum chromodynamics in detail", subject: "", class: "", userId: undefined,
  },
  {
    mode: "quiz" as const, label: "Quiz — nitrogen cycle (not in curriculum)",
    query: "Quiz me on the nitrogen cycle", subject: "", class: "",
    userId: undefined, difficulty: "medium" as const,
  },
  {
    mode: "quiz" as const, label: "Quiz — forces and motion",
    query: "Test me on forces and motion", subject: "Physics", class: "Senior 2",
    userId: undefined, difficulty: undefined,
  },
  {
    mode: "teacher" as const, label: "Teacher — French Revolution scheme",
    query: "Create a scheme of work for the French Revolution", subject: "H&P", class: "",
  },
  {
    mode: "teacher" as const, label: "Teacher — Shakespeare activities",
    query: "Activities for teaching Shakespeare", subject: "", class: "",
  },
] as const;

// ── Token estimator ───────────────────────────────────────────────────────────

function estimateTokens(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Math.ceil(JSON.stringify(value).length / 4);
}

// ── Printer ───────────────────────────────────────────────────────────────────

function printSection(title: string, value: unknown, indent = 2) {
  const tokens = estimateTokens(value);
  const pad    = " ".repeat(indent);
  console.log(`${pad}┌─ ${title}  (~${tokens} tokens)`);
  if (value === null || value === undefined) {
    console.log(`${pad}│  (empty)`);
  } else if (Array.isArray(value)) {
    console.log(`${pad}│  ${value.length} item(s)`);
    if (value.length > 0)
      console.log(`${pad}│  sample[0]: ${JSON.stringify(value[0], null, 2).replace(/\n/g, `\n${pad}│  `)}`);
  } else if (typeof value === "object") {
    console.log(`${pad}│  ${JSON.stringify(value, null, 2).replace(/\n/g, `\n${pad}│  `)}`);
  } else {
    console.log(`${pad}│  ${value}`);
  }
  console.log(`${pad}└${"─".repeat(50)}`);
}

function printContextReport(label: string, mode: string, ctx: BuiltContext, ms: number) {
  const div = "═".repeat(70);
  console.log(`\n${div}`);
  console.log(`  MODE: ${mode.toUpperCase()}   |   ${label}`);
  console.log(`  Elapsed: ${ms}ms   |   found: ${ctx.found}   |   score: ${ctx.qdrantScore?.toFixed(3) ?? "—"}`);
  console.log(div);

  if (!ctx.found) {
    console.log("  ⚠  No matches above threshold.\n");
    if (ctx.topics.length) {
      console.log("  Best candidates returned:");
      (ctx.topics as QdrantResult[]).forEach(r =>
        console.log(`    score=${r.score.toFixed(3)} | ${r.payload.subject} | ${r.payload.topic}`)
      );
    }
    return;
  }

  console.log(`\n  IDENTITY`);
  console.log(`    subject: ${ctx.subject}  |  class: ${ctx.class}  |  term: ${ctx.term}`);
  console.log(`    topic:   ${ctx.topic}`);

  console.log(`\n  QDRANT CANDIDATES`);
  (ctx.topics as QdrantResult[]).forEach((r, i) =>
    console.log(`    [${i}] ${r.score.toFixed(3)} | ${r.payload.subject} | ${r.payload.class} | ${r.payload.topic}`)
  );

  console.log(`\n  TOKEN BREAKDOWN`);
  const fields: [string, unknown][] = [
    ["topicContext",    ctx.topicContext],
    ["concepts",       ctx.concepts],
    ["prerequisites",  ctx.prerequisites],
    ["crossSubject",   ctx.crossSubject],
    ["quizOutcomes",   ctx.quizOutcomes],
    ["studentProgress",ctx.studentProgress],
  ];
  let total = 0;
  const rows = fields.map(([name, val]) => {
    const tokens = estimateTokens(val);
    total += tokens;
    return { name, tokens, items: Array.isArray(val) ? val.length : "—" as const };
  });
  const maxName = Math.max(...rows.map(r => r.name.length));
  for (const r of rows) {
    const bar = "█".repeat(Math.min(30, Math.ceil((r.tokens / Math.max(total, 1)) * 30)));
    const pct = total > 0 ? ((r.tokens / total) * 100).toFixed(1) : "0.0";
    console.log(`    ${r.name.padEnd(maxName + 2)} ${String(r.tokens).padStart(6)} tok  ${pct.padStart(5)}%  ${bar}  items: ${r.items}`);
  }
  console.log(`    ${"─".repeat(maxName + 50)}`);
  console.log(`    ${"TOTAL".padEnd(maxName + 2)} ${String(total).padStart(6)} tok`);

  console.log(`\n  CONTENT DETAIL`);
  printSection("topicContext",    ctx.topicContext);
  printSection("concepts",        ctx.concepts);
  printSection("prerequisites",   ctx.prerequisites);
  printSection("crossSubject",    ctx.crossSubject);
  printSection("quizOutcomes",    ctx.quizOutcomes);
  printSection("studentProgress", ctx.studentProgress);
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function runHarness() {
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║         CONTEXT-BUILDER HARNESS v4 — Qdrant + Supabase             ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`\nSupabase: ${SUPABASE_URL}\nQdrant:   ${QDRANT_URL}\nQueries:  ${QUERIES.length}\n`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const summary: { label: string; mode: string; found: boolean; score: string; tokens: number; ms: number }[] = [];

  for (const q of QUERIES) {
    const t0 = Date.now();
    let ctx: BuiltContext;
    try {
      if      (q.mode === "query")   ctx = await buildQueryContext(sb, q.query, q.subject, q.class, q.userId);
      else if (q.mode === "quiz")    ctx = await buildQuizContext(sb, q.query, q.subject, q.class, q.userId, q.difficulty);
      else                           ctx = await buildTeacherContext(sb, q.query, q.subject, q.class);
    } catch (err) {
      console.error(`\n[ERROR] ${q.label}:`, err);
      continue;
    }

    const ms     = Date.now() - t0;
    const tokens = estimateTokens(ctx.topicContext) + estimateTokens(ctx.concepts) +
                   estimateTokens(ctx.prerequisites) + estimateTokens(ctx.crossSubject) +
                   estimateTokens(ctx.quizOutcomes)  + estimateTokens(ctx.studentProgress);

    printContextReport(q.label, q.mode, ctx, ms);
    summary.push({ label: q.label, mode: q.mode, found: ctx.found, score: ctx.qdrantScore?.toFixed(3) ?? "—", tokens, ms });

    // Pause between queries to avoid Qdrant rate limiting
    await sleep(QUERY_DELAY_MS);
  }

  console.log("\n\n" + "═".repeat(76));
  console.log("  SUMMARY");
  console.log("═".repeat(76));
  console.log("  " + "Label".padEnd(42) + "Mode".padEnd(9) + "Found".padEnd(7) + "Score".padEnd(8) + "Tokens".padEnd(9) + "Ms");
  console.log("  " + "─".repeat(74));
  for (const s of summary) {
    console.log(
      "  " + s.label.padEnd(42) + s.mode.padEnd(9) +
      (s.found ? "✓" : "✗").padEnd(7) + s.score.padEnd(8) +
      String(s.tokens).padEnd(9) + s.ms
    );
  }
  console.log("\nDone.\n");
}

runHarness().catch(console.error);