import catalog from "./cards.json";
import {
  cardAbilities,
  cardEffect,
  initialCounters,
  monsterStats,
  passiveStats,
} from "./effects";
import { Engine } from "./engine";
import { clone, shuffle } from "./game-helpers";
import type { Action, Card, Game, Op, Player } from "./game-types";
import { targetSlot } from "./operation-arguments";
import { isEternal, key, rule } from "./rules";
export function newGame(mode: string, names: string[]): Game {
  if (
    !["solo", "online"].includes(mode) ||
    names.length < 2 ||
    names.length > 4 ||
    (mode === "solo" && names.length !== 2)
  )
    throw Error("Modo o jugadores no válidos");
  const decks: Record<string, Card[]> = {};
  for (const type of [
    "character",
    "eternal",
    "treasure",
    "loot",
    "monster",
    "bsoul",
  ])
    decks[type] = shuffle(
      catalog
        .filter(
          (c) => c.type === type && !(names.length < 3 && rule(c).threePlus),
        )
        .map((c, i) => ({ ...c, uid: c.id + "@" + i })),
    );
  const pairs: Record<string, string> = {
    isaac: "the_d6",
    maggy: "yum_heart",
    cain: "sleight_of_hand",
    judas: "book_of_belial",
    blue_baby: "forever_alone",
    eve: "the_curse",
    samson: "blood_lust",
    lazarus: "lazarus_rags",
    lilith: "incubus",
    the_forgotten: "the_bone",
  };
  const players: Player[] = names.map((name) => {
    const character = decks.character.pop()!;
    const item = decks.eternal.find((c) => key(c) === pairs[key(character)]);
    return {
      name,
      character,
      hand: decks.loot.splice(-3),
      items: item ? [{ ...item, counters: initialCounters(item) }] : [],
      souls: [],
      curses: [],
      hp: 2,
      maxHp: 2,
      coins: 3,
      attack: 1,
      tapped: true,
      dead: false,
      damage: 0,
      temp: {},
      flags: {},
    };
  });
  const s: Game = {
    rulesVersion: 3,
    startingSeat: Math.max(
      0,
      players.findIndex((p) => key(p.character) === "cain"),
    ),
    mode,
    players,
    decks,
    discard: { loot: [], treasure: [], monster: [] },
    monsters: [],
    covered: {},
    shop: [],
    bonus: mode === "solo" ? [] : decks.bsoul.splice(-3),
    stack: [],
    queue: [],
    prompt: null,
    priority: 0,
    passes: 0,
    turn: Math.max(
      0,
      players.findIndex((p) => key(p.character) === "cain"),
    ),
    round: 1,
    timer: 8,
    die: 1,
    log: [],
    started: mode === "solo",
    winner: null,
    lootPlays: 1,
    bonusPlays: players.map(() => 0),
    purchases: 1,
    attacks: 1,
    combat: null,
    phase: "setup",
    serial: 0,
    flags: {},
    pool: 100 - 3 * players.length,
    extraTurns: [],
    removed: [],
    shopSlots: 2,
    monsterSlots: 2,
  };
  const e = new Engine(s);
  e.fill(true);
  e.refresh();
  if (s.started) {
    e.beginTurn();
    players.forEach((p, i) => {
      if (key(p.character) === "eden")
        s.queue.push({ op: "custom", owner: i, key: "eden" });
    });
    settle(s, e);
  }
  return s;
}
export function act(input: Game, a: Action, seat: number): Game {
  if (input.rulesVersion !== 3)
    throw Error("Crea una partida nueva para usar el motor actualizado");
  if (
    !a ||
    typeof a.type !== "string" ||
    !Number.isInteger(seat) ||
    !input.players[seat]
  )
    throw Error("Acción no válida");
  const s = clone(input),
    e = new Engine(s),
    p = s.players[seat];
  if (s.winner) throw Error("La partida ha terminado");
  if (a.type === "start") {
    if (s.started || seat !== 0 || s.players.length < 2)
      throw Error("No puedes iniciar esta partida");
    s.started = true;
    e.beginTurn();
    s.players.forEach((p, i) => {
      if (key(p.character) === "eden")
        s.queue.push({ op: "custom", owner: i, key: "eden" });
    });
    settle(s, e);
    return s;
  }
  if (!s.started) throw Error("Esperando al anfitrión");
  if (a.type === "choose") {
    if (!s.prompt || s.prompt.player !== seat)
      throw Error("Esta decisión corresponde a otro jugador");
    const opt = s.prompt.options.find((x) => x.id === a.choice);
    if (!opt) throw Error("La opción ya no está disponible");
    s.prompt = null;
    e.enqueue(...opt.tasks);
    settle(s, e);
    return s;
  }
  if (s.prompt) throw Error("Resuelve la decisión pendiente");
  const main = () => {
    if (
      seat !== s.turn ||
      s.priority !== seat ||
      s.stack.length ||
      s.combat ||
      p.dead ||
      s.phase !== "action"
    )
      throw Error(
        "Acción disponible solo en tu turno, fuera del combate y con la pila vacía",
      );
  };
  const priority = () => {
    if (seat !== s.priority) throw Error("Espera a tener prioridad");
    if (p.dead) throw Error("Este personaje ha muerto");
    if (seat !== s.turn && e.has(s.turn, "trinity_shield"))
      throw Error("Trinity Shield impide responder este turno");
  };
  if (a.type === "pass" || a.type === "resolve") {
    if (a.type === "resolve" && s.mode !== "solo")
      throw Error("Cada jugador debe pasar prioridad");
    if (a.type === "pass" && seat !== s.priority)
      throw Error("Espera tu prioridad");
    passPriority(s, e, a.type === "resolve");
  } else if (a.type === "attack") {
    main();
    if (
      s.attacks <= 0 &&
      !s.flags.optionalDeck &&
      (e.item(seat, "bum_bo")?.counters || 0) < 25
    )
      throw Error("Ya has usado tus ataques");
    if (s.attacks <= 0 && s.flags.optionalDeck) {
      s.flags.optionalDeck--;
      s.flags.deckOnly = 1;
    } else s.flags.attackUsed = (s.flags.attackUsed || 0) + 1;
    e.push(
      "Declarar ataque",
      seat,
      [{ op: "startAttack", owner: seat }],
      "declaration",
    );
    e.trigger("declareAttack", seat);
  } else if (a.type === "buy") {
    main();
    if (s.purchases <= 0) throw Error("Ya has comprado este turno");
    if (p.coins < Math.min(10, e.price(seat)))
      throw Error("No tienes suficientes monedas");
    s.flags.purchaseUsed = (s.flags.purchaseUsed || 0) + 1;
    e.push(
      "Declarar compra",
      seat,
      [{ op: "purchase", owner: seat }],
      "declaration",
    );
  } else if (a.type === "end") {
    main();
    if (s.flags.mustAttack || s.flags.mustDeck || s.forcedUid)
      throw Error("Tienes un ataque obligatorio pendiente");
    e.push("Terminar turno", seat, [{ op: "end", owner: seat }], "declaration");
  } else if (a.type === "roll") {
    if (
      !s.combat ||
      s.combat.owner !== seat ||
      s.stack.length ||
      s.priority !== seat ||
      p.dead
    )
      throw Error("Solo puedes tirar durante tu combate, con la pila vacía");
    const c = s.monsters.find((c) => c.uid === s.combat!.uid)!;
    const value = Math.max(
      1,
      Math.min(
        6,
        1 + Math.floor(Math.random() * 6) + passiveStats(e, seat).roll,
      ),
    );
    s.die = value;
    e.push(
      "Tirada de ataque",
      seat,
      [
        {
          op: "attackRoll",
          owner: seat,
          target: { kind: "monster", id: c.uid },
        },
      ],
      "roll",
      c,
      { value, attackRoll: true },
    );
    e.trigger("rollWould", seat, { value, entry: s.stack.at(-1) });
  } else if (a.type === "play") {
    priority();
    const idx = p.hand.findIndex((c) => c.uid === a.uid);
    if (idx < 0) throw Error("Esta carta no está en tu mano");
    const c = p.hand[idx];
    if (c.type !== "loot") throw Error("Solo puedes jugar botín");
    const reason = cardBlock(s, seat, c, "hand");
    if (reason) throw Error(reason);
    if (a.useCharacter) {
      if (p.tapped) throw Error("Tu personaje está agotado");
      p.tapped = true;
    } else if (seat === s.turn && s.phase === "action" && s.lootPlays > 0)
      s.flags.lootUsed = (s.flags.lootUsed || 0) + 1;
    else if (s.bonusPlays[seat] > 0) s.bonusPlays[seat]--;
    else throw Error("No tienes jugadas de botín disponibles");
    p.hand.splice(idx, 1);
    e.enqueue({
      op: "prepareEffect",
      owner: seat,
      source: c,
      args: {
        kind: "loot",
        tasks: cardEffect(e, { op: "card", owner: seat, source: c }),
        finish: [{ op: "finishLoot", owner: seat, source: c }],
      },
    });
  } else if (a.type === "activate") {
    priority();
    const c = p.items.find((c) => c.uid === a.uid);
    if (!c) throw Error("No controlas este objeto");
    const abilities = cardAbilities(c),
      ability = abilities[a.ability ?? 0];
    if (!ability) throw Error("Este objeto no tiene esa habilidad");
    const reason = cardBlock(s, seat, c, "items", a.ability ?? 0);
    if (reason) throw Error(reason);
    if (ability.tap && c.tapped) throw Error("El objeto está agotado");
    if (ability.coins && p.coins < ability.coins)
      throw Error("No tienes suficientes monedas");
    if (ability.counters && (c.counters || 0) < ability.counters)
      throw Error("No hay suficientes contadores");
    if (ability.hp && p.hp < ability.hp)
      throw Error("No tienes vida suficiente");
    if (ability.tap) c.tapped = true;
    if (ability.coins) e.gainCoins(seat, -ability.coins);
    if (ability.counters) c.counters! -= ability.counters;
    if (ability.hp) p.damage += ability.hp;
    const prepared: Op = {
      op: "prepareEffect",
      owner: seat,
      source: clone(c),
      args: {
        kind: "ability",
        tasks: cardEffect(e, {
          op: "card",
          owner: seat,
          source: clone(c),
          args: { ability: a.ability ?? 0 },
        }),
      },
    };
    if (key(c) === "smelter") {
      (prepared.args ??= {}).tasks = [
        { op: "coins", owner: seat, source: c, n: 3 },
      ];
      e.enqueue({
        op: "select",
        owner: seat,
        args: { query: "hand", title: "Smelter · paga un botín" },
        tasks: [
          { op: "discardCard", owner: seat, target: targetSlot("$target") },
          prepared,
        ],
      });
    } else if (key(c) === "contract_from_below") {
      (prepared.args ??= {}).tasks = [
        { op: "stealItem", owner: seat, target: targetSlot("$steal") },
      ];
      e.enqueue({
        op: "select",
        owner: seat,
        args: {
          query: "otherNonEternal",
          bind: "$steal",
          title: "Contract from Below · elige qué robar",
        },
        tasks: [
          {
            op: "select",
            owner: seat,
            args: {
              query: "ownNonEternal",
              bind: "$cost1",
              title: "Paga el primer objeto",
            },
            tasks: [
              { op: "destroy", owner: seat, target: targetSlot("$cost1") },
              {
                op: "select",
                owner: seat,
                args: {
                  query: "ownNonEternal",
                  title: "Paga el segundo objeto",
                },
                tasks: [
                  { op: "destroy", owner: seat, target: targetSlot("$target") },
                  prepared,
                ],
              },
            ],
          },
        ],
      });
    } else if (key(c) === "donation_machine") {
      (prepared.args ??= {}).tasks = [
        { op: "coins", owner: seat, source: c, n: 8 },
      ];
      e.enqueue({
        op: "select",
        owner: seat,
        args: {
          query: "ownNonEternal",
          exclude: c.uid,
          bind: "$gift",
          title: "Donation Machine · elige el objeto",
        },
        tasks: [
          {
            op: "select",
            owner: seat,
            args: {
              query: "otherPlayer",
              title: "Elige quién recibe el objeto",
            },
            tasks: [
              {
                op: "custom",
                owner: seat,
                key: "giveItem",
                target: targetSlot("$gift"),
                args: { other: targetSlot("$target") },
              },
              prepared,
            ],
          },
        ],
      });
    } else e.enqueue(prepared);
  } else if (a.type === "peekTreasure") {
    if (seat !== s.turn || !e.has(seat, "theres_options"))
      throw Error("No tienes permiso para mirar ese mazo");
    e.enqueue({
      op: "custom",
      owner: seat,
      key: "peekDeck",
      args: { deck: "treasure", mode: "look" },
    });
  } else throw Error("Acción no permitida por las reglas");
  settle(s, e);
  return s;
}
/** One priority pass; `all` resolves the top entry as if everyone passed. */
function passPriority(s: Game, e: Engine, all = false) {
  s.passes = all ? s.players.length : s.passes + 1;
  s.priority = (s.priority + 1) % s.players.length;
  if (s.passes >= s.players.length) {
    const top = s.stack.pop();
    s.passes = 0;
    s.priority = s.turn;
    if (top) {
      e.log("Resuelve: " + top.name);
      const ops = clone(top.ops);
      if (top.kind === "roll") ops.forEach((o) => (o.value = top.value));
      e.enqueue(...ops);
    }
  }
}
/** True when `seat` could legally play a loot card or activate an item now. */
export function hasResponse(s: Game, seat: number): boolean {
  const p = s.players[seat];
  if (!p || p.dead) return false;
  return (
    p.hand.some((c) => c.type === "loot" && !cardBlock(s, seat, c, "hand")) ||
    p.items.some((c) =>
      cardAbilities(c).some((_, i) => !cardBlock(s, seat, c, "items", i)),
    )
  );
}
const AUTO_PASS_LIMIT = 200;
/**
 * Settles queued effects, then skips priority windows nobody can use: turn
 * phases resolve at once, a player never waits on their own declaration (in
 * solo, declarations resolve at once) and seats without a legal response pass.
 */
