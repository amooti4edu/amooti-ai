// ============================================================================
//  context-builder.ts
//  Assembles curriculum context from Supabase before the LLM call.
//  Three modes — each calls a different combination of RPCs.
//  Context is always built first. Tools are a fallback only.
// ============================================================================

import { embedQuery }         from "./embedding.ts";
import {
  SIMILARITY_THRESHOLD,
  CONCEPT_MATCH_COUNT,
  TOPIC_MATCH_COUNT,
  PREREQ_DEPTH,
  PROGRESS_TIMEOUT_MS,
  type Mode,
} from "./models.config.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  topic_id:               string;
  subject:                string;
  class:                  string;
  term:                   string;
  theme:                  string;
  topic:                  string;
  periods:                string;
  sequence_position:      number;
  concept_count:          number;
  outcome_count:          number;
  blooms_tag_count:       number;
  application_count:      number;
  activity_count:         number;
  difficulty_distribution: Record<string, number>;
  blooms_levels_covered:  string[];
  similarity:             number;
}

export interface BuiltContext {
  // What was found
  found:           boolean;
  subject?:        string;
  class?:          string;
  term?:           string;
  topic?:          string;

  // Core content
  topicContext?:   Record<string, unknown>;   // full get_topic_context result
  concepts:        ConceptNode[];
  topics:          TopicNode[];

  // Relational context (query mode)
  prerequisites?:  unknown[];
  crossSubject?:   unknown[];

  // Quiz-specific
  quizOutcomes?:   unknown[];

  // Student state (optional — only if authenticated + fetched in time)
  studentProgress?: unknown[];

  // For prompts: best single topic/concept IDs
  bestTopicId?:    string;
  bestConceptId?:  string;
}

// ── RPC helper ────────────────────────────────────────────────────────────────

