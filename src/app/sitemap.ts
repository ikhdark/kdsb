import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.w3cstats.com";

  return [
    {
      url: base,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/stats`,
      changeFrequency: "daily",
    },

    // example player so Google learns the pattern
    {
      url: `${base}/stats/player/kuhhhdark%231976/summary`,
      changeFrequency: "daily",
    },
  ];
}
