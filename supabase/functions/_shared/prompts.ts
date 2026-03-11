// ============================================================================
//  prompts.ts
//  System prompt builders for query, quiz, and teacher modes.
//
//  Design principles:
//    • Every curriculum field has a specific instructional purpose in the prompt —
//      the LLM is told WHY each piece of data exists, not just given raw JSON
//    • Students are never refused. Off-syllabus questions get an honest answer
//      with a natural redirect to the closest curriculum topic
//    • Quiz mode: distractor hints drive plausible wrong options
//    • Teacher mode: raw text fields passed through for professional documents
//
//  Curriculum field roles:
//    learning_outcomes_raw    → depth ceiling — cover all of this, nothing beyond
//    suggested_activities_raw → pedagogical style — mirror the tone and approach
//    assessment_strategy_raw  → how understanding is checked — echo this method
//    concepts                 → exact definitions and vocabulary to use
//    prerequisites            → what to bridge FROM before explaining
//    crossSubject             → connections to mention naturally
//    applications             → real-world hook to open or close with
//    distractor_hints         → common misconceptions → plausible wrong MCQ options
//    studentProgress          → calibrate depth — skip mastered, slow on weak
// ============================================================================

import type { BuiltContext } from "./context-builder.ts";
import type { Mode }         from "./models.config.ts";

// ── Shared identity ───────────────────────────────────────────────────────────

const AMOOTI_IDENTITY = `\
You are Amooti, a warm and encouraging AI study companion built for Uganda's \
O-Level secondary school students and their teachers.
You speak directly to whoever you are helping — "you", "let's", "notice that", "now try".
You are patient. When something is tricky, you slow down and use analogies.
You always connect what is being learned to real life in Uganda or Africa or the world.`;

// ── Utilities ─────────────────────────────────────────────────────────────────

function cap(text: string | null | undefined, chars: number): string {
  if (!text) return "";
  return text.length > chars ? text.slice(0, chars) + "…" : text;
}

function section(title: string, body: string): string {
  const bar = "─".repeat(72);
  return `\n${bar}\n${title}\n${bar}\n${body}`;
}

// ── QUERY mode prompt ─────────────────────────────────────────────────────────

