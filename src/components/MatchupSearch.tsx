"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BattleTagInput from "@/components/BattleTagInput";

export default function MatchupSearch({
  initialA,
  initialB,
}: {
  initialA?: string;
  initialB?: string;
}) {
  const router = useRouter();

  const [a, setA] = useState(initialA ?? "");
  const [b, setB] = useState(initialB ?? "");

  useEffect(() => {
    setA(initialA ?? "");
  }, [initialA]);

  useEffect(() => {
    setB(initialB ?? "");
  }, [initialB]);

  function run(e?: React.FormEvent) {
    e?.preventDefault();

    const A = a.trim();
    const B = b.trim();

    if (!A || !B) return;

    router.push(`/stats/matchup?a=${encodeURIComponent(A)}&b=${encodeURIComponent(B)}`);
  }

  return (
    <form
      onSubmit={run}
      className="flex gap-2 max-w-xl rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm mt-6"
    >
      <BattleTagInput
        value={a}
        onChange={setA}
        placeholder="Player A"
      />

      <BattleTagInput
        value={b}
        onChange={setB}
        placeholder="Player B"
      />

      <button
        type="submit"
        className="rounded bg-emerald-600 text-white px-4"
      >
        Compare
      </button>
    </form>
  );
}
