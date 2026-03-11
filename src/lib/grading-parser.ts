/**
 * parseGradingResponse — robust parser for AI grading responses.
 *
 * The system runs 10+ different models across 4 providers (Cerebras, Ollama,
 * OpenRouter, Google). Each can return grading output differently:
 *
 *   Shape A  — clean JSON object with "results" array (ideal)
 *   Shape B  — JSON wrapped in ```json ... ``` or ``` ... ```
 *   Shape C  — JSON with non-standard field names (score_out_of, is_correct, etc.)
 *   Shape D  — JSON buried inside prose ("Here is the grading: {...}")
 *   Shape E  — markdown table  | Q# | Answer | Correct | Explanation |
 *   Shape F  — numbered prose  "Question 1: Correct. ..."
 *   Shape G  — partial/truncated JSON (Ollama NDJSON edge cases)
 *
 * Strategy: try each parser in order of reliability, accept the first that
 * produces results for at least half the expected questions.
 */

import type {
  QuizResults,
  QuestionCorrection,
  QuizQuestion,
  StudentAnswer,
} from "@/types/quiz";

// ─── Normalisation helpers ────────────────────────────────────────────────────

/** Strip markdown fences, leading/trailing whitespace, and BOM */
function cleanJSON(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")                          // BOM
    .replace(/```(?:json|JSON)?\s*/g, "")            // opening fence
    .replace(/```\s*$/g, "")                         // closing fence
    .replace(/,\s*([}\]])/g, "$1")                   // trailing commas
    .trim();
}

/** Coerce any truthy-ish value to boolean */
function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number")  return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "correct" || s === "yes" || s === "1";
  }
  return false;
}

/** Try to pull a question number out of a mixed value */
function toQNum(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  return null;
}

/** Extract all JSON-like objects/arrays from a string (handles prose wrapping) */
function extractJSONBlobs(text: string): string[] {
  const blobs: string[] = [];

  // 1. Fenced blocks first
  const fenced = [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)];
  for (const m of fenced) blobs.push(m[1].trim());

  // 2. Bare top-level object { ... }  (greedy, outermost)
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        blobs.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return blobs;
}

// ─── Shape normaliser ─────────────────────────────────────────────────────────
// Different models use different field names. We normalise to a common shape.

interface NormalisedResult {
  number:       number;
  correct:      boolean;
  yourAnswer:   string;
  rightAnswer:  string;
  explanation:  string;
}

const FIELD_ALIASES: Record<string, string[]> = {
  number:      ["number", "q", "question_number", "q_number", "question", "num", "no"],
  correct:     ["correct", "is_correct", "isCorrect", "correct_flag", "passed", "right"],
  yourAnswer:  ["your_answer", "yourAnswer", "student_answer", "studentAnswer", "answer", "given"],
  rightAnswer: ["correct_answer", "correctAnswer", "right_answer", "rightAnswer", "expected", "solution"],
  explanation: ["explanation", "feedback", "reason", "comment", "note", "details"],
};

function pick(obj: Record<string, unknown>, key: string): unknown {
  const aliases = FIELD_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    if (obj[alias] !== undefined) return obj[alias];
    // Case-insensitive fallback
    const lower = alias.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lower) return obj[k];
    }
  }
  return undefined;
}

function normaliseResult(
  item: Record<string, unknown>,
  fallbackAnswers: Map<number, string>,
): NormalisedResult | null {
  const num = toQNum(pick(item, "number"));
  if (num === null) return null;

  return {
    number:      num,
    correct:     toBool(pick(item, "correct")),
    yourAnswer:  String(pick(item, "yourAnswer")  ?? fallbackAnswers.get(num) ?? "N/A"),
    rightAnswer: String(pick(item, "rightAnswer") ?? "See explanation"),
    explanation: String(pick(item, "explanation") ?? ""),
  };
}

// ─── Score extraction ─────────────────────────────────────────────────────────

interface ScoreData { correct: number; total: number; percent: number }

function extractScore(parsed: Record<string, unknown>, totalQ: number): ScoreData | null {
  // Direct fields
  const scoreField   = parsed.score   ?? parsed.correct_count ?? parsed.num_correct;
  const totalField   = parsed.total   ?? parsed.total_questions ?? parsed.num_questions;
  const percentField = parsed.percent ?? parsed.percentage     ?? parsed.score_percent;

  if (typeof scoreField === "number" && typeof totalField === "number" && totalField > 0) {
    return {
      correct: scoreField,
      total:   totalField,
      percent: typeof percentField === "number" ? percentField : (scoreField / totalField) * 100,
    };
  }
  if (typeof percentField === "number") {
    const correct = Math.round((percentField / 100) * totalQ);
    return { correct, total: totalQ, percent: percentField };
  }
  return null;
}

