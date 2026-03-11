// ============================================================================
//  streaming.ts
//  Provider fallback chain, SSE streaming, tool-call accumulation,
//  and markdown sanitization.
//  Anthropic messages API has a different request/response shape —
//  we normalise it to OpenAI-compatible SSE here.
// ============================================================================

import type { ModelEntry, TierConfig } from "./models.config.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCall {
  id:       string;
  function: { name: string; arguments: string };
}

export interface AccumulatedResponse {
  content:   string;
  toolCalls: ToolCall[] | null;
}

// ── Markdown sanitizer ────────────────────────────────────────────────────────

export function sanitizeMarkdown(text: string): string {
  // Normalise LaTeX delimiters
  text = text.replace(/\\\[\s*/g, "\n$$\n").replace(/\s*\\\]/g, "\n$$\n");
  text = text.replace(/\\\(\s*/g, "$").replace(/\s*\\\)/g, "$");
  // Python/None literals that slip through
  text = text.replace(/\bNone\b/g, "null");
  // HTML line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Bullet immediately after a word
  text = text.replace(/(\S)(•|-(?=\s))/g, "$1\n$2");
  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ── Anthropic normalizer ──────────────────────────────────────────────────────
// Converts Anthropic Messages API response to OpenAI-compatible SSE

function anthropicToSSE(response: Response): Response {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let   buffer  = "";

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            // Anthropic streaming events
            if (parsed.type === "content_block_delta") {
              const text = parsed.delta?.text ?? "";
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      choices: [{ delta: { content: text } }]
                    })}\n\n`
                  )
                );
              }
            }
            // Tool use in Anthropic format
            if (parsed.type === "content_block_start" &&
                parsed.content_block?.type === "tool_use") {
              // Emit as a tool_calls delta in OpenAI format
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{
                      delta: {
                        tool_calls: [{
                          index: 0,
                          id:    parsed.content_block.id,
                          type:  "function",
                          function: { name: parsed.content_block.name, arguments: "" }
                        }]
                      }
                    }]
                  })}\n\n`
                )
              );
            }
            if (parsed.type === "content_block_delta" &&
                parsed.delta?.type === "input_json_delta") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{
                      delta: {
                        tool_calls: [{
                          index: 0,
                          function: { arguments: parsed.delta.partial_json ?? "" }
                        }]
                      }
                    }]
                  })}\n\n`
                )
              );
            }
          } catch { /* skip malformed */ }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// ── Ollama Cloud NDJSON → SSE normalizer ─────────────────────────────────────
// Ollama Cloud returns newline-delimited JSON, not SSE.
// Each line: {"model":"...","message":{"role":"assistant","content":"..."}}

function ollamaToSSE(response: Response): Response {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let   buffer  = "";
  let   chunks  = 0;

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Flush any remaining buffer content
          if (buffer.trim()) {
            try {
              const parsed  = JSON.parse(buffer.trim());
              const content = parsed.message?.content ?? "";
              if (content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
                  )
                );
              }
            } catch { /* ignore malformed trailing data */ }
          }
          console.log(`[Stream] Ollama Cloud complete — ${chunks} chunks`);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed  = JSON.parse(line);
            // Skip the final done message
            if (parsed.done === true) continue;
            const content = parsed.message?.content ?? "";
            if (content) {
              chunks++;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
                )
              );
            }
          } catch { /* skip malformed lines */ }
        }
      } catch (err) {
        console.error("[Stream] Ollama Cloud read error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// ── Single provider request ───────────────────────────────────────────────────

async function fetchFromProvider(
  entry:    ModelEntry,
  messages: unknown[],
  tools?:   unknown[],
): Promise<Response | null> {
  const apiKey = Deno.env.get(entry.apiKeyEnv);
  if (!apiKey) {
    console.warn(`[Stream] Skipping ${entry.label} — ${entry.apiKeyEnv} not set`);
    return null;
  }

  console.log(`[Stream] Trying ${entry.label}…`);

  // ── Anthropic has a different request shape ───────────────────────────────
  const isAnthropic = entry.providerUrl.includes("anthropic.com");

  let body: Record<string, unknown>;

  if (isAnthropic) {
    // Extract system from messages array (Anthropic takes it separately)
    const systemMsg = (messages as any[]).find((m) => m.role === "system");
    const chatMsgs  = (messages as any[]).filter((m) => m.role !== "system");

    body = {
      model:      entry.model,
      max_tokens: 4096,
      stream:     true,
      system:     systemMsg?.content ?? "",
      messages:   chatMsgs,
    };
    if (tools?.length && entry.supportsTools) {
      body.tools = (tools as any[]).map((t: any) => ({
        name:        t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }
  } else {
    body = {
      model:    entry.model,
      stream:   true,
      messages,
    };
    if (tools?.length && entry.supportsTools) {
      body.tools       = tools;
      body.tool_choice = "auto";
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isAnthropic) {
    headers["x-api-key"]         = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(entry.providerUrl, {
      method: "POST",
      headers,
      body:   JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[Stream] ${entry.label} → ${res.status}: ${text.slice(0, 200)}`);
      // Don't retry on auth errors
      if (res.status === 401 || res.status === 403) return null;
      // Propagate rate limit so caller can surface it
      if (res.status === 429 || res.status === 402) {
        return new Response(text, { status: res.status });
      }
      return null;
    }

    console.log(`[Stream] ✓ ${entry.label} streaming`);

    // Normalise response format to OpenAI-compatible SSE
    if (isAnthropic)                    return anthropicToSSE(res);
    if (entry.requiresNDJSONTransform)  return ollamaToSSE(res);
    return res;

  } catch (err) {
    console.warn(`[Stream] ${entry.label} exception:`, err);
    return null;
  }
}

