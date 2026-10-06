import { serverProviders } from "@/lib/server-ai";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ providers: serverProviders() });
}
