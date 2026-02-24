import { PLAYER_LABELS } from "@/lib/playerLabels";

export function displayName(battletag: string) {
  return PLAYER_LABELS[battletag]
    ? `${battletag} (${PLAYER_LABELS[battletag]})`
    : battletag;
}