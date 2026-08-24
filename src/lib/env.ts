import { z } from "zod";

if (typeof window === "undefined" && !process.env.DATABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config();
  } catch {}
}

const resolvedAuthMode = process.env.AUTH_MODE
  ?? (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY ? "clerk" : undefined);

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")).default("postgresql://pramana:pramana@localhost:5432/pramana"),
  AUTH_MODE: z.enum(["development", "credentials", "clerk"]).default("development"),
  AUTH_ENCRYPTION_KEY: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("pramana_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  APP_BASE_URL: z.string().url().default("http://localhost:4173"),
  INGESTION_SERVICE_URL: z.string().url().default("http://localhost:8001"),
  SOLVER_SERVICE_URL: z.string().url().default("http://localhost:8002"),
  LOCAL_UPLOAD_DIR: z.string().min(1).default("./data/uploads"),
  OBJECT_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_SECRET_KEY: z.string().min(1).default("minioadmin"),
  S3_BUCKET: z.string().min(3).default("pramana-local"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  REDIS_PREFIX: z.string().min(1).default("pramana"),
  INFRA_ALLOW_DEGRADED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  // This is deliberately opt-in so local builds and deterministic tests keep
  // working without deployment credentials. Deployment manifests must set it
  // to true, which turns insecure fallbacks into startup errors.
  REQUIRE_PRODUCTION_CONFIG: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  // Local Ollama is the normal runtime. Mock remains available only for
  // deterministic tests and explicitly opted-in development scenarios.
  MODEL_PROVIDER: z.enum(["mock", "ollama", "gemini", "nim", "groq", "cerebras"]).default("ollama"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("gemma4:e2b"),
  OLLAMA_EMBEDDING_MODEL: z.string().min(1).default("nomic-embed-text:latest"),
  // One deadline applies to every generation/embedding provider. The
  // Ollama-named setting is retained as a backwards-compatible override for
  // existing local installations.
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(45_000),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).optional(),
  MODEL_PROMPT_MAX_CHARS: z.coerce.number().int().min(1_000).max(250_000).default(60_000),
  MODEL_OUTPUT_MAX_TOKENS: z.coerce.number().int().min(16).max(4_096).default(512),
  MODEL_CONTEXT_TOKENS: z.coerce.number().int().min(512).max(32_768).default(8_192),
  // Optional per-minute token budget for the currently active MODEL_PROVIDER.
  // Unset (default) = no throttling, unchanged behavior. Set this whenever a
  // provider/model has its own hard TPM ceiling (e.g. a hosted free tier) so
  // requests are paced to actually succeed instead of firing and 429ing —
  // edit this one number when switching provider/model rather than changing
  // code. Scoped by MODEL_PROVIDER internally, so switching providers never
  // reuses a stale budget counter.
  MODEL_TOKENS_PER_MINUTE: z.coerce.number().int().min(100).max(10_000_000).optional(),
  // Optional rolling-24h token spend cap for the copilot specifically,
  // summed from real usage already persisted on copilot_messages (see
  // ModelResult.usage) for whichever provider is currently active. Unset
  // (default) = no cap. Exists for a metered/paid provider on a small
  // credit balance (e.g. Cerebras) so a runaway or repeatedly-retried
  // conversation can't silently burn the whole balance — the copilot
  // refuses new turns with a clear message once exceeded, rather than
  // failing opaquely against the provider's own billing limit.
  MODEL_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(1_000).max(1_000_000_000).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-004"),
  NIM_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NIM_API_KEY: z.string().optional(),
  NIM_MODEL: z.string().min(1).default("meta/llama-3.3-70b-instruct"),
  // Groq: OpenAI-compatible chat-completions endpoint, same shape as NIM below.
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
  // Cerebras: OpenAI-compatible chat-completions endpoint, same shape as NIM
  // above. Offered by the user for gpt-oss-120b (bigger than Groq's 20b) on
  // a small metered credit balance — pair with MODEL_DAILY_TOKEN_BUDGET.
  CEREBRAS_BASE_URL: z.string().url().default("https://api.cerebras.ai/v1"),
  CEREBRAS_API_KEY: z.string().optional(),
  CEREBRAS_MODEL: z.string().min(1).default("gpt-oss-120b"),
  // Embeddings intentionally remain independently selected. Choosing Gemini
  // for generation must never silently change an existing vector space.
  EMBEDDING_PROVIDER: z.enum(["mock", "ollama", "gemini", "service"]).default("ollama"),
  RETRIEVAL_SERVICE_URL: z.string().url().default("http://localhost:8003"),
  KNOWLEDGE_RERANK_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  SHIPMENT_STATUS_BUFFER_HOURS: z.coerce.number().min(0).max(720).default(72),
  POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  POLL_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  AIS_MODE: z.enum(["synthetic", "aisstream"]).default("synthetic"),
  AISSTREAM_API_KEY: z.string().optional(),
  WEATHER_MODE: z.enum(["synthetic", "open-meteo"]).default("synthetic"),
  OPEN_METEO_BASE_URL: z.string().url().default("https://marine-api.open-meteo.com/v1/marine"),
  RISK_POLL_MODE: z.enum(["synthetic", "http"]).default("synthetic"),
  RISK_PROBABILITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  RISK_DELAY_HOURS_THRESHOLD: z.coerce.number().int().min(1).max(2160).default(8),
  RISK_PROCUREMENT_URL: z.string().url().optional(),
  RISK_LEAD_TIME_URL: z.string().url().optional(),
  RISK_WORKFORCE_URL: z.string().url().optional(),
  RISK_WEATHER_URL: z.string().url().optional(),
  RISK_SITE_LAT: z.coerce.number().min(-90).max(90).default(18.9492),
  RISK_SITE_LNG: z.coerce.number().min(-180).max(180).default(72.9347),
  // Scores below 0.50 produced plausible-looking but cross-domain citations
  // (for example, chilled-water procedures in a fire-protection answer).
  // Prefer a deliberate "no match" over an uncited-looking weak match.
  KNOWLEDGE_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  AI_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(60),
  AI_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  // Per-category budgets (Rules.md line 87: auth, upload, search, AI, export,
  // schedule, compliance, risk, and knowledge endpoints all require rate limiting).
  // Each category gets its own budget since an upload and an AI call have very
  // different natural request rates.
  AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  UPLOAD_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(20),
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  SCHEDULE_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(30),
  SCHEDULE_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  EXPORT_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(10),
  EXPORT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  // Named accuracy/latency targets (TRD NFR table; PRD success metrics). These are
  // targets/config for golden-set evaluation, not runtime enforcement.
  COMPLIANCE_DEVIATION_ACCURACY_TARGET: z.coerce.number().min(0).max(1).default(0.95),
  RISK_LEAD_TIME_TARGET_HOURS: z.coerce.number().min(0).max(720).default(48),
  RFI_MATCH_ACCURACY_TARGET: z.coerce.number().min(0).max(1).default(0.85),
  HIGH_SEVERITY_PRECISION_TARGET: z.coerce.number().min(0).max(1).default(0.9),
  PACK_PREP_TIME_REDUCTION_TARGET: z.coerce.number().min(0).max(1).default(0.6),
  SOLVER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(90_000),
  SOLVER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3)
});

