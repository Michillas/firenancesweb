import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays, isoWeekKey, monthGrid, startOfWeek, weekday } from "./dates";

describe("dates", () => {
  it("adds days across DST boundaries without drifting", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // EU spring-forward weekend
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // EU fall-back weekend
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
  });
  it("clamps month arithmetic to the target month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("computes weeks for Monday and Sunday starts", () => {
    expect(weekday("2026-10-02")).toBe(5);
    expect(startOfWeek("2026-10-02", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-02", 0)).toBe("2026-09-27");
  });
  it("builds a 6x7 month grid starting on the configured weekday", () => {
    const grid = monthGrid("2026-10-15", 1);
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toBe("2026-09-28");
    expect(grid[5][6]).toBe("2026-11-08");
  });
  it("labels ISO weeks", () => {
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2026-12-31")).toBe("2026-W53");
  });
});
