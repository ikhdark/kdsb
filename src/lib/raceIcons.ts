export function getRaceIconName(
  race: number,
  rndRace: number | null
) {
  const resolve = (r: number) =>
    r === 1
      ? "Human"
      : r === 2
      ? "Orc"
      : r === 4
      ? "NightElf"
      : r === 8
      ? "Undead"
      : "Random";

  if (race === 0 && rndRace != null) {
    return `${resolve(rndRace)}Random`;
  }

  return resolve(race);
}