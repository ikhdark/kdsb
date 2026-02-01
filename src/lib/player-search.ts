// src/lib/player-search.ts
export async function validateBattleTag(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(
      `/api/resolve-battletag?q=${encodeURIComponent(trimmed)}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data?.ok ? data.battleTag : null;
  } catch {
    return null;
  }
}
