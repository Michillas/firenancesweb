// Palette for user-chosen colours (accounts, categories, goals). Stored as ids so a theme change
// never orphans data; `oklch` keeps the same perceived lightness in light and dark mode.
export const PALETTE = [
  { id: "indigo", value: "oklch(0.62 0.2 275)" },
  { id: "sky", value: "oklch(0.68 0.14 230)" },
  { id: "teal", value: "oklch(0.65 0.12 190)" },
  { id: "emerald", value: "oklch(0.66 0.16 155)" },
  { id: "lime", value: "oklch(0.74 0.17 125)" },
  { id: "amber", value: "oklch(0.76 0.16 75)" },
  { id: "orange", value: "oklch(0.7 0.18 50)" },
  { id: "rose", value: "oklch(0.65 0.21 15)" },
  { id: "fuchsia", value: "oklch(0.64 0.24 325)" },
  { id: "violet", value: "oklch(0.6 0.22 295)" },
  { id: "slate", value: "oklch(0.6 0.03 255)" },
] as const;

export type PaletteId = (typeof PALETTE)[number]["id"];

export function colorValue(id: string | null | undefined, fallback = "slate"): string {
  const found = PALETTE.find((c) => c.id === id) ?? PALETTE.find((c) => c.id === fallback)!;
  return found.value;
}

// Chart series follow the entity, never its rank: each asset type / bucket owns a fixed slot of the
// validated categorical palette (CSS vars --series-1..8 in globals.css).
export const series = (slot: number) => `var(--series-${((slot - 1) % 8) + 1})`;

export const ASSET_TYPE_SLOT: Record<string, number> = { etf: 1, stock: 2, index_fund: 3, crypto: 4, bond: 5, cash: 6, pension: 7, reit: 8, commodity: 8, other: 8 };
