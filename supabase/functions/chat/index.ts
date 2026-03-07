// ============================================================================
//  chat/index.ts
//  Student chat edge function.
//  Handles query and quiz modes.
//  Context is always built first. Tools are a fallback only.
// ============================================================================

import { serve }          from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient }   from "https://esm.sh/@supabase/supabase-js@2";

import { buildContext }   from "../_shared/context-builder.ts";
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

// ── Rate limiter ──────────────────────────────────────────────────────────────

async function checkRateLimit(
  userId: string,
  sb:     any,
  tier:   Tier,
): Promise<{ allowed: boolean; reason?: string }> {
  const now       = new Date();
  const dailyLimit = TIER_CONFIG[tier].dailyLimit;

  try {
    const { data } = await sb
      .from("rate_limits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      const windowStart    = new Date(data.window_start);
      const isWithinWindow = now.getTime() - windowStart.getTime() < RATE_LIMIT_WINDOW_MS;

      // Burst check (per-minute)
      if (isWithinWindow && data.burst_count >= RATE_LIMIT_MAX_BURST) {
        return { allowed: false, reason: "Too many requests. Please wait a moment." };
      }

      // Daily check
      const today          = now.toISOString().slice(0, 10);
      const lastDay        = data.last_day ?? "";
      const dailyCount     = lastDay === today ? (data.daily_count ?? 0) : 0;

      if (dailyCount >= dailyLimit) {
        return {
          allowed: false,
          reason: `Daily limit of ${dailyLimit} questions reached for your plan. Upgrade for more.`,
        };
      }

      // Update counts
      await sb.from("rate_limits").update({
        burst_count:  isWithinWindow ? data.burst_count + 1 : 1,
        window_start: isWithinWindow ? data.window_start : now.toISOString(),
        daily_count:  lastDay === today ? dailyCount + 1 : 1,
        last_day:     today,
      }).eq("user_id", userId);

    } else {
      // First request
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
    // Don't block on rate limit errors
    console.warn("[RateLimit] Error — allowing request:", err);
    return { allowed: true };
  }
}

// ── Agentic loop ──────────────────────────────────────────────────────────────
// Context is pre-built. Tools are only called if the model requests them
// AND the model supports tools. Max 2 tool rounds to keep costs down.

async function runAgenticLoop(
  messages:   unknown[],
  tierConfig: typeof TIER_CONFIG[Tier],
  sb:         any,
): Promise<Response> {
  const MAX_TOOL_ROUNDS = 2;
  let workingMessages = [...messages];

  // Check if ANY model in this tier supports tools
  const tierHasToolSupport = tierConfig.models.some((m) => m.supportsTools);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    // Only pass tools if the tier has at least one tool-capable model
    const tools = tierHasToolSupport ? CURRICULUM_TOOLS : undefined;

    const streamRes = await getStreamingResponse(tierConfig, workingMessages, tools);

    // Non-stream response = provider error — propagate
    const ct = streamRes.headers.get("Content-Type") ?? "";
    if (!ct.includes("event-stream")) {
      console.error("[Agent] Non-stream response from provider");
      return streamRes;
    }

    // Accumulate to check for tool calls
    const { content, toolCalls } = await accumulateSSE(streamRes);

    // No tool calls — this is the final answer
    if (!toolCalls || toolCalls.length === 0) {
      console.log(`[Agent] Final answer on round ${round + 1}`);
      return streamFinalAnswer(content);
    }

    // ── Tool calls ──────────────────────────────────────────────────────────
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

  // Hit max rounds — final answer without tools
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
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env vars missing");

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Auth (optional — anonymous users get free-tier context) ────────────
    let userId: string | null   = null;
    let userTier: Tier          = "free";
    let userRole                = "individual";

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) {
        userId = user.id;
        // Fetch tier from user metadata or a profiles table
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
      console.log("[Auth] Anonymous — free tier");
    }

    const tierConfig = TIER_CONFIG[userTier];

    // ── Parse request ───────────────────────────────────────────────────────
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

    // Validate mode against tier
    if (!tierConfig.allowedModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `Mode "${mode}" is not available on your plan.` }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting (authenticated users only)
    if (userId) {
      const { allowed, reason } = await checkRateLimit(userId, sb, userTier);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: reason }),
          { status: 429, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
    }

    // Extract the latest user message for context building
    const lastUserMsg = [...(messages as any[])]
      .filter((m) => m.role === "user")
      .pop()?.content ?? "";

    console.log(
      `[Chat] Mode: ${mode} | Tier: ${userTier} | ` +
      `Subject: ${subject ?? "—"} | Class: ${classVal ?? "—"} | ` +
      `Query: "${lastUserMsg.slice(0, 80)}…"`
    );

    // ── Step 1: Build context (skip for grading requests) ─────────────────
    let ctx: Awaited<ReturnType<typeof buildContext>>;

    if (grading) {
      console.log(`[Chat] Grading request — skipping context/embedding`);
      ctx = { found: false, concepts: [], topics: [] } as any;
    } else {
      const ctxStart = Date.now();
      ctx = await buildContext(
        mode,
        sb,
        lastUserMsg,
        subject,
        classVal,
        userId ?? undefined,
        difficulty,
        topic,
      );
      console.log(`[Chat] Context built in ${Date.now() - ctxStart}ms | found: ${ctx.found}`);
    }

    // ── Step 2: Build system prompt ─────────────────────────────────────────
    const systemPrompt = buildPrompt(mode, ctx, userRole, difficulty);
    console.log(`[Chat] System prompt: ${systemPrompt.length} chars`);

    // ── Step 3: Assemble messages for LLM ──────────────────────────────────
    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // ── Step 4: Agentic loop ────────────────────────────────────────────────
    const agentStart = Date.now();
    const aiResponse = await runAgenticLoop(llmMessages, tierConfig, sb);
    console.log(
      `[Chat] Agent done in ${Date.now() - agentStart}ms | ` +
      `Total: ${Date.now() - t0}ms`
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