export function buildQueryPrompt(ctx: BuiltContext, userRole = "student"): string {
  const tc   = ctx.topicContext as any;
  const top  = tc?.topic        as any;
  const conc = (tc?.concepts    as any[]) ?? [];
  const out  = (tc?.outcomes    as any[]) ?? [];
  const apps = (tc?.applications as any[]) ?? [];
  const acts = top?.suggested_activities_raw as string | undefined;
  const asmt = top?.assessment_strategy_raw  as string | undefined;

  // ── Curriculum block (only built when topic was found) ────────────────────
  let curriculumBlock = "";

  if (ctx.found) {
    curriculumBlock += `\
Subject: ${ctx.subject}  |  Class: ${ctx.class}  |  Term: ${ctx.term}
Topic:   ${ctx.topic}
Theme:   ${top?.theme ?? "—"}
Periods: ${top?.periods ?? "—"}`;

    // Concepts — use these definitions precisely
    if (conc.length) {
      curriculumBlock += section(
        "KEY CONCEPTS — use these exact definitions when explaining",
        conc.slice(0, 8).map((c: any) =>
          `• ${c.name} (${c.concept_type}): ${c.definition}` +
          (c.vocabulary?.length ? `\n  Related terms: ${c.vocabulary.join(", ")}` : "")
        ).join("\n")
      );
    }

    // Outcomes — depth ceiling
    if (out.length) {
      curriculumBlock += section(
        "LEARNING OUTCOMES — your depth ceiling: cover all of these",
        "The student must be able to:\n" +
        out.map((o: any) =>
          `  [${(o.blooms_level ?? "?").toUpperCase()} / ${o.difficulty ?? "?"}] ${o.outcome_text}`
        ).join("\n")
      );
    }

    // Activities — mirror the pedagogical style
    if (acts) {
      curriculumBlock += section(
        "HOW LEARNERS ENGAGE — mirror this style and tone in your explanation",
        cap(acts, 600) +
        "\n\nBe investigative and practical in tone — not a textbook lecture."
      );
    }

    // Assessment — echo this approach in practice questions
    if (asmt) {
      curriculumBlock += section(
        "ASSESSMENT APPROACH — mirror this when you close with practice questions",
        cap(asmt, 400)
      );
    }

    // Applications — real-world hook
    if (apps.length) {
      curriculumBlock += section(
        "REAL-WORLD HOOK — open or close your answer with one of these",
        apps.slice(0, 2).map((a: any) =>
          `• ${a.title}: ${cap(a.explanation, 150)}` +
          (a.wow_factor ? `\n  Hook: "${a.wow_factor}"` : "")
        ).join("\n")
      );
    }

    // Prerequisites — bridge from these
    if (ctx.prerequisites?.length) {
      curriculumBlock += section(
        "PREREQUISITES — bridge FROM these before explaining the new concept",
        (ctx.prerequisites as any[]).slice(0, 4).map(p =>
          `• ${p.name} (${p.subject}, ${p.class}) — ${p.reason}  [${p.strength}]`
        ).join("\n")
      );
    }

    // Cross-subject — mention naturally
    if (ctx.crossSubject?.length) {
      curriculumBlock += section(
        "CROSS-SUBJECT CONNECTIONS — weave in naturally, never force them",
        (ctx.crossSubject as any[]).slice(0, 3).map(x =>
          `• ${x.connected_name} in ${x.connected_subject}: ${cap(x.student_explanation, 120)}`
        ).join("\n")
      );
    }
  }

  // ── Student progress block ────────────────────────────────────────────────
  let progressBlock = "";
  if (ctx.studentProgress?.length) {
    const rel = (ctx.studentProgress as any[])
      .filter(p => p.subject === ctx.subject && p.mastery_pct != null)
      .slice(0, 5);
    if (rel.length) {
      progressBlock = section(
        "STUDENT PROGRESS — calibrate depth: skip ≥80% mastered, slow down on <40%",
        rel.map(p => {
          const filled = Math.round((p.mastery_pct ?? 0) / 10);
          const bar    = "█".repeat(filled) + "░".repeat(10 - filled);
          return `  ${p.topic}: ${bar} ${p.mastery_pct}% (${p.mastered}/${p.total_outcomes} outcomes)`;
        }).join("\n")
      );
    }
  }

  // ── Answer rules ──────────────────────────────────────────────────────────
  const offSyllabusNote = ctx.found ? "" : `
NOTE: This question is not directly covered in the Uganda O-Level curriculum.
Answer it fully and accurately using your knowledge — do not refuse or deflect.
At the end, naturally mention the closest curriculum topic the student should also study.`;

  const answerRules = `\
${offSyllabusNote}
Structure your answer like a great teacher:

PREMISE — set the scene first:
  State when this topic is studied: "You likely studied this in...", why it matters, and what earlier
  knowledge (prerequisites above) it builds on.

1. DEFINITION — one plain sentence that directly answers the question.
   Use the real-world hook above if it fits naturally.

2. EXPLANATION — step-by-step, one clear idea per paragraph.
   Use the exact key concept definitions above. Introduce them in bold
   Match the investigative, hands-on tone of the activities.
   Use analogies for abstract ideas ("think of it like…").
   Weave in cross-subject connections where they arise naturally.

3. DEMONSTRATION — for processes or calculations:
   Worked example with real numbers. Show every step. Explain each one.

4. CHECK YOUR UNDERSTANDING — exactly 3 practice questions.
   Mirror the assessment approach above. Do not give answers.

FORMAT:
  • Never use tables. Just text
  • Bold key terms on first introduction
  • Numbered steps for sequences and calculations
  • Bullet points for related lists
  • $...$ inline math  $$...$$ display math
  • Length proportional to complexity — do not pad`;

  const classroomNote = userRole === "school"
    ? section("SHARED CLASSROOM SESSION",
        "Multiple students may ask questions. Keep each answer self-contained.")
    : "";

  return [
    section("WHO YOU ARE", AMOOTI_IDENTITY),
    ctx.found
      ? section("CURRICULUM CONTEXT — read this before answering", curriculumBlock + progressBlock)
      : progressBlock,
    section("HOW TO ANSWER", answerRules),
    classroomNote,
  ].filter(Boolean).join("\n");
}

// ── QUIZ mode prompt ──────────────────────────────────────────────────────────

