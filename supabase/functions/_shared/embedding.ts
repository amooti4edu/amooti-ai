// ============================================================================
//  embedding.ts
//  Embed a query string with provider fallback chain.
// ============================================================================

import { EMBEDDING_PROVIDERS } from "./models.config.ts";

export async function embedQuery(text: string): Promise<number[] | null> {
  for (const provider of EMBEDDING_PROVIDERS) {
    const apiKey = Deno.env.get(provider.apiKeyEnv);
    if (!apiKey) {
      console.warn(`[Embedding] Skipping ${provider.label} — ${provider.apiKeyEnv} not set`);
      continue;
    }

    console.log(`[Embedding] Trying ${provider.label} for: "${text.slice(0, 80)}…"`);

    try {
      const res = await fetch(provider.url, {
        method:  "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ model: provider.model, input: text }),
      });

      if (!res.ok) {
        console.warn(`[Embedding] ${provider.label} error ${res.status}: ${await res.text()}`);
        continue;
      }

      const data      = await res.json();
      const embedding = data.data?.[0]?.embedding ?? null;

      if (!embedding || embedding.length !== provider.dimensions) {
        console.warn(`[Embedding] ${provider.label} bad response — dim: ${embedding?.length}`);
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
