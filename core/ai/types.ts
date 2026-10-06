import type { AIProviderId, ProviderConfig } from "../domain/settings";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  // Ask the model for a JSON object. Providers that cannot enforce it still get a prompt hint.
  json?: boolean;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  provider: AIProviderId;
  model: string;
}

export type AIErrorCode = "no-provider" | "all-failed" | "aborted" | "invalid-json";

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public attempts: { provider: AIProviderId; reason: string }[] = [],
  ) {
    super(message);
    this.name = "AIError";
  }
}

// What a provider needs to expose so both the browser (direct) and the Next route (proxy)
// can talk to it through the same code.
export interface ProviderAdapter {
  id: AIProviderId;
  // `auto` models are routers/aliases the provider keeps pointing at its newest free model.
  defaultModel: string;
  requiresKey: boolean;
  supportsJsonMode: boolean;
  // false when the provider rejects browser origins (anti-bot); such providers go through the server proxy.
  directFromBrowser: boolean;
  signupUrl: string;
  endpoint(config: ProviderConfig): string;
  headers(config: ProviderConfig): Record<string, string>;
  body(request: ChatRequest, config: ProviderConfig): Record<string, unknown>;
  parse(json: unknown): string;
}

export type ProviderStatus = "ready" | "needs-key" | "disabled" | "cooldown";

export interface ProxyCapabilities {
  // Providers for which the server holds a key (cloud deployments).
  providers: AIProviderId[];
}
