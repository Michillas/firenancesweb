import type { Metadata } from "next";
import { InvestmentsScreen } from "@/features/investments/investments-screen";

export const metadata: Metadata = { title: "Inversiones" };

export default function Page() {
  return <InvestmentsScreen />;
}