function settle(s: Game, e: Engine) {
  e.settle();
  for (let i = 0; i < AUTO_PASS_LIMIT; i++) {
    const top = s.stack.at(-1);
    if (!top || s.winner || s.prompt || s.queue.length) return;
    if (top.kind === "phase") passPriority(s, e, true);
    else if (top.kind === "declaration" && s.mode === "solo")
      passPriority(s, e, true);
    else if (top.kind === "declaration" && s.priority === top.owner)
      passPriority(s, e);
    else if (!hasResponse(s, s.priority)) passPriority(s, e);
    else return;
    e.settle();
  }
}
export function redact(input: Game, seat: number): Game {
  const s = clone(input);
  for (let i = 0; i < s.players.length; i++)
    if (i !== seat)
      s.players[i].hand = s.players[i].hand.map((_, j) => ({
        id: "hidden",
        uid: "hidden" + j,
        name: "Carta oculta",
        type: "loot",
        image: "",
        url: "",
      }));
  for (const k of Object.keys(s.decks))
    s.decks[k] = s.decks[k].map((_, i) => ({
      id: "hidden",
      uid: String(i),
      name: "",
      image: "",
      url: "",
      type: k,
    }));
  s.queue = [];
  if (s.prompt) {
    if (s.prompt.player !== seat) s.prompt.options = [];
    else s.prompt.options = s.prompt.options.map((x) => ({ ...x, tasks: [] }));
  }
  return s;
}
export function cardBlock(
  s: Game,
  seat: number,
  c: Card,
  zone: string,
  ability = 0,
): string | null {
  const e = new Engine(s),
    p = s.players[seat];
  if (!p || s.winner || s.prompt) return "Hay una decisión pendiente";
  if (s.priority !== seat) return "Espera a tener prioridad";
  if (p.dead) return "Este personaje ha muerto";
  if (seat !== s.turn && e.has(s.turn, "trinity_shield"))
    return "Trinity Shield impide responder";
  if (zone === "items") {
    const a = cardAbilities(c)[ability];
    if (!a) return "Objeto pasivo";
    if (a.tap && c.tapped) return "Objeto agotado";
    if (a.coins && p.coins < a.coins) return "Necesitas " + a.coins + " ¢";
    if (a.counters && (c.counters || 0) < a.counters)
      return "Faltan contadores";
    if (a.hp && p.hp < a.hp) return "Falta vida";
    if (
      ["box", "chaos_card", "moms_shovel", "pandoras_box", "the_d4"].includes(
        key(c),
      ) &&
      isEternal(c)
    )
      return "Un objeto eterno no puede destruirse";
    if (
      key(c) === "contract_from_below" &&
      p.items.filter((c) => !isEternal(c)).length < 2
    )
      return "Necesitas dos objetos no eternos";
    if (
      key(c) === "contract_from_below" &&
      !e.targets("otherNonEternal", seat).length
    )
      return "No hay un objeto válido para robar";
    if (key(c) === "crystal_ball" && s.stack.some((e) => e.kind === "roll"))
      return "Activa Crystal Ball antes de tirar";
    if (key(c) === "smelter" && !p.hand.length)
      return "Necesitas un botín para pagar";
  }
  if (
    zone === "hand" &&
    !(
      (seat === s.turn && s.phase === "action" && s.lootPlays > 0) ||
      s.bonusPlays[seat] > 0 ||
      !p.tapped
    )
  )
    return "No tienes jugadas de botín";
  try {
    if (
      !e.possible(
        cardEffect(e, {
          op: "card",
          owner: seat,
          source: c,
          args: { ability },
        }),
      )
    )
      return "No hay un objetivo válido";
  } catch {
    return "Esta carta no tiene una habilidad que puedas activar";
  }
  return null;
}
export function getMonsterStats(s: Game, c: Card) {
  return monsterStats(new Engine(s), c);
}
