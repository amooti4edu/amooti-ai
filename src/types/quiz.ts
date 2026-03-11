/**
 * Quiz flashcard types for quiz mode
 */

export type QuestionType = "mcq" | "short-answer" | "fill-in" | "calculation" | "long-answer";

export interface QuizOption {
  id: string; // "A", "B", "C", "D"
  text: string;
}

export interface QuizQuestion {
  id: string;
  number: number;
  type: QuestionType;
  text: string;
  options?: QuizOption[]; // Only for MCQ type
  imageUrl?: string; // For visual questions
}

export interface StudentAnswer {
  questionId: string;
  answer: string; // "A", "B", "C", "D" for MCQ, or free text
  isCorrect?: boolean;
  feedback?: string;
}

export interface QuizSession {
  questionSet: QuizQuestion[];
  currentIndex: number;
  studentAnswers: StudentAnswer[];
  isSubmitted: boolean;
  results?: QuizResults;
}

export interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  score: number; // percentage
  explanation: string;
  corrections: QuestionCorrection[];
}

export interface QuestionCorrection {
  questionNumber: number;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

/**
 * Parsed quiz data from AI response.
 * The model should return this structured format.
 */
export interface QuizData {
  questions: QuizQuestion[];
  description?: string;
}
