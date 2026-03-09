// ============================================================================
//  embedding.ts
//  Embed a query string with provider fallback chain.
// ============================================================================

import { EMBEDDING_PROVIDERS, type EmbeddingProvider } from "./models.config.ts";

function buildProviderUrl(provider: EmbeddingProvider): string | null {
  // If provider has accountIdEnv, construct Cloudflare URL
  if (provider.accountIdEnv) {
    const accountId = Deno.env.get(provider.accountIdEnv);
    if (!accountId) {
      console.warn(`[Embedding] ${provider.label} — ${provider.accountIdEnv} not set, cannot construct URL`);
      return null;
    }
    // Construct Cloudflare Workers AI URL: baseURL + accountId + /ai/v1/embeddings
    return `${provider.url}${accountId}/ai/v1/embeddings`;
  }
  
  // Otherwise return the URL as-is
  return provider.url;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  for (const provider of EMBEDDING_PROVIDERS) {
    const apiKey = Deno.env.get(provider.apiKeyEnv);
    if (!apiKey) {
      console.warn(`[Embedding] Skipping ${provider.label} — ${provider.apiKeyEnv} not set`);
      continue;
    }

    // Build the full URL (especially important for Cloudflare which needs account ID)
    const fullUrl = buildProviderUrl(provider);
    if (!fullUrl) {
      console.warn(`[Embedding] Skipping ${provider.label} — could not build URL`);
      continue;
    }

    console.log(`[Embedding] Trying ${provider.label} for: "${text.slice(0, 80)}…"`);

    try {
      // Prepare headers (Cloudflare uses different auth header format)
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      // Cloudflare uses Bearer token, OpenRouter also uses Bearer
      // Both work with the same Authorization header format
      headers["Authorization"] = `Bearer ${apiKey}`;

      // For OpenRouter, add extra identifying headers (optional but recommended)
      if (provider.url.includes("openrouter.ai")) {
        headers["HTTP-Referer"] = "https://yourapp.com"; // Replace with your app URL
        headers["X-Title"] = "Your App Name"; // Replace with your app name
      }

      const res = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          model: provider.model, 
          input: text 
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[Embedding] ${provider.label} error ${res.status}: ${errorText}`);
        continue;
      }

      const data = await res.json();
      
      // Handle different response formats
      let embedding: number[] | null = null;
      
      // Cloudflare format (OpenAI-compatible)
      if (data.result?.data?.[0]?.embedding) {
        embedding = data.result.data[0].embedding;
      } 
      // OpenRouter format
      else if (data.data?.[0]?.embedding) {
        embedding = data.data[0].embedding;
      }
      // Direct data array format
      else if (data.data?.[0]?.embedding) {
        embedding = data.data[0].embedding;
      }

      if (!embedding || embedding.length !== provider.dimensions) {
        console.warn(`[Embedding] ${provider.label} bad response — expected ${provider.dimensions}d, got ${embedding?.length || 0}d`);
        continue;
      }

      console.log(`[Embedding] ✓ ${provider.label} — ${embedding.length}d`);
      return embedding;

    } catch (err) {
      console.warn(`[Embedding] ${provider.label} exception:`, err);
      continue;
    }
  }

  console.error("[Embedding] All providers failed");
  return null;
}
