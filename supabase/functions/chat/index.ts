// ============================================================================
//  chat/index.ts
//  Student chat edge function — query and quiz modes.
//
//  Changes from previous version:
//    • Grading requests now build their OWN quiz context (embed the topic
//      query, fetch curriculum outcomes) instead of getting an empty context.
//      This gives the grader the same rich curriculum knowledge as the quizzer.
//    • Grading messages are trimmed to ONLY the quiz Q&A exchange — no history.
//    • Non-grading history trimmed from 30 → 5 messages (keeps costs down on
//      free-tier models while preserving enough conversational coherence).
//    • Soft subject filter in context builder (see context-builder.ts).
//    • IP-based rate limiting for anonymous requests.
//    • buildPrompt() now accepts a `grading` flag to route to a dedicated
//      grading-only system prompt (defined in prompts.ts).
// ============================================================================

import { serve }          from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient }   from "https://esm.sh/@supabase/supabase-js@2";

import { buildContext, buildQuizContext } from "../_shared/context-builder.ts";
import { buildPrompt }    from "../_shared/prompts.ts";
import { executeTool, CURRICULUM_TOOLS } from "../_shared/tools.ts";
import {
  getStreamingResponse,
  accumulateSSE,
  streamFinalAnswer,
  sanitizeStream,
} from "../_shared/streaming.ts";
import {
  TIER_CONFIG,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_BURST,
  type Mode,
  type Tier,
} from "../_shared/models.config.ts";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── How many recent messages to keep for each request type ───────────────────

const MAX_CHAT_HISTORY   = 5;   // non-grading: keep last 5 exchanges
const MAX_GRADING_MSGS   = 0;   // grading: NO prior history — just Q&A payload

// ── Rate limiter (authenticated users) ───────────────────────────────────────

async function checkUserRateLimit(
  userId: string,
  sb:     any,
  tier:   Tier,
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();

  // Check for a per-user custom limit (set directly in profiles for enterprise schools).
  // Falls back to the tier default if not set.
  let dailyLimit = TIER_CONFIG[tier]?.dailyLimit ?? TIER_CONFIG["free"].dailyLimit;
  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("custom_daily_limit")
      .eq("id", userId)
      .single();
    if (profile?.custom_daily_limit != null) {
      dailyLimit = profile.custom_daily_limit;
    }
  } catch { /* non-fatal — use tier default */ }

  try {
    const { data } = await sb
      .from("rate_limits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      const windowStart    = new Date(data.window_start);
      const isWithinWindow = now.getTime() - windowStart.getTime() < RATE_LIMIT_WINDOW_MS;

      if (isWithinWindow && data.burst_count >= RATE_LIMIT_MAX_BURST) {
        return { allowed: false, reason: "Too many requests. Please wait a moment." };
      }

      const today      = now.toISOString().slice(0, 10);
      const lastDay    = data.last_day ?? "";
      const dailyCount = lastDay === today ? (data.daily_count ?? 0) : 0;

      if (dailyCount >= dailyLimit) {
        return {
          allowed: false,
          reason: `Daily limit of ${dailyLimit} questions reached for your plan. Upgrade for more.`,
        };
      }

      await sb.from("rate_limits").update({
        burst_count:  isWithinWindow ? data.burst_count + 1 : 1,
        window_start: isWithinWindow ? data.window_start : now.toISOString(),
        daily_count:  lastDay === today ? dailyCount + 1 : 1,
        last_day:     today,
      }).eq("user_id", userId);

    } else {
      await sb.from("rate_limits").insert({
        user_id:      userId,
        burst_count:  1,
        window_start: now.toISOString(),
        daily_count:  1,
        last_day:     now.toISOString().slice(0, 10),
      });
    }

    return { allowed: true };

  } catch (err) {
    console.warn("[RateLimit] Error — allowing request:", err);
    return { allowed: true };
  }
}

// ── Rate limiter (anonymous / IP-based) ──────────────────────────────────────
// Light in-memory store — resets when the edge function cold-starts.
// Good enough to block burst abuse without needing a DB round-trip.

