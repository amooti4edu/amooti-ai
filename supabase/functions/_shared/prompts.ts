// ============================================================================
//  prompts.ts
//  System prompt builders for query, quiz, and teacher modes.
//  Each mode gets a different identity, context block, and answer rules.
// ============================================================================

import type { BuiltContext } from "./context-builder.ts";
import type { Mode }         from "./models.config.ts";

// ── Shared identity ───────────────────────────────────────────────────────────

const AMOOTI_IDENTITY = `You are Amooti, a warm and encouraging AI study assistant for Uganda's O-Level secondary school students.
You have deep knowledge of all secondary school subjects taught in Uganda.
You speak directly to the student — "you", "let's", "notice that", "now try".
You are encouraging. If something is tricky, say so and slow down.
You connect what students are learning to their real lives in Uganda and East Africa.`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function section(title: string, content: string): string {
  return `
================================================================================
${title}
================================================================================
${content}`;
}

function jsonBlock(label: string, data: unknown): string {
  if (!data || (Array.isArray(data) && data.length === 0)) return "";
  return `\n${label}:\n${JSON.stringify(data, null, 2)}`;
}

function truncate(text: string, chars: number): string {
  return text.length > chars ? text.slice(0, chars) + "…" : text;
}

// ── Curriculum context block (shared across all modes) ────────────────────────

function buildCurriculumBlock(ctx: BuiltContext): string {
  if (!ctx.found) return "";

  const tc = ctx.topicContext as any;

  let block = `
Subject:  ${ctx.subject ?? "—"}
Class:    ${ctx.class   ?? "—"}
Term:     ${ctx.term    ?? "—"}
Topic:    ${ctx.topic   ?? "—"}`;

  if (tc?.topic) {
    const t = tc.topic as any;
    if (t.theme)    block += `\nTheme:    ${t.theme}`;
    if (t.periods)  block += `\nPeriods:  ${t.periods}`;
  }

  if (tc?.concepts?.length) {
    block += `\n\nKEY CONCEPTS:\n`;
    for (const c of tc.concepts.slice(0, 8)) {
      block += `  • ${c.name} — ${truncate(c.definition, 120)}\n`;
    }
  }

  if (tc?.outcomes?.length) {
    block += `\nLEARNING OUTCOMES (what students must achieve):\n`;
    for (const o of tc.outcomes) {
      block += `  [${o.difficulty?.toUpperCase() ?? "?"}] ${truncate(o.outcome_text, 140)}\n`;
    }
  }

  if (tc?.applications?.length) {
    block += `\nREAL-WORLD APPLICATIONS (use these to make it relatable):\n`;
    for (const a of tc.applications.slice(0, 3)) {
      block += `  • ${a.title} (${a.context}): ${truncate(a.explanation, 120)}\n`;
      if (a.wow_factor) block += `    Hook: ${a.wow_factor}\n`;
    }
  }

  if (ctx.prerequisites?.length) {
    block += `\nPREREQUISITE CONCEPTS (what students need to know first):\n`;
    for (const p of (ctx.prerequisites as any[]).slice(0, 5)) {
      block += `  • ${p.name} (${p.subject}, ${p.class}) — ${p.reason}\n`;
    }
  }

  if (ctx.crossSubject?.length) {
    block += `\nCROSS-SUBJECT CONNECTIONS (mention these naturally):\n`;
    for (const x of (ctx.crossSubject as any[]).slice(0, 4)) {
      block += `  • ${x.connected_name} in ${x.connected_subject}: ${truncate(x.student_explanation, 120)}\n`;
    }
  }

  return block;
}

// ── Student progress block ────────────────────────────────────────────────────

