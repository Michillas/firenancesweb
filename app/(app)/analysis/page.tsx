import type { Metadata } from "next";
import { AnalysisScreen } from "@/features/analysis/analysis-screen";

export const metadata: Metadata = { title: "Gastos" };

export default function Page() {
  return <AnalysisScreen />;
}