async function rpc(
  sb: any,
  fn: string,
  params: Record<string, unknown>
): Promise<unknown[]> {
  try {
    const { data, error } = await sb.rpc(fn, params);
    if (error) {
      console.warn(`[RPC] ${fn} error:`, error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn(`[RPC] ${fn} exception:`, err);
    return [];
  }
}

// ── Progress fetch with timeout ───────────────────────────────────────────────

async function fetchProgressSafe(
  sb:        any,
  userId:    string,
  subject?:  string,
  classVal?: string
): Promise<unknown[]> {
  try {
    const result = await Promise.race([
      rpc(sb, "get_student_progress", {
        p_user_id:      userId,
        subject_filter: subject  ?? "",
        class_filter:   classVal ?? "",
      }),
      new Promise<unknown[]>((resolve) =>
        setTimeout(() => resolve([]), PROGRESS_TIMEOUT_MS)
      ),
    ]);
    return result as unknown[];
  } catch {
    return [];
  }
}

// ── Query context ─────────────────────────────────────────────────────────────
// Concept-level granularity: find what the student is asking about,
// then build outward — topic context, prerequisites, cross-subject links.

export async function buildQueryContext(
  sb:        any,
  query:     string,
  subject?:  string,
  classVal?: string,
  userId?:   string,
): Promise<BuiltContext> {
  const t0 = Date.now();

  const embedding = await embedQuery(query);
  if (!embedding) {
    console.warn("[Context/query] No embedding — returning empty context");
    return { found: false, concepts: [], topics: [] };
  }

  // ── Parallel: concept search + topic search + student progress ────────────
  const [concepts, topics, studentProgress] = await Promise.all([
    rpc(sb, "match_concept_nodes", {
      query_embedding: embedding,
      match_count:     CONCEPT_MATCH_COUNT,
      subject_filter:  subject  ?? "",
      class_filter:    classVal ?? "",
      min_similarity:  SIMILARITY_THRESHOLD,
    }) as Promise<ConceptNode[]>,

    rpc(sb, "match_topic_nodes", {
      query_embedding: embedding,
      match_count:     TOPIC_MATCH_COUNT,
      subject_filter:  subject  ?? "",
      class_filter:    classVal ?? "",
      min_similarity:  SIMILARITY_THRESHOLD,
    }) as Promise<TopicNode[]>,

    userId
      ? fetchProgressSafe(sb, userId, subject, classVal)
      : Promise.resolve([]),
  ]);

  const bestTopic   = (topics   as TopicNode[])[0];
  const bestConcept = (concepts as ConceptNode[])[0];

  if (!bestTopic && !bestConcept) {
    console.log(`[Context/query] No matches above threshold in ${Date.now() - t0}ms`);
    return { found: false, concepts: concepts as ConceptNode[], topics: topics as TopicNode[], studentProgress };
  }

  // ── Sequential: full topic context + prerequisites + cross-subject ─────────
  // These depend on having a topic/concept ID, so they run after the parallel batch
  const [topicContext, prerequisites, crossSubject] = await Promise.all([
    bestTopic
      ? sb.rpc("get_topic_context", { p_topic_id: bestTopic.topic_id })
          .then((r: any) => r.data ?? null)
          .catch(() => null)
      : Promise.resolve(null),

    bestConcept
      ? rpc(sb, "get_prerequisites", {
          p_node_id: bestConcept.node_id,
          max_depth: PREREQ_DEPTH,
        })
      : Promise.resolve([]),

    bestConcept
      ? rpc(sb, "get_interdisciplinary_links", {
          p_node_id: bestConcept.node_id,
        })
      : Promise.resolve([]),
  ]);

  console.log(
    `[Context/query] Built in ${Date.now() - t0}ms | ` +
    `topic: ${bestTopic?.topic ?? "—"} | ` +
    `concepts: ${(concepts as ConceptNode[]).length} | ` +
    `prereqs: ${(prerequisites as unknown[]).length} | ` +
    `cross: ${(crossSubject as unknown[]).length}`
  );

  return {
    found:           true,
    subject:         bestTopic?.subject ?? bestConcept?.subject,
    class:           bestTopic?.class   ?? bestConcept?.class,
    term:            bestTopic?.term    ?? bestConcept?.term,
    topic:           bestTopic?.topic   ?? bestConcept?.topic,
    topicContext,
    concepts:        concepts as ConceptNode[],
    topics:          topics   as TopicNode[],
    prerequisites,
    crossSubject,
    studentProgress: studentProgress as unknown[],
    bestTopicId:     bestTopic?.topic_id,
    bestConceptId:   bestConcept?.node_id,
  };
}

// ── Quiz context ──────────────────────────────────────────────────────────────
// Outcome-level granularity: find the topic, get outcomes filtered by
// difficulty. Distractor hints feed directly into MCQ generation.

export async function buildQuizContext(
  sb:         any,
  query:      string,
  subject?:   string,
  classVal?:  string,
  userId?:    string,
  difficulty?: "low" | "medium" | "high",
  topicHint?: string,
): Promise<BuiltContext> {
  const t0 = Date.now();

  const embedding = await embedQuery(query);
  if (!embedding) {
    return { found: false, concepts: [], topics: [] };
  }

  // ── Parallel: topic search + student progress ─────────────────────────────
  const [topics, studentProgress] = await Promise.all([
    rpc(sb, "match_topic_nodes", {
      query_embedding: embedding,
      match_count:     TOPIC_MATCH_COUNT,
      subject_filter:  subject  ?? "",
      class_filter:    classVal ?? "",
      min_similarity:  SIMILARITY_THRESHOLD,
    }) as Promise<TopicNode[]>,

    userId
      ? fetchProgressSafe(sb, userId, subject, classVal)
      : Promise.resolve([]),
  ]);

  const bestTopic = (topics as TopicNode[])[0];
  if (!bestTopic) {
    return { found: false, concepts: [], topics: topics as TopicNode[], studentProgress };
  }

  // ── Infer difficulty from student progress if not specified ───────────────
  let effectiveDifficulty = difficulty;
  if (!effectiveDifficulty && (studentProgress as unknown[]).length > 0) {
    const progress = studentProgress as Array<{ mastery_pct: number }>;
    const topicProgress = progress.find((p: any) =>
      p.topic?.toLowerCase() === bestTopic.topic.toLowerCase()
    );
    if (topicProgress) {
      const pct = topicProgress.mastery_pct ?? 0;
      effectiveDifficulty = pct < 30 ? "low" : pct < 70 ? "medium" : "high";
      console.log(`[Context/quiz] Inferred difficulty: ${effectiveDifficulty} from ${pct}% mastery`);
    }
  }

  // ── Sequential: full topic context + quiz outcomes ────────────────────────
  const [topicContext, quizOutcomes] = await Promise.all([
    sb.rpc("get_topic_context", { p_topic_id: bestTopic.topic_id })
      .then((r: any) => r.data ?? null)
      .catch(() => null),

    rpc(sb, "get_quiz_outcomes", {
      p_topic_id:        bestTopic.topic_id,
      difficulty_filter: effectiveDifficulty ?? "",
      blooms_filter:     "",
      result_limit:      12,
    }),
  ]);

  console.log(
    `[Context/quiz] Built in ${Date.now() - t0}ms | ` +
    `topic: ${bestTopic.topic} | ` +
    `outcomes: ${(quizOutcomes as unknown[]).length} | ` +
    `difficulty: ${effectiveDifficulty ?? "any"}`
  );

  return {
    found:           true,
    subject:         bestTopic.subject,
    class:           bestTopic.class,
    term:            bestTopic.term,
    topic:           bestTopic.topic,
    topicContext,
    concepts:        [],
    topics:          topics as TopicNode[],
    quizOutcomes,
    studentProgress: studentProgress as unknown[],
    bestTopicId:     bestTopic.topic_id,
  };
}

// ── Teacher context ───────────────────────────────────────────────────────────
// Topic-level granularity: full context for one or more topics including
// raw text fields, activities, and assessment strategies.

export async function buildTeacherContext(
  sb:        any,
  query:     string,
  subject?:  string,
  classVal?: string,
  topicHint?: string,
): Promise<BuiltContext> {
  const t0 = Date.now();

  const embedding = await embedQuery(query);
  if (!embedding) {
    return { found: false, concepts: [], topics: [] };
  }

  const topics = await rpc(sb, "match_topic_nodes", {
    query_embedding: embedding,
    match_count:     5,   // teacher may need multiple topics for a scheme
    subject_filter:  subject  ?? "",
    class_filter:    classVal ?? "",
    min_similarity:  SIMILARITY_THRESHOLD,
  }) as TopicNode[];

  if (!topics.length) {
    return { found: false, concepts: [], topics: [] };
  }

  // ── Fetch full context for up to 3 topics in parallel ────────────────────
  const topContexts = await Promise.all(
    topics.slice(0, 3).map((t) =>
      sb.rpc("get_topic_context", { p_topic_id: t.topic_id })
        .then((r: any) => r.data ?? null)
        .catch(() => null)
    )
  );

  // ── Also get sequence neighbours for the primary topic ───────────────────
  const neighbours = await rpc(sb, "get_topic_neighbours", {
    p_topic_id: topics[0].topic_id,
  });

  console.log(
    `[Context/teacher] Built in ${Date.now() - t0}ms | ` +
    `topics: ${topics.length} | ` +
    `full contexts: ${topContexts.filter(Boolean).length}`
  );

  return {
    found:        true,
    subject:      topics[0].subject,
    class:        topics[0].class,
    term:         topics[0].term,
    topic:        topics[0].topic,
    topicContext: topContexts[0],             // primary topic for the prompt
    concepts:     [],
    topics,
    crossSubject: neighbours,                 // used as sequence context
    bestTopicId:  topics[0].topic_id,
    // Pass all topic contexts as extra field for teacher prompt
    ...(topContexts.length > 1 && { allTopicContexts: topContexts }),
  } as BuiltContext & { allTopicContexts?: unknown[] };
}

// ── Mode dispatcher ───────────────────────────────────────────────────────────

export async function buildContext(
  mode:       Mode,
  sb:         any,
  query:      string,
  subject?:   string,
  classVal?:  string,
  userId?:    string,
  difficulty?: "low" | "medium" | "high",
  topicHint?: string,
): Promise<BuiltContext> {
  switch (mode) {
    case "quiz":
      return buildQuizContext(sb, query, subject, classVal, userId, difficulty, topicHint);
    case "teacher":
      return buildTeacherContext(sb, query, subject, classVal, topicHint);
    case "query":
    default:
      return buildQueryContext(sb, query, subject, classVal, userId);
  }
}
