import type { AIProviderId, ProviderConfig } from "../domain/settings";
import type { ChatRequest, ProviderAdapter } from "./types";

function openAiBody(model: string, request: ChatRequest, json: boolean): Record<string, unknown> {
  return {
    model,
    messages: request.messages,
    temperature: request.temperature ?? 0.4,
    ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    ...(json && request.json ? { response_format: { type: "json_object" } } : {}),
  };
}

function parseOpenAi(json: unknown): string {
  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text) : "")).join("");
  return "";
}

const bearer = (config: ProviderConfig): Record<string, string> =>
  config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};

// `openrouter/free` is OpenRouter's own router: it always picks a currently available free
// model that supports the features the request needs, so nobody has to track model names.
export const openrouter: ProviderAdapter = {
  id: "openrouter",
  defaultModel: "openrouter/free",
  requiresKey: true,
  supportsJsonMode: true,
  directFromBrowser: true,
  signupUrl: "https://openrouter.ai/keys",
  endpoint: () => "https://openrouter.ai/api/v1/chat/completions",
  headers: (c) => ({ "Content-Type": "application/json", "X-Title": "FireNances", ...bearer(c) }),
  body: (r, c) => openAiBody(c.model || "openrouter/free", r, true),
  parse: parseOpenAi,
};

// `gemini-flash-latest` is Google's hot-swapped alias for the newest Flash model.
export const gemini: ProviderAdapter = {
  id: "gemini",
  defaultModel: "gemini-flash-latest",
  requiresKey: true,
  supportsJsonMode: true,
  directFromBrowser: true,
  signupUrl: "https://aistudio.google.com/apikey",
  endpoint: () => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  headers: (c) => ({ "Content-Type": "application/json", ...bearer(c) }),
  body: (r, c) => openAiBody(c.model || "gemini-flash-latest", r, true),
  parse: parseOpenAi,
};

// Keyless last resort. The `openai` alias is the service's own "current default" model.
export const pollinations: ProviderAdapter = {
  id: "pollinations",
  defaultModel: "openai",
  requiresKey: false,
  supportsJsonMode: false,
  // Verified: browser-origin requests get HTTP 403 "Missing Turnstile token"; server-side requests work.
  directFromBrowser: false,
  signupUrl: "https://pollinations.ai",
  endpoint: () => "https://text.pollinations.ai/openai",
  headers: () => ({ "Content-Type": "application/json" }),
  // Verified 2026-10: its default model is a reasoning model that answers `{}` when the request
  // carries temperature or max_tokens, so both are left out.
  body: (r, c) => ({ model: c.model || "openai", messages: r.messages }),
  parse: parseOpenAi,
};

// Any OpenAI-compatible server: Ollama (http://localhost:11434/v1), LM Studio, vLLM, a company gateway...
export const custom: ProviderAdapter = {
  id: "custom",
  defaultModel: "",
  requiresKey: false,
  supportsJsonMode: true,
  directFromBrowser: true,
  signupUrl: "",
  endpoint: (c) => `${c.baseUrl.replace(/\/+$/, "")}/chat/completions`,
  headers: (c) => ({ "Content-Type": "application/json", ...bearer(c) }),
  body: (r, c) => openAiBody(c.model, r, true),
  parse: parseOpenAi,
};

export const PROVIDERS: Record<AIProviderId, ProviderAdapter> = { openrouter, gemini, pollinations, custom };

export const DEFAULT_PROVIDER_ORDER: AIProviderId[] = ["openrouter", "gemini", "pollinations"];

export function defaultProviderConfigs(): ProviderConfig[] {
  return DEFAULT_PROVIDER_ORDER.map((id) => ({ id, enabled: true, apiKey: "", baseUrl: "", model: "" }));
}

export function isUsable(config: ProviderConfig): boolean {
  const adapter = PROVIDERS[config.id];
  if (!config.enabled) return false;
  if (config.id === "custom") return Boolean(config.baseUrl && config.model);
  return !adapter.requiresKey || Boolean(config.apiKey);
}
