"use client";

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

  function normalize(s: string) {
    return s.replace(/\s+/g, "").toLowerCase();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const query = q.trim();
    if (!query) return;

    const qNorm = normalize(query);

    const idx = rows.findIndex((r) =>
      normalize(r.battletag).includes(qNorm)
    );

    if (idx === -1) return;

    const page = Math.floor(idx / PAGE_SIZE) + 1;

    router.push(
      `${base}?page=${page}&highlight=${encodeURIComponent(query)}`
    );
  }

  return (
    <form onSubmit={submit} className="mb-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find player in ladder..."
        className="
          w-full max-w-xs rounded-lg border border-gray-300
          bg-white px-3 py-2 text-sm
          focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
          dark:border-gray-700 dark:bg-gray-800
        "
      />

      {/* ✅ enables Enter key submit */}
      <button type="submit" className="hidden" />
    </form>
  );
}
