import { createGateway, createGroundedSearch } from "@/core/ai";
import { PROVIDERS, defaultProviderConfigs } from "@/core/ai/providers";
import type { AIProviderId, ProviderConfig } from "@/core/domain/settings";
import { device } from "./stores";

let proxyProviders: AIProviderId[] = [];
let capabilitiesLoaded = false;

// Stored provider order wins; defaults fill in anything the user never touched.
export function resolveProviderConfigs(stored: ProviderConfig[]): ProviderConfig[] {
  const defaults = defaultProviderConfigs();
  const byId = new Map(stored.map((c) => [c.id, c]));
  const ordered: ProviderConfig[] = [];
  for (const c of stored) if (PROVIDERS[c.id]) ordered.push(c);
  for (const d of defaults) if (!byId.has(d.id)) ordered.push(d);
  return ordered;
}

const configs = () => resolveProviderConfigs(device.get().aiProviders);

export const gateway = createGateway({ configs, proxyProviders: () => proxyProviders });

// Web-grounded answers (latest news, fund NAVs) through Gemini + Google Search.
export const grounded = createGroundedSearch({ configs, proxyProviders: () => proxyProviders });

// Self-hosted deployments can hold provider keys server-side. Ask once which ones.
export async function loadAiCapabilities(): Promise<void> {
  if (capabilitiesLoaded || typeof window === "undefined") return;
  capabilitiesLoaded = true;
  try {
    const res = await fetch("/api/ai/status", { cache: "no-store" });
    if (res.ok) proxyProviders = ((await res.json()) as { providers?: AIProviderId[] }).providers ?? [];
  } catch {
    // Static / offline builds have no API route: direct mode only.
  }
}

export const serverProviders = () => proxyProviders;

// One-off check of a single provider (the Settings "Test" button), ignoring the rest of the chain.
export async function testProvider(config: ProviderConfig): Promise<{ ok: true; model: string } | { ok: false; reason: string }> {
  const single = createGateway({ configs: () => [{ ...config, enabled: true }], proxyProviders: () => proxyProviders });
  try {
    const result = await single.chat({ messages: [{ role: "user", content: "Reply with the single word: ok" }], maxTokens: 16, temperature: 0 });
    return { ok: true, model: result.model };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.replace(/^All AI providers failed: /, "") : "unknown" };
  }
}

// "Reliable" = at least one provider with a real quota (own key, a custom server, or a server-side key).
export function hasReliableAi(list: ProviderConfig[] = configs()): boolean {
  const server = new Set(proxyProviders);
  return list.some((c) => c.enabled && c.id !== "pollinations" && (Boolean(c.apiKey) || (c.id === "custom" && Boolean(c.baseUrl && c.model)) || server.has(c.id)));
}
