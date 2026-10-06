import type { Metadata } from "next";
import { SubscriptionsScreen } from "@/features/subscriptions/subscriptions-screen";

export const metadata: Metadata = { title: "Suscripciones" };

export default function Page() {
  return <SubscriptionsScreen />;
}
