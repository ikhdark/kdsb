import Link from "next/link";
import { fetchCountryLadder } from "@/services/w3cApi";
import { flattenCountryLadder } from "@/lib/ranking";
import { PlayerHeader, Section } from "@/components/PlayerUI";

const KNOWN_COUNTRIES = [
  "US","DE","FR","SE","NO","DK","FI","PL","CZ","RU",
  "UA","BR","CN","KR","AT","NL","BE","GB","ES","IT",
  "CA","MX","AU","IN","TR"
];

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  DE: "Germany",
  FR: "France",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czech Republic",
  RU: "Russia",
  UA: "Ukraine",
  BR: "Brazil",
  CN: "China",
  KR: "South Korea",
  AT: "Austria",
  NL: "Netherlands",
  BE: "Belgium",
  GB: "United Kingdom",
  ES: "Spain",
  IT: "Italy",
  CA: "Canada",
  MX: "Mexico",
  AU: "Australia",
  IN: "India",
  TR: "Turkey",
};

export default async function CountryHubPage() {
  const found = new Set<string>();

  // probe a subset to build list quickly
  await Promise.all(
    KNOWN_COUNTRIES.slice(0, 50).map(async (code) => {
      try {
        const payload = await fetchCountryLadder(code, 20, 1, 24);
        const rows = flattenCountryLadder(payload);

        if (rows.length > 0) {
          found.add(code);
        }
      } catch {
        // ignore probe failures
      }
    })
  );

  const countries = Array.from(found).sort();
  console.log("countries found:", countries.length);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 md:px-0">
      <PlayerHeader
        battletag="SoS Country Ladder"
        subtitle="Select Country (If you do not see your country, try again later as the database is updated)"
      />

      <Section title="Country Selection">
        {countries.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-6">
            No countries available.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {countries.map((code) => (
              <Link
                key={code}
                href={`/stats/ladder/country/${code}`}
                className="
                  h-10
                  rounded-md
                  border border-zinc-400 dark:border-zinc-800
                  bg-white dark:bg-zinc-900
                  flex items-center justify-center
                  text-sm font-medium
                  text-zinc-700 dark:text-zinc-200
                  hover:bg-zinc-100 dark:hover:bg-zinc-800
                  hover:border-emerald-500
                  dark:hover:border-emerald-500
                  transition-colors
                "
              >
                {COUNTRY_NAMES[code] ?? code}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}