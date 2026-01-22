import { notFound } from "next/navigation";
import { getW3CHeroStats } from "@/services/playerHeroes";

type PageProps = {
  params: Promise<{
    battletag: string;
  }>;
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
      <h2 className="border-b border-gray-300 pb-1 text-sm font-semibold uppercase tracking-wide text-black dark:border-gray-700 dark:text-white">
        {title}
      </h2>
      <div className="space-y-2 text-sm">{children}</div>
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
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 items-center">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>

      {typeof winrate === "number" && (
        <div className="h-1.5 bg-gray-200 rounded overflow-hidden dark:bg-gray-700">
          <div
            className={
              winrate >= 55
                ? "bg-emerald-500 h-full"
                : winrate >= 48
                ? "bg-yellow-500 h-full"
                : "bg-rose-500 h-full"
            }
            style={{ width: `${Math.min(100, Math.max(0, winrate))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default async function HeroesPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  // service owns canonicalization
  const data = await getW3CHeroStats(battletag);
  if (!data) notFound();

  const lines = data.result
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const normalize = (s: string) =>
    s.toUpperCase().replace(/\s+/g, " ").trim();

  const HEADERS = new Set([
    normalize("Your W/L by Your Hero Count"),
    normalize("Your W/L vs Opponent Hero Count"),
    normalize("Your Top 5 Best Winrates vs Opponent Opening Hero"),
    normalize("Top 5 Worst Winrates vs Opponent Opening Hero"),
    normalize("Your Top 5 Best Winrates vs Opponent Heroes Overall"),
    normalize("Your Top 5 Worst Winrates vs Opponent Heroes Overall"),
  ]);

  function collectSection(headers: string[]) {
    const wanted = headers.map(normalize);
    const start = lines.findIndex(l => wanted.includes(normalize(l)));
    if (start === -1) return [];

    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (HEADERS.has(normalize(lines[i]))) break;
      out.push(lines[i]);
    }
    return out;
  }

  const byHeroCount = collectSection(["Your W/L by Your Hero Count"]);
  const vsOppHeroCount = collectSection(["Your W/L vs Opponent Hero Count"]);
  const bestOpeners = collectSection([
    "Your Top 5 Best Winrates vs Opponent Opening Hero",
  ]);
  const worstOpeners = collectSection([
    "Top 5 Worst Winrates vs Opponent Opening Hero",
  ]);
  const bestOverall = collectSection([
    "Your Top 5 Best Winrates vs Opponent Heroes Overall",
  ]);
  const worstOverall = collectSection([
    "Your Top 5 Worst Winrates vs Opponent Heroes Overall",
  ]);

  return (
    <div className="space-y-10 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-white">
          {data.battletag}
        </h1>
        <p className="text-sm text-gray-500">
          Season {data.seasons.join(", ")} · All Races
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

      <Section title="Best Winrates vs Opponent Heroes (Overall)">
        {bestOverall.map((l, i) => (
          <div key={i} className="flex justify-between tabular-nums">
            <span>{l.split(":")[0]}</span>
            <span className="font-medium">{l.split(":")[1]?.trim()}</span>
          </div>
        ))}
      </Section>

      <Section title="Worst Winrates vs Opponent Heroes (Overall)">
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
