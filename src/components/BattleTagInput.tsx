"use client";

import { useBattleTagAutocomplete } from "@/hooks/useBattleTagAutocomplete";

export default function BattleTagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const { results, clear } = useBattleTagAutocomplete(value);

  return (
    <div className="relative w-full">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border rounded px-3 py-2 w-full"
        autoComplete="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="none"
      />

{results.length > 0 && (
  <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow">
    {results.slice(0, 6).map((r) => (
      <button
        key={r.battleTag}
        type="button"
        onClick={() => {
          onChange(r.battleTag);
          clear();
        }}
        className="block w-full px-3 py-2 hover:bg-gray-100 text-sm text-left"
      >
        {r.battleTag}
      </button>
    ))}
  </div>
)}
    </div>
  );
}