function extractScoreFromText(text: string, totalQ: number): ScoreData | null {
  // "6 / 8", "6/8", "6 out of 8"
  const fracMatch = text.match(/(\d+)\s*(?:\/|out\s+of)\s*(\d+)/i);
  if (fracMatch) {
    const correct = parseInt(fracMatch[1], 10);
    const total   = parseInt(fracMatch[2], 10);
    if (total > 0 && correct <= total)
      return { correct, total, percent: (correct / total) * 100 };
  }
  // "75%"
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const percent  = parseFloat(pctMatch[1]);
    const correct  = Math.round((percent / 100) * totalQ);
    return { correct, total: totalQ, percent };
  }
  return null;
}

// ─── Parser A: structured JSON with "results" array ──────────────────────────

function parseJSON(
  gradingContent: string,
  questions: QuizQuestion[],
  fallbackAnswers: Map<number, string>,
): NormalisedResult[] | null {
  const blobs = extractJSONBlobs(gradingContent);

  for (const blob of blobs) {
    try {
      const parsed = JSON.parse(cleanJSON(blob));
      if (typeof parsed !== "object" || parsed === null) continue;

      // Could be { results: [...] } or just [...]
      const arr: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.results)
        ? parsed.results
        : Array.isArray(parsed.grades)
        ? parsed.grades
        : Array.isArray(parsed.answers)
        ? parsed.answers
        : [];

      if (arr.length === 0) continue;

      const normed = arr
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => normaliseResult(item, fallbackAnswers))
        .filter((r): r is NormalisedResult => r !== null);

      // Accept if we got results for at least half the questions
      if (normed.length >= Math.ceil(questions.length / 2)) return normed;
    } catch {
      // Try next blob
    }
  }
  return null;
}

// ─── Parser B: markdown table ─────────────────────────────────────────────────
// | Q# | Your Answer | Correct Answer | Explanation |
// | 1  | A           | B              | Because...  |

function parseMarkdownTable(
  gradingContent: string,
  questions: QuizQuestion[],
  fallbackAnswers: Map<number, string>,
): NormalisedResult[] | null {
  const lines = gradingContent.split("\n");
  const results: NormalisedResult[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    // Skip separator lines like |---|---|
    if (/^\|[\s\-:]+\|/.test(trimmed)) continue;

    const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    const num = toQNum(cells[0].replace(/\*|Q/gi, "").trim());
    if (num === null) continue;

    // Detect correct/incorrect from cell content
    const yourAns   = cells[1]?.replace(/\*\*/g, "").trim() ?? fallbackAnswers.get(num) ?? "N/A";
    const rightAns  = cells[2]?.replace(/\*\*/g, "").trim() ?? "See explanation";
    const expl      = cells[3]?.replace(/\*\*/g, "").trim() ?? "";
    const isCorrect = yourAns.toLowerCase() === rightAns.toLowerCase()
      || /✓|correct|yes/i.test(cells[1] ?? "");

    results.push({ number: num, correct: isCorrect, yourAnswer: yourAns, rightAnswer: rightAns, explanation: expl });
  }

  return results.length >= Math.ceil(questions.length / 2) ? results : null;
}

// ─── Parser C: numbered prose ─────────────────────────────────────────────────
// "Question 1: ✓ Correct. Your answer A is right because..."
// "Q2: ✗ Incorrect. The correct answer is B. ..."

function parseProse(
  gradingContent: string,
  questions: QuizQuestion[],
  fallbackAnswers: Map<number, string>,
): NormalisedResult[] | null {
  const results: NormalisedResult[] = [];

  // Split on question boundaries
  const sections = gradingContent.split(
    /(?=(?:\*\*)?(?:Q(?:uestion)?\s*\.?\s*\d+|\d+[\.\)])\s*(?:\*\*)?)/i
  );

  for (const section of sections) {
    const numMatch = section.match(/(?:Q(?:uestion)?\s*\.?\s*(\d+)|\b(\d+)[\.\)])/i);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1] ?? numMatch[2], 10);
    if (isNaN(num) || num < 1 || num > questions.length * 2) continue;

    const isCorrect =
      /(?:✓|☑|✅|correct|right|well done|excellent|good answer)/i.test(section) &&
      !/(?:✗|✘|❌|incorrect|wrong|not correct|mistaken)/i.test(section);

    const rightMatch = section.match(
      /correct\s+answer\s+is\s+(?:\*\*)?([^.\n,*]{1,80})/i
    );

    results.push({
      number:      num,
      correct:     isCorrect,
      yourAnswer:  fallbackAnswers.get(num) ?? "N/A",
      rightAnswer: rightMatch?.[1]?.trim() ?? (isCorrect ? (fallbackAnswers.get(num) ?? "") : "See explanation"),
      explanation: section.replace(/(?:Q(?:uestion)?\s*\.?\s*\d+|\d+[\.\)])/i, "").trim().slice(0, 600),
    });
  }

  return results.length >= Math.ceil(questions.length / 2) ? results : null;
}