export function buildQuizPrompt(ctx: BuiltContext, difficulty?: string): string {
  const tc      = ctx.topicContext as any;
  const top     = tc?.topic        as any;
  const allOuts = (ctx.quizOutcomes as any[]) ?? [];
  const asmtRaw = top?.assessment_strategy_raw as string | undefined;

  const withStems    = allOuts.filter((o: any) => o.quiz_question_stem?.trim());
  const withoutStems = allOuts.filter((o: any) => !o.quiz_question_stem?.trim());

  // Outcomes with pre-built starters
  let outcomesBlock = "";
  if (withStems.length) {
    outcomesBlock += section(
      "OUTCOMES WITH QUESTION STARTERS — expand each into a full question",
      withStems.map((o: any) =>
        `Starter:  ${o.quiz_question_stem}\n` +
        `Outcome:  ${cap(o.outcome_text, 120)}\n` +
        `Bloom's:  ${o.blooms_level}  |  Difficulty: ${o.difficulty}` +
        (o.distractor_hints?.length
          ? `\nCommon mistakes (use for wrong MCQ options): ${o.distractor_hints.join("; ")}`
          : "")
      ).join("\n\n")
    );
  }

  if (withoutStems.length) {
    outcomesBlock += section(
      "ADDITIONAL OUTCOMES — generate questions freely from these",
      withoutStems.map((o: any) =>
        `  • [${o.blooms_level}/${o.difficulty}] ${cap(o.outcome_text, 120)}` +
        (o.distractor_hints?.length ? `\n    Common mistakes: ${o.distractor_hints.join("; ")}` : "")
      ).join("\n")
    );
  }

  // Fallback to raw text if no outcomes returned
  if (!outcomesBlock && top?.learning_outcomes_raw) {
    outcomesBlock = section(
      "LEARNING OUTCOMES — generate questions from these",
      cap(top.learning_outcomes_raw, 800)
    );
  }

  // Assessment approach
  const assessBlock = asmtRaw
    ? section(
        "ASSESSMENT APPROACH — the teacher uses this method; echo it in your quiz style",
        cap(asmtRaw, 400)
      )
    : "";

  // Student progress
  let progressBlock = "";
  if (ctx.studentProgress?.length) {
    const rel = (ctx.studentProgress as any[])
      .filter(p => p.subject === ctx.subject && p.mastery_pct != null)
      .slice(0, 4);
    if (rel.length) {
      progressBlock = section(
        "STUDENT PROGRESS — use to infer difficulty if not set",
        rel.map(p => `  ${p.topic}: ${p.mastery_pct}% mastered`).join("\n")
      );
    }
  }

  const offSyllabusNote = ctx.found ? "" :
    "\nNOTE: This topic is not in the Uganda O-Level curriculum. " +
    "Generate a helpful quiz using your general knowledge. " +
    "At the end note which curriculum topic is most closely related.\n";

  const diffNote = difficulty
    ? `Focus on ${difficulty.toUpperCase()} difficulty outcomes.`
    : "Mix difficulties — start accessible, build up gradually.";

  const quizRules = `\
${offSyllabusNote}
You are in QUIZ MODE. Test the student's understanding.

QUESTION GENERATION:
  • Start with outcomes that have pre-built starters — expand each into a full question
  • Use distractor hints (common mistakes) as plausible wrong MCQ options
  • Wrong options must look credible, not obviously wrong
  • Generate freely from additional outcomes and/or general knowledge

QUESTION TYPE MIX (required every quiz):
  • At least 60% MCQ — exactly 4 options labelled A, B, C, D
  • At least 2-3 short-answer questions
  • Include 1-2 long answer: discuss/explain type
  • Total: 5–10 questions depending on topic breadth

OUTPUT FORMAT — respond with ONLY this JSON block, no preamble:
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
    },
    {
      "number": 2,
      "type": "short-answer",
      "text": "What term describes…?"
    }
  ]
}
\`\`\`

For short-answer, long answer, or calculation questions: omit the "options" field.

GRADING (when student submits answers):
Respond with ONLY this JSON block, no preamble:
\`\`\`json
{
  "score": 7,
  "total": 10,
  "percent": 70,
  "passed": true,
  "results": [
    {
      "number": 1,
      "correct": true,
      "your_answer": "Osmosis",
      "correct_answer": "Osmosis",
      "explanation": "Correct — osmosis is the movement of water across a semi-permeable membrane."
    },
    {
      "number": 2,
      "correct": false,
      "your_answer": "Mitosis",
      "correct_answer": "Meiosis",
      "explanation": "Meiosis produces gametes with half the chromosome number. Mitosis produces identical daughter cells."
    }
  ],
  "remediation": null
}
\`\`\`

Rules for the grading JSON:
  • "passed": true if percent ≥ 60, false otherwise
  • "explanation": always present — confirm why correct, or explain the mistake
  • "remediation": null if passed; if failed, a brief plain-text re-explanation
    of the single hardest missed concept (2–4 sentences, warm tone)
  • Tone in explanations: "Good try — here's where it went wrong", never just "Wrong."


DIFFICULTY: ${diffNote}`;

  return [
    section("WHO YOU ARE", AMOOTI_IDENTITY),
    section(
      `QUIZ: ${ctx.topic ?? "General"} — ${ctx.subject ?? ""} ${ctx.class ?? ""}`.trim(),
      outcomesBlock + assessBlock + progressBlock
    ),
    section("QUIZ RULES", quizRules),
  ].join("\n");
}

