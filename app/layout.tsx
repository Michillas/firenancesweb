import type { Metadata, Viewport } from "next";
import { uiPrefsBootScript } from "@/lib/ui-prefs";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FireNances", template: "%s · FireNances" },
  description: "Finanzas personales sin conectar el banco: patrimonio, gastos, suscripciones, nómina, inversiones con noticias e IA, y planificación FIRE.",
  applicationName: "FireNances",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b1a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: uiPrefsBootScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
