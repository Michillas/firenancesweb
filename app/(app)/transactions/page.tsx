import type { Metadata } from "next";
import { TransactionsScreen } from "@/features/transactions/transactions-screen";

export const metadata: Metadata = { title: "Movimientos" };

export default function Page() {
  return <TransactionsScreen />;
}
