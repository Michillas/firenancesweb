import type { Metadata } from "next";
import { ImportScreen } from "@/features/import/import-screen";

export const metadata: Metadata = { title: "Importar con IA" };

export default function Page() {
  return <ImportScreen />;
}
