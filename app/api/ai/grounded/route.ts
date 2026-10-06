import { clientId, rateLimit, serverGeminiKey } from "@/lib/server-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gemini + Google Search with the server's key (self-hosted deployments only).
export async function POST(request: Request) {
  const key = serverGeminiKey();
  if (!key) return Response.json({ error: "provider-not-available" }, { status: 400 });
  if (!rateLimit(`g:${clientId(request)}`, 15)) return Response.json({ error: "rate-limited" }, { status: 429, headers: { "retry-after": "60" } });
  const body = await request.text();
  if (body.length > 80_000) return Response.json({ error: "too-large" }, { status: 413 });
  const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body,
    signal: AbortSignal.timeout(55_000),
  }).catch(() => null);
  if (!upstream) return Response.json({ error: "upstream-unreachable" }, { status: 502 });
  return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
