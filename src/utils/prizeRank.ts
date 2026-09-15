import type { Prize } from "../types";

// Older event.json files remain valid; explicit labels never affect probability/order.
export function prizeRank(prize: Prize, index: number) {
  return prize.rankLabel?.trim() || (prize.isLose ? "꽝" : `${index + 1}등`);
}
