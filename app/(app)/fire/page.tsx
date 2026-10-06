import type { Metadata } from "next";
import { FireScreen } from "@/features/fire/fire-screen";

export const metadata: Metadata = { title: "FIRE" };

export default function Page() {
  return <FireScreen />;
}