export const env = environmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_MODE: resolvedAuthMode,
  AUTH_ENCRYPTION_KEY: process.env.AUTH_ENCRYPTION_KEY,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS,
  APP_BASE_URL: process.env.APP_BASE_URL,
  INGESTION_SERVICE_URL: process.env.INGESTION_SERVICE_URL,
  SOLVER_SERVICE_URL: process.env.SOLVER_SERVICE_URL,
  LOCAL_UPLOAD_DIR: process.env.LOCAL_UPLOAD_DIR,
  OBJECT_STORAGE_DRIVER: process.env.OBJECT_STORAGE_DRIVER,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_PREFIX: process.env.REDIS_PREFIX,
  INFRA_ALLOW_DEGRADED: process.env.INFRA_ALLOW_DEGRADED,
  REQUIRE_PRODUCTION_CONFIG: process.env.REQUIRE_PRODUCTION_CONFIG,
  MODEL_PROVIDER: process.env.MODEL_PROVIDER,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
  MODEL_TIMEOUT_MS: process.env.MODEL_TIMEOUT_MS,
  OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS,
  MODEL_PROMPT_MAX_CHARS: process.env.MODEL_PROMPT_MAX_CHARS,
  MODEL_OUTPUT_MAX_TOKENS: process.env.MODEL_OUTPUT_MAX_TOKENS,
  MODEL_CONTEXT_TOKENS: process.env.MODEL_CONTEXT_TOKENS,
  MODEL_TOKENS_PER_MINUTE: process.env.MODEL_TOKENS_PER_MINUTE,
  MODEL_DAILY_TOKEN_BUDGET: process.env.MODEL_DAILY_TOKEN_BUDGET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
  NIM_BASE_URL: process.env.NIM_BASE_URL,
  NIM_API_KEY: process.env.NIM_API_KEY,
  NIM_MODEL: process.env.NIM_MODEL,
  GROQ_BASE_URL: process.env.GROQ_BASE_URL,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  CEREBRAS_BASE_URL: process.env.CEREBRAS_BASE_URL,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
  CEREBRAS_MODEL: process.env.CEREBRAS_MODEL,
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
  RETRIEVAL_SERVICE_URL: process.env.RETRIEVAL_SERVICE_URL,
  KNOWLEDGE_RERANK_THRESHOLD: process.env.KNOWLEDGE_RERANK_THRESHOLD,
  SHIPMENT_STATUS_BUFFER_HOURS: process.env.SHIPMENT_STATUS_BUFFER_HOURS,
  POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
  POLL_ENABLED: process.env.POLL_ENABLED,
  AIS_MODE: process.env.AIS_MODE,
  AISSTREAM_API_KEY: process.env.AISSTREAM_API_KEY,
  WEATHER_MODE: process.env.WEATHER_MODE,
  OPEN_METEO_BASE_URL: process.env.OPEN_METEO_BASE_URL,
  RISK_POLL_MODE: process.env.RISK_POLL_MODE,
  RISK_PROBABILITY_THRESHOLD: process.env.RISK_PROBABILITY_THRESHOLD,
  RISK_DELAY_HOURS_THRESHOLD: process.env.RISK_DELAY_HOURS_THRESHOLD,
  RISK_PROCUREMENT_URL: process.env.RISK_PROCUREMENT_URL,
  RISK_LEAD_TIME_URL: process.env.RISK_LEAD_TIME_URL,
  RISK_WORKFORCE_URL: process.env.RISK_WORKFORCE_URL,
  RISK_WEATHER_URL: process.env.RISK_WEATHER_URL,
  RISK_SITE_LAT: process.env.RISK_SITE_LAT,
  RISK_SITE_LNG: process.env.RISK_SITE_LNG,
  KNOWLEDGE_SIMILARITY_THRESHOLD: process.env.KNOWLEDGE_SIMILARITY_THRESHOLD,
  AI_RATE_LIMIT: process.env.AI_RATE_LIMIT,
  AI_RATE_LIMIT_WINDOW_SECONDS: process.env.AI_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_RATE_LIMIT: process.env.AUTH_RATE_LIMIT,
  AUTH_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
  UPLOAD_RATE_LIMIT: process.env.UPLOAD_RATE_LIMIT,
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS: process.env.UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
  SCHEDULE_RATE_LIMIT: process.env.SCHEDULE_RATE_LIMIT,
  SCHEDULE_RATE_LIMIT_WINDOW_SECONDS: process.env.SCHEDULE_RATE_LIMIT_WINDOW_SECONDS,
  EXPORT_RATE_LIMIT: process.env.EXPORT_RATE_LIMIT,
  EXPORT_RATE_LIMIT_WINDOW_SECONDS: process.env.EXPORT_RATE_LIMIT_WINDOW_SECONDS,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  COMPLIANCE_DEVIATION_ACCURACY_TARGET: process.env.COMPLIANCE_DEVIATION_ACCURACY_TARGET,
  RISK_LEAD_TIME_TARGET_HOURS: process.env.RISK_LEAD_TIME_TARGET_HOURS,
  RFI_MATCH_ACCURACY_TARGET: process.env.RFI_MATCH_ACCURACY_TARGET,
  HIGH_SEVERITY_PRECISION_TARGET: process.env.HIGH_SEVERITY_PRECISION_TARGET,
  PACK_PREP_TIME_REDUCTION_TARGET: process.env.PACK_PREP_TIME_REDUCTION_TARGET,
  SOLVER_TIMEOUT_MS: process.env.SOLVER_TIMEOUT_MS,
  SOLVER_MAX_ATTEMPTS: process.env.SOLVER_MAX_ATTEMPTS
});

