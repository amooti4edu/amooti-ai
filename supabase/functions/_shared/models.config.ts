// ============================================================================
//  models.config.ts
//  Single source of truth for all model tiers, providers, and limits.
//  To add a new model: add one entry to the appropriate tier array.
//  To change a model: update the model string — nothing else changes.
// ============================================================================

export type Mode = "query" | "quiz" | "teacher";
export type Tier = "free" | "basic" | "premium";

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

// ── Shared provider URLs ──────────────────────────────────────────────────────

const CEREBRAS_URL    = "https://api.cerebras.ai/v1/chat/completions";
const OLLAMA_URL      = "https://ollama.com/api/chat";   // Ollama Cloud (NDJSON, not SSE)
const OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions";
const GOOGLE_URL      = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const ANTHROPIC_URL   = "https://api.anthropic.com/v1/messages";

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
        supportsTools: true,   // fast enough to attempt; fallback handled if it fails
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
        model:         "meta-llama/llama-3.1-70b-instruct:free",
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
  basic: {
    dailyLimit:   10,
    allowedModes: ["query", "quiz"],
    models: [
      {
        label:         "Gemini 2.5 Flash (Google)",
        providerUrl:   GOOGLE_URL,
        model:         "gemini-2.5-flash-preview-05-20",
        apiKeyEnv:     "GOOGLE_API_KEY",
        supportsTools: true,
      },
      {
        label:         "Gemini 2.5 Flash (OpenRouter)",
        providerUrl:   OPENROUTER_URL,
        model:         "google/gemini-2.5-flash",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: true,
      },
      {
        label:         "DeepSeek V3 (OpenRouter)",
        providerUrl:   OPENROUTER_URL,
        model:         "deepseek/deepseek-v3.2",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
      {
        label:         "Meta Llama (OpenRouter)",
        providerUrl:   OPENROUTER_URL,
        model:         "meta-llama/llama-3.3-70b-instruct:free",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
      {
        label:         "GPT-4o Mini (OpenRouter)",
        providerUrl:   OPENROUTER_URL,
        model:         "openai/gpt-4o-mini",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: true,
      },
      {
        label:                   "Ollama Cloud GPT-OSS 120B (fallback)",
        providerUrl:             OLLAMA_URL,
        model:                   "gpt-oss:120b-cloud",
        apiKeyEnv:               "OLLAMA_API_KEY",
        supportsTools:           false,
        requiresNDJSONTransform: true,
      },
    ],
  },

  // ── PREMIUM — 20 questions/day (15,000 UGX/month) — teachers included ───────
  premium: {
    dailyLimit:   20,
    allowedModes: ["query", "quiz", "teacher"],
    models: [
      {
        label:         "Gemini 2.5 Pro (Google)",
        providerUrl:   GOOGLE_URL,
        model:         "gemini-2.5-pro-preview-06-05",
        apiKeyEnv:     "GOOGLE_API_KEY",
        supportsTools: true,
      },
      {
        label:         "Gemini 2.5 Pro (OpenRouter)",
        providerUrl:   OPENROUTER_URL,
        model:         "google/gemini-2.5-pro-preview",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: true,
      },
      {
        label:         "Claude Haiku 4.5 (Anthropic)",
        providerUrl:   ANTHROPIC_URL,
        model:         "claude-haiku-4-5-20251001",
        apiKeyEnv:     "ANTHROPIC_API_KEY",
        supportsTools: true,
      },
      {
        label:         "Gemini 2.5 Flash (Google fallback)",
        providerUrl:   GOOGLE_URL,
        model:         "google/gemini-2.5-flash",
        apiKeyEnv:     "GOOGLE_API_KEY",
        supportsTools: true,
      },
      {
        label:         "DeepSeek V3 (OpenRouter fallback)",
        providerUrl:   OPENROUTER_URL,
        model:         "deepseek/deepseek-v3.2",
        apiKeyEnv:     "OPENROUTER_API_KEY",
        supportsTools: false,
      },
      {
        label:                   "Ollama Cloud GPT-OSS 120B (fallback)",
        providerUrl:             OLLAMA_URL,
        model:                   "gpt-oss:120b-cloud",
        apiKeyEnv:               "OLLAMA_API_KEY",
        supportsTools:           false,
        requiresNDJSONTransform: true,
      },
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
}

export const EMBEDDING_PROVIDERS: EmbeddingProvider[] = [
  {
    label:      "BGE-M3 (OpenRouter)",
    url:        "https://openrouter.ai/api/v1/embeddings",
    model:      "baai/bge-m3",
    apiKeyEnv:  "OPENROUTER_API_KEY",
    dimensions: 1024,
  },
  // Add fallback embedding providers here when needed, e.g.:
  // {
  //   label:     "BGE-M3 (alternative provider)",
  //   url:       "https://...",
  //   model:     "baai/bge-m3",
  //   apiKeyEnv: "ALT_EMBED_API_KEY",
  //   dimensions: 1024,
  // },
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
