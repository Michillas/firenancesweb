import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// Only the public pages: the app screens are personal (local data) and marked noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${config.siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${config.siteUrl}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
