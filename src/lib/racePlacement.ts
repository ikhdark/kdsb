export function applyRacePlacement(
  raceCounters: Record<number, number>,
  race: number | null | undefined,
  minGames: number = 35
): boolean {
  if (race == null) return false;

  const current = raceCounters[race] ?? 0;
  const next = current + 1;

  raceCounters[race] = next;

  return next >= minGames;
}
