import type { Metadata } from "next";
import { CalendarScreen } from "@/features/calendar/calendar-screen";

export const metadata: Metadata = { title: "Calendario" };

export default function Page() {
  return <CalendarScreen />;
}
