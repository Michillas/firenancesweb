import { ChevronDown, Download, HardDrive, KeyRound, Landmark, ShieldCheck, UserX } from "lucide-react";
import Link from "next/link";
import { config, site } from "@/lib/config";
import { FAQ, FEATURES, STEPS } from "./content";
import { ReturningCta } from "./returning-cta";

// A rising net-worth line in a 320×120 box (decorative product preview).
const LINE = "M0 104 L32 96 L60 99 L92 82 L124 86 L156 66 L188 70 L220 46 L252 39 L284 22 L320 12";

const PREVIEW_ROWS = [
  { label: "Nómina", meta: "Ingreso · día 28", amount: "+2.140,00 €", positive: true },
  { label: "Mercadona", meta: "Supermercado", amount: "−64,30 €", positive: false },
  { label: "Fondo indexado MSCI World", meta: "Aportación mensual", amount: "−300,00 €", positive: false },
];

function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none">
      <div className="absolute -inset-10 -z-10 rounded-full bg-accent/10 blur-3xl" />
      <div className="card gap-4 p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Patrimonio neto</p>
            <p className="mt-1 whitespace-nowrap text-[1.7rem] tracking-tight tabular-nums sm:text-3xl">
              48.250<span className="text-muted">,00 €</span>
            </p>
          </div>
          <span className="chip chip-success shrink-0 whitespace-nowrap">+12,4 % este año</span>
        </div>
        <svg viewBox="0 0 320 120" className="h-28 w-full text-accent" preserveAspectRatio="none">
          <path d={`${LINE} L320 120 L0 120 Z`} fill="currentColor" opacity="0.12" />
          <path d={LINE} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Ingresos", "2.140 €"],
            ["Gastado", "1.212 €"],
            ["Libre a fin de mes", "628 €"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-surface-secondary px-2 py-2.5">
              <p className="text-[0.7rem] text-muted">{k}</p>
              <p className="mt-0.5 text-sm tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {PREVIEW_ROWS.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm">{r.label}</span>
                <span className="block text-xs text-muted">{r.meta}</span>
              </span>
              <span className={r.positive ? "text-sm tabular-nums text-success" : "text-sm tabular-nums"}>{r.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const PRIVACY_POINTS = [
  { icon: Landmark, title: "Sin conectar el banco", text: "Nunca pedimos tus claves ni acceso a tus cuentas." },
  { icon: UserX, title: "Sin cuenta", text: "No hay registro, email ni contraseña. Abres la app y empiezas." },
  { icon: HardDrive, title: "Datos en tu dispositivo", text: "Todo se guarda en tu navegador, no en nuestros servidores." },
  { icon: Download, title: "Tuyos de verdad", text: "Exporta una copia cuando quieras o bórralo todo con un clic." },
  { icon: KeyRound, title: "IA bajo tu control", text: "Solo se usa cuando la pides, y puedes usar tu propia clave." },
  { icon: ShieldCheck, title: "Sin publicidad ni rastreo", text: "Sin cookies de terceros ni analítica que te siga." },
];

function JsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: site.name,
      url: `${config.siteUrl}/`,
      description: site.description,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      inLanguage: "es",
      browserRequirements: "Requiere JavaScript y un navegador moderno",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      featureList: FEATURES.map((f) => f.title),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  // `<` is escaped so the JSON can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function LandingPage() {
  return (
    <>
      <JsonLd />

      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col items-start gap-6">
            <span className="chip chip-accent">Gratis · Sin cuenta · Sin conectar el banco</span>
            <h1 className="text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Tus finanzas personales, <span className="text-accent">sin darle tu banco a nadie.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted">
              Controla gastos, suscripciones, nómina, patrimonio e inversiones, y planifica tu independencia financiera. Todo en tu navegador, con ayuda de IA cuando la
              necesitas.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ReturningCta size="lg" />
              <Link href="#como-funciona" className="btn btn-secondary btn-lg">
                Cómo funciona
              </Link>
            </div>
            <p className="text-sm text-muted">Pruébalo con datos de ejemplo en un clic. Sin registro.</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section id="funciones" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl tracking-tight sm:text-4xl">Todo tu dinero en un solo sitio</h2>
            <p className="mt-3 text-muted">Del gasto del súper a tu plan de jubilación anticipada, con cálculos pensados para España: IRPF, pagas extra y calendario fiscal.</p>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card gap-2 p-5">
                <span className="grid size-10 place-items-center rounded-xl border border-border bg-surface-secondary text-accent">
                  <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-1 font-medium">{title}</h3>
                <p className="text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Cómo funciona</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-accent text-sm text-accent-foreground">{i + 1}</span>
                <h3 className="text-lg font-medium">{s.title}</h3>
                <p className="text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="privacidad" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl tracking-tight sm:text-4xl">Privada por diseño</h2>
            <p className="mt-3 text-muted">
              Las apps que se conectan a tu banco ven todos tus movimientos. FireNances funciona al revés: tus datos se quedan contigo.{" "}
              <Link href="/privacidad" className="text-accent underline-offset-4 hover:underline">
                Lee cómo tratamos los datos
              </Link>
              .
            </p>
          </div>
          <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRIVACY_POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="preguntas" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Preguntas frecuentes</h2>
          <div className="mt-8 flex flex-col divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
          <h2 className="max-w-2xl text-3xl tracking-tight sm:text-4xl">Empieza a ordenar tu dinero hoy</h2>
          <p className="max-w-xl text-muted">Sin registro y sin dar tus claves a nadie. Si solo quieres curiosear, carga los datos de ejemplo.</p>
          <ReturningCta size="lg" />
        </div>
      </section>
    </>
  );
}
