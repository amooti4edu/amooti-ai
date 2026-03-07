// ============================================================================
//  teacher/index.ts
//  Teacher edge function — premium only.
//  Non-streaming by default (teachers can wait for a complete document).
//  Streaming available via ?stream=true for live generation feel.
// ============================================================================

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildTeacherContext }                    from "../_shared/context-builder.ts";
import { jsonToDocx, uploadDocxAndGetUrl }        from "../_shared/docx-converter.ts";
import { buildTeacherPrompt }                     from "../_shared/prompts.ts";
import { executeTool, CURRICULUM_TOOLS }          from "../_shared/tools.ts";
import {
  getStreamingResponse,
  accumulateSSE,
  streamFinalAnswer,
  sanitizeMarkdown,
} from "../_shared/streaming.ts";
import { TIER_CONFIG } from "../_shared/models.config.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JSON fence extractor ──────────────────────────────────────────────────────
// LLM wraps its response in ```json ... ``` — strip the fence before parsing.

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw    = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`LLM response was not valid JSON: ${(err as Error).message}`);
  }
}

// ── Non-streaming accumulator (for document generation) ───────────────────────

async function generateDocument(
  messages: unknown[],
  sb:       any,
): Promise<string> {
  const tierConfig      = TIER_CONFIG["premium"];
  const MAX_TOOL_ROUNDS = 2;
  let   workingMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const streamRes = await getStreamingResponse(
      tierConfig, workingMessages, CURRICULUM_TOOLS
    );

    const ct = streamRes.headers.get("Content-Type") ?? "";
    if (!ct.includes("event-stream")) {
      throw new Error(`Provider error: ${streamRes.status}`);
    }

    const { content, toolCalls } = await accumulateSSE(streamRes);

    // No tool calls — LLM returned the document JSON directly
    if (!toolCalls || toolCalls.length === 0) {
      return content;   // do NOT sanitize — we need the raw JSON fence intact
    }

    // Execute tool calls and loop
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
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { /* ignore */ }
      const result = await executeTool(tc.function.name, args, sb);
      workingMessages.push({
        role:         "tool",
        tool_call_id: tc.id,
        content:      result,
      });
    }
  }

  // Final pass without tools
  const final          = await getStreamingResponse(TIER_CONFIG["premium"], workingMessages);
  const { content }    = await accumulateSSE(final);
  return content;   // raw JSON fence — do not sanitize
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const t0         = Date.now();
  const wantStream = new URL(req.url).searchParams.get("stream") === "true";

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env vars missing");

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required for teacher mode." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid token." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Premium check ────────────────────────────────────────────────────────
    const { data: profile } = await sb
      .from("profiles")
      .select("tier, role")
      .eq("id", user.id)
      .single();

    if (profile?.tier !== "premium") {
      return new Response(
        JSON.stringify({
          error: "Teacher mode requires a Premium plan (15,000 UGX/month).",
        }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Teacher] User: ${user.id} | Role: ${profile?.role}`);

    // ── Parse request ────────────────────────────────────────────────────────
    const {
      messages,
      subject,
      class: classVal,
    } = await req.json();

    const lastMsg = [...(messages as any[])]
      .filter((m) => m.role === "user")
      .pop()?.content ?? "";

    console.log(
      `[Teacher] Subject: ${subject ?? "—"} | Class: ${classVal ?? "—"} | ` +
      `Query: "${lastMsg.slice(0, 80)}…"`
    );

    // ── Build teacher context ────────────────────────────────────────────────
    // topicHint removed — Qdrant semantic search makes it redundant
    const ctx = await buildTeacherContext(sb, lastMsg, subject, classVal);
    console.log(`[Teacher] Context built | found: ${ctx.found} | topic: ${ctx.topic ?? "—"}`);

    // ── Build system prompt ──────────────────────────────────────────────────
    const systemPrompt = buildTeacherPrompt(ctx as any);

    // ── Assemble messages ────────────────────────────────────────────────────
    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // ── Streaming mode ───────────────────────────────────────────────────────
    // Returns the raw SSE stream — useful for showing live generation in the UI.
    // Client receives the JSON token by token; it must parse the fence on its end.
    if (wantStream) {
      const tierConfig = TIER_CONFIG["premium"];
      const streamRes  = await getStreamingResponse(tierConfig, llmMessages, CURRICULUM_TOOLS);
      return new Response(streamRes.body, {
        status:  streamRes.status,
        headers: { ...CORS, "Content-Type": "text/event-stream" },
      });
    }

    // ── Non-streaming — accumulate → parse JSON → build docx → upload ────────
    const rawResponse = await generateDocument(llmMessages, sb);
    console.log(`[Teacher] LLM done in ${Date.now() - t0}ms | ${rawResponse.length} chars`);

    // Parse the JSON fence from the LLM response
    const docJson = extractJson(rawResponse);
    const docType = (docJson.type as string) ?? "generic";
    console.log(`[Teacher] Document type: ${docType}`);

    // Build docx directly from structured JSON — no markdown parsing
    const docxStart = Date.now();
    const docxBytes = await jsonToDocx(docJson, subject, classVal, ctx.term);
    console.log(`[Teacher] DocX built in ${Date.now() - docxStart}ms | ${docxBytes.length} bytes`);

    // Upload to Supabase Storage and return a signed 1-hour download URL
    const downloadUrl = await uploadDocxAndGetUrl(
      sb,
      docxBytes,
      user.id,
      docType as any,
      subject,
    );

    console.log(`[Teacher] Total: ${Date.now() - t0}ms`);

    return new Response(
      JSON.stringify({
        content:      docJson,       // parsed document object for in-app preview
        download_url: downloadUrl,   // signed .docx download link (1 hour)
        expires_in:   3600,
        doc_type:     docType,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(`[Teacher] Error after ${Date.now() - t0}ms:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
