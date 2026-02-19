"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import BattleTagInput from "@/components/BattleTagInput";

const PAGE_SIZE = 50;

/* stable helper */
const normalize = (s: string) =>
  s.replace(/\s+/g, "").toLowerCase();

export default function LadderSearch({
  rows,
  base,
}: {
  rows: { battletag: string }[];
  base: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* precompute once */
  const normalizedRows = useMemo(
    () =>
      rows.map((r) => ({
        norm: normalize(r.battletag),
      })),
    [rows]
  );

  const runSearch = useCallback(
    (queryRaw: string) => {
      const query = queryRaw.trim();
      if (!query) return;

      const qNorm = normalize(query);

      const idx = normalizedRows.findIndex((r) =>
        r.norm.includes(qNorm)
      );

      if (idx === -1) {
        setError("Player not found");
        return;
      }

      setError(null);

      const page = Math.floor(idx / PAGE_SIZE) + 1;

      router.push(
        `${base}?page=${page}&highlight=${encodeURIComponent(query)}`
      );
    },
    [normalizedRows, router, base]
  );

  return (
    <div className="mb-4 space-y-1 max-w-xs">
      <BattleTagInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setError(null);
          runSearch(v); // ← jump when user selects
        }}
        placeholder="Find player in ladder..."
      />

      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}
    </div>
  );
}