import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Embedding providers (BAAI/bge-m3) ---

async function getEmbeddingHuggingFace(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api-inference.huggingface.co/models/BAAI/bge-m3", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text }),
    });
    if (!resp.ok) { console.error("HF embedding error:", resp.status); return null; }
    const data = await resp.json();
    // HF returns array of embeddings; bge-m3 returns [vector] or vector directly
    if (Array.isArray(data) && Array.isArray(data[0])) return data[0];
    if (Array.isArray(data)) return data;
    return null;
  } catch (e) { console.error("HF embedding exception:", e); return null; }
}

async function getEmbeddingOpenRouter(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "baai/bge-m3", input: text }),
    });
    if (!resp.ok) { console.error("OpenRouter embedding error:", resp.status); return null; }
    const data = await resp.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (e) { console.error("OpenRouter embedding exception:", e); return null; }
}

async function getEmbedding(text: string): Promise<number[] | null> {
  const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");
  const orKey = Deno.env.get("OPENROUTER_API_KEY");

  if (hfKey) {
    const vec = await getEmbeddingHuggingFace(text, hfKey);
    if (vec) return vec;
    console.warn("HF embedding failed, trying OpenRouter fallback");
  }
  if (orKey) {
    return await getEmbeddingOpenRouter(text, orKey);
  }
  console.error("No embedding provider available");
  return null;
}

// --- Chat providers ---

async function chatCerebras(messages: any[], apiKey: string): Promise<Response | null> {
  try {
    const resp = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss-20b", messages, stream: true }),
    });
    if (!resp.ok) { console.error("Cerebras error:", resp.status); return null; }
    return resp;
  } catch (e) { console.error("Cerebras exception:", e); return null; }
}

async function chatOllama(messages: any[], apiKey: string): Promise<Response | null> {
  try {
    const resp = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-oss:120b", messages, stream: true }),
    });
    if (!resp.ok) { console.error("Ollama error:", resp.status); return null; }
    return resp;
  } catch (e) { console.error("Ollama exception:", e); return null; }
}

async function chatOpenRouter(messages: any[], apiKey: string): Promise<Response | null> {
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "cerebras/gpt-oss-20b", messages, stream: true }),
    });
    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limits exceeded" }), { status: 429 });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402 });
      console.error("OpenRouter chat error:", resp.status);
      return null;
    }
    return resp;
  } catch (e) { console.error("OpenRouter chat exception:", e); return null; }
}

async function getChatResponse(messages: any[]): Promise<Response> {
  const cerebrasKey = Deno.env.get("CEREBRAS_API_KEY");
  const ollamaKey = Deno.env.get("OLLAMA_API_KEY");
  const orKey = Deno.env.get("OPENROUTER_API_KEY");

  // Cerebras first
  if (cerebrasKey) {
    const resp = await chatCerebras(messages, cerebrasKey);
    if (resp) return resp;
    console.warn("Cerebras failed, trying Ollama");
  }

  // Ollama second
  if (ollamaKey) {
    const resp = await chatOllama(messages, ollamaKey);
    if (resp) return resp;
    console.warn("Ollama failed, trying OpenRouter");
  }

  // OpenRouter third
  if (orKey) {
    const resp = await chatOpenRouter(messages, orKey);
    if (resp) return resp;
  }

  throw new Error("All chat providers failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const QDRANT_URL = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");
    if (!QDRANT_API_KEY) throw new Error("QDRANT_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // Rate limiting
    if (userId) {
      const now = new Date();
      const windowMs = 60 * 1000;
      const maxRequests = 20;

      const { data: rl } = await supabaseAdmin
        .from("rate_limits").select("*").eq("user_id", userId).single();

      if (rl) {
        const windowStart = new Date(rl.window_start);
        if (now.getTime() - windowStart.getTime() < windowMs) {
          if (rl.request_count >= maxRequests) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await supabaseAdmin.from("rate_limits")
            .update({ request_count: rl.request_count + 1 }).eq("user_id", userId);
        } else {
          await supabaseAdmin.from("rate_limits")
            .update({ request_count: 1, window_start: now.toISOString() }).eq("user_id", userId);
        }
      } else {
        await supabaseAdmin.from("rate_limits")
          .insert({ user_id: userId, request_count: 1, window_start: now.toISOString() });
      }
    }

    const { messages, userRole } = await req.json();
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()?.content || "";

    // Step 1: Get embedding via BAAI/bge-m3 (HF → OpenRouter fallback)
    const queryVector = await getEmbedding(lastUserMessage);
    let ragContext = "";

    if (queryVector) {
      // Step 2: Hybrid search on Qdrant
      const qdrantResp = await fetch(`${QDRANT_URL}/collections/amooti/points/search`, {
        method: "POST",
        headers: { "api-key": QDRANT_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ vector: queryVector, limit: 5, with_payload: true }),
      });

      if (qdrantResp.ok) {
        const qdrantData = await qdrantResp.json();
        const results = qdrantData.result || [];
        ragContext = results
          .map((r: any) => r.payload?.text || r.payload?.content || JSON.stringify(r.payload))
          .join("\n\n---\n\n");
      }
    }

    // Step 3: Build system prompt with RAG context
    const systemPrompt = `You are Amooti, a helpful AI study assistant for students. You help answer educational questions using the provided context from educational materials.

${ragContext ? `## Relevant Educational Context
${ragContext}

## Instructions
- Use the above context to answer the user's question accurately.
- If the context contains the answer, use it directly.
- If the context partially relates, synthesize what you can and note any gaps.
- If the context is NOT relevant to the question, answer from your general knowledge but let the user know the educational materials didn't cover this specific topic.
- Be clear, educational, and helpful. Use examples when appropriate.
- Format responses with markdown for readability.` : `No relevant context was found in the educational materials for this query. Answer from your general knowledge and let the user know.`}

${userRole === "school" ? "This is a school account used by multiple people. Keep responses general and educational." : "This is a student account. You can reference their conversation history for continuity."}`;

    // Step 4: Stream response via Cerebras → Ollama → OpenRouter fallback
    const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
    const aiResp = await getChatResponse(fullMessages);

    // Check if it's an error response from fallback
    if (aiResp.headers.get("Content-Type")?.includes("application/json")) {
      const body = await aiResp.text();
      return new Response(body, {
        status: aiResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rag-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
