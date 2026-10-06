import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // App screens stay crawlable on purpose so bots can read their `noindex`; only the API is off limits.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
