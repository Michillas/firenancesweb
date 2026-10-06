import "server-only";
import type { AIProviderId, ProviderConfig } from "@/core/domain/settings";

// Server-held provider keys for self-hosted deployments (see docs/DEPLOYMENT.md).
const KEY_ENV: Partial<Record<AIProviderId, string | undefined>> = {
  openrouter: process.env.OPENROUTER_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

export function serverProviders(): AIProviderId[] {
  const ids = (Object.keys(KEY_ENV) as AIProviderId[]).filter((id) => Boolean(KEY_ENV[id]));
  return [...ids, "pollinations"];
}

export function serverConfig(id: AIProviderId, model?: string): ProviderConfig | null {
  if (!serverProviders().includes(id)) return null;
  return { id, enabled: true, apiKey: KEY_ENV[id] ?? "", baseUrl: "", model: model ?? "" };
}

export const serverGeminiKey = () => KEY_ENV.gemini ?? "";

// Fixed-window limiter per client, in memory (single instance).
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export const clientId = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