function buildProgressBlock(ctx: BuiltContext): string {
  if (!ctx.studentProgress?.length) return "";

  const progress = ctx.studentProgress as any[];
  const relevant = progress.filter((p) =>
    p.subject === ctx.subject && p.mastery_pct !== null
  ).slice(0, 5);

  if (!relevant.length) return "";

  let block = "STUDENT PROGRESS IN THIS SUBJECT:\n";
  for (const p of relevant) {
    const bar = "█".repeat(Math.round((p.mastery_pct ?? 0) / 10)) +
                "░".repeat(10 - Math.round((p.mastery_pct ?? 0) / 10));
    block += `  ${p.topic}: ${bar} ${p.mastery_pct ?? 0}% mastered `;
    block += `(${p.mastered ?? 0}/${p.total_outcomes ?? 0} outcomes)\n`;
  }
  block += `\nUse this to calibrate depth — revisit weak areas naturally.`;
  return block;
}

// ── QUERY mode prompt ─────────────────────────────────────────────────────────

export function buildQueryPrompt(ctx: BuiltContext, userRole: string): string {
  const curriculumBlock = buildCurriculumBlock(ctx);
  const progressBlock   = buildProgressBlock(ctx);

  const answerRules = `
Structure your answer like a great teacher explaining in class:

PREMISE — Set the scene first:
  Tell the student when this topic is studied, why it matters at this level,
  and what earlier knowledge it builds on (use the prerequisites above if available).

1. DEFINITION — One plain sentence that directly answers the question.
   Hook them immediately with a real-life Uganda/East Africa example.

2. EXPLANATION — Develop the concept step by step.
   One clear idea per paragraph. Build from what they already know.
   Use everyday analogies for abstract ideas ("think of it like…").
   Reference cross-subject connections naturally when relevant.

3. DEMONSTRATION — For topics involving calculations or processes:
   Walk through a worked example with real numbers. Show every step.
   Explain what you're doing at each step and why.

4. QUIZ — End with exactly 3 practice questions at the right difficulty.
   Keep them short. Don't give the answers — let the student try first.

FORMAT:
  • **Bold** key terms when first introduced
  • Numbered steps for processes and calculations
  • Bullet points for related items
  • $...$ for inline math, $$...$$ for display equations
  • Tables only when genuinely comparing multiple items
  • Length proportional to complexity — don't pad`;

  const toolNote = `
TOOLS (use only if the curriculum context above is genuinely insufficient):
  You have access to search_curriculum and get_topic_context.
  Try to answer from the context provided first. Only call a tool if you
  cannot give a complete, accurate answer without it.`;

  const parts = [
    section("WHO YOU ARE", AMOOTI_IDENTITY),
  ];

  if (ctx.found) {
    parts.push(section("CURRICULUM CONTEXT — read this before answering", curriculumBlock));
  }
  if (progressBlock) {
    parts.push(section("STUDENT STATE", progressBlock));
  }

  parts.push(section("HOW TO ANSWER", answerRules));
  parts.push(section("TOOLS", toolNote));

  if (userRole === "school") {
    parts.push(section("SESSION TYPE: SHARED CLASSROOM", `
This is a shared classroom session. Multiple students may ask questions.
Keep each explanation self-contained. Build naturally on what was just discussed
but do not assume all messages are from the same student.`));
  }

  return parts.join("\n");
}

// ── QUIZ mode prompt ──────────────────────────────────────────────────────────

