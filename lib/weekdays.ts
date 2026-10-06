import { addDays, parseKey, startOfWeek, type WeekStart } from "@/core/logic/dates";
import { INTL } from "./format";

export function weekdayLabels(weekStartsOn: WeekStart, style: "short" | "narrow" = "short"): string[] {
  const start = startOfWeek("2026-10-04", weekStartsOn);
  const fmt = new Intl.DateTimeFormat(INTL, { weekday: style });
  return Array.from({ length: 7 }, (_, i) => fmt.format(parseKey(addDays(start, i))));
}
