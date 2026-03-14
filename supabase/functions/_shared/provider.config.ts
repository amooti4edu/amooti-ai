// ============================================================================
//  provider.config.ts
//  Controls which gateway is PRIMARY for paid-tier model calls.
//
//  Set ONE env var to switch everything:
//    PRIMARY_PROVIDER=cloudflare  → Cloudflare AI Gateway first, OpenRouter backup  ← recommended for production
//    PRIMARY_PROVIDER=openrouter  → OpenRouter first, Cloudflare backup             ← default for dev
//    PRIMARY_PROVIDER=bifrost     → Bifrost first, Cloudflare backup                ← if you self-host Bifrost
//
//  Free-tier models are NEVER routed through this — they stay hardcoded
//  to their original providers (Cerebras, OpenRouter free, Ollama).
//
//  Required env vars:
//    OPENROUTER_API_KEY          always needed (primary or backup)
//    CF_ACCOUNT_ID               your Cloudflare account ID
//    CF_GATEWAY_ID               your gateway name (e.g. "amooti")
//    CF_AIG_TOKEN                Cloudflare AI Gateway auth token (optional but recommended)
//    BIFROST_URL                 only if using Bifrost
//    BIFROST_API_KEY             only if using Bifrost
// ============================================================================

export type ProviderName = "openrouter" | "cloudflare" | "bifrost";

// ── Read env var (default: openrouter) ───────────────────────────────────────

function resolveProvider(): ProviderName {
  const val = Deno.env.get("PRIMARY_PROVIDER") ?? "openrouter";
  if (val === "cloudflare") return "cloudflare";
  if (val === "bifrost")    return "bifrost";
  return "openrouter";
}

export const PRIMARY_PROVIDER: ProviderName = resolveProvider();

// ── Cloudflare AI Gateway URL builder ────────────────────────────────────────
// Cloudflare proxies each provider under its own path segment.
// Format: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}/...

const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") ?? "";
const CF_GATEWAY_ID = Deno.env.get("CF_GATEWAY_ID") ?? "amooti";
const CF_BASE       = `https://gateway.ai.cloudflare.com/v1/${CF_ACCOUNT_ID}/${CF_GATEWAY_ID}`;

// The OpenRouter path through Cloudflare — same models, same API key, just proxied
export const CF_OPENROUTER_URL = `${CF_BASE}/openrouter/v1/chat/completions`;

// Direct provider paths through Cloudflare (used as fallbacks inside the gateway)
export const CF_GOOGLE_URL     = `${CF_BASE}/google-ai-studio/v1/chat/completions`;
export const CF_ANTHROPIC_URL  = `${CF_BASE}/anthropic/v1/messages`;

// ── Provider base URLs ────────────────────────────────────────────────────────

export const PROVIDER_URLS: Record<ProviderName, string> = {
  cloudflare: CF_OPENROUTER_URL,
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  bifrost:    (Deno.env.get("BIFROST_URL") ?? "http://localhost:8080") + "/api/v1/chat/completions",
};

export const PROVIDER_KEY_ENVS: Record<ProviderName, string> = {
  cloudflare: "OPENROUTER_API_KEY",   // same key — Cloudflare just proxies to OpenRouter
  openrouter: "OPENROUTER_API_KEY",
  bifrost:    "BIFROST_API_KEY",
};

// ── Backup provider ───────────────────────────────────────────────────────────
// When primary fails, automatic fallback order:
//   cloudflare → openrouter (direct)
//   openrouter → cloudflare
//   bifrost    → cloudflare

export const BACKUP_PROVIDER: ProviderName =
  PRIMARY_PROVIDER === "cloudflare" ? "openrouter" :
  PRIMARY_PROVIDER === "bifrost"    ? "cloudflare" :
  "cloudflare";

export const PRIMARY_URL  = PROVIDER_URLS[PRIMARY_PROVIDER];
export const PRIMARY_KEY  = PROVIDER_KEY_ENVS[PRIMARY_PROVIDER];
export const BACKUP_URL   = PROVIDER_URLS[BACKUP_PROVIDER];
export const BACKUP_KEY   = PROVIDER_KEY_ENVS[BACKUP_PROVIDER];

// ── Cloudflare AI Gateway headers ─────────────────────────────────────────────
// cf-aig-authorization: authenticates your gateway (prevents others using your gateway URL)
// cf-aig-cache-ttl:     cache identical prompts for this many seconds
// cf-skip-cache:        set to "true" on a request to bypass cache when needed

export function cloudflareCacheHeaders(): Record<string, string> {
  const token = Deno.env.get("CF_AIG_TOKEN");
  const headers: Record<string, string> = {
    "cf-aig-cache-ttl": "3600",  // cache responses for 1 hour
  };
  if (token) {
    headers["cf-aig-authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── Bifrost semantic cache headers ────────────────────────────────────────────

export const BIFROST_CACHE_HEADERS: Record<string, string> = {
  "x-bifrost-cache-mode":      "semantic",
  "x-bifrost-cache-ttl":       "3600",
  "x-bifrost-cache-threshold": "0.92",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isCloudflareEntry(providerUrl: string): boolean {
  return providerUrl.includes("gateway.ai.cloudflare.com");
}

export function isBifrostEntry(providerUrl: string): boolean {
  const bifrostBase = Deno.env.get("BIFROST_URL") ?? "localhost:8080";
  return providerUrl.includes(bifrostBase) || providerUrl.includes("bifrost");
}