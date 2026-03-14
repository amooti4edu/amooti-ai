// ============================================================================
//  models.config.ts
//  Single source of truth for all model tiers, providers, and limits.
//  To add a new model: add one entry to the appropriate tier array.
//  To change a model: update the model string — nothing else changes.
// ============================================================================

export type Mode = "query" | "quiz" | "teacher";
export type Tier = "free" | "basic" | "premium" | "enterprise";

export interface ModelEntry {
  /** Human-readable label for logs */
  label: string;
  /** API endpoint base URL */
  providerUrl: string;
  /** Model identifier string sent to the provider */
  model: string;
  /** Env var name that holds the API key */
  apiKeyEnv: string;
  /** Whether this model reliably handles tool/function calling */
  supportsTools: boolean;
  /**
   * Some providers (Ollama) return NDJSON instead of SSE.
   * Set to true to run the NDJSON → SSE transform.
   */
  requiresNDJSONTransform?: boolean;
}

export interface TierConfig {
  /** Questions allowed per day */
  dailyLimit: number;
  /** Which modes are available to this tier */
  allowedModes: Mode[];
  /** Ordered provider/model list — first healthy entry wins */
  models: ModelEntry[];
}

import {
  PRIMARY_PROVIDER,
  PRIMARY_URL,
  PRIMARY_KEY,
} from "./provider.config.ts";

// ── Direct provider URLs (used for specific fallbacks only) ───────────────────

const CEREBRAS_URL    = "https://api.cerebras.ai/v1/chat/completions";
const OLLAMA_URL      = "https://ollama.com/api/chat";
const OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_URL      = "https://api.openai.com/v1/chat/completions";
const GOOGLE_URL      = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const CLOUDFLARE_URL  = "https://api.cloudflare.com/client/v4/accounts/";

// ── Tier definitions ──────────────────────────────────────────────────────────

