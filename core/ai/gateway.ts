import type { ZodType } from "zod";
import type { AIProviderId, ProviderConfig } from "../domain/settings";
import { cleanModelText, parseJsonWith } from "./json";
import { PROVIDERS, isUsable } from "./providers";
import { AIError, type ChatRequest, type ChatResult, type ProviderStatus } from "./types";

export interface GatewayDeps {
  // Ordered by preference; read on every call so settings changes apply immediately.
  configs: () => ProviderConfig[];
  // Providers the server holds a key for (cloud mode). Optional.
  proxyProviders?: () => AIProviderId[];
  proxyUrl?: string;
  // Extra headers for proxy calls (e.g. the user's cloud session token).
  proxyHeaders?: () => Promise<Record<string, string>>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 60_000;

interface Cooldown {
  until: number;
  reason: string;
}

export function createGateway(deps: GatewayDeps) {
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = deps.now ?? Date.now;
  const cooldowns = new Map<AIProviderId, Cooldown>();

  type Route = "direct" | "proxy" | null;

  function route(config: ProviderConfig): Route {
    if (!config.enabled) return null;
    const adapter = PROVIDERS[config.id];
    const proxyOk = (deps.proxyProviders?.() ?? []).includes(config.id);
    const usable = isUsable(config);
    if (usable && (adapter.directFromBrowser || !proxyOk)) return "direct";
    if (proxyOk) return "proxy";
    return null;
  }

  function status(config: ProviderConfig): ProviderStatus {
    if (!config.enabled) return "disabled";
    const cd = cooldowns.get(config.id);
    if (cd && cd.until > now()) return "cooldown";
    return route(config) ? "ready" : "needs-key";
  }

  function candidates(): ProviderConfig[] {
    return deps.configs().filter((c) => status(c) === "ready");
  }

  async function callOnce(config: ProviderConfig, request: ChatRequest, withJsonMode: boolean): Promise<ChatResult> {
    const adapter = PROVIDERS[config.id];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), deps.timeoutMs ?? DEFAULT_TIMEOUT);
    const onAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const effective = { ...request, json: withJsonMode && request.json };
      const proxied = route(config) === "proxy";
      const res = proxied
        ? await doFetch(deps.proxyUrl ?? "/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...((await deps.proxyHeaders?.()) ?? {}) },
            body: JSON.stringify({
              provider: config.id,
              model: config.model || undefined,
              request: { ...effective, signal: undefined },
            }),
            signal: controller.signal,
          })
        : await doFetch(adapter.endpoint(config), {
            method: "POST",
            headers: adapter.headers(config),
            body: JSON.stringify(adapter.body(effective, config)),
            signal: controller.signal,
          });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new HttpError(res.status, text.slice(0, 300), res.headers.get("retry-after"));
      }
      const json = await res.json();
      const content = cleanModelText(proxied ? String((json as { content?: unknown }).content ?? "") : adapter.parse(json));
      if (!content) throw new HttpError(502, "empty response", null);
      const model = proxied
        ? String((json as { model?: unknown }).model ?? adapter.defaultModel)
        : String((json as { model?: unknown }).model ?? (config.model || adapter.defaultModel));
      return { content, provider: config.id, model };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  async function chat(request: ChatRequest): Promise<ChatResult> {
    const list = candidates();
    if (list.length === 0) {
      throw new AIError("no-provider", "No AI provider is available. Add an API key in Settings or enable the free keyless provider.");
    }
    const attempts: { provider: AIProviderId; reason: string }[] = [];
    for (const config of list) {
      if (request.signal?.aborted) throw new AIError("aborted", "Request cancelled.");
      try {
        return await callOnce(config, request, true);
      } catch (error) {
        if (request.signal?.aborted) throw new AIError("aborted", "Request cancelled.");
        // Some models reject response_format: retry once without it before moving on.
        if (error instanceof HttpError && error.status === 400 && request.json) {
          try {
            return await callOnce(config, request, false);
          } catch (retryError) {
            error = retryError;
          }
        }
        const reason = describe(error);
        attempts.push({ provider: config.id, reason });
        cooldowns.set(config.id, { until: now() + cooldownFor(error), reason });
      }
    }
    throw new AIError("all-failed", `All AI providers failed: ${attempts.map((a) => `${a.provider}: ${a.reason}`).join("; ")}`, attempts);
  }

  async function chatJSON<T>(request: ChatRequest, schema: ZodType<T>, retries = 1): Promise<{ data: T; provider: AIProviderId }> {
    let lastError: unknown;
    let messages = request.messages;
    for (let i = 0; i <= retries; i++) {
      const result = await chat({ ...request, messages, json: true });
      try {
        return { data: parseJsonWith(result.content, schema), provider: result.provider };
      } catch (error) {
        lastError = error;
        messages = [
          ...request.messages,
          { role: "assistant", content: result.content.slice(0, 4000) },
          { role: "user", content: "That was not valid JSON for the requested shape. Reply again with ONLY the corrected JSON, no prose, no code fences." },
        ];
      }
    }
    throw lastError instanceof AIError ? lastError : new AIError("invalid-json", "Invalid JSON from model.");
  }

  return {
    chat,
    chatJSON,
    status,
    hasAnyProvider: () => candidates().length > 0,
    resetCooldowns: () => cooldowns.clear(),
  };
}

export type AIGateway = ReturnType<typeof createGateway>;

class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
    public retryAfter: string | null,
  ) {
    super(`HTTP ${status}`);
  }
}

function describe(error: unknown): string {
  if (error instanceof HttpError) return `HTTP ${error.status}${error.body ? ` ${error.body.slice(0, 120)}` : ""}`;
  if (error instanceof Error) return error.message || error.name;
  return "unknown error";
}

function cooldownFor(error: unknown): number {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) return 10 * 60_000;
    if (error.status === 402) return 5 * 60_000;
    if (error.status === 429) {
      const seconds = Number(error.retryAfter);
      return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 600) * 1000 : 60_000;
    }
    if (error.status === 404) return 10 * 60_000;
  }
  return 30_000;
}
