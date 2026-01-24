// src/lib/player-search.ts
export async function validateBattleTag(input: string) {
  if (!input.trim()) return null;

  const res = await fetch(`/api/resolve-battletag?q=${encodeURIComponent(input)}`);
  const data = await res.json();

  if (!data?.ok) return null;
  return data.battleTag;
}
