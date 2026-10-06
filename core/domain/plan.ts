import { z } from "zod";
import { isoString } from "./base";

// The user's financial plan: payroll, how the salary is split, and FIRE assumptions. One document.
export const BUCKET_KINDS = ["needs", "wants", "savings", "invest", "goal"] as const;
export type BucketKind = (typeof BUCKET_KINDS)[number];

export const bucketSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(BUCKET_KINDS),
  percent: z.number().min(0).max(100),
});
export type Bucket = z.infer<typeof bucketSchema>;

export const extraIncomeSchema = z.object({
  id: z.string(),
  name: z.string(),
  monthly: z.number().nonnegative(),
});

export const payrollSchema = z.object({
  grossAnnual: z.number().nonnegative().default(0),
  payments: z.union([z.literal(12), z.literal(14)]).default(14),
  payday: z.number().int().min(1).max(31).default(28),
  // Months (1-12) with an extra payment when payments = 14.
  extraMonths: z.array(z.number().int().min(1).max(12)).default([6, 12]),
  children: z.number().int().min(0).max(10).default(0),
  // Overrides from the actual payslip (null = estimate).
  irpfRate: z.number().min(0).max(60).nullable().default(null),
  ssRate: z.number().min(0).max(20).default(6.48),
  netMonthlyOverride: z.number().nullable().default(null),
  // Expected yearly raise (%) used by long projections.
  raisePct: z.number().default(2),
  accountId: z.string().nullable().default(null),
  extras: z.array(extraIncomeSchema).default([]),
});
export type Payroll = z.infer<typeof payrollSchema>;

export const fireSchema = z.object({
  birthYear: z.number().int().min(1920).max(2020).nullable().default(null),
  targetAge: z.number().int().min(25).max(80).default(50),
  // Annual spending in retirement; null = derived from the last 12 months of expenses.
  annualExpenses: z.number().nullable().default(null),
  withdrawalRate: z.number().min(1).max(10).default(4),
  expectedReturn: z.number().min(-5).max(20).default(7),
  inflation: z.number().min(0).max(15).default(2.5),
  volatility: z.number().min(0).max(40).default(15),
  // null = derived from the payroll plan (savings + invest buckets).
  monthlyContribution: z.number().nullable().default(null),
  leanFactor: z.number().default(0.7),
  fatFactor: z.number().default(1.5),
  baristaIncome: z.number().nonnegative().default(12000),
  // Expected public pension per year (today's money) from `pensionAge`.
  pension: z.number().nonnegative().default(0),
  pensionAge: z.number().int().default(67),
});
export type FireSettings = z.infer<typeof fireSchema>;

export const DEFAULT_BUCKETS: Bucket[] = [
  { id: "needs", name: "Necesidades", kind: "needs", percent: 50 },
  { id: "wants", name: "Caprichos y ocio", kind: "wants", percent: 25 },
  { id: "invest", name: "Inversión", kind: "invest", percent: 15 },
  { id: "savings", name: "Ahorro / metas", kind: "savings", percent: 10 },
];

export const planSchema = z.object({
  id: z.string().default("singleton"),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable().optional(),
  payroll: payrollSchema.default(payrollSchema.parse({})),
  buckets: z.array(bucketSchema).default(DEFAULT_BUCKETS),
  fire: fireSchema.default(fireSchema.parse({})),
});
export type Plan = z.infer<typeof planSchema>;
