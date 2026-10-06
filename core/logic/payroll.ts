import type { Payroll } from "../domain/plan";
import type { MonthKey } from "./dates";

// Spanish payroll estimator (rules in force for 2026). It is an approximation of the withholding
// the employer applies: regional scales, family situation and contract type change the real figure,
// so the UI always lets the user override it with the rate printed on the payslip.

// Employee social-security rate: common contingencies 4.70 + unemployment 1.55 + training 0.10 + MEI 0.13.
export const SS_EMPLOYEE_RATE = 6.48;
// Maximum contribution base 2026 (monthly) x 12.
export const SS_MAX_BASE_ANNUAL = 5101.2 * 12;
const OTHER_DEDUCTIBLE = 2000;
const PERSONAL_MINIMUM = 5550;
const CHILD_MINIMUM = [2400, 2700, 4000, 4500];

// General (state + average regional) progressive scale.
const SCALE: [limit: number, rate: number][] = [
  [12450, 0.19],
  [20200, 0.24],
  [35200, 0.3],
  [60000, 0.37],
  [300000, 0.45],
  [Infinity, 0.47],
];

export function applyScale(base: number): number {
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of SCALE) {
    if (base <= prev) break;
    tax += (Math.min(base, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}

// Reducción por obtención de rendimientos del trabajo (art. 20 LIRPF).
export function workIncomeReduction(netWork: number): number {
  if (netWork <= 14852) return 7302;
  if (netWork <= 17673.52) return Math.max(0, 7302 - 1.75 * (netWork - 14852));
  if (netWork <= 19747.5) return Math.max(0, 2364.34 - 1.14 * (netWork - 17673.52));
  return 0;
}

export function familyMinimum(children: number): number {
  let total = PERSONAL_MINIMUM;
  for (let i = 0; i < children; i++) total += CHILD_MINIMUM[Math.min(i, CHILD_MINIMUM.length - 1)];
  return total;
}

export interface PayrollEstimate {
  gross: number;
  socialSecurity: number;
  irpf: number;
  irpfRate: number;
  netAnnual: number;
  // Net of an ordinary month and of a month with an extra payment.
  netMonthly: number;
  netExtraMonth: number;
  // Annual net spread over 12 months (what you can budget each month).
  netProrated: number;
  ssRate: number;
  estimatedIrpf: boolean;
}

export function estimatePayroll(p: Pick<Payroll, "grossAnnual" | "payments" | "children" | "irpfRate" | "ssRate">): PayrollEstimate {
  const gross = Math.max(0, p.grossAnnual);
  const ssRate = p.ssRate ?? SS_EMPLOYEE_RATE;
  const socialSecurity = (Math.min(gross, SS_MAX_BASE_ANNUAL) * ssRate) / 100;
  let irpfRate: number;
  if (p.irpfRate != null) irpfRate = p.irpfRate;
  else {
    const netWork = Math.max(0, gross - socialSecurity - OTHER_DEDUCTIBLE);
    const base = Math.max(0, netWork - workIncomeReduction(netWork));
    const quota = Math.max(0, applyScale(base) - applyScale(Math.min(base, familyMinimum(p.children))));
    irpfRate = gross > 0 ? Math.round((quota / gross) * 10000) / 100 : 0;
  }
  const irpf = (gross * irpfRate) / 100;
  const netAnnual = gross - socialSecurity - irpf;
  const perPayment = gross / p.payments;
  // Social security is prorated over 12 months, so extra payments only lose IRPF.
  const netMonthly = perPayment - socialSecurity / 12 - (perPayment * irpfRate) / 100;
  const netExtraMonth = p.payments === 14 ? netMonthly + perPayment * (1 - irpfRate / 100) : netMonthly;
  return { gross, socialSecurity, irpf, irpfRate, netAnnual, netMonthly, netExtraMonth, netProrated: netAnnual / 12, ssRate, estimatedIrpf: p.irpfRate == null };
}

// Net salary that lands in `month` (extra payments included), honouring a payslip override.
export function netForMonth(p: Payroll, month: MonthKey): number {
  if (p.grossAnnual <= 0 && p.netMonthlyOverride == null) return 0;
  const est = estimatePayroll(p);
  const isExtra = p.payments === 14 && p.extraMonths.includes(Number(month.slice(5, 7)));
  const base = p.netMonthlyOverride ?? est.netMonthly;
  const extra = isExtra ? (p.netMonthlyOverride != null ? p.netMonthlyOverride : est.netExtraMonth - est.netMonthly) : 0;
  return base + extra;
}

export function extrasMonthly(p: Payroll): number {
  return p.extras.reduce((n, e) => n + e.monthly, 0);
}

// What one ordinary month brings in on average (annual net / 12 + side incomes).
export function averageMonthlyIncome(p: Payroll): number {
  const est = estimatePayroll(p);
  const salary = p.netMonthlyOverride != null ? (p.netMonthlyOverride * p.payments) / 12 : est.netProrated;
  return (p.grossAnnual > 0 || p.netMonthlyOverride != null ? salary : 0) + extrasMonthly(p);
}
