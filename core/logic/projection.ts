import { seededRng, type Rng } from "./rng";

export const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
// Return above inflation, (1+r)/(1+i)-1, in percent.
export const realReturn = (nominalPct: number, inflationPct: number) => ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;

export interface ProjectionPoint {
  year: number;
  contributed: number;
  value: number;
  // Value in today's money.
  real: number;
  interest: number;
}

export function project(input: { initial: number; monthly: number; annualReturn: number; years: number; inflation?: number; contributionGrowth?: number }): ProjectionPoint[] {
  const r = monthlyRate(input.annualReturn);
  const infl = input.inflation ?? 0;
  let value = input.initial;
  let contributed = input.initial;
  let monthly = input.monthly;
  const out: ProjectionPoint[] = [{ year: 0, contributed, value, real: value, interest: 0 }];
  for (let y = 1; y <= input.years; y++) {
    for (let m = 0; m < 12; m++) {
      value = value * (1 + r) + monthly;
      contributed += monthly;
    }
    monthly *= 1 + (input.contributionGrowth ?? 0) / 100;
    const real = value / Math.pow(1 + infl / 100, y);
    out.push({ year: y, contributed, value, real, interest: value - contributed });
  }
  return out;
}

// Months until `target` is reached, or null if not within 100 years.
export function monthsToTarget(initial: number, monthly: number, annualReturn: number, target: number): number | null {
  if (initial >= target) return 0;
  const r = monthlyRate(annualReturn);
  let value = initial;
  for (let m = 1; m <= 1200; m++) {
    value = value * (1 + r) + monthly;
    if (value >= target) return m;
  }
  return null;
}

// Monthly contribution needed to reach `target` in `months`.
export function requiredMonthly(initial: number, target: number, months: number, annualReturn: number): number {
  if (months <= 0) return Math.max(0, target - initial);
  const r = monthlyRate(annualReturn);
  if (Math.abs(r) < 1e-9) return Math.max(0, (target - initial) / months);
  const growth = Math.pow(1 + r, months);
  return Math.max(0, ((target - initial * growth) * r) / (growth - 1));
}

export interface Strategy {
  id: string;
  label: string;
  description: string;
  annualReturn: number;
  volatility: number;
}

// Long-run nominal returns: deliberately conservative, in line with historical global averages.
export const STRATEGIES: Strategy[] = [
  { id: "cash", label: "Cuenta remunerada", description: "Depósitos y cuentas al ~2 %. Sin riesgo, pierde contra la inflación a largo plazo.", annualReturn: 2, volatility: 0.5 },
  { id: "conservative", label: "Conservadora", description: "20/80 acciones/bonos (fondos indexados).", annualReturn: 4, volatility: 6 },
  { id: "balanced", label: "Equilibrada", description: "60/40 acciones globales y renta fija.", annualReturn: 5.5, volatility: 10 },
  { id: "growth", label: "Crecimiento", description: "90/10, p. ej. MSCI World / S&P 500 indexado.", annualReturn: 7, volatility: 15 },
  { id: "aggressive", label: "Agresiva", description: "100 % renta variable con sesgo a crecimiento o emergentes.", annualReturn: 8, volatility: 19 },
];

// Standard normal from two uniforms (Box-Muller).
export function normal(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export interface SimulationResult {
  // Percentile bands per year in today's money.
  bands: { year: number; p10: number; p50: number; p90: number }[];
  // Share of paths that reached `target` (real) by each year.
  successByYear: number[];
  successAtEnd: number;
}

// Monte Carlo of the accumulation phase with log-normal yearly returns (real terms).
export function simulate(input: { initial: number; monthly: number; years: number; annualReturn: number; volatility: number; inflation: number; target: number; paths?: number; seed?: string }): SimulationResult {
  const paths = input.paths ?? 1000;
  const rng = seededRng(input.seed ?? "firenances");
  const mu = Math.log(1 + realReturn(input.annualReturn, input.inflation) / 100);
  const sigma = input.volatility / 100;
  const byYear: number[][] = Array.from({ length: input.years + 1 }, () => []);
  const reached = new Array<number>(input.years + 1).fill(0);
  for (let p = 0; p < paths; p++) {
    let value = input.initial;
    let hit = value >= input.target;
    byYear[0].push(value);
    if (hit) reached[0]++;
    for (let y = 1; y <= input.years; y++) {
      const yearly = Math.exp(mu - (sigma * sigma) / 2 + sigma * normal(rng)) - 1;
      // Contributions are spread through the year: half a year of growth on average.
      value = value * (1 + yearly) + input.monthly * 12 * (1 + yearly / 2);
      byYear[y].push(value);
      if (!hit && value >= input.target) hit = true;
      if (hit) reached[y]++;
    }
  }
  const pct = (arr: number[], q: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
  };
  const bands = byYear.map((arr, year) => ({ year, p10: pct(arr, 0.1), p50: pct(arr, 0.5), p90: pct(arr, 0.9) }));
  const successByYear = reached.map((n) => (n / paths) * 100);
  return { bands, successByYear, successAtEnd: successByYear[successByYear.length - 1] ?? 0 };
}

// Probability that a portfolio survives `years` of inflation-adjusted withdrawals.
export function retirementSuccess(input: { portfolio: number; annualWithdrawal: number; years: number; annualReturn: number; volatility: number; inflation: number; paths?: number; seed?: string }): number {
  const paths = input.paths ?? 1000;
  const rng = seededRng(input.seed ?? "retire");
  const mu = Math.log(1 + realReturn(input.annualReturn, input.inflation) / 100);
  const sigma = input.volatility / 100;
  let ok = 0;
  for (let p = 0; p < paths; p++) {
    let value = input.portfolio;
    let alive = true;
    for (let y = 0; y < input.years; y++) {
      value -= input.annualWithdrawal;
      if (value <= 0) {
        alive = false;
        break;
      }
      value *= Math.exp(mu - (sigma * sigma) / 2 + sigma * normal(rng));
    }
    if (alive) ok++;
  }
  return (ok / paths) * 100;
}