// ── Provider fallback chain ───────────────────────────────────────────────────

export async function getStreamingResponse(
  tierConfig: TierConfig,
  messages:   unknown[],
  tools?:     unknown[],
): Promise<Response> {
  for (const entry of tierConfig.models) {
    // Only pass tools to models that support them
    const effectiveTools = entry.supportsTools ? tools : undefined;
    const res = await fetchFromProvider(entry, messages, effectiveTools);

    if (res && res.ok !== false) {
      // Tag the response with which model was used (for logs)
      console.log(`[Stream] Using: ${entry.label}`);
      return res;
    }
  }

  throw new Error("All providers in tier failed — check API keys and model availability");
}

// ── SSE accumulator ───────────────────────────────────────────────────────────
// Reads a full SSE stream and extracts content + tool calls.
// Only used when we need to inspect for tool calls before proceeding.

export async function accumulateSSE(response: Response): Promise<AccumulatedResponse> {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";
  let   content = "";

  const toolAccumulators: Record<number, { id: string; name: string; arguments: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta  = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) content += delta.content;

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolAccumulators[idx]) {
              toolAccumulators[idx] = { id: tc.id ?? "", name: "", arguments: "" };
            }
            if (tc.id)                      toolAccumulators[idx].id        = tc.id;
            if (tc.function?.name)          toolAccumulators[idx].name      += tc.function.name;
            if (tc.function?.arguments)     toolAccumulators[idx].arguments += tc.function.arguments;
          }
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  const entries = Object.values(toolAccumulators);
  const toolCalls = entries.length > 0
    ? entries.map((tc) => ({
        id:       tc.id,
        function: { name: tc.name, arguments: tc.arguments },
      }))
    : null;

  return { content, toolCalls };
}

// ── Final answer streamer ─────────────────────────────────────────────────────
// Takes accumulated text, sanitizes it, re-emits word-by-word as SSE.

export function streamFinalAnswer(text: string): Response {
  const sanitized = sanitizeMarkdown(text);
  const encoder   = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const words = sanitized.match(/\S+\s*/g) ?? [];
      for (const word of words) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`
          )
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

// ── Pipe stream through sanitizer ────────────────────────────────────────────
// Used when we get a live stream and want to sanitize before forwarding.

// ── Pipe stream through sanitizer (chunk-by-chunk) ───────────────────────────
// Previous version buffered the entire response before emitting anything,
// killing the streaming UX. This version sanitizes incrementally at sentence
// boundaries so tokens reach the client as they arrive.
//
// Strategy:
//   • Accumulate delta tokens into a sentence buffer.
//   • When a sentence boundary (. ! ? \n) is detected, sanitize and flush.
//   • Flush any remaining buffer at stream end.

export function sanitizeStream(response: Response): Response {
  const reader  = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let   lineBuf = "";   // SSE line accumulator (cross-chunk)
  let   sentBuf = "";   // sentence accumulator (sanitized in batches)

  // Sentence boundary — flush when we see one of these
  const SENTENCE_END = /[.!?\n]/;

  function emit(controller: ReadableStreamDefaultController, text: string) {
    const sanitized = sanitizeMarkdown(text);
    if (!sanitized) return;
    // Emit word-by-word so the frontend types-in effect works
    const words = sanitized.match(/\S+\s*/g) ?? [];
    for (const word of words) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`
        )
      );
    }
  }

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          // Flush any remaining sentence buffer
          if (sentBuf.trim()) emit(controller, sentBuf);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        lineBuf += decoder.decode(value, { stream: true });
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content;
            if (!delta) continue;

            sentBuf += delta;

            // Flush when we hit a sentence boundary
            if (SENTENCE_END.test(delta)) {
              emit(controller, sentBuf);
              sentBuf = "";
            }
          } catch { /* skip malformed chunks */ }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
