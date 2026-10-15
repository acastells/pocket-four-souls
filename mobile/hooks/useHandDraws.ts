import { useEffect, useRef, useState } from "react";
import type { Card, Game } from "../../lib/game-types";
const FRESH_MS = 2400;
const NOTICE_MS = 2800;

export type DrawNotice = { id: number; text: string; cards: Card[] };

/**
 * Detects cards that just entered a visible hand so the UI can announce them
 * briefly and highlight them. Online, only the own seat's hand is visible.
 */
export function useHandDraws(game: Game | null, room: string, seat: number) {
  const previous = useRef<{
    room: string;
    log: number;
    hands: string[][];
  } | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<DrawNotice | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!game?.started) {
      previous.current = null;
      return;
    }
    const before = previous.current;
    const hands = game.players.map((p) => p.hand.map((c) => c.uid));
    previous.current = { room, log: game.log.length, hands };
    // A different room or a shorter log means another game, not a draw.
    if (
      !before ||
      before.room !== room ||
      before.log > game.log.length ||
      before.hands.length !== hands.length
    )
      return;
    const drawn = game.players.flatMap((p, i) => {
      if (game.mode === "online" && i !== seat) return [];
      const old = new Set(before.hands[i]);
      const cards = p.hand.filter((c) => !old.has(c.uid));
      return cards.length ? [{ player: p, cards }] : [];
    });
    if (!drawn.length) return;
    setFresh(new Set(drawn.flatMap((d) => d.cards.map((c) => c.uid))));
    setNotice({
      id: Date.now(),
      text: drawn
        .map(
          ({ player, cards }) =>
            (game.mode === "online"
              ? "Robas "
              : player.character.name + " roba ") +
            (cards.length === 1 ? cards[0].name : cards.length + " cartas"),
        )
        .join(" · "),
      cards: drawn.flatMap((d) => d.cards).slice(0, 3),
    });
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setFresh(new Set()), FRESH_MS),
      setTimeout(() => setNotice(null), NOTICE_MS),
    ];
  }, [game, room, seat]);
  return { fresh, notice };
}