const _ipWindow = new Map<string, { count: number; resetAt: number }>();
const IP_LIMIT  = 10;   // requests per window
const IP_WINDOW = 60 * 1000;  // 1 minute

function checkIpRateLimit(ip: string): { allowed: boolean } {
  const now   = Date.now();
  const entry = _ipWindow.get(ip);

  if (!entry || now > entry.resetAt) {
    _ipWindow.set(ip, { count: 1, resetAt: now + IP_WINDOW });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > IP_LIMIT) {
    console.warn(`[RateLimit/IP] ${ip} exceeded ${IP_LIMIT} req/min`);
    return { allowed: false };
  }
  return { allowed: true };
}

// ── Message trimmer ───────────────────────────────────────────────────────────

function trimMessages(messages: unknown[], maxPairs: number): unknown[] {
  // Always keep the system message, trim chat turns from the front.
  const msgs = messages as any[];
  if (maxPairs === 0) return [];
  // Take the last N user+assistant pairs (2 * maxPairs messages)
  const chatMsgs = msgs.filter((m) => m.role !== "system");
  const keep     = chatMsgs.slice(-(maxPairs * 2));
  return keep;
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function runAgenticLoop(
  messages:   unknown[],
  tierConfig: typeof TIER_CONFIG[Tier],
  sb:         any,
): Promise<Response> {
  const MAX_TOOL_ROUNDS   = 2;
  let workingMessages     = [...messages];
  const tierHasToolSupport = tierConfig.models.some((m) => m.supportsTools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    const tools     = tierHasToolSupport ? CURRICULUM_TOOLS : undefined;
    const streamRes = await getStreamingResponse(tierConfig, workingMessages, tools);

    const ct = streamRes.headers.get("Content-Type") ?? "";
    if (!ct.includes("event-stream")) {
      console.error("[Agent] Non-stream response from provider");
      return streamRes;
    }

    const { content, toolCalls } = await accumulateSSE(streamRes);

    if (!toolCalls || toolCalls.length === 0) {
      console.log(`[Agent] Final answer on round ${round + 1}`);
      return streamFinalAnswer(content);
    }

    console.log(`[Agent] ${toolCalls.length} tool call(s) on round ${round + 1}`);

    workingMessages.push({
      role:       "assistant",
      content:    content || null,
      tool_calls: toolCalls.map((tc, i) => ({
        id:       tc.id || `tool_${round}_${i}`,
        type:     "function",
        function: tc.function,
      })),
    });

    for (const tc of toolCalls) {
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(tc.function.arguments ?? "{}");
      } catch {
        console.warn(`[Agent] Could not parse tool args for "${tc.function.name}"`);
      }

      const result = await executeTool(tc.function.name, toolArgs, sb);
      workingMessages.push({
        role:         "tool",
        tool_call_id: tc.id,
        content:      result,
      });
    }
  }

  console.warn(`[Agent] Hit MAX_TOOL_ROUNDS — final answer without tools`);
  const fallback = await getStreamingResponse(tierConfig, workingMessages);
  return sanitizeStream(fallback);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const t0 = Date.now();
  console.log(`[Chat] ${req.method} ${req.url}`);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env vars missing");

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Auth ───────────────────────────────────────────────────────────────
    let userId: string | null = null;
    let userTier: Tier        = "free";
    let userRole              = "individual";

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await sb
          .from("profiles")
          .select("tier, role")
          .eq("id", userId)
          .single();

        userTier = (profile?.tier as Tier) ?? "free";
        userRole = profile?.role ?? "individual";
        console.log(`[Auth] User: ${userId} | Tier: ${userTier} | Role: ${userRole}`);
      }
    } else {
      // Anonymous — apply IP rate limit
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
               ?? req.headers.get("cf-connecting-ip")
               ?? "unknown";
      const ipCheck = checkIpRateLimit(ip);
      if (!ipCheck.allowed) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait a moment." }),
          { status: 429, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
      console.log(`[Auth] Anonymous (IP: ${ip}) — free tier`);
    }

    const tierConfig = TIER_CONFIG[userTier];

    // ── Parse request ──────────────────────────────────────────────────────
    const body = await req.json();
    const {
      messages,
      mode        = "query" as Mode,
      grading     = false,
      subject,
      class:      classVal,
      topic,
      difficulty,
    } = body;

    // Validate mode
    if (!tierConfig.allowedModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Mode "${mode}" is not available on your plan.` }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Authenticated rate limit
    if (userId) {
      const { allowed, reason } = await checkUserRateLimit(userId, sb, userTier);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: reason }),
          { status: 429, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Step 1: Build context ──────────────────────────────────────────────
    //
    // GRADING: We skip the chat history but we DO build quiz context by
    // embedding the topic/subject query. This gives the grader the same
    // curriculum outcomes and concept definitions the quiz was built from,
    // so it can assess open-ended answers against the actual syllabus.
    //
    // NON-GRADING: normal context build from the latest user message.

    let ctx: Awaited<ReturnType<typeof buildContext>>;

    if (grading) {
      // Use topic + subject as the embedding query for grading context.
      // Falls back gracefully if neither is present.
      const gradingQuery = [topic, subject, classVal].filter(Boolean).join(" ") || "general";
      console.log(`[Chat] Grading — building quiz context for: "${gradingQuery}"`);
      const ctxStart = Date.now();
      ctx = await buildQuizContext(sb, gradingQuery, subject, classVal, userId ?? undefined);
      console.log(`[Chat] Grading context built in ${Date.now() - ctxStart}ms | found: ${ctx.found}`);
    } else {
      const lastUserMsg = [...(messages as any[])]
        .filter((m) => m.role === "user")
        .pop()?.content ?? "";

      console.log(
        `[Chat] Mode: ${mode} | Tier: ${userTier} | ` +
        `Subject: ${subject ?? "—"} | Class: ${classVal ?? "—"} | ` +
        `Query: "${lastUserMsg.slice(0, 80)}…"`
      );

      const ctxStart = Date.now();
      ctx = await buildContext(
        mode, sb, lastUserMsg, subject, classVal, userId ?? undefined, difficulty, topic,
      );
      console.log(`[Chat] Context built in ${Date.now() - ctxStart}ms | found: ${ctx.found}`);
    }

    // ── Step 2: Build system prompt ────────────────────────────────────────
    const systemPrompt = buildPrompt(mode, ctx, userRole, difficulty, grading);
    console.log(`[Chat] System prompt: ${systemPrompt.length} chars`);

    // ── Step 3: Trim messages ──────────────────────────────────────────────
    //
    // GRADING: send NO prior chat history — the grading payload (quiz
    // questions + student answers) is already in the final user message.
    // Sending history confuses models into re-generating the quiz.
    //
    // CHAT: keep last 5 exchanges (10 messages). Enough for coherence,
    // cheap enough for free-tier 7B models.

    const rawMsgs  = messages as any[];
    let chatHistory: any[];

    if (grading) {
      // Only the final user message (which contains all Q&A)
      const lastMsg = rawMsgs.filter((m) => m.role === "user").pop();
      chatHistory   = lastMsg ? [lastMsg] : [];
    } else {
      chatHistory = trimMessages(rawMsgs, MAX_CHAT_HISTORY);
    }

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
    ];

    // ── Step 4: Agentic loop ───────────────────────────────────────────────
    const agentStart = Date.now();
    const aiResponse = await runAgenticLoop(llmMessages, tierConfig, sb);
    console.log(
      `[Chat] Agent done in ${Date.now() - agentStart}ms | Total: ${Date.now() - t0}ms`
    );

    return new Response(aiResponse.body, {
      status:  aiResponse.status,
      headers: { ...CORS, "Content-Type": "text/event-stream" },
    });

  } catch (err) {
    console.error(`[Chat] Unhandled error after ${Date.now() - t0}ms:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});