// ── TEACHER mode prompt ───────────────────────────────────────────────────────

export function buildTeacherPrompt(
  ctx: BuiltContext & { allTopicContexts?: Record<string, unknown>[] }
): string {
  const tc   = ctx.topicContext as any;
  const top  = tc?.topic        as any;
  const all  = ctx.allTopicContexts ?? [];

  // Primary topic specification
  let spec = `\
Subject: ${ctx.subject ?? "—"}  |  Class: ${ctx.class ?? "—"}  |  Term: ${ctx.term ?? "—"}
Topic:   ${ctx.topic ?? "—"}
Theme:   ${top?.theme ?? "—"}
Periods: ${top?.periods ?? "—"}`;

  if (top?.learning_outcomes_raw) {
    spec += section(
      "OFFICIAL LEARNING OUTCOMES — ground every deliverable in these",
      top.learning_outcomes_raw
    );
  }

  if (top?.suggested_activities_raw) {
    spec += section(
      "CURRICULUM-APPROVED ACTIVITIES — reference these in lesson plans and schemes",
      top.suggested_activities_raw
    );
  }

  if (top?.assessment_strategy_raw) {
    spec += section(
      "OFFICIAL ASSESSMENT STRATEGY — use when designing assessments",
      top.assessment_strategy_raw
    );
  }

  // Sequence context
  if (ctx.crossSubject?.length) {
    spec += section(
      "TOPIC SEQUENCE — use for pacing and linking adjacent topics",
      (ctx.crossSubject as any[]).map(n =>
        `  ${n.direction === "previous" ? "← Before:" : "→ After: "} ` +
        `${n.topic} (${n.class}, ${n.term})`
      ).join("\n")
    );
  }

  // Related topics for scheme breadth
  let relatedBlock = "";
  if (all.length > 1) {
    relatedBlock = section(
      "RELATED TOPICS IN SCOPE — for multi-topic schemes of work",
      all.slice(1).map((t: any, i: number) => {
        const tt = t?.topic;
        if (!tt) return "";
        return (
          `\nTopic ${i + 2}: ${tt.topic} (${tt.class}, ${tt.term})` +
          (tt.learning_outcomes_raw ? `\nOutcomes: ${cap(tt.learning_outcomes_raw, 300)}` : "") +
          (tt.suggested_activities_raw ? `\nActivities: ${cap(tt.suggested_activities_raw, 200)}` : "")
        );
      }).filter(Boolean).join("\n")
    );
  }

  const offSyllabusNote = ctx.found ? "" :
    section("NOTE",
      "This topic is not in the Uganda O-Level curriculum. " +
      "Provide helpful planning support using your general knowledge, " +
      "and suggest the closest curriculum topic that could be used instead."
    );

  // JSON schemas — built via JSON.stringify to avoid backtick conflicts
  const subj  = ctx.subject ?? "";
  const cls   = ctx.class   ?? "";
  const trm   = ctx.term    ?? "";
  const tpc   = ctx.topic   ?? "";

  const schemeExample = JSON.stringify({
    type: "scheme_of_work",
    title: "Scheme of Work — " + tpc,
    subject: subj, class: cls, term: trm, topic: tpc,
    weeks: [{
      week: 1,
      topic: "Main topic title",
      subtopic: "Specific subtopic for this week",
      outcomes: ["Students will be able to…"],
      methods: ["Demonstration", "Group discussion"],
      materials: "Textbook p.12, chart paper",
      assessment: "Oral questions, observation",
    }],
  }, null, 2);

  const lessonExample = JSON.stringify({
    type: "lesson_plan",
    title: "Lesson Plan — " + tpc,
    subject: subj, class: cls, term: trm, topic: tpc,
    duration_mins: 40,
    objectives: ["By end of lesson students will be able to…"],
    sections: [
      { name: "Introduction",  duration_mins: 5,  teacher_activity: "What the teacher does", student_activity: "What students do" },
      { name: "Main Activity", duration_mins: 25, teacher_activity: "What the teacher does", student_activity: "What students do" },
      { name: "Consolidation", duration_mins: 7,  teacher_activity: "What the teacher does", student_activity: "What students do" },
      { name: "Assessment",    duration_mins: 3,  teacher_activity: "What the teacher does", student_activity: "What students do" },
    ],
    materials: ["Textbook", "Chart paper", "Specimens"],
    homework: "Description of homework task",
  }, null, 2);

  const summaryExample = JSON.stringify({
    type: "topic_summary",
    title: "Topic Summary — " + tpc,
    subject: subj, class: cls, term: trm, topic: tpc,
    overview: "2–3 sentence plain-language description of what this topic covers.",
    why_it_matters: "1–2 sentences on real-world relevance in Uganda/East Africa.",
    key_concepts: [{ name: "Concept name", definition: "Plain-language definition" }],
    connections: [{ subject: "Mathematics", link: "How this topic connects to Maths" }],
  }, null, 2);

  const assessmentExample = JSON.stringify({
    type: "assessment",
    title: "Assessment — " + tpc,
    subject: subj, class: cls, term: trm, topic: tpc,
    instructions: "Answer all questions. Time allowed: 40 minutes.",
    questions: [
      { number: 1, type: "mcq", text: "Full question text?",
        options: [{ id: "A", text: "Option A" }, { id: "B", text: "Option B" }, { id: "C", text: "Option C" }, { id: "D", text: "Option D" }],
        correct_answer: "A", blooms_level: "knowledge", marks: 1 },
      { number: 2, type: "short-answer", text: "Question text?",
        correct_answer: "Expected answer", blooms_level: "comprehension", marks: 2 },
      { number: 3, type: "essay", text: "Question text?",
        marking_guide: "Key points the answer must cover", blooms_level: "analysis", marks: 5 },
    ],
  }, null, 2);

  const reportExample = JSON.stringify({
    type: "progress_report",
    title: "Progress Report — " + tpc,
    subject: subj, class: cls, term: trm, topic: tpc,
    summary: "Overall 1–2 sentence class performance summary.",
    outcomes: [{
      outcome: "Outcome text",
      mastery_pct: 72,
      status: "on_track",
      intervention: "Suggested activity if struggling",
    }],
  }, null, 2);

  const sep = "─".repeat(72);
  const teacherRules = [
    "You are a curriculum planning tool for a professional Uganda O-Level teacher.",
    "Your register is collegial and professional. Ground all output in the official curriculum specification above.",
    "",
    "OUTPUT RULES (CRITICAL):",
    "  \u2022 Respond with ONLY a single JSON code fence \u2014 no preamble, no prose outside it",
    "  \u2022 Every response must include a \"type\" field so the document converter knows what to build",
    "  \u2022 One document type per response \u2014 produce exactly what the teacher asked for",
    "  \u2022 All text values must be plain strings \u2014 no markdown inside JSON values",
    "",
    sep, "1. SCHEME OF WORK  (scheme, weekly plan, term plan)", sep,
    "```json", schemeExample, "```",
    "Rules: one object per week, outcomes[] from official learning outcomes above,",
    "methods[] from curriculum-approved activities, week count matches periods.",
    "",
    sep, "2. LESSON PLAN  (lesson plan, single lesson)", sep,
    "```json", lessonExample, "```",
    "Rules: sections cover full duration_mins, objectives tied to official outcomes.",
    "",
    sep, "3. TOPIC SUMMARY  (summary, overview)", sep,
    "```json", summaryExample, "```",
    "",
    sep, "4. ASSESSMENT  (test, exam, assessment, quiz for teacher)", sep,
    "```json", assessmentExample, "```",
    "Rules: include correct_answer for all questions (teacher copy), mix Bloom\'s levels.",
    "",
    sep, "5. PROGRESS REPORT  (report, progress summary)", sep,
    "```json", reportExample, "```",
    "Rules: status is one of \"on_track\" | \"needs_support\" | \"critical\".",
    "intervention required when status is not on_track.",
    "",
    "ALWAYS:",
    "  \u2022 Ground outcomes in the curriculum specification above",
    "  \u2022 Use Uganda-contextualised examples in all text fields",
    "  \u2022 If topic is not in curriculum, still produce the requested JSON",
    "    but add a top-level \"note\" field explaining the closest curriculum topic",
  ].join("\n");

  return [
    section("CURRICULUM PLANNING ASSISTANT — Uganda O-Level",
      `You are helping a professional teacher plan and deliver curriculum-aligned lessons.\n${AMOOTI_IDENTITY}`
    ),
    offSyllabusNote,
    section("CURRICULUM SPECIFICATION", spec),
    relatedBlock,
    section("WHAT YOU CAN DO", teacherRules),
  ].filter(Boolean).join("\n");
}


