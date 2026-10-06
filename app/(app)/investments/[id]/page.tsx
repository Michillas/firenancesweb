import type { Metadata } from "next";
import { HoldingScreen } from "@/features/investments/holding-screen";

export const metadata: Metadata = { title: "Inversión" };

export default async function Page({ params }: PageProps<"/investments/[id]">) {
  const { id } = await params;
  return <HoldingScreen id={id} />;
}