export function buildQuizPrompt(ctx: BuiltContext, difficulty?: string): string {
  const tc       = ctx.topicContext as any;
  const outcomes = ctx.quizOutcomes as any[] ?? [];
  const progressBlock = buildProgressBlock(ctx);

  // Separate outcomes that have pre-extracted stems vs those that don't
  const withStems    = outcomes.filter((o) => o.quiz_question_stem?.trim());
  const withoutStems = outcomes.filter((o) => !o.quiz_question_stem?.trim());

  let outcomesBlock = "";
  if (withStems.length) {
    outcomesBlock += `\nOUTCOMES WITH QUESTION STARTERS (use these as the basis for questions):\n`;
    for (const o of withStems) {
      outcomesBlock += `\n  Stem: ${o.quiz_question_stem}`;
      outcomesBlock += `\n  Outcome: ${truncate(o.outcome_text, 120)}`;
      outcomesBlock += `\n  Bloom's: ${o.blooms_level} | Difficulty: ${o.difficulty}`;
      if (o.distractor_hints?.length) {
        outcomesBlock += `\n  Common mistakes students make: ${o.distractor_hints.join("; ")}`;
      }
      outcomesBlock += "\n";
    }
  }

  if (withoutStems.length) {
    outcomesBlock += `\nADDITIONAL OUTCOMES (generate questions freely from these):\n`;
    for (const o of withoutStems) {
      outcomesBlock += `  • [${o.blooms_level}/${o.difficulty}] ${truncate(o.outcome_text, 120)}\n`;
      if (o.distractor_hints?.length) {
        outcomesBlock += `    Common mistakes: ${o.distractor_hints.join("; ")}\n`;
      }
    }
  }

  const quizRules = `
You are in QUIZ MODE. Your job is to test the student.

QUESTION GENERATION:
  For outcomes with question starters (listed above):
    → Expand the starter into a full, clear question
    → Generate 4 multiple choice options (A, B, C, D)
    → Make wrong options plausible using the "common mistakes" hints
    → The correct answer should not be obviously different from the others

  For outcomes without starters:
    → Generate questions freely from the outcome text
    → Primarily use MCQ (multiple choice); can include short-answer, fill-in

OUTPUT FORMAT (CRITICAL):
Your response MUST be a JSON block in a markdown code fence:

\`\`\`json
{
  "questions": [
    {
      "number": 1,
      "type": "mcq",
      "text": "Full question text here?",
      "options": [
        {"id": "A", "text": "First option"},
        {"id": "B", "text": "Second option"},
        {"id": "C", "text": "Third option"},
        {"id": "D", "text": "Fourth option"}
      ]
    }
  ]
}
\`\`\`

Include 5-10 questions depending on topic breadth.
For MCQ: Always include exactly 4 options with IDs A, B, C, D.
For short-answer: omit the "options" field.

FLOW:
  1. Student will answer all questions (one at a time via flashcards)
  2. When they submit: they will send back their answers
  3. You will then mark each answer, explain WHY wrong answers were wrong
     (reference the common mistakes — these are real student misconceptions)
  4. Give the student a score and encourage them
  5. If they scored < 60%: re-explain the hardest concept briefly

DIFFICULTY: ${difficulty ? `Focus on ${difficulty.toUpperCase()} difficulty outcomes.` : "Mix difficulties — start accessible, increase gradually."}

TONE: Encouraging but honest. "Good try — here's where it went wrong" not "Wrong."`;

  const parts = [
    section("WHO YOU ARE", AMOOTI_IDENTITY),
    section(`QUIZ TOPIC: ${ctx.topic ?? "General"} — ${ctx.subject ?? ""} ${ctx.class ?? ""}`,
      `${outcomesBlock}\n` +
      (tc?.topic?.learning_outcomes_raw
        ? `\nFULL LEARNING OUTCOMES TEXT:\n${truncate(tc.topic.learning_outcomes_raw, 800)}`
        : "")
    ),
  ];

  if (progressBlock) {
    parts.push(section("STUDENT PROGRESS (calibrate difficulty)", progressBlock));
  }

  parts.push(section("QUIZ RULES AND FORMAT", quizRules));

  return parts.join("\n");
}

// ── TEACHER mode prompt ───────────────────────────────────────────────────────

