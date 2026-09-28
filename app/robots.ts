import type { MetadataRoute } from "next";
import { siteUrl } from "./layout";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // API routes proxy live market data; crawling them wastes budget and
        // hammers upstream providers.
        disallow: "/api/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
