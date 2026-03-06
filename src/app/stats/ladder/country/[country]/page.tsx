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

export default async function CountryPage({ params }: PageProps) {
  const { country } = await params;

  if (!country) {
    return notFound();
  }

  const code = country.toUpperCase();

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 md:px-0">
      <PlayerHeader
        battletag={`${code} Country`}
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