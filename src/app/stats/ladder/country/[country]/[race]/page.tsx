import { notFound } from "next/navigation";
import LadderPage from "@/components/LadderPage";
import {
  getCountryRaceLadder,
  type RaceKey,
} from "@/services/countryRaceLadder";

/* ---------------------
   Country name mapping
---------------------- */
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

type PageProps = {
  params: Promise<{
    country?: string;
    race?: string;
  }>;
};

const VALID_RACES: RaceKey[] = [
  "human",
  "orc",
  "elf",
  "undead",
  "random",
];

export default async function CountryRacePage({ params }: PageProps) {
  const resolved = await params;

  const country = resolved?.country;
  const race = resolved?.race as RaceKey | undefined;

  if (!country || !race || !VALID_RACES.includes(race)) {
    return notFound();
  }

  const fullCountryName = COUNTRY_NAMES[country.toUpperCase()] ?? country.toUpperCase();

  const data = await getCountryRaceLadder(
    country,
    race,
    undefined,
    1,
    9999
  );

  if (!data) return notFound();

  return (
<LadderPage
  title={`${fullCountryName} \n ${race.toUpperCase()} Ladder`}
  subtitle={`Players: ${data.poolSize}`}
  base={`/stats/ladder/country/${country}/${race}`}
  rows={data.full}
  poolSize={data.poolSize}
  currentPage={1}
  totalPages={1}
/>
  );
}