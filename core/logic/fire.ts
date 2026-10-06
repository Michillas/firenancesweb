import type { FireSettings } from "../domain/plan";
import { monthsToTarget, project, realReturn } from "./projection";

export interface FireNumbers {
  fire: number;
  lean: number;
  fat: number;
  // Portfolio needed when a part-time income covers part of the expenses.
  barista: number;
}

export function fireNumbers(annualExpenses: number, s: Pick<FireSettings, "withdrawalRate" | "leanFactor" | "fatFactor" | "baristaIncome">): FireNumbers {
  const mult = 100 / s.withdrawalRate;
  return {
    fire: annualExpenses * mult,
    lean: annualExpenses * s.leanFactor * mult,
    fat: annualExpenses * s.fatFactor * mult,
    barista: Math.max(0, annualExpenses - s.baristaIncome) * mult,
  };
}

// Amount that, with zero further contributions, compounds into `target` by `years` from now (real terms).
export function coastNumber(target: number, years: number, realReturnPct: number): number {
  if (years <= 0) return target;
  return target / Math.pow(1 + realReturnPct / 100, years);
}

export interface FirePlan {
  numbers: FireNumbers;
  realReturn: number;
  progress: number;
  // Years until each target, in real terms with current contributions (null = >100 years).
  yearsTo: Record<keyof FireNumbers, number | null>;
  ageAt: Record<keyof FireNumbers, number | null>;
  coast: { needed: number; reached: boolean; yearsToTarget: number };
  currentAge: number | null;
  // Yearly real trajectory vs targets for the chart.
  timeline: { year: number; age: number | null; value: number; contributed: number }[];
  safeMonthlyIncome: number;
}

export function firePlan(input: { s: FireSettings; annualExpenses: number; current: number; monthly: number; thisYear: number }): FirePlan {
  const { s } = input;
  const numbers = fireNumbers(input.annualExpenses, s);
  const real = realReturn(s.expectedReturn, s.inflation);
  const currentAge = s.birthYear ? input.thisYear - s.birthYear : null;
  const yearsOf = (target: number) => {
    const m = monthsToTarget(input.current, input.monthly, real, target);
    return m == null ? null : Math.round((m / 12) * 10) / 10;
  };
  const yearsTo = { fire: yearsOf(numbers.fire), lean: yearsOf(numbers.lean), fat: yearsOf(numbers.fat), barista: yearsOf(numbers.barista) };
  const age = (y: number | null) => (y == null || currentAge == null ? null : Math.round((currentAge + y) * 10) / 10);
  const yearsToTarget = currentAge != null ? Math.max(0, s.targetAge - currentAge) : 20;
  const needed = coastNumber(numbers.fire, yearsToTarget, real);
  const horizon = Math.min(60, Math.max(10, Math.ceil((yearsTo.fat ?? yearsTo.fire ?? 40) + 5)));
  const timeline = project({ initial: input.current, monthly: input.monthly, annualReturn: real, years: horizon }).map((p) => ({
    year: input.thisYear + p.year,
    age: currentAge != null ? currentAge + p.year : null,
    value: p.value,
    contributed: p.contributed,
  }));
  return {
    numbers,
    realReturn: real,
    progress: numbers.fire > 0 ? Math.min(100, (input.current / numbers.fire) * 100) : 0,
    yearsTo,
    ageAt: { fire: age(yearsTo.fire), lean: age(yearsTo.lean), fat: age(yearsTo.fat), barista: age(yearsTo.barista) },
    coast: { needed, reached: input.current >= needed, yearsToTarget },
    currentAge,
    timeline,
    safeMonthlyIncome: (input.current * s.withdrawalRate) / 100 / 12,
  };
}

// How much sooner FIRE arrives with `extra` more per month (the "what if I save X more" lever).
export function yearsSaved(input: { current: number; monthly: number; extra: number; realReturnPct: number; target: number }): number | null {
  const base = monthsToTarget(input.current, input.monthly, input.realReturnPct, input.target);
  const faster = monthsToTarget(input.current, input.monthly + input.extra, input.realReturnPct, input.target);
  if (base == null || faster == null) return null;
  return Math.round(((base - faster) / 12) * 10) / 10;
}
