import type { Metadata } from "next";
import { PurchasesScreen } from "@/features/purchases/purchases-screen";

export const metadata: Metadata = { title: "Compras planeadas" };

export default function Page() {
  return <PurchasesScreen />;
}
