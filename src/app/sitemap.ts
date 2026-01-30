import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.w3cstats.com";
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/stats`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },

    // one example player (only used to teach Google the route pattern)
    {
      url: `${base}/stats/player/kuhhhdark%231976/summary`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];
}
