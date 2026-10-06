import Link from "next/link";
import { LogoMark } from "@/components/shell/logo";
import { ReturningCta } from "./returning-cta";

const LINKS = [
  { href: "/#funciones", label: "Funciones" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#privacidad", label: "Privacidad" },
  { href: "/#preguntas", label: "Preguntas" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="FireNances, inicio">
          <span className="grid size-9 place-items-center rounded-xl border border-border bg-surface">
            <LogoMark className="size-5" />
          </span>
          <span className="font-medium">FireNances</span>
        </Link>
        <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm text-muted md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <ReturningCta size="sm" />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-foreground">
            <LogoMark className="size-5" />
            <span className="font-medium">FireNances</span>
          </Link>
          <p>
            Herramienta educativa de finanzas personales. No es asesoramiento financiero, fiscal ni de inversión: los cálculos de IRPF, previsiones y análisis con IA son
            estimaciones.
          </p>
        </div>
        <nav aria-label="Enlaces legales" className="flex flex-col gap-2">
          <Link href="/dashboard" className="hover:text-foreground">
            Abrir la app
          </Link>
          <Link href="/privacidad" className="hover:text-foreground">
            Privacidad y aviso legal
          </Link>
          <span>© {new Date().getFullYear()} FireNances</span>
        </nav>
      </div>
    </footer>
  );
}
