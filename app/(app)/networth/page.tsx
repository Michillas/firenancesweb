import type { Metadata } from "next";
import { NetworthScreen } from "@/features/networth/networth-screen";

export const metadata: Metadata = { title: "Patrimonio" };

export default function Page() {
  return <NetworthScreen />;
}
