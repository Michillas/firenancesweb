import type { Metadata } from "next";
import { PayrollScreen } from "@/features/payroll/payroll-screen";

export const metadata: Metadata = { title: "Nómina y previsión" };

export default function Page() {
  return <PayrollScreen />;
}
