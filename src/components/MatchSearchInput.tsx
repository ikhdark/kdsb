"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BattleTagInput from "@/components/BattleTagInput";

export default function MatchSearchInput({
  error,
}: {
  error?: string;
}) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;

    router.push(
      `/stats/matches?player=${encodeURIComponent(
        value.trim()
      )}`
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-center">
          Match History
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <BattleTagInput
            value={value}
            onChange={setValue}
            placeholder="BattleTag#1234"
          />

          <button
            type="submit"
            className="w-full rounded border py-2.5 text-sm sm:text-base hover:bg-gray-100 active:scale-[0.99] transition"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="text-red-500 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}