/**
 * Quiz parser: converts AI responses to structured quiz data
 */

import type { QuizQuestion, QuizData, QuestionType } from "@/types/quiz";

/**
 * Parse JSON-formatted quiz from AI response
 * Handles various formats the AI might use:
 * - ```json ... ```
 * - ```JSON ... ```
 * - ``` ... ```  (no language tag)
 * - Raw JSON object
 * - JSON embedded in surrounding text
 */
export function parseQuizJSON(content: string): QuizData | null {
  try {
    // Try multiple patterns for extracting JSON
    const patterns = [
      /```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/,   // fenced code block
      /(\{[\s\S]*"questions"[\s\S]*\})/,                 // any object with "questions" key
    ];

    let jsonStr: string | null = null;

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        jsonStr = match[1] || match[0];
        break;
      }
    }

    if (!jsonStr) return null;

    // Clean up common issues
    jsonStr = jsonStr.trim();
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(jsonStr);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return null;
    }

    // Validate and transform questions
    const questions = parsed.questions
      .map((q: any, idx: number): QuizQuestion | null => {
        if (!q.text && !q.question) return null;

        const type = (q.type || "mcq") as QuestionType;

        const question: QuizQuestion = {
          id: `q-${idx}`,
          number: q.number || idx + 1,
          type,
          text: q.text || q.question, // handle both field names
        };

        // Add options if MCQ
        if (
          (type === "mcq" || !type) &&
          q.options &&
          Array.isArray(q.options)
        ) {
          question.options = q.options.map((opt: any, optIdx: number) => ({
            id: opt.id || opt.label || String.fromCharCode(65 + optIdx),
            text: opt.text || opt.value || String(opt),
          }));
        }

        // Add image URL if present
        if (q.imageUrl) {
          question.imageUrl = q.imageUrl;
        }

        return question;
      })
      .filter((q): q is QuizQuestion => q !== null);

    if (questions.length === 0) return null;

    return {
      questions,
      description: parsed.description,
    };
  } catch (e) {
    console.error("[QuizParser] JSON parse failed:", e);
    return null;
  }
}

/**
 * Fallback: parse quiz from markdown-like format
 * Handles text like:
 * Q1. What is...?
 * A) Option A
 * B) Option B
 * C) Option C
 * D) Option D
 *
 * Also handles:
 * 1. What is...?
 * **1.** What is...?
 */
export function parseQuizMarkdown(content: string): QuizData | null {
  try {
    const lines = content.split("\n");
    const questions: QuizQuestion[] = [];
    let currentQuestion: Partial<QuizQuestion> | null = null;
    let currentOptions: { id: string; text: string }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect question start — multiple patterns
      const qMatch = trimmed.match(
        /^(?:\*\*)?Q?\s*(\d+)[\.\)\:]?\s*\**\s*(.+)$/i
      );
      if (qMatch && qMatch[2]) {
        // Save previous question if exists
        if (currentQuestion) {
          if (currentOptions.length > 0) {
            currentQuestion.options = currentOptions;
            currentQuestion.type = "mcq";
          }
          if (currentQuestion.text) {
            questions.push(currentQuestion as QuizQuestion);
          }
        }

        currentQuestion = {
          id: `q-${questions.length}`,
          number: questions.length + 1,
          text: qMatch[2].replace(/\*\*/g, "").trim(),
          type: "mcq",
        };
        currentOptions = [];
        continue;
      }

      // Detect options (A), B), A., A:, etc.)
      const optMatch = trimmed.match(/^(?:\*\*)?([A-D])[\.)\]\:]\s*\**\s*(.+)$/);
      if (optMatch && currentQuestion) {
        const optionId = optMatch[1].toUpperCase();
        currentOptions.push({
          id: optionId,
          text: optMatch[2].replace(/\*\*/g, "").trim(),
        });
        continue;
      }
    }

    // Push last question
    if (currentQuestion) {
      if (currentOptions.length > 0) {
        currentQuestion.options = currentOptions;
        currentQuestion.type = "mcq";
      }
      if (currentQuestion.text) {
        questions.push(currentQuestion as QuizQuestion);
      }
    }

    if (questions.length === 0) return null;

    return { questions };
  } catch (e) {
    console.error("[QuizParser] Markdown parse failed:", e);
    return null;
  }
}

/**
 * Main parser: try JSON first, then markdown
 */
export function parseQuizResponse(content: string): QuizData | null {
  // Try JSON first
  let parsed = parseQuizJSON(content);
  if (parsed) {
    console.log("[Quiz] Parsed JSON format with", parsed.questions.length, "questions");
    return parsed;
  }

  // Fallback to markdown
  parsed = parseQuizMarkdown(content);
  if (parsed) {
    console.log("[Quiz] Parsed markdown format with", parsed.questions.length, "questions");
    return parsed;
  }

  console.warn("[Quiz] Could not parse quiz response. Content preview:", content.slice(0, 200));
  return null;
}
