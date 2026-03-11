import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type {
  QuizSession,
  QuizQuestion,
  StudentAnswer,
  QuizResults,
} from "@/types/quiz";

interface FlashcardQuizProps {
  session: QuizSession;
  onAnswerChange: (questionId: string, answer: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: () => void;
  onNavigate: (index: number) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

// Question types that have an explicit renderer below
const HANDLED_TYPES = ["mcq", "short-answer", "fill-in", "calculation", "long-answer"];

export function FlashcardQuiz({
  session,
  onAnswerChange,
  onNext,
  onPrevious,
  onSubmit,
  onNavigate,
  onClose,
  isSubmitting = false,
}: FlashcardQuizProps) {
  const { questionSet, currentIndex, studentAnswers, isSubmitted, results } =
    session;
  const currentQuestion = questionSet[currentIndex];
  const currentAnswer =
    studentAnswers.find((a) => a.questionId === currentQuestion.id)?.answer || "";
  const totalQuestions = questionSet.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  if (isSubmitted && results) {
    return <QuizResultsView results={results} totalQuestions={totalQuestions} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      {/* Close button */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          ← Back to chat
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{currentQuestion.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* MCQ Options */}
          {currentQuestion.type === "mcq" && currentQuestion.options && (
            <RadioGroup
              value={currentAnswer}
              onValueChange={(val) => onAnswerChange(currentQuestion.id, val)}
            >
              <div className="space-y-3">
                {currentQuestion.options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.id} id={option.id} />
                    <Label htmlFor={option.id} className="cursor-pointer flex-1">
                      <span className="font-semibold">{option.id}.</span> {option.text}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}

          {/* Short answer / fill-in */}
          {(currentQuestion.type === "short-answer" ||
            currentQuestion.type === "fill-in") && (
            <Input
              placeholder="Type your answer..."
              value={currentAnswer}
              onChange={(e) => onAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full"
            />
          )}

          {/* Calculation */}
          {currentQuestion.type === "calculation" && (
            <Input
              placeholder="Enter your answer (number)"
              type="number"
              value={currentAnswer}
              onChange={(e) => onAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full"
            />
          )}

          {/* Long answer — FIX: was missing, caused blank question card */}
          {currentQuestion.type === "long-answer" && (
            <textarea
              placeholder="Write your answer here..."
              value={currentAnswer}
              onChange={(e) => onAnswerChange(currentQuestion.id, e.target.value)}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[120px]"
            />
          )}

          {/* Fallback: any unrecognised question type gets a textarea so
              it never silently renders nothing */}
          {!HANDLED_TYPES.includes(currentQuestion.type) && (
            <textarea
              placeholder="Write your answer here..."
              value={currentAnswer}
              onChange={(e) => onAnswerChange(currentQuestion.id, e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[80px]"
            />
          )}

          {/* Question image if available */}
          {currentQuestion.imageUrl && (
            <img
              src={currentQuestion.imageUrl}
              alt="Question visual"
              className="max-w-full h-auto rounded-lg my-4"
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3">
        <Button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          variant="outline"
        >
          Previous
        </Button>

        <div className="space-x-2">
          {currentIndex < totalQuestions - 1 ? (
            <Button onClick={onNext} disabled={!currentAnswer}>
              Next
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={isSubmitting || studentAnswers.length < totalQuestions}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Submitting..." : "Submit Quiz"}
            </Button>
          )}
        </div>
      </div>

      {/* Answer status dots */}
      <div className="flex gap-2 flex-wrap">
        {questionSet.map((q, idx) => {
          const hasAnswer = studentAnswers.some((a) => a.questionId === q.id);
          return (
            <button
              key={q.id}
              onClick={() => onNavigate(idx)}
              className={`w-10 h-10 rounded flex items-center justify-center text-sm font-semibold transition-colors ${
                idx === currentIndex
                  ? "border-2 border-primary bg-primary/10 text-primary"
                  : hasAnswer
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Display quiz results with corrections
 */
function QuizResultsView({
  results,
  totalQuestions,
}: {
  results: QuizResults;
  totalQuestions: number;
}) {
  const scoreColor =
    results.score >= 80
      ? "text-green-600"
      : results.score >= 60
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      {/* Score summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your Score</p>
              <p className={`text-4xl font-bold ${scoreColor}`}>
                {results.score.toFixed(1)}%
              </p>
              <p className="text-base text-muted-foreground">
                {results.correctAnswers} out of {totalQuestions} correct
              </p>
            </div>
            <div className={`${scoreColor}`}>
              {results.score >= 80 ? (
                <CheckCircle2 size={64} />
              ) : results.score >= 60 ? (
                <AlertCircle size={64} />
              ) : (
                <XCircle size={64} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Corrections */}
      {results.corrections.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Corrections & Feedback</h3>
          {results.corrections.map((correction, idx) => (
            <Card
              key={idx}
              className={
                correction.isCorrect
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Question {correction.questionNumber}
                    </p>
                    <p className="font-medium">{correction.question}</p>
                  </div>
                  {correction.isCorrect ? (
                    <CheckCircle2 className="text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="text-destructive flex-shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-mono bg-muted p-2 rounded">
                    {correction.studentAnswer}
                  </p>
                </div>
                {!correction.isCorrect && (
                  <div>
                    <p className="text-muted-foreground">Correct answer:</p>
                    <p className="font-mono bg-green-500/10 p-2 rounded text-green-700 dark:text-green-400">
                      {correction.correctAnswer}
                    </p>
                  </div>
                )}
                {correction.explanation && (
                  <div className="bg-muted/50 p-2 rounded border-l-2 border-primary">
                    <p className="text-sm">{correction.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
