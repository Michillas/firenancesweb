import type { Metadata } from "next";
import { SavingsScreen } from "@/features/savings/savings-screen";

export const metadata: Metadata = { title: "Ahorro y metas" };

export default function Page() {
  return <SavingsScreen />;
}
