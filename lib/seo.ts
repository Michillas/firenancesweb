import type { Metadata } from "next";
import { site } from "./config";

// Metadata for an indexable public page. Next replaces (does not merge) nested objects such as `openGraph`,
// so every page gets the full set here instead of overriding a single field.
// app/opengraph-image.tsx. Listed explicitly: a page-level `openGraph` drops the inherited file-based image.
const IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "FireNances: finanzas personales sin conectar el banco" };

export function publicPage({ path, title, description = site.description }: { path: string; title?: string; description?: string }): Metadata {
  const fullTitle = title ? `${title} · ${site.name}` : site.title;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "es_ES", siteName: site.name, url: path, title: fullTitle, description, images: [IMAGE] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [IMAGE] },
  };
}
