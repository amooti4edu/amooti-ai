export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type ChatMode = "query" | "quiz" | "teacher";
export type Tier = "free" | "basic" | "premium" | "enterprise";
export type Difficulty = "low" | "medium" | "high";

export interface TeacherDoc {
  content: string;
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
