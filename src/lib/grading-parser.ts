/**
 * Parse grading response from AI into structured QuizResults
 * Handles markdown tables and text-based feedback
 */

import type { QuizResults, QuestionCorrection, QuizQuestion, StudentAnswer } from "@/types/quiz";

/**
 * Extract score from grading text
 * Handles: "2 / 7", "2/7", "Score: 28%", "Your Score: 2 / 7 ≈ 28 %"
 */
function extractScore(text: string, totalQuestions: number): { correct: number; score: number } | null {
  // Try "X / Y" or "X/Y" pattern
  const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const correct = parseInt(fractionMatch[1], 10);
    const total = parseInt(fractionMatch[2], 10);
    if (total > 0 && correct <= total) {
      return { correct, score: (correct / total) * 100 };
    }
  }

  // Try percentage pattern
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const score = parseFloat(pctMatch[1]);
    const correct = Math.round((score / 100) * totalQuestions);
    return { correct, score };
  }

  return null;
}

/**
 * Parse markdown table rows for corrections
 * Handles: | Q# | Your answer | Correct answer | Explanation |
 */
function parseCorrectionsFromTable(
  text: string,
  questions: QuizQuestion[]
): QuestionCorrection[] {
  const corrections: QuestionCorrection[] = [];

  // Split into lines and find table rows
  const lines = text.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip non-table lines and separator lines
    if (!trimmed.startsWith("|") || trimmed.match(/^\|[\s\-:]+\|/)) continue;
    
    const cells = trimmed.split("|").map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length < 4) continue;

    // Extract question number
    const qNumMatch = cells[0].replace(/\*/g, "").match(/(\d+)/);
    if (!qNumMatch) continue;
    
    const qNum = parseInt(qNumMatch[1], 10);
    const studentAnswer = cells[1].replace(/\*\*/g, "").trim();
    const correctAnswer = cells[2].replace(/\*\*/g, "").trim();
    const explanation = cells[3].replace(/\*\*/g, "").trim();

    // Determine if correct by comparing answers
    const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase() ||
      correctAnswer.toLowerCase().includes(studentAnswer.toLowerCase().charAt(0));

    const question = questions.find(q => q.number === qNum);

    corrections.push({
      questionNumber: qNum,
      question: question?.text || `Question ${qNum}`,
      studentAnswer,
      correctAnswer,
      explanation,
      isCorrect,
    });
  }

  return corrections;
}

/**
 * Parse corrections from non-table format
 * Handles numbered feedback like "Q1: Your answer B is incorrect. The correct answer is A because..."
 */
function parseCorrectionsFromText(
  text: string,
  questions: QuizQuestion[],
  studentAnswers: StudentAnswer[]
): QuestionCorrection[] {
  const corrections: QuestionCorrection[] = [];

  // Match patterns like "Question 1" or "Q1" or "**1**" sections
  const sections = text.split(/(?=(?:\*\*)?Q(?:uestion)?[\s\-]*\d|(?:\*\*)\d+(?:\*\*))/i);

  for (const section of sections) {
    const qMatch = section.match(/(?:\*\*)?Q?(?:uestion)?[\s\-]*(\d+)(?:\*\*)?/i);
    if (!qMatch) continue;

    const qNum = parseInt(qMatch[1], 10);
    const question = questions.find(q => q.number === qNum);
    const studentAns = studentAnswers.find(a => {
      const q = questions.find(q => q.id === a.questionId);
      return q?.number === qNum;
    });

    // Look for correct answer indicator
    const correctMatch = section.match(/correct\s+answer[:\s]*(?:is\s+)?(?:\*\*)?([A-D])[.\s)]/i);
    const correctAnswer = correctMatch ? correctMatch[1] : "";
    
    // Check for "correct" or "incorrect" keywords, or checkmark/X
    const isCorrect = /(?:✓|correct|excellent|well done|good)/i.test(section) && 
                      !/incorrect|wrong|not correct/i.test(section);

    corrections.push({
      questionNumber: qNum,
      question: question?.text || `Question ${qNum}`,
      studentAnswer: studentAns?.answer || "N/A",
      correctAnswer: correctAnswer || (isCorrect ? (studentAns?.answer || "") : "See explanation"),
      explanation: section.replace(/(?:\*\*)?Q?(?:uestion)?[\s\-]*\d+(?:\*\*)?[.\s:]*/i, "").trim().slice(0, 500),
      isCorrect,
    });
  }

  return corrections;
}

/**
 * Main grading parser: extract structured results from AI grading response
 */
export function parseGradingResponse(
  gradingContent: string,
  questions: QuizQuestion[],
  studentAnswers: StudentAnswer[]
): QuizResults {
  const totalQuestions = questions.length;

  console.log("[Grading] Parsing grading response for", totalQuestions, "questions");

  // Extract score
  const scoreData = extractScore(gradingContent, totalQuestions);

  // Try table-based corrections first
  let corrections = parseCorrectionsFromTable(gradingContent, questions);

  // Fallback to text-based parsing
  if (corrections.length === 0) {
    corrections = parseCorrectionsFromText(gradingContent, questions, studentAnswers);
  }

  // If we got corrections, count correct from them
  const correctFromCorrections = corrections.filter(c => c.isCorrect).length;

  // Determine correct count: prefer score extraction, fall back to corrections
  const correctAnswers = scoreData?.correct ?? correctFromCorrections;
  const score = scoreData?.score ?? (totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0);

  console.log("[Grading] Parsed score:", correctAnswers, "/", totalQuestions, `(${score.toFixed(1)}%)`);
  console.log("[Grading] Found", corrections.length, "corrections");

  // Fill in any missing questions in corrections
  if (corrections.length < totalQuestions) {
    for (const q of questions) {
      if (!corrections.find(c => c.questionNumber === q.number)) {
        const sa = studentAnswers.find(a => a.questionId === q.id);
        corrections.push({
          questionNumber: q.number,
          question: q.text,
          studentAnswer: sa?.answer || "N/A",
          correctAnswer: "See explanation",
          explanation: "No detailed feedback available for this question.",
          isCorrect: false,
        });
      }
    }
    corrections.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  return {
    totalQuestions,
    correctAnswers,
    score,
    explanation: gradingContent,
    corrections,
  };
}
