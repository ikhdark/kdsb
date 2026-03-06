import { notFound } from "next/navigation";
import LadderPage from "@/components/LadderPage";
import {
  getCountryRaceLadder,
  type RaceKey,
} from "@/services/countryRaceLadder";

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
  const { country, race } = await params;

  if (!country || !race || !VALID_RACES.includes(race as RaceKey)) {
    return notFound();
  }

  const countryCode = country.toUpperCase();
  const raceKey = race as RaceKey;

  const data = await getCountryRaceLadder(
    countryCode,
    raceKey,
    undefined,
    1,
    9999
  );

  if (!data) return notFound();

  return (
    <LadderPage
      title={`${countryCode} ${raceKey.toUpperCase()} Ladder`}
      subtitle={`Players: ${data.poolSize} • Rank = 80% MMR + 15% SoS (game-scaled) + 5% activity`}
      base={`/stats/ladder/country/${countryCode}/${raceKey}`}
      rows={data.full}
      poolSize={data.poolSize}
      currentPage={1}
      totalPages={1}
    />
  );
}