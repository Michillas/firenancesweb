import { describe, expect, it } from "vitest";
import { createGateway } from "./gateway";
import { parseGeminiGrounded, geminiGroundedBody } from "./grounded";
import { parseAssistantResponse } from "./assistant";
import { chunkText, extractTransactions } from "./tasks";
import { extractJson } from "./json";

const okResponse = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }], model: "free-model" }), { status: 200 });

describe("AI gateway", () => {
  it("falls through providers and cools down the failing one", async () => {
    const calls: string[] = [];
    const gateway = createGateway({
      configs: () => [
        { id: "openrouter", enabled: true, apiKey: "k1", baseUrl: "", model: "" },
        { id: "gemini", enabled: true, apiKey: "k2", baseUrl: "", model: "" },
      ],
      fetchImpl: async (url) => {
        calls.push(String(url));
        return String(url).includes("openrouter") ? new Response("busy", { status: 429 }) : okResponse('{"ok":true}');
      },
    });
    const r = await gateway.chat({ messages: [{ role: "user", content: "hi" }] });
    expect(r.provider).toBe("gemini");
    expect(gateway.status({ id: "openrouter", enabled: true, apiKey: "k1", baseUrl: "", model: "" })).toBe("cooldown");
  });

  it("extracts transactions from a statement with lenient numbers", async () => {
    const reply = JSON.stringify({ transactions: [{ date: "2026-10-03", amount: "-45,30 €", kind: "expense", description: "COMPRA MERCADONA", merchant: "Mercadona", category: "Supermercado" }, { date: "bad", amount: 1 }], closingBalance: "1.200,50" });
    const gateway = createGateway({ configs: () => [{ id: "gemini", enabled: true, apiKey: "k", baseUrl: "", model: "" }], fetchImpl: async () => okResponse(reply) });
    const r = await extractTransactions(gateway, "03/10 MERCADONA -45,30", { today: "2026-10-06", currency: "EUR", categories: ["Supermercado"], accounts: [] });
    expect(r.transactions).toEqual([{ date: "2026-10-03", amount: 45.3, kind: "expense", description: "COMPRA MERCADONA", merchant: "Mercadona", category: "Supermercado" }]);
    expect(r.dropped).toBe(1);
    expect(r.closingBalance).toBe(1200.5);
  });

  it("splits long statements on line boundaries", () => {
    const text = Array.from({ length: 1000 }, (_, i) => `line ${i} ${"x".repeat(30)}`).join("\n");
    const chunks = chunkText(text, 5000);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 5100)).toBe(true);
    expect(chunks.join("").split("\n").filter(Boolean)).toHaveLength(1000);
  });
});

describe("grounded search", () => {
  it("builds Gemini bodies and reads sources", () => {
    const body = geminiGroundedBody([{ role: "system", content: "sys" }, { role: "user", content: "q" }]);
    expect(body.systemInstruction?.parts[0].text).toBe("sys");
    expect(body.tools).toEqual([{ google_search: {} }]);
    const parsed = parseGeminiGrounded({ candidates: [{ content: { parts: [{ text: '```json\n{"a":1}\n```' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://x", title: "X" } }, { web: { uri: "https://x", title: "X" } }] } }] });
    expect(extractJson(parsed.content)).toEqual({ a: 1 });
    expect(parsed.sources).toEqual([{ title: "X", url: "https://x" }]);
  });
});

describe("assistant", () => {
  it("keeps valid actions and drops invented ones", () => {
    const r = parseAssistantResponse({ reply: "Hecho", actions: [{ type: "add_transaction", date: "2026-10-05", amount: "12.5", kind: "expense", description: "Café" }, { type: "hack_bank" }, { type: "add_goal", name: "Viaje", target: 2000, kind: "unknown" }] });
    expect(r.actions).toHaveLength(2);
    expect(r.actions[0]).toMatchObject({ amount: 12.5 });
    expect(r.actions[1]).toMatchObject({ kind: "other" });
    expect(r.dropped).toBe(1);
  });
});
