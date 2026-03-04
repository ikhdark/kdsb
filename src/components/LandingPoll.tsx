"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  "Average opponent MMR (All games)",
  "Unique opponent MMR (each opponent counts once)",
  "Average opponent MMR (last 50 games)",
  "Average opponent MMR (All games)",
  
];

export default function LandingPoll() {
  const [results, setResults] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/poll/results")
      .then((r) => r.json())
      .then((data) => setResults(data || {}))
      .catch(() => {});
  }, []);

  async function submitVote() {
    if (!selected || submitting) return;

    setSubmitting(true);

    const res = await fetch("/api/poll/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ option: selected }),
    });

    const data = await res.json();
    setResults(data);
    setSubmitting(false);
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 rounded-xl border border-gray-300 dark:border-gray-700 p-4 text-left">
      <div className="text-sm font-semibold">
        How should SOS be calculated? (The other metric that is used with MMR to decide Ladder Ranking)
      </div>

      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const count = results[opt] ?? 0;
          const percent = total ? Math.round((count / total) * 100) : 0;

          return (
            <label
              key={opt}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                selected === opt
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <input
                type="radio"
                name="poll"
                value={opt}
                checked={selected === opt}
                onChange={() => setSelected(opt)}
                className="mt-1"
              />

              <div className="flex-1">
                <div className="text-sm">{opt}</div>
                <div className="text-xs opacity-60">
                  {count} votes ({percent}%)
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <button
        onClick={submitVote}
        disabled={!selected || submitting}
        className="w-full rounded-lg bg-emerald-500 text-white py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Submitting..." : "Vote"}
      </button>
    </div>
  );
}