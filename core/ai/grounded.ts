import type { AIProviderId, ProviderConfig } from "../domain/settings";
import { cleanModelText } from "./json";
import { AIError, type ChatMessage } from "./types";

// Web-grounded answers (news, latest fund NAV, upcoming events) through Gemini's built-in Google
// Search tool. Free-tier Gemini keys include a daily grounding quota. Other providers have no
// free web access, so callers fall back to plain chat with the news we fetched ourselves.

export interface GroundedResult {
  content: string;
  sources: { title: string; url: string }[];
  provider: AIProviderId;
}

const MODEL = "gemini-flash-latest";

export function geminiGroundedBody(messages: ChatMessage[], temperature = 0.3) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    tools: [{ google_search: {} }],
    generationConfig: { temperature },
  };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
};

export function parseGeminiGrounded(json: unknown): { content: string; sources: { title: string; url: string }[] } {
  const c = (json as GeminiResponse).candidates?.[0];
  const content = cleanModelText((c?.content?.parts ?? []).map((p) => p.text ?? "").join(""));
  const seen = new Set<string>();
  const sources = (c?.groundingMetadata?.groundingChunks ?? [])
    .map((g) => ({ title: g.web?.title ?? "", url: g.web?.uri ?? "" }))
    .filter((s) => s.url && !seen.has(s.url) && seen.add(s.url));
  return { content, sources };
}

export function createGroundedSearch(deps: {
  configs: () => ProviderConfig[];
  proxyProviders?: () => AIProviderId[];
  proxyUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  function route(): "direct" | "proxy" | null {
    const gemini = deps.configs().find((c) => c.id === "gemini");
    if (gemini?.enabled && gemini.apiKey) return "direct";
    if ((deps.proxyProviders?.() ?? []).includes("gemini") && gemini?.enabled !== false) return "proxy";
    return null;
  }

  async function search(messages: ChatMessage[], signal?: AbortSignal): Promise<GroundedResult> {
    const how = route();
    if (!how) throw new AIError("no-provider", "Web search needs a Gemini key.");
    const body = geminiGroundedBody(messages);
    const res =
      how === "direct"
        ? await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": deps.configs().find((c) => c.id === "gemini")!.apiKey },
            body: JSON.stringify(body),
            signal,
          })
        : await doFetch(deps.proxyUrl ?? "/api/ai/grounded", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    if (!res.ok) throw new AIError("all-failed", `Gemini search failed: HTTP ${res.status}`, [{ provider: "gemini", reason: `HTTP ${res.status}` }]);
    const parsed = parseGeminiGrounded(await res.json());
    if (!parsed.content) throw new AIError("all-failed", "Empty grounded answer");
    return { ...parsed, provider: "gemini" };
  }

  return { search, available: () => route() !== null };
}

export type GroundedSearch = ReturnType<typeof createGroundedSearch>;