export const TIER_CONFIG: Record<Tier, TierConfig> = {

  // ── FREE — 5 questions/day ──────────────────────────────────────────────────
  free: {
    dailyLimit:   5,
    allowedModes: ["query", "quiz"],
    models: [
      {
        label:         "Cerebras GPT-OSS 120B",
        providerUrl:   CEREBRAS_URL,
        model:         "gpt-oss-120b",
        apiKeyEnv:     "CEREBRAS_API_KEY",
        supportsTools: false,   // fast enough to attempt; fallback handled if it fails
      },
      {
        // Ollama Cloud — NDJSON stream, needs transform flag
        label:                   "Ollama Cloud GPT-OSS 120B",
        providerUrl:             OLLAMA_URL,
        model:                   "gpt-oss:120b-cloud",
        apiKeyEnv:               "OLLAMA_API_KEY",
        supportsTools:           false,
        requiresNDJSONTransform: true,
      },
      {
        label:         "Llama 3.1 70B (OpenRouter free)",
        providerUrl:   OPENROUTER_URL,
        model:         "meta-llama/llama-3.3-70b-instruct:free",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
      {
        label:         "Mistral 7B (OpenRouter free)",
        providerUrl:   OPENROUTER_URL,
        model:         "mistralai/mistral-7b-instruct:free",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
      {
        // Last resort — OpenRouter picks the best available free model
        label:         "OpenRouter auto (free)",
        providerUrl:   OPENROUTER_URL,
        model:         "openrouter/auto",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
    ],
  },

  // ── BASIC — 10 questions/day (7,000 UGX/month) ─────────────────────────────
  // 4 models, cheapest to best. Each model: Cloudflare→OpenRouter, OpenRouter direct, provider direct.
  basic: {
    dailyLimit:   10,
    allowedModes: ["query", "quiz"],
    models: [
      // ── Model 1: GPT-5 Nano ──────────────────────────────────────────────────
      { label: "GPT-5 Nano (Cloudflare→OpenRouter)",  providerUrl: PRIMARY_URL,  model: "openai/gpt-5-nano",                   apiKeyEnv: PRIMARY_KEY,        supportsTools: true  },
      { label: "GPT-5 Nano (OpenRouter direct)",       providerUrl: OPENROUTER_URL, model: "openai/gpt-5-nano",                 apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true  },
      { label: "GPT-5 Nano (OpenAI direct)",           providerUrl: OPENAI_URL,   model: "gpt-4o-mini",                         apiKeyEnv: "OPENAI_API_KEY",   supportsTools: true  },
      // ── Model 2: GPT-4o Mini ────────────────────────────────────────────────
      { label: "GPT-4o Mini (Cloudflare→OpenRouter)", providerUrl: PRIMARY_URL,  model: "openai/gpt-4o-mini",                  apiKeyEnv: PRIMARY_KEY,        supportsTools: true  },
      { label: "GPT-4o Mini (OpenRouter direct)",      providerUrl: OPENROUTER_URL, model: "openai/gpt-4o-mini",               apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true  },
      { label: "GPT-4o Mini (OpenAI direct)",          providerUrl: OPENAI_URL,   model: "gpt-4o-mini",                         apiKeyEnv: "OPENAI_API_KEY",   supportsTools: true  },
      // ── Model 3: DeepSeek V3 ────────────────────────────────────────────────
      { label: "DeepSeek V3 (Cloudflare→OpenRouter)", providerUrl: PRIMARY_URL,  model: "deepseek/deepseek-v3.2",              apiKeyEnv: PRIMARY_KEY,        supportsTools: false },
      { label: "DeepSeek V3 (OpenRouter direct)",      providerUrl: OPENROUTER_URL, model: "deepseek/deepseek-v3.2",           apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: false },
    //{ label: "DeepSeek V3 (Direct)",                  providerUrl: ,   model: "deepseek/deepseek-v3.2",            apiKeyEnv: "",   supportsTools: true  },
      // ── Model 4: Meta Llama ─────────────────────────────────────────────────
      { label: "Meta Llama (Cloudflare→OpenRouter)",  providerUrl: PRIMARY_URL,  model: "meta-llama/llama-3.3-70b-instruct",  apiKeyEnv: PRIMARY_KEY,        supportsTools: false },
      { label: "Meta Llama (OpenRouter direct)",       providerUrl: OPENROUTER_URL, model: "meta-llama/llama-3.3-70b-instruct", apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: false },
    //{ label: "Meta Llama (Direct)",                 providerUrl: ,   model: "meta-llama/llama-3.3-70b-instruct",     apiKeyEnv: "",   supportsTools: true  },
    ],
  },

  // ── PREMIUM — 20 questions/day (15,000 UGX/month) — teachers included ───────
  // 4 models, cheapest to best. Each model: Cloudflare→OpenRouter, OpenRouter direct, provider direct.
  premium: {
    dailyLimit:   20,
    allowedModes: ["query", "quiz", "teacher"],
    models: [
      // ── Model 1: Grok 4 Fast ────────────────────────────────────────────────
      { label: "Grok 4 Fast (Cloudflare→OpenRouter)",     providerUrl: PRIMARY_URL,    model: "x-ai/grok-4-fast",              apiKeyEnv: PRIMARY_KEY,          supportsTools: true  },
      { label: "Grok 4 Fast (OpenRouter direct)",          providerUrl: OPENROUTER_URL, model: "x-ai/grok-4-fast",              apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true  },
    //{ label: "Grok 4 Fast (Direct fallback)",            providerUrl: ,     model: "x-ai/grok-4-fast",              apiKeyEnv: "",     supportsTools: true  },
      // ── Model 2: Gemini 3.1 Flashlite ─────────────────────────────────────────────
      { label: "Gemini 3.1 Flashlite (Cloudflare→OpenRouter)",  providerUrl: PRIMARY_URL,    model: "google/gemini-3.1-flash-lite-preview",               apiKeyEnv: PRIMARY_KEY,          supportsTools: true  },
      { label: "Gemini 3.1 Flashlite (OpenRouter direct)",       providerUrl: OPENROUTER_URL, model: "google/gemini-3.1-flash-lite-preview",               apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true  },
      { label: "Gemini 3.1 Flashlite (Google direct)",           providerUrl: GOOGLE_URL,     model: "google/gemini-3.1-flash-lite-preview",              apiKeyEnv: "GOOGLE_API_KEY",     supportsTools: true  },
      // ── Model 3: Gemini 2.5 Flash ───────────────────────────────────────────
      { label: "Gemini 2.5 Flash (Cloudflare→OpenRouter)", providerUrl: PRIMARY_URL,    model: "google/gemini-2.5-flash",       apiKeyEnv: PRIMARY_KEY,          supportsTools: true  },
      { label: "Gemini 2.5 Flash (OpenRouter direct)",     providerUrl: OPENROUTER_URL, model: "google/gemini-2.5-flash",       apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true  },
      { label: "Gemini 2.5 Flash (Google direct)",         providerUrl: GOOGLE_URL,     model: "gemini-2.5-flash",              apiKeyEnv: "GOOGLE_API_KEY",     supportsTools: true  },
 // ── Model 4: DeepSeek V3 ────────────────────────────────────────────────
      { label: "DeepSeek V3 (Cloudflare→OpenRouter)",     providerUrl: PRIMARY_URL,    model: "deepseek/deepseek-v3.2",        apiKeyEnv: PRIMARY_KEY,          supportsTools: false },
      { label: "DeepSeek V3 (OpenRouter direct)",          providerUrl: OPENROUTER_URL, model: "deepseek/deepseek-v3.2",        apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: false },
      { label: "DeepSeek V3 (Gemini fallback)",            providerUrl: GOOGLE_URL,     model: "gemini-2.5-flash",              apiKeyEnv: "GOOGLE_API_KEY",     supportsTools: true  },
    ],
  },

  // ── ENTERPRISE — 100 questions/day (custom negotiated pricing) ───────────────
  // 4 models, cheapest to best. Each model: Cloudflare→OpenRouter, OpenRouter direct, provider direct.
  enterprise: {
    dailyLimit:   100,
    allowedModes: ["query", "quiz", "teacher"],
    models: [
      // ── Model 1: GPT-5 Nano ──────────────────────────────────────────────────
      { label: "GPT-5 Nano (Cloudflare→OpenRouter)",      providerUrl: PRIMARY_URL,    model: "openai/gpt-5-nano",                    apiKeyEnv: PRIMARY_KEY,          supportsTools: true },
      { label: "GPT-5 Nano (OpenRouter direct)",           providerUrl: OPENROUTER_URL, model: "openai/gpt-5-nano",                    apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true },
      { label: "GPT-5 Nano (OpenAI direct)",               providerUrl: OPENAI_URL,     model: "openai/gpt-5-nano",                   apiKeyEnv: "OPENAI_API_KEY",     supportsTools: true },
      // ── Model 2: Gemini 2.5 Flash Lite ──────────────────────────────────────
      { label: "Gemini Flash Lite (Cloudflare→OpenRouter)", providerUrl: PRIMARY_URL,    model: "google/gemini-2.5-flash-lite",        apiKeyEnv: PRIMARY_KEY,          supportsTools: true },
      { label: "Gemini Flash Lite (OpenRouter direct)",     providerUrl: OPENROUTER_URL, model: "google/gemini-2.5-flash-lite",        apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true },
      { label: "Gemini Flash Lite (Google direct)",         providerUrl: GOOGLE_URL,     model: "gemini-2.5-flash-lite",               apiKeyEnv: "GOOGLE_API_KEY",     supportsTools: true },
      // ── Model 3: GPT-4o Mini ────────────────────────────────────────────────
      { label: "GPT-4o Mini (Cloudflare→OpenRouter)",     providerUrl: PRIMARY_URL,    model: "openai/gpt-4o-mini",                   apiKeyEnv: PRIMARY_KEY,          supportsTools: true },
      { label: "GPT-4o Mini (OpenRouter direct)",          providerUrl: OPENROUTER_URL, model: "openai/gpt-4o-mini",                   apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true },
      { label: "GPT-4o Mini (OpenAI direct)",              providerUrl: OPENAI_URL,     model: "gpt-4o-mini",                          apiKeyEnv: "OPENAI_API_KEY",     supportsTools: true },
      // ── Model 4: Grok 4.1 Fast ──────────────────────────────────────────────
      { label: "Grok 4.1 Fast (Cloudflare→OpenRouter)",   providerUrl: PRIMARY_URL,    model: "x-ai/grok-4.1-fast",                  apiKeyEnv: PRIMARY_KEY,          supportsTools: true },
      { label: "Grok 4.1 Fast (OpenRouter direct)",        providerUrl: OPENROUTER_URL, model: "x-ai/grok-4.1-fast",                  apiKeyEnv: "OPENROUTER_API_KEY", supportsTools: true },
   // { label: "Grok 4.1 Fast (Gemini fallback)",          providerUrl: GOOGLE_URL,     model: "gemini-2.5-flash",                    apiKeyEnv: "GOOGLE_API_KEY",     supportsTools: true },
    ],
  },
};

// ── Embedding config ──────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  label:      string;
  url:        string;
  model:      string;
  apiKeyEnv:  string;
  dimensions: number;
  /** Account ID required for Cloudflare Workers AI (will be appended to URL) */
  accountIdEnv?: string;
}

export const EMBEDDING_PROVIDERS: EmbeddingProvider[] = [
  {
    label:        "BGE-M3 (Cloudflare Workers AI)",
    url:          CLOUDFLARE_URL,
    model:        "@cf/baai/bge-m3",
    apiKeyEnv:    "CLOUDFLARE_API_KEY",
    accountIdEnv: "CLOUDFLARE_ACCOUNT_ID",
    dimensions:   1024,
  },
  {
    label:      "BGE-M3 (OpenRouter fallback)",
    url:        "https://openrouter.ai/api/v1/embeddings",
    model:      "baai/bge-m3",
    apiKeyEnv:  "OPENROUTER_API_KEY",
    dimensions: 1024,
  },
  {
    // Bifrost gateway — only active when BIFROST_API_KEY + BIFROST_URL are set
    label:      "BGE-M3 (Bifrost fallback)",
    url:        (Deno.env.get("BIFROST_URL") ?? "http://localhost:8080") + "/api/v1/embeddings",
    model:      "baai/bge-m3",
    apiKeyEnv:  "BIFROST_API_KEY",
    dimensions: 1024,
  },
];

// ── Context thresholds ────────────────────────────────────────────────────────

export const SIMILARITY_THRESHOLD  = 0.45;  // minimum cosine similarity to use a result
export const CONCEPT_MATCH_COUNT   = 5;     // how many concept nodes to fetch
export const TOPIC_MATCH_COUNT     = 3;     // how many topic nodes to fetch
export const PREREQ_DEPTH          = 2;     // how deep to walk prerequisite graph
export const PROGRESS_TIMEOUT_MS   = 300;   // max ms to wait for student progress fetch

// ── Rate limiting ─────────────────────────────────────────────────────────────

export const RATE_LIMIT_WINDOW_MS  = 60 * 1000;  // 1 minute rolling window
export const RATE_LIMIT_MAX_BURST  = 5;           // max requests per window regardless of tier