// ─── Build corrections array ──────────────────────────────────────────────────

function buildCorrections(
  normed:    NormalisedResult[],
  questions: QuizQuestion[],
  fallbackAnswers: Map<number, string>,
): QuestionCorrection[] {
  const byNum = new Map(normed.map((r) => [r.number, r]));

  // Fill any missing questions
  for (const q of questions) {
    if (!byNum.has(q.number)) {
      byNum.set(q.number, {
        number:      q.number,
        correct:     false,
        yourAnswer:  fallbackAnswers.get(q.number) ?? "N/A",
        rightAnswer: "See explanation",
        explanation: "No detailed feedback available for this question.",
      });
    }
  }

  return [...byNum.values()]
    .sort((a, b) => a.number - b.number)
    .map((r) => {
      const q = questions.find((q) => q.number === r.number);
      return {
        questionNumber: r.number,
        question:       q?.text ?? `Question ${r.number}`,
        studentAnswer:  r.yourAnswer,
        correctAnswer:  r.rightAnswer,
        explanation:    r.explanation,
        isCorrect:      r.correct,
      };
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseGradingResponse(
  gradingContent: string,
  questions:      QuizQuestion[],
  studentAnswers: StudentAnswer[],
): QuizResults {
  const totalQuestions = questions.length;

  // Build a quick lookup: questionNumber → student's answer text
  const fallbackAnswers = new Map<number, string>(
    studentAnswers.map((sa) => {
      const q = questions.find((q) => q.id === sa.questionId);
      return [q?.number ?? -1, sa.answer] as [number, string];
    })
  );

  console.log("[Grading] Parsing for", totalQuestions, "questions");
  console.log("[Grading] Content preview:", gradingContent.slice(0, 200));

  // ── Try parsers in order of reliability ──────────────────────────────────
  let normed: NormalisedResult[] | null = null;
  let method = "";

  normed = parseJSON(gradingContent, questions, fallbackAnswers);
  if (normed) { method = "JSON"; }

  if (!normed) {
    normed = parseMarkdownTable(gradingContent, questions, fallbackAnswers);
    if (normed) { method = "markdown-table"; }
  }

  if (!normed) {
    normed = parseProse(gradingContent, questions, fallbackAnswers);
    if (normed) { method = "prose"; }
  }

  // Ultimate fallback — at least show student answers with no feedback
  if (!normed) {
    method = "fallback";
    normed = questions.map((q) => ({
      number:      q.number,
      correct:     false,
      yourAnswer:  fallbackAnswers.get(q.number) ?? "N/A",
      rightAnswer: "See explanation",
      explanation: "The grading response could not be parsed. Full response below.",
    }));
  }

  console.log(`[Grading] ✅ Parsed via ${method} — ${normed.length} results`);

  // ── Build corrections ─────────────────────────────────────────────────────
  const corrections = buildCorrections(normed, questions, fallbackAnswers);

  // ── Extract score ─────────────────────────────────────────────────────────
  // Try JSON blob score fields first, then count from corrections, then text
  let scoreData: ScoreData | null = null;

  const blobs = extractJSONBlobs(gradingContent);
  for (const blob of blobs) {
    try {
      const parsed = JSON.parse(cleanJSON(blob));
      if (typeof parsed === "object" && parsed !== null) {
        scoreData = extractScore(parsed as Record<string, unknown>, totalQuestions);
        if (scoreData) break;
      }
    } catch { /* keep trying */ }
  }

  if (!scoreData) {
    const correctFromCorrections = corrections.filter((c) => c.isCorrect).length;
    // Trust corrections count if we had a real parser (not fallback)
    if (method !== "fallback") {
      scoreData = {
        correct: correctFromCorrections,
        total:   totalQuestions,
        percent: totalQuestions > 0 ? (correctFromCorrections / totalQuestions) * 100 : 0,
      };
    } else {
      // Last resort: grep text for a fraction or percentage
      scoreData = extractScoreFromText(gradingContent, totalQuestions) ?? {
        correct: 0,
        total:   totalQuestions,
        percent: 0,
      };
    }
  }

  console.log(
    `[Grading] Score: ${scoreData.correct}/${scoreData.total} (${scoreData.percent.toFixed(1)}%)`
  );

  return {
    totalQuestions,
    correctAnswers: scoreData.correct,
    score:          scoreData.percent,
    explanation:    gradingContent,
    corrections,
  };
}
