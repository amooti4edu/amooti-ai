# Amooti — AI Study Companion for Uganda's O-Level Students

**Built by Domus Dei Tech · 2026**

Amooti is a curriculum-grounded AI study companion for Uganda's O-Level secondary school students (S1–S4) and their teachers. It answers questions, generates quizzes, and produces professional teaching documents — all anchored to the actual Uganda O-Level syllabus stored in Supabase.

---

## Table of Contents

1. [What Amooti Does](#1-what-amooti-does)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Curriculum Knowledge Graph](#5-curriculum-knowledge-graph)
6. [Supabase Edge Functions](#6-supabase-edge-functions)
7. [AI Models & Tier Configuration](#7-ai-models--tier-configuration)
8. [Chat Modes](#8-chat-modes)
9. [Teacher Mode & Document Generation](#9-teacher-mode--document-generation)
10. [Authentication & User Roles](#10-authentication--user-roles)
11. [Rate Limiting & Quotas](#11-rate-limiting--quotas)
12. [Pricing Plans](#12-pricing-plans)
13. [Environment Variables](#13-environment-variables)
14. [Local Development](#14-local-development)
15. [Deployment](#15-deployment)

---

## 1. What Amooti Does

- **Query mode** — students ask curriculum questions and get structured, syllabus-aligned answers with worked examples, practice questions, and a YouTube link
- **Quiz mode** — AI generates a 5–10 question quiz (MCQ + short answer + long answer) from the relevant outcomes, then grades and explains the student's answers
- **Teacher mode** *(premium only)* — teachers request lesson plans, schemes of work, or topic summaries and receive a downloadable `.docx` file built from official curriculum data
- **Persistent conversations** — student chat history is saved per-conversation in Supabase and can be resumed at any time
- **Progress tracking** — student interactions and quiz scores are stored in `student_progress` and fed back into the AI context to calibrate difficulty

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing | React Router v6 |
| State / Data | TanStack Query v5 |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | Supabase (PostgreSQL 17 on `eu-west-1`) |
| Vector search | Qdrant (external) + pgvector fallback |
| Embeddings | BGE-M3 via Cloudflare Workers AI (OpenRouter fallback) |
| Edge functions | Supabase Edge Functions (Deno) |
| AI providers | Cerebras · OpenRouter · OpenAI · Google Gemini · xAI Grok · DeepSeek (multi-tier cascade) |
| Document generation | `docx` v8 (Deno-compatible) → Supabase Storage |
| Payments | PesaPal (reference stored on `subscriptions` table) |
| Deployment | Vercel (SPA, all routes rewrite to `/index.html`) |
| Rendering extras | KaTeX (math), highlight.js (code), react-markdown + remark-gfm |

---

## 3. Project Structure

```
amooti-ai-main/
├── src/
│   ├── pages/
│   │   ├── Index.tsx          # Landing page with subject marquee carousel
│   │   ├── Login.tsx          # Email/password + Google OAuth (student | school roles)
│   │   ├── Chat.tsx           # Main chat interface — all three modes
│   │   ├── Pricing.tsx        # Plan overview page
│   │   ├── About.tsx          # About page (magazine-style layout)
│   │   ├── Subjects.tsx       # Subjects overview
│   │   ├── Terms.tsx
│   │   └── Privacy.tsx
│   ├── components/
│   │   ├── ChatMessages.tsx   # Message list with markdown/math/code rendering
│   │   ├── ChatInput.tsx      # Text input bar
│   │   ├── ChatSidebar.tsx    # Conversation history sidebar
│   │   ├── ModeSelector.tsx   # query / quiz / teacher toggle
│   │   ├── DifficultySelector.tsx
│   │   ├── DailyLimitBadge.tsx
│   │   ├── FlashcardQuiz.tsx  # Interactive quiz UI (question nav, answer fields, results)
│   │   ├── TeacherResponse.tsx # Download card for generated .docx files
│   │   ├── ProfileEditor.tsx  # Settings dialog: name, class, subject, tier upgrade
│   │   └── QuizLoadingOverlay.tsx
│   ├── hooks/
│   │   └── useQuotaSync.ts    # Polls/syncs daily question quota from rate_limits
│   ├── lib/
│   │   ├── auth.tsx           # AuthContext + AuthProvider
│   │   ├── quiz-parser.ts     # Parses JSON quiz response from SSE stream
│   │   └── grading-parser.ts  # Parses JSON grading response
│   ├── types/
│   │   ├── chat.ts            # Message, ChatMode, Tier, Difficulty, TeacherDoc, ApiError
│   │   └── quiz.ts            # QuizSession, QuizQuestion, StudentAnswer, QuizResult
│   └── integrations/supabase/
│       ├── client.ts          # Supabase JS client
│       └── types.ts           # Generated database types
├── supabase/
│   ├── functions/
│   │   ├── chat/index.ts      # Student chat edge function (query + quiz modes)
│   │   ├── teacher/index.ts   # Teacher document generation edge function
│   │   └── _shared/
│   │       ├── models.config.ts   # All tiers, models, limits — single source of truth
│   │       ├── prompts.ts         # System prompt builders for all modes
│   │       ├── context-builder.ts # Qdrant + Supabase RPC context assembly
│   │       ├── embedding.ts       # BGE-M3 embedding (Cloudflare → OpenRouter fallback)
│   │       ├── streaming.ts       # SSE stream helpers, agentic loop utilities
│   │       ├── tools.ts           # LLM tool definitions (get_topic_context, search_concepts, get_prerequisites)
│   │       ├── docx-converter.ts  # JSON/markdown → .docx → Supabase Storage
│   │       └── provider.config.ts # Primary provider URL/key env var names
│   ├── migrations/            # SQL migration files
│   └── config.toml
├── public/
│   └── images/hero.jpg
├── vercel.json                # SPA rewrite rule
└── package.json
```

---

## 4. Database Schema

All tables live in the `public` schema with Row Level Security enabled. The project is hosted at `ehswpksboxyzqztdhofh.supabase.co` in `eu-west-1`.

### User & Auth tables

**`profiles`**
Extends `auth.users`. Auto-created on signup via the `handle_new_user` trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users.id` |
| `display_name` | text | |
| `role` | text | `student` · `teacher` · `school` |
| `tier` | text | `free` · `basic` · `premium` · `enterprise` |
| `subject` | text | Preferred subject (seeds chat subject selector) |
| `class` | text | e.g. `S1`, `S3` — determines O-Level vs A-Level subject list |
| `term` | text | Student term/form level |
| `phone_number` | text | For PesaPal billing |
| `payment_reference` | text | PesaPal payment reference |
| `tier_expires_at` | timestamptz | When the paid tier lapses back to free |
| `tier_updated_at` | timestamptz | Last tier change |
| `custom_daily_limit` | int | Per-user quota override for enterprise schools (NULL = use tier default) |

**`user_roles`**
Separate role assignment table used by the `has_role()` RPC. Enum type: `app_role` (`student` | `school`).

**`subscriptions`** *(billing not yet live)*
Tracks 30-day billing cycles. Columns: `tier`, `status` (`active`/`canceled`/`expired`), `current_period_start`, `current_period_end`, `pesapal_reference_id`.

**`rate_limits`**
One row per user. Tracks burst requests (per-minute window) and daily question count.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | FK → `auth.users.id` |
| `burst_count` | int | Requests in current 1-minute window |
| `window_start` | timestamptz | Start of current burst window |
| `daily_count` | int | Questions asked today |
| `last_day` | date | Date of last question (resets `daily_count` on new day) |

### Chat tables

**`conversations`**
One per chat thread. `title` is set to the first 60 characters of the opening message.

**`messages`**
`role` is either `user` or `assistant`. Linked to conversations via FK. The chat UI displays the last 30 messages; the backend sends the last 5 exchange pairs to the LLM to keep costs low.

### Student progress tables

**`student_progress`**
Tracks per-outcome mastery. Linked to both `outcome_nodes` and `topic_nodes`. Columns: `status`, `attempts`, `last_score`.

**`student_interactions`**
Raw log of which curriculum nodes a student has interacted with, with `interaction_type` and `session_id`.

---

## 5. Curriculum Knowledge Graph

The curriculum is stored as a rich graph structure. All data covers **Uganda O-Level (S1–S4)** across 8 subjects.

### Subjects in the database

| Subject | Classes |
|---|---|
| Mathematics | S1 · S2 · S3 · S4 |
| Biology | S1 · S2 · S3 · S4 |
| Chemistry | S1 · S2 · S3 · S4 |
| Physics | S1 · S2 · S3 · S4 |
| English | S1 · S2 · S3 · S4 |
| Geography | S1 · S2 · S3 · S4 |
| H&P (History & Political Education) | S1 · S2 · S3 · S4 |
| General Science | S1 · S2 · S3 · S4 |

### Live graph statistics

| Table | Rows | What it holds |
|---|---|---|
| `topic_nodes` | **346** | One row per curriculum topic. Contains `learning_outcomes_raw`, `suggested_activities_raw`, `assessment_strategy_raw`, BGE-M3 vector embedding, and metadata (periods, sequence position, difficulty distribution) |
| `curriculum_nodes` | **1,757** | Individual concept nodes with definitions, vocabulary lists, and vector embeddings |
| `outcome_nodes` | **346** | Bloom's-tagged learning outcomes with `distractor_hints` (common student misconceptions used to generate plausible wrong MCQ options) |
| `blooms_tags` | **346** | Bloom's taxonomy tags linking outcomes to topics, with `quiz_question_stem` pre-starters |
| `activity_nodes` | **1,730** | Curriculum-approved classroom activities with `methods`, `materials`, `grouping`, and `duration_hint` |
| `realworld_applications` | **346** | Real-world hooks (title, explanation, `wow_factor`) linked to curriculum concepts |
| `topic_edges` | **4,863** | Typed relationships: `HAS_CONCEPT` (1,757) · `HAS_ACTIVITY` (1,730) · `HAS_APPLICATION` (346) · `HAS_OUTCOME_NODE` (346) · `HAS_BLOOMS_TAG` (346) · `TOPIC_PRECEDES` (338) |
| `curriculum_edges` | **527** | Cross-node relationships: `PREREQUISITE_OF` (258) · `INTERDISCIPLINARY` (269) |

### Database RPCs (Postgres functions)

| Function | Purpose |
|---|---|
| `get_topic_context(topic, subject, class)` | Returns full structured context for a topic — concepts, outcomes, activities, applications, Bloom's tags |
| `get_quiz_outcomes(topic, subject, class)` | Returns outcomes with `quiz_question_stem` and `distractor_hints` for quiz generation |
| `get_prerequisites(concept_name, subject)` | Walks the `PREREQUISITE_OF` edges to find foundational concepts |
| `get_interdisciplinary_links(node_id)` | Follows `INTERDISCIPLINARY` edges to find cross-subject connections |
| `get_topic_neighbours(topic_id)` | Returns previous/next topics in sequence via `TOPIC_PRECEDES` edges |
| `get_student_progress(user_id, subject)` | Returns per-topic mastery % for a student |
| `match_concept_nodes(embedding, threshold, count)` | pgvector similarity search on concept embeddings |
| `match_topic_nodes(embedding, threshold, count)` | pgvector similarity search on topic embeddings |
| `match_outcome_nodes(embedding, threshold, count)` | pgvector similarity search on outcome embeddings |
| `handle_new_user()` | Trigger: auto-creates `profiles` + `user_roles` rows on signup |
| `expire_subscriptions()` | Marks subscriptions as `expired` when `current_period_end` is passed |
| `has_role(user_id, role)` | Security definer for role-based access checks |

### Vector search architecture

The primary semantic search uses **Qdrant** (external, collection: `curriculum_topics`) with BGE-M3 1024-dimensional dense vectors. Supabase pgvector (`match_topic_nodes`, `match_concept_nodes`) is a fallback. The similarity threshold is `0.45` for context retrieval and `0.52` for confirming a topic is in the curriculum. Results are cached in-memory for 60 seconds (max 200 entries) to avoid redundant Qdrant round-trips.

---

## 6. Supabase Edge Functions

Three deployed edge functions (all `ACTIVE`, JWT verification disabled — auth handled manually inside each function):

### `chat` (v73)
Student-facing. Handles `query` and `quiz` modes. SSE streaming response.

**Flow:**
1. Authenticate user from `Authorization: Bearer <token>`, load tier from `profiles`
2. Check rate limits (burst window + daily count) — IP-based for anonymous requests
3. Build curriculum context: embed the user's query with BGE-M3, search Qdrant for relevant topics, call Supabase RPCs for full structured context
4. Build system prompt (mode-specific — see `prompts.ts`)
5. Run **agentic loop** (max 2 rounds): call LLM → if it calls a tool (`get_topic_context`, `search_concepts`, `get_prerequisites`), execute the tool and feed result back → stream final answer
6. Return SSE stream to client

**Grading sub-flow** (when `grading: true`):
- Skips chat history, uses only the Q&A payload
- Builds quiz context using the topic/subject as the embedding query
- Uses a dedicated compact grading prompt — returns structured JSON with `score`, `results[]`, `remediation`

### `teacher` (v71)
Premium-only (`premium` | `enterprise` tiers). Non-streaming by default. Generates `.docx` files.

**Flow:**
1. Auth + tier check (403 if not premium/enterprise)
2. Check quota (teacher documents cost **5 units** toward the daily limit, burst limit is 3/minute)
3. Build teacher context: fetch up to 3 related topic contexts for breadth
4. Build teacher system prompt (grounded in `learning_outcomes_raw`, `suggested_activities_raw`, `assessment_strategy_raw`)
5. Run agentic loop → accumulate full JSON response
6. Convert JSON → `.docx` via `jsonToDocx()` (handles `scheme_of_work`, `lesson_plan`, `topic_summary`)
7. Upload to Supabase Storage, return signed URL (valid 1 hour by default)

### `rag-agent` (v51)
Earlier RAG agent — still deployed and active, predates the current chat/teacher split.

---

## 7. AI Models & Tier Configuration

Defined in `supabase/functions/_shared/models.config.ts`. Each tier has an ordered list of models — the first one that returns a healthy response wins, giving automatic failover across providers.

### Free — 5 questions/day
Modes: `query`, `quiz`

1. Cerebras `gpt-oss-120b` (fastest, no tool support)
2. Ollama Cloud `gpt-oss:120b-cloud` (NDJSON stream, needs transform)
3. OpenRouter `meta-llama/llama-3.3-70b-instruct:free`
4. OpenRouter `mistralai/mistral-7b-instruct:free`
5. OpenRouter `openrouter/auto` (last resort)

### Basic — 10 questions/day (7,000 UGX/month)
Modes: `query`, `quiz`

Models cascade through: `openai/gpt-5-nano` → `openai/gpt-4o-mini` → `deepseek/deepseek-v3.2` → `meta-llama/llama-3.3-70b-instruct`. Each model tries Cloudflare→OpenRouter gateway first, then OpenRouter direct, then provider direct.

### Premium — 20 questions/day (15,000 UGX/month)
Modes: `query`, `quiz`, **`teacher`**

Models: `openrouter/auto` → `x-ai/grok-4-fast` → `google/gemini-3.1-flash-lite-preview` → `google/gemini-2.5-flash` → `deepseek/deepseek-v3.2`.

### Enterprise — 100 questions/day (custom pricing)
Modes: `query`, `quiz`, **`teacher`**

Models: `openai/gpt-5-nano` → `google/gemini-2.5-flash-lite` → `openai/gpt-4o-mini` → `x-ai/grok-4.1-fast`.

> `custom_daily_limit` on the `profiles` table overrides the tier default for any user — set this directly in the database for enterprise schools with negotiated quotas.

### Embedding providers (in order)
1. `@cf/baai/bge-m3` via Cloudflare Workers AI (1024 dims)
2. `baai/bge-m3` via OpenRouter
3. `baai/bge-m3` via Bifrost gateway (if `BIFROST_URL` + `BIFROST_API_KEY` set)

---

## 8. Chat Modes

### Query mode
The default. Student asks a question. The answer is structured as:
1. **Premise** — when this is studied, why it matters, prerequisites
2. **Definition** — one plain sentence
3. **Explanation** — step-by-step with bolded key terms, analogies, cross-subject links
4. **Demonstration** — worked example for calculations/processes
5. **Check Your Understanding** — 3 practice questions (no answers given)
6. **ICT Support** — a YouTube link

Off-syllabus questions are answered fully with a natural mention of the closest curriculum topic.

### Quiz mode
Student requests a quiz on a topic. The AI generates 5–10 questions (≥60% MCQ with 4 options, 2–3 short answer, 1–2 long answer). The frontend renders these as interactive flashcards (`FlashcardQuiz`). When submitted, the answers go back to the `chat` function with `grading: true`, which returns per-question feedback, a score, and remediation for failed quizzes.

Quiz responses from the LLM are pure JSON (`parseQuizResponse` in `quiz-parser.ts` strips the markdown fence). If parsing fails, a friendly retry prompt is shown instead of raw JSON.

### Subject + Class selector
The chat header always shows a subject dropdown. The options are filtered by the user's class from their profile:
- **S1–S4**: Mathematics, English, Biology, Chemistry, Physics, H&P, Geography, General Science
- **S5–S6**: Mathematics, Physics, Chemistry, Biology, Economics, History, Geography, General Paper
- **No class set**: combined deduplicated list

The session subject can be changed per-conversation without modifying the profile.

---

## 9. Teacher Mode & Document Generation

Available to `premium` and `enterprise` users. Each document costs **5 quota units**.

Teachers can request:
- **Scheme of Work** — weekly plan for a term, outcomes grounded in the official syllabus
- **Lesson Plan** — 40-minute lesson with `real_world_hook`, `common_misconceptions`, `discussion_questions`, `cross_curricular_links`, `teacher_notes`
- **Topic Summary** — overview with key concepts and subject connections

The LLM returns a single JSON object (no prose outside the code fence). `docx-converter.ts` builds a formatted Word document with tables, headings, page numbers, and a table of contents using the `docx` v8 library, uploads it to Supabase Storage, and returns a signed download URL valid for 1 hour.

The client has a 2.5-minute fetch timeout for teacher requests. If the stream disconnects, the frontend polls the `messages` table for up to 80 seconds before giving up.

---

## 10. Authentication & User Roles

Auth is handled by Supabase Auth. Two sign-in methods:
- Email/password
- Google OAuth (redirects to `/chat` on success)

**Roles** (set on `profiles.role`):
- `student` — individual learner, conversations are saved
- `school` — shared classroom device
- `teacher` — individual educator (premium features)

On signup the `handle_new_user` database trigger auto-creates a row in `profiles` and `user_roles`.

The `AuthContext` (`src/lib/auth.tsx`) exposes `session`, `user`, `profile`, `loading`, and `refreshProfile`. The Chat page subscribes to Supabase Realtime on the user's own `profiles` row — any tier upgrade or subject/class change in `ProfileEditor` is reflected immediately without a page reload.

---

## 11. Rate Limiting & Quotas

Two layers:

**Burst limit** (all tiers): 5 requests per 1-minute rolling window. Teacher documents count as 1 burst event (max 3/minute for teacher).

**Daily limit** by tier:

| Tier | Questions/day | Teacher doc cost |
|---|---|---|
| Free | 5 | — |
| Basic | 10 | — |
| Premium | 20 | 5 units |
| Enterprise | 100 | 5 units |

`custom_daily_limit` on `profiles` overrides these for individual enterprise accounts.

**Anonymous requests** (no JWT) are rate-limited by IP: 10 requests per minute, stored in-memory in the edge function (resets on cold start).

The frontend quota badge (`DailyLimitBadge`) syncs from `rate_limits` via `useQuotaSync`. Quota is invalidated after each successful message.

---

## 12. Pricing Plans

| Plan | Price | Daily limit | Modes |
|---|---|---|---|
| Free | Free | 5 questions | Query, Quiz |
| Basic | 7,000 UGX/month | 10 questions | Query, Quiz |
| Premium | 15,000 UGX/month | 20 questions | Query, Quiz, Teacher |
| Enterprise | Custom | 100 questions (or custom) | All |

Payments are processed via **PesaPal**. The `pesapal_reference_id` is stored on the `subscriptions` table. Subscription expiry is handled by the `expire_subscriptions` Postgres function.

---

## 13. Environment Variables

### Frontend (Vite)

```
VITE_SUPABASE_URL=https://ehswpksboxyzqztdhofh.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Supabase Edge Function secrets

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# AI providers
CEREBRAS_API_KEY
OPENROUTER_API_KEY
OPENAI_API_KEY
GOOGLE_API_KEY

# Primary gateway (Cloudflare AI Gateway → OpenRouter)
PRIMARY_PROVIDER_URL=<cloudflare gateway url>
PRIMARY_PROVIDER_KEY=<cloudflare gateway key>

# Embeddings
CLOUDFLARE_API_KEY
CLOUDFLARE_ACCOUNT_ID

# Vector DB
QDRANT_URL
QDRANT_API_KEY

# Optional
OLLAMA_API_KEY
BIFROST_URL
BIFROST_API_KEY
```

---

## 14. Local Development

**Prerequisites:** Node.js ≥18, Supabase CLI, Deno (for edge functions)

```bash
# Install dependencies
npm install

# Start frontend dev server
npm run dev

# Run edge functions locally
supabase functions serve chat --env-file .env.local
supabase functions serve teacher --env-file .env.local

# Run tests
npm test
```

---

## 15. Deployment

**Frontend** → Vercel. `vercel.json` rewrites all routes to `/index.html` for SPA routing.

**Edge functions** → Supabase. Deploy with:

```bash
supabase functions deploy chat
supabase functions deploy teacher
```

Current deployed versions: `chat` v73, `teacher` v71, `rag-agent` v51.

**Database migrations:**

```bash
supabase db push
```

---

*© 2026 Domus Dei Tech. All rights reserved.*
