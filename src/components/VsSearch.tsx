"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import BattleTagInput from "@/components/BattleTagInput";

export default function VsSearch() {
  const router = useRouter();
  const params = useSearchParams();

  const [a, setA] = useState(params.get("a") ?? "");
  const [b, setB] = useState(params.get("b") ?? "");

  function go() {
    const A = a.trim();
    const B = b.trim();

    if (!A || !B) return;

    router.push(`/stats/matchup?a=${encodeURIComponent(A)}&b=${encodeURIComponent(B)}`);
  }

  return (
    <form
  onSubmit={(e) => {
    e.preventDefault();
    go();
  }}
  className="flex flex-col sm:flex-row gap-2 items-stretch"
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
    className="border px-4 rounded whitespace-nowrap shrink-0 relative z-10"
  >
    Compare
  </button>
</form>

  );
}
