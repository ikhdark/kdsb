// src/app/stats/player/[battletag]/heroes/page.tsx

export const revalidate = 300;

import EmptyState from "@/components/EmptyState";
import { getW3CHeroStats } from "@/services/playerHeroes";
import { PlayerHeader, Section, StatRow } from "@/components/PlayerUI";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function HeroesPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) return <EmptyState message="Player not found" />;

  const data = await getW3CHeroStats(battletag);
 if (!data || !data.result) return <EmptyState message="Not enough data/recent games available" />;

  /* -------------------- helpers -------------------- */

  const lines = data.result
    .split("\n")
    .map((l) => l.trim())
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

    const start = lines.findIndex((l) =>
      wanted.includes(normalize(l))
    );
    if (start === -1) return [];

    const out: string[] = [];

    for (let i = start + 1; i < lines.length; i++) {
      if (HEADERS.has(normalize(lines[i]))) break;
      out.push(lines[i]);
    }

    return out;
  }

  /* -------------------- sections -------------------- */

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

  /* -------------------- render -------------------- */

  return (
    <div className="space-y-10 max-w-6xl mx-auto text-sm leading-relaxed">

      {/* HEADER */}
      <PlayerHeader
        battletag={data.battletag}
        subtitle={`Hero Stats (All races) · Season 24 (Games under 120 seconds excluded)`}
      />

      {/* ================= HERO COUNT ================= */}
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

      {/* ================= VS OPP HERO COUNT ================= */}
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

      {/* ================= BEST OPENERS ================= */}
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

      {/* ================= WORST OPENERS ================= */}
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

      {/* ================= BEST OVERALL ================= */}
      <Section title="Best Winrates vs Opponent Heroes (Overall)">
        {bestOverall.map((l, i) => {
          const idx = l.indexOf(":");
          const label = idx !== -1 ? l.slice(0, idx) : l;
          const value = idx !== -1 ? l.slice(idx + 1).trim() : "";

          return (
            <div key={i} className="flex justify-between tabular-nums">
              <span>{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          );
        })}
      </Section>

      {/* ================= WORST OVERALL ================= */}
      <Section title="Worst Winrates vs Opponent Heroes (Overall)">
        {worstOverall.map((l, i) => {
          const idx = l.indexOf(":");
          const label = idx !== -1 ? l.slice(0, idx) : l;
          const value = idx !== -1 ? l.slice(idx + 1).trim() : "";

          return (
            <div key={i} className="flex justify-between tabular-nums">
              <span>{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          );
        })}
      </Section>

    </div>
  );
}