export function buildTeacherPrompt(ctx: BuiltContext & { allTopicContexts?: unknown[] }): string {
  const tc         = ctx.topicContext as any;
  const allContexts = ctx.allTopicContexts as any[] ?? [];

  let activitiesBlock = "";
  if (tc?.activities?.length) {
    activitiesBlock += `\nSUGGESTED ACTIVITIES (from curriculum):\n`;
    for (const a of tc.activities) {
      activitiesBlock += `  [${a.methods?.join(", ")}] ${a.grouping} — ${truncate(a.description, 150)}\n`;
      if (a.materials?.length) activitiesBlock += `    Materials: ${a.materials.join(", ")}\n`;
      if (a.duration_hint)     activitiesBlock += `    Duration: ${a.duration_hint}\n`;
    }
  }

  let rawBlock = "";
  if (tc?.topic) {
    const t = tc.topic;
    if (t.learning_outcomes_raw)
      rawBlock += `\nOFFICIAL LEARNING OUTCOMES:\n${t.learning_outcomes_raw}\n`;
    if (t.suggested_activities_raw)
      rawBlock += `\nOFFICIAL SUGGESTED ACTIVITIES:\n${t.suggested_activities_raw}\n`;
    if (t.assessment_strategy_raw)
      rawBlock += `\nOFFICIAL ASSESSMENT STRATEGY:\n${t.assessment_strategy_raw}\n`;
  }

  let sequenceBlock = "";
  if (ctx.crossSubject?.length) {   // neighbours stored here from teacher context builder
    sequenceBlock = "\nTOPIC SEQUENCE:\n";
    for (const n of ctx.crossSubject as any[]) {
      sequenceBlock += `  ${n.direction === "previous" ? "← Before:" : "→ After:"} ${n.topic} (${n.class}, Term ${n.term})\n`;
    }
  }

  const teacherRules = `
You are assisting a professional teacher. Your register is professional and collegial.
You are not a student assistant here — you are a curriculum planning tool.

WHAT YOU CAN PRODUCE (respond to what the teacher asks for):

1. SCHEME OF WORK — Weekly plan with: week number, topic/subtopic, learning outcomes,
   teaching methods, materials needed, assessment approach. Use a markdown table.

2. LESSON PLAN — Detailed single-lesson plan: objectives, introduction (5 min),
   main activity (30 min), consolidation (10 min), assessment (5 min), homework.
   Reference the specific activities and materials from the curriculum above.

3. TOPIC SUMMARY — Concise overview suitable for sharing with students or parents.
   Cover: what is taught, why it matters, how it connects to other subjects.

4. ASSESSMENT DESIGN — Quiz questions, test items, or rubrics aligned to the
   learning outcomes and Bloom's levels shown above.

5. PROGRESS REPORT — If student data is provided, summarise class performance
   per outcome, identify struggling areas, suggest intervention activities.

ALWAYS:
  • Ground your output in the official curriculum specification above
  • Reference specific learning outcomes by their Bloom's level and difficulty
  • Suggest Uganda-contextualised examples and activities
  • Format documents professionally — use headers, tables, numbered lists`;

  const parts = [
    section("TOOL: CURRICULUM PLANNING ASSISTANT FOR UGANDA O-LEVEL", `
You are assisting a teacher with curriculum planning and classroom management.
You have access to the official Uganda O-Level curriculum specification.
Produce professional, curriculum-aligned documents.`),

    section("CURRICULUM SPECIFICATION", `
Subject:  ${ctx.subject ?? "—"}
Class:    ${ctx.class   ?? "—"}
Term:     ${ctx.term    ?? "—"}
Topic:    ${ctx.topic   ?? "—"}
${rawBlock}
${activitiesBlock}
${sequenceBlock}`)
  ];

  if (allContexts.length > 1) {
    parts.push(section("ADDITIONAL TOPICS IN SCOPE", allContexts.slice(1).map((tc: any, i: number) =>
      `Topic ${i + 2}: ${tc?.topic?.topic ?? "—"} (${tc?.topic?.class}, Term ${tc?.topic?.term})`
    ).join("\n")));
  }

  parts.push(section("WHAT YOU CAN DO", teacherRules));

  return parts.join("\n");
}

// ── Mode dispatcher ───────────────────────────────────────────────────────────

export function buildPrompt(
  mode:       Mode,
  ctx:        BuiltContext,
  userRole:   string,
  difficulty?: string,
): string {
  switch (mode) {
    case "quiz":
      return buildQuizPrompt(ctx, difficulty);
    case "teacher":
      return buildTeacherPrompt(ctx as any);
    case "query":
    default:
      return buildQueryPrompt(ctx, userRole);
  }
}
