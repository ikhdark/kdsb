import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerHeader, Section } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ country?: string }>;
};

const RACES = [
  { key: "human", label: "Human" },
  { key: "orc", label: "Orc" },
  { key: "elf", label: "Night Elf" },
  { key: "undead", label: "Undead" },
  { key: "random", label: "Random" },
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

export default async function CountryPage({ params }: PageProps) {
  const resolved = await params;
  const country = resolved?.country;

  if (!country || typeof country !== "string") {
    return notFound();
  }

  const code = country.toUpperCase();
  const fullName = COUNTRY_NAMES[code] ?? code;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 md:px-0">
      <PlayerHeader
        battletag={`${fullName} Country`}
        subtitle="Select race ladder"
      />

      <Section title="Race Selection">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {RACES.map((r) => (
            <Link
              key={r.key}
              href={`/stats/ladder/country/${code}/${r.key}`}
              className="
                h-10
                rounded-md
                border border-zinc-500 dark:border-zinc-800
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
              {r.label}
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}