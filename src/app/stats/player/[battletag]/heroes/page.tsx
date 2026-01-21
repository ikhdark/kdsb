import { notFound } from "next/navigation";
import { getW3CHeroStats } from "@/services/playerHeroes";

type PageProps = {
  params: {
    battletag: string;
  };
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="border-b border-gray-300 pb-1 font-semibold uppercase tracking-wide text-sm text-black dark:border-gray-700 dark:text-white">
        {title}
      </h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function StatRow({
  label,
  value,
  winrate,
}: {
  label: string;
  value: string;
  winrate?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
      <span>{label}</span>
      <span className="tabular-nums font-medium">{value}</span>

      {typeof winrate === "number" && (
        <div className="col-span-2 mt-1 h-1.5 bg-gray-200 rounded overflow-hidden dark:bg-gray-700">
          <div
            className={`h-full ${
              winrate >= 55
                ? "bg-emerald-500"
                : winrate >= 48
                ? "bg-yellow-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, winrate))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default async function HeroesPage({ params }: PageProps) {
  const battletag = params?.battletag;
  if (!battletag) notFound();

  // DO NOT decode or normalize here
  const data = await getW3CHeroStats(battletag);
  if (!data) notFound();

  const lines = data.result
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const HEADERS = [
    "YOUR W/L BY YOUR HERO COUNT",
    "YOUR W/L VS OPPONENT HERO COUNT",
    "YOUR TOP 5 BEST WINRATES VS OPPONENT OPENING HERO",
    "TOP 5 WORST WINRATES VS OPPONENT OPENING HERO",
    "YOUR TOP 5 WORST WINRATES VS OPPONENT OPENING HERO",
    "YOUR TOP 5 BEST WINRATES VS OPPONENT HEROES OVERALL",
    "YOUR TOP 5 WORST WINRATES VS OPPONENT HEROES OVERALL",
  ];

  const normalize = (s: string) =>
    s.toUpperCase().replace(/\s+/g, " ").trim();

  function collectSection(possibleHeaders: string[]) {
    const wanted = possibleHeaders.map(normalize);
    const start = lines.findIndex(l =>
      wanted.includes(normalize(l))
    );
    if (start === -1) return [];

    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (HEADERS.includes(normalize(lines[i]))) break;
      out.push(lines[i]);
    }
    return out;
  }

  const byHeroCount = collectSection([
    "YOUR W/L BY YOUR HERO COUNT",
  ]);

  const vsOppHeroCount = collectSection([
    "YOUR W/L VS OPPONENT HERO COUNT",
  ]);

  const bestOpeners = collectSection([
    "YOUR TOP 5 BEST WINRATES VS OPPONENT OPENING HERO",
    "TOP 5 BEST WINRATES VS OPPONENT OPENING HERO",
  ]);

  const worstOpeners = collectSection([
    "TOP 5 WORST WINRATES VS OPPONENT OPENING HERO",
    "YOUR TOP 5 WORST WINRATES VS OPPONENT OPENING HERO",
  ]);

  const bestOverall = collectSection([
    "YOUR TOP 5 BEST WINRATES VS OPPONENT HEROES OVERALL",
  ]);

  const worstOverall = collectSection([
    "YOUR TOP 5 WORST WINRATES VS OPPONENT HEROES OVERALL",
  ]);

  return (
    <div className="space-y-10 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">
          Hero Statistics
        </h1>
        <p className="text-sm text-gray-500">
          Season 23 · All Races
        </p>
      </div>

      <Section title="Your W/L by Hero Count">
        {byHeroCount.map((l, i) => {
          const m = l.match(/(.+?):\s([\d.]+)%\s\((\d+)-(\d+)\)/);
          return (
            <StatRow
              key={i}
              label={m?.[1] ?? l}
              value={m ? `${m[3]}–${m[4]} (${m[2]}%)` : l}
              winrate={m ? Number(m[2]) : undefined}
            />
          );
        })}
      </Section>

      <Section title="W/L vs Opponent Hero Count">
        {vsOppHeroCount.map((l, i) => {
          const m = l.match(/(.+?):\s([\d.]+)%\s\((\d+)-(\d+)\)/);
          return (
            <StatRow
              key={i}
              label={m?.[1] ?? l}
              value={m ? `${m[3]}–${m[4]} (${m[2]}%)` : l}
              winrate={m ? Number(m[2]) : undefined}
            />
          );
        })}
      </Section>

      <Section title="Best Matchups vs Opponent Opening Hero">
        {bestOpeners.map((l, i) => {
          const m = l.match(/(.+?):\s([\d.]+)%\s\((\d+)-(\d+)\)/);
          return (
            <StatRow
              key={i}
              label={m?.[1] ?? l}
              value={m ? `${m[3]}–${m[4]} (${m[2]}%)` : l}
              winrate={m ? Number(m[2]) : undefined}
            />
          );
        })}
      </Section>

      <Section title="Worst Matchups vs Opponent Opening Hero">
        {worstOpeners.map((l, i) => {
          const m = l.match(/(.+?):\s([\d.]+)%\s\((\d+)-(\d+)\)/);
          return (
            <StatRow
              key={i}
              label={m?.[1] ?? l}
              value={m ? `${m[3]}–${m[4]} (${m[2]}%)` : l}
              winrate={m ? Number(m[2]) : undefined}
            />
          );
        })}
      </Section>

      <Section title="Top 5 Best Winrates vs Opponent Heroes (Overall)">
        {bestOverall.map((l, i) => (
          <div key={i} className="flex justify-between tabular-nums">
            <span>{l.split(":")[0]}</span>
            <span className="font-medium">{l.split(":")[1]?.trim()}</span>
          </div>
        ))}
      </Section>

      <Section title="Top 5 Worst Winrates vs Opponent Heroes (Overall)">
        {worstOverall.map((l, i) => (
          <div key={i} className="flex justify-between tabular-nums">
            <span>{l.split(":")[0]}</span>
            <span className="font-medium">{l.split(":")[1]?.trim()}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
