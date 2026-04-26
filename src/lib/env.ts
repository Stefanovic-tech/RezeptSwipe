function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

function readNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function readBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const env = {
  nodeEnv: read("NODE_ENV", "development"),
  appPort: readNumber("APP_PORT", 3015),
  appBaseUrl: read("APP_BASE_URL", "http://localhost:3015"),
  appPublicBaseUrl: read("APP_PUBLIC_BASE_URL", "http://localhost:3015"),

  db: {
    host: read("DB_HOST", "127.0.0.1"),
    port: readNumber("DB_PORT", 3306),
    user: read("DB_USER", "root"),
    password: read("DB_PASSWORD", ""),
    database: read("DB_NAME", "rezeptswipe"),
  },

  auth: {
    secret: read("AUTH_SECRET"),
    accessTtlMinutes: readNumber("ACCESS_TOKEN_TTL_MIN", 15),
    refreshTtlDays: readNumber("REFRESH_TOKEN_TTL_DAYS", 14),
    cookieSecure: readBool("COOKIE_SECURE", false),
  },

  gemini: {
    apiKey: read("GEMINI_API_KEY", ""),
    model: read("GEMINI_MODEL", "gemini-2.5-flash"),
  },

  ollama: {
    baseUrl: read("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    model: read("OLLAMA_MODEL", ""),
    timeoutMs: readNumber("OLLAMA_TIMEOUT_MS", 120000),
  },

  recipeSource: {
    themealdbBaseUrl: read("THEMEALDB_BASE_URL", "https://www.themealdb.com/api/json/v1/1"),
  },

  sentry: {
    dsn: read("SENTRY_DSN", ""),
    environment: read("SENTRY_ENVIRONMENT", "development"),
  },
};

export function isProd(): boolean {
  return env.nodeEnv === "production";
}
