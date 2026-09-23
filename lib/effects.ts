import { operationArguments, targetSlot } from "./operation-arguments";
import type { OperationArguments } from "./operation-arguments";
import type { Engine } from "./game";
import type { Card, Op, Target } from "./game-types";
import { key, rule, textOf, isEternal, isTrinket, coinValue } from "./rules";
const pt = (i: number): Target => ({ kind: "player", id: String(i) });
const mt = (c: Card): Target => ({ kind: "monster", id: c.uid });
export type Ability = {
  label: string;
  tap?: boolean;
  coins?: number;
  counters?: number;
  hp?: number;
};
const paid: Record<string, Ability[]> = {
  the_bone: [
    { label: "Añadir un contador", tap: true },
    { label: "Quitar 1 contador · +1 a una tirada", counters: 1 },
    { label: "Quitar 2 contadores · 1 daño", counters: 2 },
    { label: "Quitar 5 contadores · ganar un alma", counters: 5 },
  ],
  tech_x: [
    { label: "Añadir un contador", tap: true },
    { label: "Quitar 3 contadores · matar", counters: 3 },
  ],
  battery_bum: [{ label: "Pagar 4 ¢ · recargar un objeto", coins: 4 }],
  contract_from_below: [{ label: "Destruir 2 objetos · robar un objeto" }],
  donation_machine: [{ label: "Dar un objeto · ganar 8 ¢" }],
  golden_razor_blade: [{ label: "Pagar 5 ¢ · causar 1 daño", coins: 5 }],
  pay_to_play: [{ label: "Pagar 10 ¢ · robar un objeto", coins: 10 }],
  portable_slot_machine: [{ label: "Pagar 3 ¢ · tirar", coins: 3 }],
  smelter: [{ label: "Descartar botín · ganar 3 ¢" }],
  the_poop: [{ label: "Quitar 1 contador · prevenir 1 daño", counters: 1 }],
  guppys_paw: [
    { label: "Pagar 1 vida · prevenir hasta 2 de daño", tap: true, hp: 1 },
  ],
};
export function cardAbilities(c: Card): Ability[] {
  if (paid[key(c)]) return paid[key(c)];
  if (key(c) === "book_of_belial")
    return [{ label: "Modificar una tirada ±1", tap: true }];
  if (textOf(c).includes("[Tap Effect]"))
    return [{ label: "Activar " + c.name, tap: true }];
  return [];
}
export function initialCounters(c: Card) {
  return key(c) === "the_dead_cat" ? 9 : 0;
}
export function passiveStats(e: Engine, i: number) {
  const p = e.s.players[i];
  let hp = parseInt(rule(p.character).stats.HP) || 2,
    atk = parseInt(rule(p.character).stats.ATK) || 1,
    roll = p.temp.roll || 0;
  for (const c of p.items) {
    const k = key(c);
    if (["breakfast", "dinner"].includes(k)) hp++;
    if (["brimstone", "ipecac"].includes(k)) atk++;
    if (["meat", "synthoil"].includes(k)) roll++;
    if (k === "empty_vessel") {
      if (!p.hand.length) atk++;
      if (!p.coins) roll++;
    }
    if (
      ["curved_horn", "champion_belt", "polydactyly"].includes(k) &&
      !p.flags.attackRolls
    )
      atk++;
    if (k === "bum_bo") {
      if ((c.counters || 0) >= 1 && !p.flags.attackRolls) roll += 2;
      if ((c.counters || 0) >= 10) atk++;
    }
  }
  hp += p.temp.hp || 0;
  atk += p.temp.atk || 0;
  return { hp, atk, roll };
}
export function monsterStats(e: Engine, c: Card) {
  const k = key(c),
    r = rule(c).stats;
  const hp = parseInt(r.HP) || 0;
  let dc = parseInt(r.DC) || 0,
    atk = parseInt(r.ATK) || 0;
  for (const x of e.s.monsters)
    if (key(x) === "stoney" || (key(x) === "delirium" && x.uid !== c.uid)) dc++;
  if (
    e.s.players[e.s.turn].curses.some((c) => key(c) === "curse_of_the_blind") ||
    e.has(e.s.turn, "baby_haunt")
  )
    dc++;
  const remaining = hp - (c.damage || 0);
  if (k === "gemini" && remaining === 1) atk++;
  if (k === "larry_jr" && remaining <= 2) dc++;
  if (k === "mask_of_infamy" && remaining === 1) dc += 2;
  return {
    hp: hp + (e.s.flags["hp:" + c.uid] || 0),
    dc: Math.max(0, dc + (e.s.flags["dc:" + c.uid] || 0)),
    atk: Math.max(0, atk + (e.s.flags["atk:" + c.uid] || 0)),
  };
}
export function cardEffect(e: Engine, o: Op): Op[] {
  const c = o.source!,
    template = operationArguments(o)?.effectCard || c,
    k = key(template),
    i = o.owner,
    v = o.value || 0,
    p = e.s.players[i],
    ability = operationArguments(o)?.ability || 0;
  const op = (op: string, n?: number, extra: Partial<Op> = {}): Op => ({
    op,
    owner: i,
    source: c,
    ...(n === undefined ? {} : { n }),
    ...extra,
  });
  const custom = (key: string, args: OperationArguments = {}, n?: number): Op =>
    op("custom", n, { key, args });
  const sel = (
    query: string,
    tasks: Op[],
    extra: OperationArguments = {},
  ): Op =>
    op("select", undefined, {
      args: { query, title: c.name + " · elige un objetivo", ...extra },
      tasks,
    });
  const target = targetSlot("$target");
  const self = pt(i);
  const menu = (
    options: { label: string; tasks: Op[] }[],
    title = c.name,
  ): Op => op("menu", undefined, { args: { title, options } });
  const roll = () => op("roll", undefined, { args: operationArguments(o) });
  const damage = (n: number, t: Target = self) =>
    op("damage", n, { target: t });
  const buff = (key: string, n: number, t: Target = self) =>
    op("buff", n, { key, target: t });
  const all = (opName: string, n: number) =>
    e.s.players.map((_, owner) => ({ op: opName, owner, n }) as Op);
  const look = (deck: string, n: number, mode = "bottom") =>
    custom("peekDeck", { deck, mode }, n);
  if (
    o.op === "card" &&
    ["box", "chaos_card", "moms_shovel", "pandoras_box", "the_d4"].includes(k)
  ) {
    const actual = e.find({ kind: "item", id: c.uid });
    if (!actual?.card || isEternal(actual.card)) return [];
  }
  if (
    o.op === "card" &&
    k === "contract_from_below" &&
    p.items.filter((c) => !isEternal(c)).length < 2
  )
    return [];
  if (o.op === "event") {
    if (k.startsWith("curse_of_"))
      return [
        sel("player", [op("custom", undefined, { key: "curse", target })]),
      ];
    const body = cardEffect(e, { ...o, op: "card" });
    return [...body, op("finishEvent")];
  }
  if (o.op === "cardRoll") {
    if (k === "pills") {
      if (c.id === "b2-pills_2")
        return [op("coins", v <= 2 ? 4 : v <= 4 ? 7 : -4)];
      if (c.id === "b2-pills_3")
        return [v <= 2 ? buff("atk", 1) : v <= 4 ? buff("hp", 1) : damage(1)];
      return [
        v <= 2
          ? op("loot", 1)
          : v <= 4
            ? op("loot", 3)
            : op("discardChoice", 1),
      ];
    }
    switch (k) {
      case "x_wheel_of_fortune":
        return [
          [op("coins", 1)],
          [damage(2)],
          [op("loot", 3)],
          [op("coins", -4)],
          [op("coins", 5)],
          [op("treasure", 1)],
        ][v - 1];
      case "xvi_the_tower":
        return v <= 2
          ? all("damage", 1).map((x) => ({ ...x, target: pt(x.owner) }))
          : v <= 4
            ? e.s.monsters.map((c) => damage(1, mt(c)))
            : all("damage", 2).map((x) => ({ ...x, target: pt(x.owner) }));
      case "blank_rune":
        return v === 3
          ? all("damage", 3).map((x) => ({ ...x, target: pt(x.owner) }))
          : all(v === 2 || v === 5 ? "loot" : "coins", v);
      case "book_of_sin":
        return [
          v <= 2 ? op("coins", 1) : v <= 4 ? op("loot", 1) : buff("hp", 1),
        ];
      case "bobs_brain":
        return [
          v <= 2
            ? sel("monster", [damage(1, target)])
            : v <= 4
              ? sel("player", [damage(1, target)])
              : damage(1),
        ];
      case "curse_of_the_tower":
        return v <= 3
          ? [op("damageAll", 1, { args: { others: true } })]
          : [sel("monster", [damage(1, target)])];
      case "dark_bum":
        return [v <= 2 ? op("coins", 3) : v <= 4 ? op("loot", 1) : damage(1)];
      case "glass_cannon":
        return v <= 5 ? [op("destroySelf"), op("loot", 2)] : [op("recharge")];
      case "mystery_sack":
      case "portable_slot_machine":
        return v <= 2 ? [op("loot", 1)] : v <= 4 ? [op("coins", 4)] : [];
      case "pandoras_box":
        return [
          [op("coins", 1)],
          [op("coins", 6)],
          [sel("monster", [op("kill", undefined, { target })])],
          [op("loot", 3)],
          [op("coins", 9)],
          [custom("pandoraSoul")],
        ][v - 1];
      case "the_d100":
        return [
          [op("loot", 1)],
          [op("loot", 2)],
          [op("coins", 3)],
          [op("coins", 4)],
          [buff("hp", 1)],
          [buff("atk", 1)],
        ][v - 1];
      case "wrath":
        return [op("damageAll", v <= 3 ? 1 : 2)];
      case "chest":
        return [op("coins", v <= 2 ? 1 : v <= 4 ? 3 : 6)];
      case "cursed_chest":
        return v <= 3
          ? [damage(1)]
          : v <= 5
            ? [damage(2)]
            : [custom("guppySearch")];
      case "dark_chest":
        return [v <= 2 ? op("loot", 1) : v <= 4 ? op("coins", 3) : damage(2)];
      case "gold_chest":
        return [v <= 2 ? op("treasure", 1) : op("loot", v <= 4 ? 1 : 2)];
      case "secret_room":
        return [
          v === 1
            ? damage(3)
            : v <= 3
              ? op("discardChoice", 2)
              : v <= 5
                ? op("coins", 7)
                : op("treasure", 1),
        ];
      default:
        throw Error("Tabla de dados no definida: " + c.name);
    }
  }
  if (coinValue(c)) return [op("coins", coinValue(c))];
  if (c.type === "loot" && isTrinket(c) && k !== "lost_soul")
    return [op("trinket")];
  switch (k) {
    // Loot and starting items
    case "lil_battery":
    case "the_battery":
      return [
        sel("rechargeItem", [op("recharge", undefined, { target })], {
          exclude: k === "the_battery" ? c.uid : undefined,
        }),
      ];
    case "mega_battery":
      return [
        sel("player", [
          op("custom", undefined, { key: "rechargePlayerItems", target }),
        ]),
      ];
    case "bomb":
    case "gold_bomb":
      return [
        sel("playerOrMonster", [damage(k === "gold_bomb" ? 3 : 1, target)]),
      ];
    case "butter_bean":
    case "no":
      return [
        sel(k === "no" ? "itemAbility" : "cancelEffect", [
          op("cancel", undefined, { target }),
        ]),
      ];
    case "dice_shard":
    case "the_d6":
      return [sel("roll", [op("reroll", undefined, { target })])];
    case "pills":
    case "x_wheel_of_fortune":
    case "xvi_the_tower":
    case "blank_rune":
    case "book_of_sin":
    case "mystery_sack":
    case "the_d100":
    case "portable_slot_machine":
    case "chest":
    case "cursed_chest":
    case "dark_chest":
    case "gold_chest":
    case "secret_room":
    case "wrath":
    case "dark_bum":
    case "bobs_brain":
    case "curse_of_the_tower":
      return [roll()];
    case "soul_heart":
      return [sel("player", [op("prevent", 1, { target, key: "points" })])];
    case "o_the_fool":
      return [op("end", undefined, { args: { cancel: true } })];
    case "i_the_magician":
    case "godhead":
      return [
        sel("roll", [
          menu(
            (k === "godhead" ? [1, 6] : [1, 2, 3, 4, 5, 6]).map((n) => ({
              label: String(n),
              tasks: [op("setRoll", n, { target })],
            })),
          ),
        ]),
      ];
    case "ii_the_high_priestess":
      return [
        sel("playerOrMonster", [
          op("roll", undefined, {
            tasks: [op("damage", undefined, { target, bindN: "$roll" })],
          }),
        ]),
      ];
    case "iii_the_empress":
      return [sel("player", [buff("atk", 1, target), buff("roll", 1, target)])];
    case "iv_the_emperor":
      return [look("monster", 5, "topOne")];
    case "v_the_hierophant":
    case "guppys_paw":
      return [
        sel(k === "guppys_paw" ? "player" : "playerOrMonster", [
          op("prevent", 2, { key: "instancePoints", target }),
        ]),
      ];
    case "vi_the_lovers":
      return [sel("player", [buff("hp", 2, target)])];
    case "vii_the_chariot":
      return [sel("player", [buff("atk", 1, target), buff("hp", 1, target)])];
    case "viii_justice":
      return [
        sel("player", [op("custom", undefined, { key: "justice", target })]),
      ];
    case "ix_the_hermit":
      return [look("treasure", 5, "topOne")];
    case "xi_strength":
      return [
        sel("player", [
          buff("atk", 1, target),
          op("custom", 1, { key: "addPlayerAttack", target }),
        ]),
      ];
    case "xii_the_hanged_man":
      return [
        look("loot", 1),
        look("treasure", 1),
        look("monster", 1),
        op("loot", 2),
      ];
    case "xiii_death":
      return [sel("livingPlayer", [op("kill", undefined, { target })])];
    case "xiv_temperance":
      return [
        menu([
          {
            label: "Recibir 1 daño · ganar 4 ¢",
            tasks: [damage(1), op("coins", 4)],
          },
          {
            label: "Recibir 2 daños · ganar 8 ¢",
            tasks: [damage(2), op("coins", 8)],
          },
        ]),
      ];
    case "xv_the_devil":
      return [
        sel("ownNonEternal", [
          op("destroy", undefined, { target }),
          custom("stealShop"),
        ]),
      ];
    case "xvii_the_stars":
      return [op("treasure", 1)];
    case "xviii_the_moon":
      return [look("loot", 5, "topOne")];
    case "xix_the_sun":
      return [custom("sun")];
    case "xx_judgement":
      return [custom("judgement")];
    case "xxi_the_world":
      return [
        ...e.s.players.map((_, j) =>
          op("custom", undefined, { key: "lookHand", target: pt(j) }),
        ),
        op("loot", 2),
      ];
    case "dagaz":
      return [
        menu([
          { label: "Destruir una maldición", tasks: [custom("destroyCurse")] },
          {
            label: "Prevenir 1 daño",
            tasks: [
              sel("player", [op("prevent", 1, { key: "points", target })]),
            ],
          },
        ]),
      ];
    case "ehwaz":
      return [custom("replace", { deck: "monster" })];
    case "lost_soul":
      return [op("gainSoul", 1)];
    case "yum_heart":
      return [sel("playerOrMonster", [op("prevent", 1, { target })])];
    case "book_of_belial":
      return [
        sel("roll", [
          menu([
            { label: "+1", tasks: [op("modRoll", 1, { target })] },
            { label: "−1", tasks: [op("modRoll", -1, { target })] },
          ]),
        ]),
      ];
    case "blood_lust":
      return [sel("playerOrMonster", [buff("atk", 1, target)])];
    case "forever_alone":
      return [
        menu([
          {
            label: "Robar 1 ¢",
            tasks: [sel("otherPlayer", [op("stealCoins", 1, { target })])],
          },
          {
            label: "Mirar un mazo",
            tasks: [custom("peekDeck", { mode: "look" })],
          },
          {
            label: "Descartar un botín y robar uno",
            tasks: [op("discardChoice", 1), op("loot", 1)],
          },
        ]),
      ];
    case "sleight_of_hand":
      return [custom("peekDeck", { mode: "order" }, 5)];
    case "the_curse":
      return [custom("discardToTop")];
    case "incubus":
      return [
        menu([
          {
            label: "Intercambiar un botín con un jugador",
            tasks: [
              sel("player", [
                op("custom", undefined, { key: "incubusSwap", target }),
              ]),
            ],
          },
          {
            label: "Robar uno y devolver uno al mazo",
            tasks: [
              op("loot", 1),
              sel("hand", [op("topHand", undefined, { target })]),
            ],
          },
        ]),
      ];
    case "the_bone":
      return ability === 0
        ? [op("counter", 1)]
        : ability === 1
          ? [sel("roll", [op("modRoll", 1, { target })])]
          : ability === 2
            ? [sel("playerOrMonster", [damage(1, target)])]
            : [op("itemSoul", 1)];
    // Activated treasure
    case "blank_card":
      return [op("playerFlag", 1, { key: "blank" })];
    case "boomerang":
      return [sel("otherPlayer", [op("stealLoot", 1, { target })])];
    case "box":
      return [op("destroySelf"), op("lootPlays", 1000)];
    case "bum_friend":
      return [
        op("loot", 1),
        sel("hand", [op("topHand", undefined, { target })]),
      ];
    case "chaos":
      return [op("rotateHands")];
    case "chaos_card":
      return [
        op("destroySelf"),
        menu([
          {
            label: "Matar a un jugador o monstruo",
            tasks: [
              sel("playerOrMonster", [op("kill", undefined, { target })]),
            ],
          },
          {
            label: "Destruir un objeto",
            tasks: [
              sel("nonEternalItem", [op("destroy", undefined, { target })]),
            ],
          },
          {
            label: "Destruir un alma",
            tasks: [
              sel("soul", [
                op("custom", undefined, { key: "destroySoul", target }),
              ]),
            ],
          },
        ]),
      ];
    case "compost":
      return [op("flag", 1, { key: "compost" })];
    case "crystal_ball":
      return [custom("crystal")];
    case "decoy":
      return [
        sel("otherNonEternal", [
          op("swapItem", undefined, {
            target,
            args: { other: { kind: "item", id: c.uid } },
          }),
        ]),
      ];
    case "diplopia":
    case "modeling_clay":
      return [
        sel(
          k === "diplopia" ? "passiveItem" : "nonEternalItem",
          [
            op("copyItem", undefined, {
              target,
              args: { temporary: k === "diplopia" },
            }),
          ],
          { exclude: c.uid },
        ),
      ];
    case "flush":
      return [
        menu([
          {
            label: "Devolver monstruos no atacados al fondo",
            tasks: [custom("replace", { deck: "monster", bottom: true })],
          },
          {
            label: "Devolver tienda al fondo",
            tasks: [custom("replace", { deck: "treasure", bottom: true })],
          },
        ]),
      ];
    case "glass_cannon":
      return [
        sel("nonEternalItem", [op("destroy", undefined, { target }), roll()], {
          exclude: c.uid,
        }),
      ];
    case "guppys_head":
      return [sel("otherPlayer", [op("giveLoot", undefined, { target })])];
    case "host_hat":
      return [
        op("prevent", 1, { target: self, key: "points" }),
        buff("hostReflect", 1),
      ];
    case "jawbone":
      return [sel("otherPlayer", [op("stealCoins", 3, { target })])];
    case "lucky_foot":
    case "mini_mush":
    case "spoon_bender":
      return [
        sel(
          k === "lucky_foot" ? "nonAttackRoll" : "roll",
          k === "spoon_bender"
            ? [op("modRoll", 1, { target })]
            : [
                menu(
                  [1, 2].map((n) => ({
                    label: (k === "mini_mush" ? "−" : "+") + n,
                    tasks: [
                      op("modRoll", k === "mini_mush" ? -n : n, { target }),
                    ],
                  })),
                ),
              ],
        ),
      ];
    case "moms_bra":
      return [
        sel("playerOrMonster", [op("prevent", 1, { key: "reduce", target })]),
      ];
    case "moms_shovel":
      return [
        op("destroySelf"),
        sel("otherSoul", [op("stealSoul", undefined, { target })]),
      ];
    case "monster_manual":
      return [
        sel("monster", [op("custom", 1, { key: "forceAttack", target })]),
      ];
    case "mr_boom":
    case "razor_blade":
    case "golden_razor_blade":
      return [
        sel(
          k === "mr_boom"
            ? "monster"
            : k === "razor_blade"
              ? "player"
              : "playerOrMonster",
          [damage(1, target)],
        ),
      ];
    case "pandoras_box":
      return [op("destroySelf"), roll()];
    case "placebo":
      return [custom("placebo")];
    case "potato_peeler":
      return [custom("discardTops")];
    case "remote_detonator":
      return [custom("vote")];
    case "sack_head":
      return [custom("peekDeck")];
    case "sack_of_pennies":
      return [op("coins", 1)];
    case "tech_x":
      return ability === 0
        ? [op("counter", 1)]
        : [sel("playerOrMonster", [op("kill", undefined, { target })])];
    case "the_d20":
      return [
        sel("nonEternalItem", [
          op("custom", undefined, { key: "rerollItem", target }),
        ]),
      ];
    case "the_d4":
      return [
        op("destroySelf"),
        sel("player", [op("custom", undefined, { key: "rerollAll", target })]),
      ];
    case "the_shovel":
      return [custom("discardMonsterTop")];
    case "two_of_clubs":
      return [sel("player", [buff("doubleLoot", 1, target)])];
    case "battery_bum":
      return [sel("rechargeItem", [op("recharge", undefined, { target })])];
    case "contract_from_below":
      return [
        sel("ownNonEternal", [
          op("destroy", undefined, { target }),
          sel("ownNonEternal", [
            op("destroy", undefined, { target }),
            sel("nonEternalItem", [op("stealItem", undefined, { target })]),
          ]),
        ]),
      ];
    case "donation_machine":
      return [
        sel(
          "ownNonEternal",
          [
            sel("otherPlayer", [
              op("custom", undefined, {
                key: "giveItem",
                target: targetSlot("$item"),
                args: { other: target },
              }),
              op("coins", 8),
            ]),
          ],
          { bind: "$item", exclude: c.uid },
        ),
      ];
    case "pay_to_play":
      return [sel("nonEternalItem", [op("stealItem", undefined, { target })])];
    case "smelter":
      return [
        sel("hand", [op("discardCard", undefined, { target }), op("coins", 3)]),
      ];
    case "the_poop":
      return [op("prevent", 1, { target: self, key: "points" })];
    // Monster events
    case "ambush":
      return [custom("forceDeck", {}, 2)];
    case "devil_deal":
      return [
        menu([
          { label: "Rechazar", tasks: [] },
          {
            label: "Robar 2 · recibir 1 daño",
            tasks: [op("loot", 2), damage(1)],
          },
          {
            label: "Recibir 2 daños · elegir un Guppy",
            tasks: [damage(2), custom("guppySearch")],
          },
        ]),
      ];
    case "greed_event":
      return [custom("greedEvent")];
    case "i_can_see_forever":
      return [look("loot", 6, "order"), op("loot", 1)];
    case "mega_troll_bomb":
      return [op("damageAll", 2)];
    case "shop_upgrade":
      return [custom("expand", { deck: "shop" }, 2), op("attacks", 1)];
    case "troll_bombs":
      return [damage(2)];
    case "we_need_to_go_deeper":
      return [custom("discardMonsterTop", { repeat: true }), op("attacks", 1)];
    case "xl_floor":
      return [custom("expand", { deck: "monster" }, 1), op("attacks", 1)];
    default:
      throw Error("No hay una habilidad activada en " + c.name);
  }
}
export function triggerEffects(
  e: Engine,
  event: string,
  actor: number,
  args: OperationArguments,
): Op[] {
  const out: Op[] = [];
  const add = (c: Card, owner: number, tasks: Op[]) => {
    if (tasks.length) out.push({ op: "trigger", owner, source: c, tasks });
  };
  for (let i = 0; i < e.s.players.length; i++) {
    const p = e.s.players[i];
    for (const c of [...p.items, ...p.curses]) {
      const k = key(c),
        self = pt(i),
        v = args.value;
      const op = (op: string, n?: number, extra: Partial<Op> = {}): Op => ({
        op,
        owner: i,
        source: c,
        ...(n === undefined ? {} : { n }),
        ...extra,
      });
      const custom = (key: string, args: OperationArguments = {}, n?: number) =>
        op("custom", n, { key, args });
      const target = targetSlot("$target");
      const select = (
        query: string,
        tasks: Op[],
        extra: OperationArguments = {},
      ): Op =>
        op("select", undefined, {
          args: { query, title: c.name + " · elige", ...extra },
          tasks,
        });
      const optional = (tasks: Op[]): Op =>
        op("menu", undefined, {
          args: {
            title: c.name,
            options: [
              { label: "Usar efecto", tasks },
              { label: "No usar", tasks: [] },
            ],
          },
        });
      let tasks: Op[] = [];
      if (event === "start" && actor === i) {
        if (k === "dark_bum") tasks = [op("roll")];
        if (k === "monstros_tooth") {
          const who = Math.floor(Math.random() * e.s.players.length);
          tasks = [
            op("select", undefined, {
              owner: who,
              args: {
                query: "ownNonEternal",
                title: "Monstro’s Tooth · destruye un objeto",
              },
              tasks: [{ op: "destroy", owner: who, target }],
            }),
          ];
        }
        if (k === "restock") tasks = [custom("restock")];
        if (["cains_eye", "golden_horseshoe", "purple_heart"].includes(k))
          tasks = [
            custom("peekDeck", {
              deck: (
                {
                  cains_eye: "loot",
                  golden_horseshoe: "treasure",
                  purple_heart: "monster",
                } as Record<string, string>
              )[k],
            }),
          ];
        if (k === "the_curse")
          tasks = [
            op("menu", undefined, {
              args: {
                title: "The Curse · descarta la primera carta",
                options: ["loot", "treasure", "monster"].map((deck) => ({
                  label: deck,
                  tasks: [custom("discardTops", { deck })],
                })),
              },
            }),
          ];
        if (k === "curse_of_pain") tasks = [op("damage", 1, { target: self })];
      }
      if (event === "end" && actor === i) {
        if (["the_d6", "yum_heart", "book_of_belial", "blood_lust"].includes(k))
          tasks = [op("recharge")];
        if (k === "edens_blessing" && p.coins === 0) tasks = [op("coins", 6)];
        if (k === "goat_head") tasks = [custom("goatHead")];
        if (k === "starter_deck" && p.hand.length >= 8) tasks = [op("loot", 2)];
        if (k === "the_polaroid" && p.hand.length === 0)
          tasks = [op("loot", 2)];
        if (["the_blue_map", "the_compass", "the_map"].includes(k))
          tasks = [
            custom(
              "peekDeck",
              {
                deck: (
                  {
                    the_blue_map: "treasure",
                    the_compass: "loot",
                    the_map: "monster",
                  } as Record<string, string>
                )[k],
                mode: "order",
              },
              4,
            ),
          ];
        if (k === "curse_of_amnesia") tasks = [op("discardChoice", 2)];
        if (k === "curse_of_greed") tasks = [op("coins", -4)];
      }
      if (event === "damage" && actor === i) {
        if (k === "belly_button")
          tasks = [optional([op("recharge", undefined, { target: self })])];
        if (k === "cambion_conception") tasks = [custom("cambion", {}, args.n)];
        if (k === "curse_of_the_tower") tasks = [op("roll")];
        if (k === "fanny_pack") tasks = [op("loot", 1)];
        if (k === "forever_alone") tasks = [op("recharge")];
        if (k === "swallowed_penny") tasks = [op("coins", 1)];
        if (k === "the_poop") tasks = [op("counter", 1)];
        if (k === "the_habit" && !p.flags.habit) {
          p.flags.habit = 1;
          tasks = [
            select("rechargeItem", [op("recharge", undefined, { target })], {
              optional: true,
            }),
          ];
        }
      }
      if (event === "activate" && actor === i && k === "shiny_rock")
        tasks = [op("coins", 1)];
      if (event === "declareAttack" && actor === i && k === "bobs_brain")
        tasks = [op("roll")];
      if (
        event === "monsterDamage" &&
        args.combat &&
        actor === i &&
        k === "brimstone"
      )
        tasks = [select("otherPlayer", [op("damage", 1, { target })])];
      if (event === "monsterDeath" && k === "the_midas_touch")
        tasks = [op("coins", 3)];
      if (event === "beforeDeath") {
        if (k === "bloody_penny") tasks = [op("loot", 1)];
        if (actor === i) {
          if (k === "greeds_gullet") tasks = [op("coins", 8)];
          if (k === "suicide_king") tasks = [op("loot", 3)];
          if (k === "curse_of_loss") tasks = [custom("loseSoul")];
          if (["baby_haunt", "daddy_haunt"].includes(k))
            tasks = [
              select("otherPlayer", [
                op("custom", undefined, { key: "hauntPass", target }),
              ]),
            ];
        }
      }
      if (event === "afterDeath" && actor === i && k === "lazarus_rags")
        tasks = [op("treasure", 1)];
      if (event === "rollWould" && v === 1) {
        if (k === "sacred_heart" && actor === i && args.entry)
          tasks = [
            optional([
              op("setRoll", 6, {
                target: { kind: "stack", id: args.entry.uid },
              }),
            ]),
          ];
        if (k === "dads_lost_coin" && args.entry)
          tasks = [
            optional([
              op("reroll", undefined, {
                target: { kind: "stack", id: args.entry.uid },
              }),
            ]),
          ];
      }
      if (event === "roll") {
        if (k === "charged_baby" && v === 2)
          tasks = [
            select("rechargeItem", [op("recharge", undefined, { target })], {
              optional: true,
            }),
          ];
        if (k === "cheese_grater" && v === 6)
          tasks = [optional([custom("peekDeck", { mode: "discard" })])];
        if (k === "dead_bird" && v === 3 && actor !== i)
          tasks = [
            select("hand", [op("takeLoot", undefined, { target })], {
              player: actor,
              optional: true,
            }),
          ];
        if (k === "eye_of_greed" && v === 5) tasks = [op("coins", 3)];
        if (k === "finger" && v === 2 && actor !== i)
          tasks = [
            select(
              "ownNonEternal",
              [
                select(
                  "nonEternalItem",
                  [
                    op("swapItem", undefined, {
                      target,
                      args: { other: targetSlot("$first") },
                    }),
                  ],
                  { player: actor },
                ),
              ],
              { optional: true, bind: "$first" },
            ),
          ];
        if (k === "ipecac" && args.attackRoll && v === 6 && actor === i)
          tasks = [op("damageAll", 1, { args: { others: true } })];
        if (k === "moms_box" && v === 4)
          tasks = [optional([op("loot", 1), op("discardChoice", 1)])];
        if (k === "moms_razor" && v === 6)
          tasks = [optional([op("damage", 1, { target: pt(actor) })])];
        if (k === "sack_of_pennies" && v === 1)
          tasks = [optional([op("recharge")])];
        if (k === "spider_mod" && v === 5)
          tasks = [
            select(
              "monsterNotCombat",
              [
                op("custom", undefined, {
                  key: "replace",
                  target,
                  args: { deck: "monster" },
                }),
              ],
              { optional: true },
            ),
          ];
        if (k === "tarot_cloth" && v === 4 && actor !== i)
          tasks = [op("giveLoot", undefined, { target: pt(actor) })];
        if (k === "the_d10" && v === 3)
          tasks = [optional([custom("revealCover")])];
        if (k === "the_relic" && v === 1) tasks = [op("loot", 1)];
      }
      add(c, i, tasks);
    }
  }
  if (event === "roll")
    for (let i = 0; i < e.s.players.length; i++) {
      const p = e.s.players[i];
      if (p.flags.crystal) {
        const guess = p.flags.crystal;
        p.flags.crystal = 0;
        if (guess === args.value)
          out.push({
            op: "trigger",
            owner: i,
            tasks: [{ op: "loot", owner: i, n: 3 }],
          });
      }
    }
  for (const c of [
    ...e.s.monsters,
    ...(event === "monsterDeath" ? [args.card] : []),
  ]) {
    if (!c) continue;
    const k = key(c),
      i = e.s.turn,
      self = pt(i),
      target = targetSlot("$target");
    const op = (op: string, n?: number, extra: Partial<Op> = {}): Op => ({
      op,
      owner: i,
      source: c,
      ...(n === undefined ? {} : { n }),
      ...extra,
    });
    const custom = (key: string, args: OperationArguments = {}, n?: number) =>
      op("custom", n, { key, args });
    const sel = (query: string, tasks: Op[], extra: OperationArguments = {}) =>
      op("select", undefined, {
        args: { query, title: c.name + " · elige", ...extra },
        tasks,
      });
    let tasks: Op[] = [];
    if (event === "activate") {
      if (
        k === "cursed_psy_horf" ||
        (k === "gurdy_jr" && e.s.combat?.uid === c.uid)
      )
        tasks = [op("damage", 1, { target: pt(actor) })];
    }
    if (event === "monsterDamage" && args.card?.uid === c.uid) {
      if (["dark_one", "war"].includes(k))
        tasks = [op("buff", 1, { key: "atk", target: mt(c) })];
      if (k === "the_haunt") {
        c.counters = (c.counters || 0) + 1;
        if (c.counters % 2 === 0)
          tasks = [op("buff", 1, { key: "dc", target: mt(c) })];
      }
      if (k === "lust" && args.combat)
        tasks = [op("damage", 1, { target: self })];
      if (["dople", "evil_twin"].includes(k)) {
        const j =
          (i + (k === "dople" ? -1 : 1) + e.s.players.length) %
          e.s.players.length;
        tasks = [op("damage", args.n, { target: pt(j) })];
      }
      if (k === "gluttony" && args.combat && e.s.flags.lastAttackRoll === 6)
        tasks = [op("damage", 1, { target: pt((i + 1) % e.s.players.length) })];
    }
    if (event === "damage" && args.source?.uid === c.uid) {
      if (k === "greed")
        tasks = e.s.players.map((_, owner) => ({ op: "coins", owner, n: -4 }));
      if (args.combat) {
        if (k === "keeper_head") tasks = [op("coins", -2, { owner: actor })];
        if (k === "mega_fatty") tasks = [op("heal", 1, { target: mt(c) })];
        if (k === "scolex") tasks = [op("discardChoice", 1, { owner: actor })];
        if (k === "the_bloat")
          tasks = [op("damageAll", 1, { args: { others: true } })];
        if (k === "rage_creep")
          tasks = [
            op("damage", args.n, { target: pt((i + 1) % e.s.players.length) }),
          ];
      }
    }
    if (event === "attackTarget" && args.card?.uid === c.uid && k === "pride")
      tasks = [
        sel("player", [op("custom", 2, { key: "targetDiscard", target })]),
      ];
    if (event === "roll") {
      const v = args.value;
      if (k === "cursed_fatty" && v === 5)
        tasks = [op("discardChoice", 1, { owner: actor })];
      if (k === "cursed_gaper" && v === 4)
        tasks = e.s.monsters.map((c) =>
          op("buff", 1, { key: "atk", target: mt(c) }),
        );
      if (k === "cursed_horf" && v === 2)
        tasks = [op("damage", 2, { target: pt(actor) })];
      if (k === "cursed_keeper_head" && v === 1)
        tasks = [op("coins", -2, { owner: actor })];
      if (k === "cursed_moms_hand" && v === 6 && actor === i)
        tasks = [op("end", undefined, { args: { cancel: true } })];
      if (k === "holy_dinga" && v === 6)
        tasks = [op("heal", 1, { target: pt(actor) })];
      if (k === "holy_dip" && v === 1)
        tasks = [op("coins", 1, { owner: actor })];
      if (k === "holy_keeper_head" && v === 4)
        tasks = [op("coins", 2, { owner: actor })];
      if (k === "holy_moms_eye" && v === 2)
        tasks = [
          op("select", undefined, {
            owner: actor,
            args: {
              query: "rechargeItem",
              title: "Holy Mom’s Eye · recarga",
              optional: true,
            },
            tasks: [{ op: "recharge", owner: actor, target }],
          }),
        ];
      if (k === "holy_squirt" && v === 5)
        tasks = [op("loot", 1, { owner: actor })];
      if (args.attackRoll && args.card?.uid === c.uid) {
        if (k === "chub" && v === 1) tasks = [op("heal", 2, { target: mt(c) })];
        if (k === "daddy_long_legs" && v === 1)
          tasks = e.s.monsters.map((c) =>
            op("buff", 1, { key: "dc", target: mt(c) }),
          );
        if (k === "moms_hand" && v === 6)
          tasks = [op("end", undefined, { args: { cancel: true } })];
        if (k === "ring_of_flies" && v === 3)
          tasks = [sel("otherPlayer", [op("stealLoot", 1, { target })])];
        if (k === "swarm_of_flies" && v === 5)
          tasks = [op("damage", 1, { target: self })];
        if (k === "satan" && v === 6)
          tasks = [sel("livingPlayer", [op("kill", undefined, { target })])];
      }
    }
    if (event === "monsterDeath") {
      if (k === "stoney" && args.card?.uid !== c.uid)
        tasks = [op("kill", undefined, { target: mt(c) })];
      if (args.card?.uid === c.uid) {
        if (k === "big_spider")
          tasks = [op("custom", 1, { key: "optionalDeck" })];
        if (k === "black_bony") tasks = [op("damage", 1, { target: self })];
        if (k === "boom_fly") tasks = [op("damageAll", 1)];
        if (k === "dank_globin")
          tasks = [
            sel("player", [op("custom", 2, { key: "targetDiscard", target })]),
          ];
        if (k === "greedling")
          tasks = [sel("player", [op("coins", -7, { target })])];
        if (k === "hanger") tasks = [custom("expand", { deck: "shop" }, 1)];
        if (["mulligan", "mom"].includes(k))
          tasks = [custom("expand", { deck: "monster" }, 1)];
        if (k === "moms_dead_hand")
          tasks = [
            sel("otherNonEternal", [op("stealItem", undefined, { target })], {
              optional: true,
            }),
          ];
        if (k === "moms_eye")
          tasks = [
            sel(
              "player",
              [op("custom", undefined, { key: "lookHand", target })],
              { optional: true },
            ),
          ];
        if (k === "mulliboom")
          tasks = [sel("player", [op("damage", 3, { target })])];
        if (["portal", "conquest", "envy"].includes(k))
          tasks = [custom("forceAttack")];
        if (k === "psy_horf") tasks = [op("rechargeAll")];
        if (k === "wizoob")
          tasks = [
            sel("player", [
              op("custom", undefined, { key: "targetLoseSoul", target }),
            ]),
          ];
        if (k === "death")
          tasks = [sel("livingPlayer", [op("kill", undefined, { target })])];
        if (k === "famine") tasks = [op("playerFlag", 1, { key: "skipTurn" })];
        if (k === "peep") tasks = [custom("peep")];
        if (k === "pestilence") tasks = [custom("splitDamage", {}, 2)];
        if (k === "sloth")
          tasks = [op("discardChoice", e.s.players[i].hand.length)];
        if (k === "the_lamb")
          tasks = [
            sel(
              "otherPlayer",
              [op("custom", undefined, { key: "giveSoul", target })],
              { optional: true },
            ),
          ];
        if (k === "wrath") tasks = [op("roll")];
      }
    }
    add(c, i, tasks);
  }
  return out;
}