// Keep the legacy Ollama-specific name as an effective override while every
// generation and embedding path consumes this provider-agnostic deadline.
export const modelRequestTimeoutMs = env.OLLAMA_TIMEOUT_MS ?? env.MODEL_TIMEOUT_MS;

if (env.REQUIRE_PRODUCTION_CONFIG) {
  const hasPlaceholder = (value: string | undefined) => Boolean(value && /replace[ _-]?(me|with)|change[ _-]?before|example\.com/i.test(value));
  if (env.AUTH_MODE === "development") throw new Error("AUTH_MODE=development is not permitted when REQUIRE_PRODUCTION_CONFIG=true.");
  if (!env.AUTH_ENCRYPTION_KEY) throw new Error("AUTH_ENCRYPTION_KEY is required when REQUIRE_PRODUCTION_CONFIG=true.");
  if ([env.DATABASE_URL, env.AUTH_ENCRYPTION_KEY, env.APP_BASE_URL, env.S3_ACCESS_KEY, env.S3_SECRET_KEY, env.S3_BUCKET].some(hasPlaceholder)) {
    throw new Error("Placeholder deployment values are not permitted when REQUIRE_PRODUCTION_CONFIG=true.");
  }
  if (!env.APP_BASE_URL.startsWith("https://")) throw new Error("APP_BASE_URL must use https when REQUIRE_PRODUCTION_CONFIG=true.");
  if ([env.S3_ACCESS_KEY, env.S3_SECRET_KEY].includes("minioadmin")) throw new Error("Default MinIO credentials are not permitted when REQUIRE_PRODUCTION_CONFIG=true.");
  if (env.MODEL_PROVIDER === "mock" || env.EMBEDDING_PROVIDER === "mock") {
    throw new Error("Mock generation and embedding providers are not permitted when REQUIRE_PRODUCTION_CONFIG=true.");
  }
  if (env.MODEL_PROVIDER === "gemini" && !env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when MODEL_PROVIDER=gemini.");
  if (env.MODEL_PROVIDER === "nim" && !env.NIM_API_KEY) throw new Error("NIM_API_KEY is required when MODEL_PROVIDER=nim.");
  if (env.MODEL_PROVIDER === "groq" && !env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is required when MODEL_PROVIDER=groq.");
  if (env.MODEL_PROVIDER === "cerebras" && !env.CEREBRAS_API_KEY) throw new Error("CEREBRAS_API_KEY is required when MODEL_PROVIDER=cerebras.");
  if (env.EMBEDDING_PROVIDER === "gemini" && !env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini.");
  if (env.AUTH_MODE === "clerk" && !(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY)) {
    throw new Error("Clerk keys are required when AUTH_MODE=clerk and REQUIRE_PRODUCTION_CONFIG=true.");
  }
}

export const clerkKeysConfigured = Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
export const clerkIsConfigured = env.AUTH_MODE === "clerk" && clerkKeysConfigured;
