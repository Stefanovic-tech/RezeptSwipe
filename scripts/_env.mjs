import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, "..");

function parseEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnv() {
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const candidates = [".env.local", ".env"];
  if (nodeEnv === "production") {
    // Next.js nutzt in Prod typischerweise .env.production; Seed/Migrate-Skripte
    // sollen dieselben Variablen sehen (z. B. GEMINI_API_KEY).
    candidates.push(".env.production.local", ".env.production");
  }
  const merged = {};
  for (const name of candidates) {
    const filePath = path.join(ROOT_DIR, name);
    if (fs.existsSync(filePath)) {
      Object.assign(merged, parseEnv(fs.readFileSync(filePath, "utf8")));
    }
  }
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return process.env;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}
