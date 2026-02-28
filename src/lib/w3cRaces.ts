// src/lib/w3cRaces.ts

import type { RaceKey } from "@/services/countryRaceLadder";

export const W3C_RACE_IDS = [1, 2, 4, 8, 0] as const;

export const W3C_RACE_LABEL: Record<number, string> = {
  0: "Random",
  1: "Human",
  2: "Orc",
  4: "Night Elf",
  8: "Undead",
};

export const W3C_RACE_KEY_MAP: Record<number, RaceKey> = {
  1: "human",
  2: "orc",
  4: "elf",
  8: "undead",
  0: "random",
};

export function raceLabel(
  raceId: number | null | undefined
): string {
  if (typeof raceId !== "number") return "Unknown";
  return W3C_RACE_LABEL[raceId] ?? `Race ${raceId}`;
}