import raw from "./card-rules.json";
import type { Card, Rule } from "./game-types";
export const rules = raw as Record<string, Rule>;
export const rule = (c: Pick<Card, "id">): Rule =>
  rules[c.id] || {
    stats: {},
    effects: [],
    rewards: {},
    threePlus: false,
    subtype: "",
  };
export const key = (c: Pick<Card, "id">) =>
  c.id.replace(/^b2-/, "").replace(/(?:_|-)\d+$/, "");
export const textOf = (c: Pick<Card, "id">) => rule(c).effects.join(" ");
export const isEternal = (c: Card) => c.type === "eternal" || !!c.eternal;
export const isTrinket = (c: Card) =>
  /Trinket/i.test(rule(c).subtype) || /\[Trinket\]/i.test(textOf(c));
export const isMonster = (c: Card) => "HP" in rule(c).stats;
export const souls = (c: Card) =>
  c.soulValue ??
  rule(c).rewards.Soul ??
  (key(c) === "lost_soul" || c.type === "bsoul" ? 1 : 0);
export const coinValue = (c: Card) =>
  (
    ({
      "A Penny!": 1,
      "2 Cents!": 2,
      "3 Cents!": 3,
      "4 Cents!": 4,
      "A Nickel!": 5,
      "A Dime!!": 10,
    }) as Record<string, number>
  )[c.name] || 0;
