import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const QDRANT_URL = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");
    if (!QDRANT_API_KEY) throw new Error("QDRANT_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth: extract user from JWT
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
      const windowMs = 60 * 1000; // 1 minute window
      const maxRequests = 20;

      const { data: rl } = await supabaseAdmin
        .from("rate_limits")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (rl) {
        const windowStart = new Date(rl.window_start);
        if (now.getTime() - windowStart.getTime() < windowMs) {
          if (rl.request_count >= maxRequests) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await supabaseAdmin
            .from("rate_limits")
            .update({ request_count: rl.request_count + 1 })
            .eq("user_id", userId);
        } else {
          await supabaseAdmin
            .from("rate_limits")
            .update({ request_count: 1, window_start: now.toISOString() })
            .eq("user_id", userId);
        }
      } else {
        await supabaseAdmin
          .from("rate_limits")
          .insert({ user_id: userId, request_count: 1, window_start: now.toISOString() });
      }
    }

    const { messages, userRole } = await req.json();
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop()?.content || "";

    // Step 1: Get embedding for user query via Lovable AI
    const embeddingResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: lastUserMessage,
      }),
    });

    let ragContext = "";

    if (embeddingResp.ok) {
      const embData = await embeddingResp.json();
      const queryVector = embData.data?.[0]?.embedding;

      if (queryVector) {
        // Step 2: Query Qdrant for relevant documents
        const qdrantResp = await fetch(`${QDRANT_URL}/collections/amooti/points/search`, {
          method: "POST",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vector: queryVector,
            limit: 5,
            with_payload: true,
          }),
        });

        if (qdrantResp.ok) {
          const qdrantData = await qdrantResp.json();
          const results = qdrantData.result || [];
          ragContext = results
            .map((r: any) => r.payload?.text || r.payload?.content || JSON.stringify(r.payload))
            .join("\n\n---\n\n");
        }
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

    // Step 4: Stream response from Lovable AI
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await aiResp.text();
      console.error("AI error:", aiResp.status, text);
      throw new Error("AI gateway error");
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
