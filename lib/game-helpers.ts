import catalog from "./cards.json";
import type { Player, Target } from "./game-types";
import { souls } from "./rules";
export const cards = catalog;
export const soulCount = (p: Player) =>
  p.souls.reduce((n, c) => n + souls(c), 0);
export function shuffle<T>(a: T[]): T[] {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const playerTarget = (i: number): Target => ({
  kind: "player",
  id: String(i),
});
export const clone = <T>(x: T): T => structuredClone(x);
