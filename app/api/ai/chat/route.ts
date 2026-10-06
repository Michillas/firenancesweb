import { z } from "zod";
import { PROVIDERS } from "@/core/ai/providers";
import { AI_PROVIDER_IDS } from "@/core/domain/settings";
import { clientId, rateLimit, serverConfig } from "@/lib/server-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS),
  model: z.string().max(120).optional(),
  request: z.object({
    messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().max(60_000) })).min(1).max(40),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(8000).optional(),
    json: z.boolean().optional(),
  }),
});

// Relays a chat request with a server-held key (or the keyless provider, which blocks browsers).
export async function POST(request: Request) {
  if (!rateLimit(clientId(request))) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "retry-after": "30" } });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad-request" }, { status: 400 });

  const { provider, model, request: chat } = parsed.data;
  const cfg = serverConfig(provider, model);
  if (!cfg) return Response.json({ error: "provider-not-available" }, { status: 400 });

  const adapter = PROVIDERS[provider];
  const upstream = await fetch(adapter.endpoint(cfg), {
    method: "POST",
    headers: adapter.headers(cfg),
    body: JSON.stringify(adapter.body(chat, cfg)),
    signal: AbortSignal.timeout(55_000),
  }).catch(() => null);

  if (!upstream) return Response.json({ error: "upstream-unreachable" }, { status: 502 });
  if (!upstream.ok) {
    // 402 is how the keyless tier says "anonymous quota used up": treat it exactly like a rate limit.
    const limited = upstream.status === 429 || upstream.status === 402;
    const retry = upstream.headers.get("retry-after");
    return Response.json({ error: "upstream-error", status: upstream.status }, { status: limited ? 429 : 502, headers: retry ? { "retry-after": retry } : {} });
  }
  const json = await upstream.json();
  return Response.json({ content: adapter.parse(json), model: (json as { model?: string }).model ?? adapter.defaultModel });
}
