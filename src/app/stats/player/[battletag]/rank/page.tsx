// src/app/stats/player/[battletag]/rank/page.tsx

import { notFound } from "next/navigation";
import { getW3CRank, type W3CRankResponse } from "@/services/playerRank";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function RankPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  // Do NOT decode here. The resolver/service handles "%23" safely.
  const input = battletag;

  let data: W3CRankResponse | null = null;
  let serviceError: { message: string } | null = null;

  try {
    data = await getW3CRank(input);
  } catch (e: unknown) {
    serviceError = { message: e instanceof Error ? e.message : String(e) };
  }

  // Header info
  const titleTag = data?.battletag ?? (() => {
    // Best-effort display label for header only (not identity logic)
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  })();

  const season = data?.season ?? "—";
  const country = data?.country ?? "—";

  const ranks = Array.isArray(data?.ranks) ? data!.ranks : [];
  const topRace =
    ranks.length > 0 ? [...ranks].sort((a, b) => b.mmr - a.mmr)[0] : null;

  const showEmpty = !serviceError && (!data || ranks.length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Rank</h1>
        <p className="text-sm text-gray-500">
          {titleTag} · Season {season}
        </p>
      </div>

      {/* Error state (non-404) */}
      {serviceError ? (
        <div className="rounded border p-3 text-sm">
          <div className="text-xs uppercase text-gray-500">Error</div>
          <div className="mt-1 font-semibold">{serviceError.message}</div>
          <div className="mt-2 text-sm text-gray-500">
            If this persists, it’s usually a resolver failure or a backend fetch issue.
          </div>
        </div>
      ) : null}

      {/* Empty state (no rank data) */}
      {showEmpty ? (
        <div className="rounded border p-3 text-sm">
          <div className="text-xs uppercase text-gray-500">No rank data</div>
          <div className="mt-1 font-semibold">
            This player isn’t showing ranked ladder data for Season {season}.
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Common causes: fewer than {25} games for a race, ladder pages not including the player,
            or country ladder not returning a matching identity row.
          </div>
        </div>
      ) : null}

      {/* Primary stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Highest MMR"
          value={topRace ? `${topRace.race} — ${topRace.mmr}` : "N/A"}
        />
        <Stat label="Country" value={country} />
        <Stat label="Races Ranked" value={ranks.length.toString()} />
      </div>

      {/* Rank table */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Race Rankings
        </h2>

        {ranks.length ? (
          <div className="mt-2 rounded border text-sm">
            <div className="grid grid-cols-6 gap-2 border-b px-3 py-2 font-semibold">
              <div>Race</div>
              <div>Global</div>
              <div>Country</div>
              <div>MMR</div>
              <div>Games</div>
              <div></div>
            </div>

            {ranks.map((r) => (
              <div
                key={String(r.raceId)}
                className="grid grid-cols-6 gap-2 border-t px-3 py-2 tabular-nums"
              >
                <div>{r.race}</div>
                <div>
                  #{r.globalRank}/{r.globalTotal}
                </div>
                <div>
                  {r.countryRank && r.countryTotal
                    ? `#${r.countryRank}/${r.countryTotal}`
                    : "—"}
                </div>
                <div>{r.mmr}</div>
                <div>{r.games}</div>
                <div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">
            No ranked ladder data available for this season / min-games filter.
          </div>
        )}
      </section>

      {/* Details */}
      {data?.result ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Details
          </h2>
          <div className="mt-2 rounded border p-3 text-xs whitespace-pre-wrap text-gray-700">
            {data.result}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 text-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
