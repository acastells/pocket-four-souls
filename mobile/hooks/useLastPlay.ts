import { useState } from "react";
import type { Game, StackEntry } from "../../lib/game-types";
const isPlay = (e: StackEntry) =>
  (e.kind === "loot" || e.kind === "ability") && !!e.sourceCard;

/** Remembers the most recent loot or ability that reached the stack. */
export function useLastPlay(game: Game | null) {
  const [last, setLast] = useState<{ entry: StackEntry; log: number } | null>(
    null,
  );
  const entry = game ? [...game.stack].reverse().find(isPlay) : undefined;
  // Adjusting state during render (no effect) keeps the panel in sync.
  if (!game || (last && game.log.length < last.log)) {
    if (last) setLast(null);
  } else if (entry && entry.uid !== last?.entry.uid)
    setLast({ entry, log: game.log.length });
  return last?.entry ?? null;
}
