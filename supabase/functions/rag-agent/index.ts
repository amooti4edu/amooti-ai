import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { searchCurriculum } from "./curriculum-tool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// Embedding Provider
// ============================================================================

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "baai/bge-m3",
        input: text,
      }),
    });

    if (!response.ok) {
      console.error("OpenRouter embedding error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding ?? null;
  } catch (error) {
    console.error("OpenRouter embedding exception:", error);
    return null;
  }
}

// ============================================================================
// Chat Providers (Fallback Chain: Cerebras → Ollama → OpenRouter)
// ============================================================================

async function chatCerebras(
  messages: any[],
  apiKey: string
): Promise<Response | null> {
  try {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-oss-20b",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      console.error("Cerebras error:", response.status);
      return null;
    }

    return response;
  } catch (error) {
    console.error("Cerebras exception:", error);
    return null;
  }
}

async function chatOllama(
  messages: any[],
  apiKey: string
): Promise<Response | null> {
  try {
    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-oss:120b",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      console.error("Ollama error:", response.status);
      return null;
    }

    // Validate response content type
    const contentType = response.headers.get("content-type") || "";
    const isValidStream =
      contentType.includes("json") ||
      contentType.includes("octet-stream") ||
      contentType.includes("text/event-stream");

    if (!isValidStream) {
      console.error("Ollama returned unexpected content-type:", contentType);
      return null;
    }

    // Transform Ollama's NDJSON stream into OpenAI-compatible SSE format
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffer content
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer.trim());
                const content = parsed.message?.content || "";
                if (content) {
                  const sseData = JSON.stringify({
                    choices: [{ delta: { content } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
              } catch {
                // Ignore unparseable final buffer
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const parsed = JSON.parse(line);
              const content = parsed.message?.content || "";
              if (content) {
                const sseData = JSON.stringify({
                  choices: [{ delta: { content } }],
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        } catch (error) {
          console.error("Ollama stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Ollama exception:", error);
    return null;
  }
}

async function chatOpenRouter(
  messages: any[],
  apiKey: string
): Promise<Response | null> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "cerebras/gpt-oss-20b",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded" }),
          { status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402 }
        );
      }
      console.error("OpenRouter chat error:", response.status);
      return null;
    }

    return response;
  } catch (error) {
    console.error("OpenRouter chat exception:", error);
    return null;
  }
}

async function getChatResponse(messages: any[]): Promise<Response> {
  const cerebrasKey = Deno.env.get("CEREBRAS_API_KEY");
  const ollamaKey = Deno.env.get("OLLAMA_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

  // Try Cerebras first
  if (cerebrasKey) {
    const response = await chatCerebras(messages, cerebrasKey);
    if (response) return response;
    console.warn("Cerebras failed, trying Ollama");
  }

  // Fall back to Ollama
  if (ollamaKey) {
    const response = await chatOllama(messages, ollamaKey);
    if (response) return response;
    console.warn("Ollama failed, trying OpenRouter");
  }

  // Final fallback to OpenRouter
  if (openRouterKey) {
    const response = await chatOpenRouter(messages, openRouterKey);
    if (response) return response;
  }

  throw new Error("All chat providers failed");
}

// ============================================================================
// Rate Limiting
// ============================================================================

async function enforceRateLimit(
  userId: string,
  supabaseAdmin: any
): Promise<boolean> {
  const now = new Date();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 20;

  const { data: rateLimit } = await supabaseAdmin
    .from("rate_limits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (rateLimit) {
    const windowStart = new Date(rateLimit.window_start);
    const isWithinWindow = now.getTime() - windowStart.getTime() < windowMs;

    if (isWithinWindow) {
      if (rateLimit.request_count >= maxRequests) {
        return false; // Rate limit exceeded
      }
      await supabaseAdmin
        .from("rate_limits")
        .update({ request_count: rateLimit.request_count + 1 })
        .eq("user_id", userId);
    } else {
      // Reset window
      await supabaseAdmin
        .from("rate_limits")
        .update({ request_count: 1, window_start: now.toISOString() })
        .eq("user_id", userId);
    }
  } else {
    // Create new rate limit entry
    await supabaseAdmin.from("rate_limits").insert({
      user_id: userId,
      request_count: 1,
      window_start: now.toISOString(),
    });
  }

  return true;
}

// ============================================================================
// System Prompt Builder
// ============================================================================

function buildSystemPrompt(ragContext: string, userRole: string): string {
  const hasContext = ragContext.trim().length > 0;

  const basePrompt = `You are Amooti, an AI study assistant for Uganda's secondary school students.

Your Role:
1. Help students understand concepts from a foundational level
2. Provide comprehensive, curriculum-aligned support using the context below`;

  const contextSection = hasContext
    ? `

CURRICULUM CONTEXT:
${ragContext}

How to Use This Context:
- Answer at the right level: Ensure depth and complexity match the student's current level
- Make connections: Link to topics they've already covered in previous terms or related subjects
- Follow curriculum standards: Align explanations with learning outcomes and teaching approaches
- Assess appropriately: When quizzing, use question types and difficulty levels that match curriculum expectations

The context includes:
• Student Profile: Level (Senior 1-4), current term, and subject progression
• Learning Progression: What they've learned, what they're studying, and what's coming next
• Cross-Subject Connections: Related topics and concepts from other subjects
• Pedagogical Framework: Teaching approaches, learning outcomes, suggested activities, and assessment methods

IMPORTANT: Provide all answers in plain text format. Do not use tables.

If you need additional curriculum details (assessment strategies, learning activities, connections to other terms), use the search_curriculum tool:

**Tool**: search_curriculum
**Parameters**: 
- query: (optional) specific search text
- subject: (optional) e.g., "Physics", "Biology"
- level: (optional) e.g., "Senior 1", "Senior 2"
- term: (optional) e.g., "Term 1", "Term 2"
- topic: (optional) specific topic name
- content_type: (optional) "learning_outcomes", "teaching_activities", "assessment_strategies", "ict_resources"
- limit: (optional) number of results, default 5

Use this tool sparingly—only when the initial context lacks what you truly need.`
    : `

NO CURRICULUM CONTEXT AVAILABLE

The curriculum database did not return relevant context for this query. This could mean:
- The topic is outside the Uganda curriculum scope
- The search didn't find matching content

Please answer from your general knowledge, but inform the student that you couldn't find specific curriculum materials for their query. You can still provide excellent educational support!

If you need to search the curriculum with specific filters, use the search_curriculum tool with parameters like subject, level, term, or content_type.`;

  const accountNote =
    userRole === "school"
      ? "\n\n**Account Type**: This is a school account used by multiple students. Keep responses general and educational without referencing personal conversation history."
      : "\n\n**Account Type**: This is an individual student account. You can reference conversation history for continuity and personalized learning.";

  return basePrompt + contextSection + accountNote;
}

// ============================================================================
// Tool Definitions
// ============================================================================

const CURRICULUM_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_curriculum",
    description:
      "Search the Uganda curriculum database with specific filters to get targeted educational content. Use this when the initial context is insufficient or when you need specific curriculum sections (e.g., assessment strategies, learning outcomes for a specific term/level).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional search query text",
        },
        subject: {
          type: "string",
          description: "Subject name (e.g., 'Physics', 'Biology', 'Mathematics')",
        },
        level: {
          type: "string",
          description:
            "Student level (e.g., 'Senior 1', 'Senior 2', 'Senior 3', 'Senior 4')",
        },
        term: {
          type: "string",
          description: "Academic term (e.g., 'Term 1', 'Term 2', 'Term 3')",
        },
        topic: {
          type: "string",
          description: "Specific topic name",
        },
        content_type: {
          type: "string",
          description: "Type of curriculum content needed",
          enum: [
            "learning_outcomes",
            "teaching_activities",
            "assessment_strategies",
            "ict_resources",
            "program_overview",
            "general_content",
          ],
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          default: 5,
        },
      },
    },
  },
};

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Load environment variables
    const QDRANT_URL = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");
    if (!QDRANT_API_KEY) throw new Error("QDRANT_API_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // Enforce rate limiting for authenticated users
    if (userId) {
      const allowed = await enforceRateLimit(userId, supabaseAdmin);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Parse request body
    const { messages, userRole } = await req.json();
    const lastUserMessage =
      messages.filter((m: any) => m.role === "user").pop()?.content || "";

    // Step 1: Generate embedding for semantic search
    const queryVector = await getEmbedding(lastUserMessage);
    let ragContext = "";

    if (queryVector) {
      // Step 2: Perform hybrid search against curriculum database
      const qdrantResponse = await fetch(
        `${QDRANT_URL}/collections/amooti/points/search`,
        {
          method: "POST",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vector: queryVector,
            limit: 18, // Optimal balance for comprehensive context
            with_payload: true,
          }),
        }
      );

      if (qdrantResponse.ok) {
        const qdrantData = await qdrantResponse.json();
        const results = qdrantData.result || [];
        ragContext = results
          .map(
            (r: any) =>
              r.payload?.text || r.payload?.content || JSON.stringify(r.payload)
          )
          .join("\n\n---\n\n");
      }
    }

    // Step 3: Build system prompt with curriculum grounding
    const systemPrompt = buildSystemPrompt(ragContext, userRole || "individual");

    // Step 4: Prepare messages with tool support
    const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Step 5: Stream response
    const aiResponse = await getChatResponse(fullMessages);

    // Check if response is an error (JSON content type)
    const contentType = aiResponse.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const body = await aiResponse.text();
      return new Response(body, {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream successful response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("rag-agent error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
