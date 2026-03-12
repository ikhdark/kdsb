"use client";

import { useCallback, useMemo } from "react";
import { useBattleTagAutocomplete } from "@/hooks/useBattleTagAutocomplete";

const INPUT_BASE = "border rounded px-3 py-2 w-full";

const DROPDOWN_BASE =
  "absolute z-50 mt-1 w-full bg-white border rounded shadow max-h-64 overflow-y-auto";

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

  const visible = results;

  const select = useCallback(
    (tag: string) => {
      onChange(tag);
      clear();
    },
    [onChange, clear]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && visible.length) {
        e.preventDefault();
        select(visible[0].battleTag);
      }
    },
    [visible, select]
  );

  return (
    <div className="relative w-full">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={INPUT_BASE}
        autoComplete="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="none"
      />

      {visible.length > 0 && (
        <div className={DROPDOWN_BASE}>
          {visible.map((r) => (
            <button
              key={r.battleTag}
              type="button"
              onClick={() => select(r.battleTag)}
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