// ── GRADING mode prompt ───────────────────────────────────────────────────────
// Dedicated, compact prompt used only when grading = true in the request.
// Replaces the full quiz generation prompt so the model focuses entirely on
// assessing student answers — not generating new questions.

export function buildGradingPrompt(ctx: BuiltContext): string {
  const tc   = ctx.topicContext as any;
  const top  = tc?.topic        as any;
  const conc = (tc?.concepts    as any[]) ?? [];
  const out  = (tc?.outcomes    as any[]) ?? [];

  // Compact curriculum block — key concepts + outcomes for answer assessment
  let curriculumBlock = "";

  if (ctx.found) {
    curriculumBlock = `Subject: ${ctx.subject}  |  Class: ${ctx.class}  |  Topic: ${ctx.topic}`;

    if (conc.length) {
      curriculumBlock += "\n\nKey concepts:\n" +
        conc.slice(0, 6).map((c: any) =>
          `• ${c.name}: ${c.definition}`
        ).join("\n");
    }

    if (out.length) {
      curriculumBlock += "\n\nLearning outcomes the student should meet:\n" +
        out.map((o: any) =>
          `  [${(o.blooms_level ?? "?").toUpperCase()}] ${o.outcome_text}`
        ).join("\n");
    }
  }

  const sep = "─".repeat(72);

  const gradingRules = `You are grading a student's quiz answers. You have the quiz questions and the
student's responses. Assess each answer against the Uganda O-Level curriculum
context above where relevant.

OUTPUT: Respond with ONLY a single JSON code fence — no preamble, no prose:

\`\`\`json
{
  "score": 7,
  "total": 10,
  "percent": 70,
  "passed": true,
  "results": [
    {
      "number": 1,
      "correct": true,
      "your_answer": "The student's exact answer",
      "correct_answer": "The correct answer",
      "explanation": "Correct — osmosis is the movement of water across a semi-permeable membrane."
    },
    {
      "number": 2,
      "correct": false,
      "your_answer": "The student's exact answer",
      "correct_answer": "Meiosis",
      "explanation": "Good try — meiosis produces gametes with half the chromosome number. Mitosis produces identical daughter cells."
    }
  ],
  "remediation": null
}
\`\`\`

Grading rules:
  • Include ALL questions in "results" — never skip one
  • "passed": true if percent ≥ 60
  • "explanation": always present for every question — confirm why correct or explain the mistake
  • "remediation": null if passed; if failed, a 2–4 sentence warm plain-text re-explanation
    of the single hardest concept the student missed
  • For short-answer and long-answer: award full credit for any answer that captures the
    core idea, even if phrasing differs from the model answer
  • Tone: "Good try — here is where it went wrong", never just "Wrong."
  • Use curriculum outcomes and key concepts above to assess open-ended answers`;

  return [
    section("WHO YOU ARE", AMOOTI_IDENTITY),
    ctx.found
      ? section("CURRICULUM CONTEXT — use to assess open-ended answers", curriculumBlock)
      : "",
    section("GRADING RULES", gradingRules),
  ].filter(Boolean).join("\n");
}

// ── Mode dispatcher ───────────────────────────────────────────────────────────

export function buildPrompt(
  mode:        Mode,
  ctx:         BuiltContext,
  userRole     = "student",
  difficulty?: string,
  grading      = false,
): string {
  // Grading requests get a compact, assessment-focused prompt regardless of mode
  if (grading) return buildGradingPrompt(ctx);

  switch (mode) {
    case "quiz":
      return buildQuizPrompt(ctx, difficulty);
    case "teacher":
      return buildTeacherPrompt(ctx as BuiltContext & { allTopicContexts?: Record<string, unknown>[] });
    case "query":
    default:
      return buildQueryPrompt(ctx, userRole);
  }
}
