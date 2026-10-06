// The single place that reads public environment variables. NEXT_PUBLIC_* values are inlined at build time.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const config = {
  // Public origin used for canonical URLs, Open Graph, sitemap and robots. Set it on the real deployment.
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3200")).replace(/\/$/, ""),
  // Optional: shown on the privacy page as the contact address.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
} as const;

export const site = {
  name: "FireNances",
  title: "FireNances — Finanzas personales sin conectar el banco",
  description:
    "App gratuita de finanzas personales que no pide tu banco: controla gastos, suscripciones, nómina, patrimonio e inversiones, y planifica tu independencia financiera (FIRE). Tus datos se quedan en tu navegador.",
  keywords: [
    "finanzas personales",
    "app de finanzas sin banco",
    "control de gastos",
    "presupuesto mensual",
    "suscripciones",
    "calculadora nómina neta",
    "IRPF 2026",
    "patrimonio neto",
    "seguimiento de inversiones",
    "fondos indexados",
    "ETFs",
    "FIRE",
    "independencia financiera",
    "ahorro",
    "alternativa a Fintonic",
  ],
} as const;

// Per-device flag (useLocalValue) set when the app opens, so the public home can offer "Ir a mi panel".
export const VISITED_KEY = "firenances:visited";
