import type { Metadata, Viewport } from "next";
import { config, site } from "@/lib/config";
import { uiPrefsBootScript } from "@/lib/ui-prefs";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: site.title, template: "%s · FireNances" },
  description: site.description,
  applicationName: site.name,
  keywords: [...site.keywords],
  category: "finance",
  creator: site.name,
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: site.name,
    title: site.title,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
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
