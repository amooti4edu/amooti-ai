export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatMode = "query" | "quiz" | "teacher";
export type Tier = "free" | "basic" | "premium" | "enterprise";
export type Difficulty = "low" | "medium" | "high";

export interface TeacherDoc {
  // The teacher endpoint returns a structured JSON document object.
  // Typed as `any` because the shape varies by document type
  // (scheme_of_work, lesson_plan, assessment, topic_summary, progress_report).
  // TeacherResponse.tsx routes rendering based on doc.content.type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  downloadUrl: string;
  expiresAt: number; // timestamp ms
}

export interface ApiError {
  type: "rate_limit" | "forbidden" | "auth" | "server";
  message: string;
}

export const TIER_DAILY_LIMITS: Record<Tier, number> = {
  free: 5,
  basic: 10,
  premium: 20,
  enterprise: 100,
};
