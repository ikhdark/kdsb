"use client";
export const dynamic = "force-dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PAGE_SIZE = 50;

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

  function normalize(s: string) {
    return s.replace(/\s+/g, "").toLowerCase();
  }

  function runSearch() {
    const query = q.trim();
    if (!query) return;

    const qNorm = normalize(query);

    const idx = rows.findIndex((r) =>
      normalize(r.battletag).includes(qNorm)
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
  }

  return (
    <div className="mb-4 space-y-1">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            runSearch();
          }
        }}
        placeholder="Find player in ladder..."
        className="
          w-full max-w-xs rounded-lg border border-gray-300
          bg-white px-3 py-2 text-sm
          focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
          dark:border-gray-700 dark:bg-gray-800
        "
      />

      {error && (
        <div className="text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
