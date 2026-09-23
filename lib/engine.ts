import { executeCustomEffect } from "./custom-effects";
import {
  cardAbilities,
  initialCounters,
  monsterStats,
  passiveStats,
  triggerEffects,
} from "./effects";
import { clone, playerTarget, shuffle, soulCount } from "./game-helpers";
import type {
  Card,
  Choice,
  Game,
  Op,
  Player,
  StackEntry,
  Target,
} from "./game-types";
import type { OperationArguments } from "./operation-arguments";
import {
  bindOperations as bind,
  operationArguments,
  playerIndex,
  targetSlot,
} from "./operation-arguments";
import { executeOperation } from "./operations";
import {
  isEternal,
  isMonster,
  isTrinket,
  key,
  rule,
  souls,
  textOf,
} from "./rules";
export class Engine {
  s: Game;
  constructor(s: Game) {
    this.s = s;
  }
  possible(tasks: Op[]): boolean {
    const first = tasks[0];
    if (!first) return true;
    if (first.op === "select")
      return (
        !!operationArguments(first).optional ||
        this.targets(
          operationArguments(first).query,
          first.owner,
          operationArguments(first),
        ).length > 0
      );
    if (first.op === "menu")
      return operationArguments(first).options.some((x) =>
        this.possible(x.tasks),
      );
    return true;
  }
  prepareEffect(o: Op) {
    const tasks: Op[] = operationArguments(o).tasks,
      first = tasks[0];
    if (first?.op === "select") {
      const options = this.targets(
        operationArguments(first).query,
        o.owner,
        operationArguments(first),
      ).map((t) =>
        this.option(
          t.label,
          [
            {
              ...o,
              args: {
                ...operationArguments(o),
                tasks: [
                  ...bind(
                    first.tasks || [],
                    operationArguments(first).bind || "$target",
                    t.target,
                  ),
                  ...tasks.slice(1),
                ],
              },
            },
          ],
          t.card,
        ),
      );
      if (operationArguments(first).optional)
        options.push(
          this.option("No usar", [
            { ...o, args: { ...operationArguments(o), tasks: tasks.slice(1) } },
          ]),
        );
      this.ask(o.owner, operationArguments(first).title, options);
      return;
    }
    if (first?.op === "menu") {
      this.ask(
        o.owner,
        operationArguments(first).title,
        operationArguments(first)
          .options.filter((x) => this.possible(x.tasks))
          .map((x) =>
            this.option(
              x.label,
              [
                {
                  ...o,
                  args: {
                    ...operationArguments(o),
                    tasks: [...x.tasks, ...tasks.slice(1)],
                  },
                },
              ],
              x.card,
            ),
          ),
      );
      return;
    }
    this.push(
      o.source!.name,
      o.owner,
      [
        ...tasks,
        ...(operationArguments(o).finish || []),
        { op: "effectEnd", owner: o.owner },
      ],
      operationArguments(o).kind,
      o.source,
    );
    if (
      operationArguments(o).kind === "loot" &&
      this.s.players[o.owner].flags.blank &&
      !isTrinket(o.source!)
    ) {
      this.s.players[o.owner].flags.blank = 0;
      this.push(
        "Copia · " + o.source!.name,
        o.owner,
        clone([...tasks, { op: "effectEnd", owner: o.owner }]),
        "ability",
        o.source,
      );
    }
    if (operationArguments(o).kind === "ability")
      this.trigger("activate", o.owner, { card: o.source });
  }
  uid() {
    return "e" + ++this.s.serial;
  }
  log(t: string) {
    this.s.log = [t, ...this.s.log].slice(0, 100);
  }
  has(i: number, id: string) {
    return this.s.players[i]?.items.some((c) => key(c) === id);
  }
  item(i: number, id: string) {
    return this.s.players[i]?.items.find((c) => key(c) === id);
  }
  draw(deck: string): Card | undefined {
    if (!["loot", "treasure", "monster"].includes(deck))
      throw Error("Mazo no válido");
    if (!this.s.decks[deck].length) {
      this.s.decks[deck] = shuffle(this.s.discard[deck]);
      this.s.discard[deck] = [];
    }
    return this.s.decks[deck].pop();
  }
  discard(c: Card) {
    const deck = ["loot", "treasure", "monster"].includes(c.type)
      ? c.type
      : null;
    if (deck) this.s.discard[deck].push({ ...c, tapped: false, damage: 0 });
    else this.s.removed.push(c);
  }
  enqueue(...ops: Op[]) {
    this.s.queue.unshift(...ops);
  }
  push(
    name: string,
    owner: number,
    ops: Op[],
    kind = "effect",
    source?: Card,
    extra: Partial<StackEntry> = {},
  ) {
    const e: StackEntry = {
      id: source?.id || "effect",
      uid: this.uid(),
      name,
      image: source?.image || "",
      url: source?.url || "",
      type: "effect",
      kind,
      owner,
      ops,
      sourceCard: source,
      ...extra,
    };
    this.s.stack.push(e);
    this.s.priority = owner;
    this.s.passes = 0;
    return e;
  }
  ask(player: number, title: string, options: Choice[]) {
    if (!options.length) return;
    this.s.prompt = { id: this.uid(), player, title, options };
  }
  option(label: string, tasks: Op[], card?: Card): Choice {
    return { id: this.uid(), label, tasks, card };
  }
  find(t?: Target):
    | {
        card?: Card;
        player?: Player;
        owner: number;
        zone?: Card[];
        index?: number;
        entry?: StackEntry;
      }
    | undefined {
    if (!t) return;
    if (t.kind === "player") {
      const i = Number(t.id);
      if (Number.isInteger(i) && this.s.players[i])
        return { player: this.s.players[i], owner: i };
      return;
    }
    if (t.kind === "stack") {
      const entry = this.s.stack.find((c) => c.uid === t.id);
      return entry ? { owner: entry.owner, entry } : undefined;
    }
    if (t.kind === "monster") {
      const index = this.s.monsters.findIndex((c) => c.uid === t.id);
      return index < 0
        ? undefined
        : {
            card: this.s.monsters[index],
            owner: this.s.turn,
            zone: this.s.monsters,
            index,
          };
    }
    for (let i = 0; i < this.s.players.length; i++)
      for (const zone of [
        this.s.players[i].items,
        this.s.players[i].hand,
        this.s.players[i].souls,
        this.s.players[i].curses,
      ]) {
        const index = zone.findIndex((c) => c.uid === t.id);
        if (index >= 0) return { card: zone[index], owner: i, zone, index };
      }
  }
  targets(
    query: string,
    owner: number,
    args: OperationArguments = {},
  ): { target: Target; label: string; card?: Card }[] {
    const result: { target: Target; label: string; card?: Card }[] = [];
    const allowedPlayer = (i: number) =>
      args.player === undefined || i === playerIndex(args.player, owner);
    if (
      ["player", "otherPlayer", "playerOrMonster", "livingPlayer"].includes(
        query,
      )
    )
      this.s.players.forEach((p, i) => {
        if (
          allowedPlayer(i) &&
          (!query.startsWith("other") || i !== owner) &&
          (query !== "livingPlayer" || !p.dead)
        )
          result.push({ target: playerTarget(i), label: p.name });
      });
    if (
      [
        "monster",
        "otherMonster",
        "monsterNotCombat",
        "playerOrMonster",
      ].includes(query)
    )
      for (const c of this.s.monsters) {
        if (
          isMonster(c) &&
          (query !== "monsterNotCombat" || this.s.combat?.uid !== c.uid) &&
          (query !== "otherMonster" || c.uid !== args.exclude)
        )
          result.push({
            target: { kind: "monster", id: c.uid },
            label: c.name,
            card: c,
          });
      }
    if (
      [
        "item",
        "nonEternalItem",
        "ownItem",
        "ownNonEternal",
        "otherNonEternal",
        "passiveItem",
        "rechargeItem",
      ].includes(query)
    )
      this.s.players.forEach((p, i) => {
        if (
          !allowedPlayer(i) ||
          (query.startsWith("own") && i !== owner) ||
          (query === "otherNonEternal" && i === owner)
        )
          return;
        for (const c of p.items) {
          if (
            (/NonEternal|nonEternal|passiveItem/.test(query) && isEternal(c)) ||
            (query === "passiveItem" && cardAbilities(c).length > 0) ||
            (query === "rechargeItem" &&
              (!c.tapped || !cardAbilities(c).length)) ||
            c.uid === args.exclude
          )
            continue;
          result.push({
            target: { kind: "item", id: c.uid },
            label: p.name + " · " + c.name,
            card: c,
          });
        }
      });
    if (query === "hand")
      this.s.players.forEach((p, i) => {
        if (i !== playerIndex(args.player, owner)) return;
        for (const c of p.hand)
          result.push({
            target: { kind: "hand", id: c.uid },
            label: c.name,
            card: c,
          });
      });
    if (query === "soul" || query === "otherSoul")
      this.s.players.forEach((p, i) => {
        if (query === "otherSoul" && i === owner) return;
        for (const c of p.souls)
          result.push({
            target: { kind: "soul", id: c.uid },
            label: p.name + " · " + c.name,
            card: c,
          });
      });
    if (
      [
        "roll",
        "nonAttackRoll",
        "effect",
        "itemAbility",
        "cancelEffect",
        "damage",
        "death",
      ].includes(query)
    )
      for (const e of this.s.stack) {
        if (
          (query === "itemAbility" && e.kind !== "ability") ||
          (query === "cancelEffect" && !["loot", "ability"].includes(e.kind)) ||
          (query === "roll" && e.kind !== "roll") ||
          (query === "nonAttackRoll" && (e.kind !== "roll" || e.attackRoll)) ||
          (query === "effect" &&
            !["loot", "ability", "trigger"].includes(e.kind)) ||
          (query === "damage" && e.kind !== "damage") ||
          (query === "death" && e.kind !== "death")
        )
          continue;
        result.push({
          target: { kind: "stack", id: e.uid },
          label: e.name + (e.kind === "roll" ? " · " + e.value : ""),
          card: e,
        });
      }
    return result;
  }
  refresh() {
    const s = this.s;
    const owner = s.turn;
    s.lootPlays = Math.max(
      0,
      1 +
        (this.has(owner, "belly_button") ? 1 : 0) +
        (this.has(owner, "polydactyly") ? 1 : 0) -
        (s.flags.lootUsed || 0),
    );
    s.purchases = Math.max(
      0,
      1 +
        (this.has(owner, "theres_options") ? 1 : 0) -
        (s.flags.purchaseUsed || 0),
    );
    s.attacks = Math.max(
      0,
      1 +
        (this.has(owner, "champion_belt") ? 1 : 0) +
        (s.flags.attackGrants || 0) -
        (s.flags.attackUsed || 0),
    );
    for (let i = 0; i < this.s.players.length; i++) {
      const p = this.s.players[i];
      const st = passiveStats(this, i);
      p.maxHp = Math.max(0, st.hp);
      p.attack = Math.max(0, st.atk);
      p.hp = p.dead ? 0 : Math.max(0, p.maxHp - p.damage);
    }
  }
  gainCoins(owner: number, n: number) {
    const p = this.s.players[owner];
    if (n > 0) {
      if (this.has(owner, "counterfeit_penny")) n++;
      const bum = this.item(owner, "bum_bo");
      if (bum) {
        bum.counters = (bum.counters || 0) + Math.min(this.s.pool, n);
        this.log(p.name + ": Bum-Bo sube a " + bum.counters);
        return;
      }
      n = Math.min(this.s.pool, n);
      this.s.pool -= n;
      p.coins += n;
    } else {
      const lost = Math.min(p.coins, -n);
      p.coins -= lost;
      this.s.pool += lost;
    }
    this.log(p.name + ": " + (n >= 0 ? "+" : "") + n + " ¢");
  }
  loot(owner: number, n: number) {
    const p = this.s.players[owner];
    if (p.temp.doubleLoot) n *= 2;
    if (this.s.flags.compost) {
      this.s.flags.compost = 0;
      for (let i = 0; i < n; i++) {
        const c = this.s.discard.loot.pop();
        if (c) p.hand.push(c);
      }
    } else
      for (let i = 0; i < n; i++) {
        const c = this.draw("loot");
        if (c) p.hand.push(c);
      }
    this.log(p.name + ": roba " + n + " botín");
  }
  gainItem(owner: number, c: Card) {
    c.tapped = /enters play deactivated/i.test(textOf(c));
    c.damage = 0;
    c.counters = initialCounters(c);
    this.s.players[owner].items.push(c);
    this.log(this.s.players[owner].name + ": obtiene " + c.name);
    this.trigger("gainItem", owner, { card: c });
  }
  treasure(owner: number, n: number) {
    for (let i = 0; i < n; i++) {
      const c = this.draw("treasure");
      if (c) this.gainItem(owner, c);
    }
  }
  trigger(event: string, owner: number, args: OperationArguments = {}) {
    for (const t of triggerEffects(this, event, owner, args))
      this.push(
        t.source?.name || "Efecto",
        t.owner,
        t.tasks || [],
        "trigger",
        t.source,
      );
  }
  damage(target: Target, n: number, source?: Card, combat = false) {
    const f = this.find(target);
    if (!f || n <= 0) return;
    if (target.kind === "player") {
      const p = f.player!;
      if (p.dead) return;
      if (this.has(f.owner, "daddy_haunt")) n++;
      if (p.temp.invulnerable) return;
      if (p.temp.preventInstance) {
        p.temp.preventInstance--;
        if (p.temp.hostReflect) {
          p.temp.hostReflect = 0;
          this.enqueue({
            op: "select",
            owner: f.owner,
            args: {
              query: "otherPlayer",
              title: "Host Hat · elige quién recibe 1 daño",
            },
            tasks: [
              {
                op: "damage",
                owner: f.owner,
                target: targetSlot("$target"),
                n: 1,
              },
            ],
          });
        }
        return;
      }
      if (p.temp.preventUpTo) {
        n = Math.max(0, n - p.temp.preventUpTo);
        p.temp.preventUpTo = 0;
      }
      if (p.temp.reduceOne) {
        n = Math.min(1, n);
        p.temp.reduceOne = 0;
      }
      if (this.has(f.owner, "dry_baby")) n = Math.min(n, 1);
      if (p.temp.prevent) {
        const prevent = Math.min(n, p.temp.prevent);
        p.temp.prevent -= prevent;
        n -= prevent;
        if (prevent && p.temp.hostReflect) {
          p.temp.hostReflect = 0;
          this.enqueue({
            op: "select",
            owner: f.owner,
            args: { query: "otherPlayer", title: "Host Hat · devuelve 1 daño" },
            tasks: [
              {
                op: "damage",
                owner: f.owner,
                n: 1,
                target: targetSlot("$target"),
              },
            ],
          });
        }
      }
      const cat = this.item(f.owner, "the_dead_cat");
      if (cat && (cat.counters || 0) > 0) {
        const prevent = Math.min(n, cat.counters!);
        cat.counters! -= prevent;
        n -= prevent;
      }
      if (n <= 0) return;
      p.damage += n;
      this.log(p.name + " recibe " + n + " daño");
      this.trigger("damage", f.owner, { n, combat, source });
    } else if (target.kind === "monster") {
      const c = f.card!;
      if (this.s.flags["prevent:" + c.uid]) {
        this.s.flags["prevent:" + c.uid]--;
        return;
      }
      if (this.s.flags["points:" + c.uid]) {
        n = Math.max(0, n - this.s.flags["points:" + c.uid]);
        this.s.flags["points:" + c.uid] = 0;
      }
      if (this.s.flags["reduce:" + c.uid]) {
        n = Math.min(1, n);
        this.s.flags["reduce:" + c.uid] = 0;
      }
      c.damage = (c.damage || 0) + n;
      this.log(c.name + " recibe " + n + " daño");
      this.trigger("monsterDamage", this.s.turn, {
        card: c,
        n,
        combat,
        source,
      });
    }
    this.refresh();
  }
  cancelCombat() {
    this.s.combat = null;
    this.s.stack = this.s.stack.filter(
      (x) => !x.attackRoll && !(x.kind === "damage" && x.ops[0]?.args?.combat),
    );
  }
  destroy(target: Target) {
    const f = this.find(target);
    if (!f?.card || isEternal(f.card)) return;
    const c = f.card;
    f.zone!.splice(f.index!, 1);
    if (key(c) === "the_chest") {
      c.soulValue = 1;
      this.s.players[f.owner].souls.push(c);
    } else this.discard(c);
    this.log(c.name + " se destruye");
    this.trigger("destroyItem", f.owner, { card: c });
    this.refresh();
  }
  takeSoul(owner: number, c: Card) {
    this.s.players[owner].souls.push(c);
    this.log(this.s.players[owner].name + " gana " + souls(c) + " alma(s)");
    this.trigger("soul", owner, { card: c });
  }
  fill(initial = false) {
    while (this.s.shop.length < this.s.shopSlots) {
      const c = this.draw("treasure");
      if (!c) break;
      this.s.shop.push(c);
    }
    let safe = 0;
    while (
      this.s.monsters.length <
        this.s.monsterSlots - (this.s.flags.pendingRefills || 0) &&
      safe++ < 200
    ) {
      const c = this.draw("monster");
      if (!c) break;
      if (initial && !isMonster(c)) {
        this.s.decks.monster.unshift(c);
        continue;
      }
      this.s.monsters.push(c);
      if (!isMonster(c)) {
        this.push(
          c.name,
          this.s.turn,
          [{ op: "event", owner: this.s.turn, source: c }],
          "trigger",
          c,
        );
        break;
      }
    }
  }
  beginTurn() {
    const s = this.s,
      p = s.players[s.turn];
    s.phase = "setup";
    s.priority = s.turn;
    s.passes = 0;
    s.lootPlays =
      1 +
      (this.has(s.turn, "belly_button") ? 1 : 0) +
      (this.has(s.turn, "polydactyly") ? 1 : 0);
    s.bonusPlays = s.players.map(() => 0);
    s.purchases = 1 + (this.has(s.turn, "theres_options") ? 1 : 0);
    s.attacks = 1 + (this.has(s.turn, "champion_belt") ? 1 : 0);
    s.flags = {};
    s.forcedUid = undefined;
    s.players.forEach((x) => {
      x.flags = { skipTurn: x.flags.skipTurn || 0 };
      x.temp = {};
      x.damage = 0;
      x.dead = false;
      x.items = x.items.map((c) =>
        c.original
          ? { ...c.original, counters: c.counters, tapped: c.tapped }
          : c,
      );
    });
    p.tapped = false;
    p.items.forEach((c) => (c.tapped = false));
    s.monsters.forEach((c) => {
      c.damage = 0;
      c.tapped = false;
      if (key(c) === "the_haunt") c.counters = 0;
    });
    this.refresh();
    this.log("Turno de " + p.name);
    this.push(
      "Inicio de turno · robar botín",
      s.turn,
      [{ op: "lootStep", owner: s.turn }],
      "phase",
    );
    this.trigger("start", s.turn);
  }
  finishTurn() {
    const s = this.s;
    const extra = s.extraTurns.length > 0;
    let next = extra ? s.extraTurns.shift()! : (s.turn + 1) % s.players.length;
    if (!extra && next === s.startingSeat) {
      s.round++;
      if (s.mode === "solo") s.timer--;
    }
    let guard = 0;
    while (s.players[next].flags.skipTurn && guard++ < s.players.length) {
      s.players[next].flags.skipTurn = 0;
      this.log(s.players[next].name + " pierde su turno");
      next = (next + 1) % s.players.length;
      if (next === s.startingSeat) {
        s.round++;
        if (s.mode === "solo") s.timer--;
      }
    }
    s.turn = next;
    this.beginTurn();
  }

  deaths() {
    this.refresh();
    for (let i = 0; i < this.s.players.length; i++) {
      const p = this.s.players[i];
      if (
        !p.dead &&
        !p.flags.deathResolving &&
        p.hp <= 0 &&
        !this.s.stack.some(
          (e) =>
            e.kind === "death" &&
            e.target?.kind === "player" &&
            e.target.id === String(i),
        )
      )
        this.push(
          "Muerte de " + p.name,
          i,
          [{ op: "playerDeath", owner: i }],
          "death",
          p.character,
          { target: playerTarget(i) },
        );
    }
    for (const c of this.s.monsters)
      if (
        isMonster(c) &&
        monsterStats(this, c).hp - (c.damage || 0) <= 0 &&
        !this.s.stack.some((e) => e.kind === "death" && e.target?.id === c.uid)
      )
        this.push(
          "Muerte de " + c.name,
          this.s.turn,
          [{ op: "monsterDeath", owner: this.s.turn, source: c }],
          "death",
          c,
          { target: { kind: "monster", id: c.uid } },
        );
  }
  win() {
    for (let i = 0; i < this.s.players.length; i++) {
      const p = this.s.players[i];
      for (const c of [...this.s.bonus]) {
        const k = key(c);
        if (
          (k === "soul_of_greed" && p.coins >= 25) ||
          (k === "soul_of_gluttony" && p.hand.length >= 10) ||
          (k === "soul_of_guppy" &&
            p.items.filter((c) => /guppy/i.test(c.name)).length >= 2)
        ) {
          this.s.bonus.splice(this.s.bonus.indexOf(c), 1);
          this.takeSoul(i, c);
        }
      }
    }
    if (this.s.mode === "solo") {
      if (this.s.timer <= 0)
        this.s.winner = "Se ha agotado el tiempo. El sótano gana.";
      else if (this.s.players.reduce((n, p) => n + soulCount(p), 0) >= 4)
        this.s.winner = "¡Cuatro almas! Has escapado del sótano.";
    } else {
      const p = this.s.players.find((p) => soulCount(p) >= 4);
      if (p) this.s.winner = p.name + " reúne cuatro almas y gana.";
    }
  }
  settle() {
    let safe = 0;
    while (!this.s.prompt && this.s.queue.length && safe++ < 500) {
      this.run(this.s.queue.shift()!);
      this.refresh();
    }
    if (safe >= 500) throw Error("La resolución contiene demasiados efectos");
    this.refresh();
    this.win();
    if (this.s.winner) return;
    if (this.s.prompt) return;
    if (
      this.s.forcedUid &&
      !this.s.monsters.some((c) => c.uid === String(this.s.forcedUid))
    )
      this.s.forcedUid = undefined;
    this.deaths();
    if (!this.s.stack.length && !this.s.queue.length) {
      this.fill();
      if (this.s.stack.length) return;
      if (this.s.phase === "ending") {
        const p = this.s.players[this.s.turn];
        if (p.hand.length > 10) {
          this.enqueue({
            op: "discardChoice",
            owner: this.s.turn,
            n: p.hand.length - 10,
          });
          this.settle();
          return;
        }
        this.finishTurn();
      }
    }
  }
  run(o: Op) {
    executeOperation(this, o);
  }
  startAttack(o: Op) {
    const s = this.s;
    if (s.players[o.owner].dead || s.phase !== "action") return;
    if (!o.target) {
      if (
        s.forcedUid &&
        !s.monsters.some(
          (c) => c.uid === String(s.forcedUid) && key(c) !== "stoney",
        )
      )
        s.forcedUid = undefined;
      const options = s.monsters
        .filter(
          (c) =>
            isMonster(c) &&
            key(c) !== "stoney" &&
            !s.flags.mustDeck &&
            !s.flags.deckOnly &&
            (!s.forcedUid || c.uid === String(s.forcedUid)),
        )
        .map((c) =>
          this.option(
            "Atacar " + c.name,
            [{ ...o, target: { kind: "monster", id: c.uid } }],
            c,
          ),
        );
      if (!s.forcedUid && (s.decks.monster.length || s.discard.monster.length))
        options.push(
          this.option("Atacar la primera carta del mazo", [
            { ...o, target: { kind: "monster", id: "deck" } },
          ]),
        );
      this.ask(o.owner, "Elige qué atacar", options);
      return;
    }
    if (o.target.id === "deck") {
      if (s.flags.mustDeck) s.flags.mustDeck--;
      s.flags.deckOnly = 0;
      if (s.flags.mustAttack) s.flags.mustAttack--;
      const c = this.draw("monster");
      if (!c) return;
      this.enqueue({
        op: "custom",
        owner: o.owner,
        key: "cover",
        source: c,
        args: { attack: true },
      });
      return;
    }
    const c = s.monsters.find((c) => c.uid === o.target!.id);
    if (!c || !isMonster(c) || key(c) === "stoney") return;
    if (s.forcedUid && String(s.forcedUid) !== c.uid)
      throw Error("Debes atacar al monstruo indicado");
    s.forcedUid = undefined;
    if (s.flags.mustAttack) s.flags.mustAttack--;
    s.combat = { uid: c.uid, owner: o.owner };
    s.flags.attackRolls = 0;
    this.log(s.players[o.owner].name + " ataca a " + c.name);
    this.trigger("attackTarget", o.owner, { card: c });
  }
  attackRoll(o: Op) {
    const s = this.s;
    if (
      !s.combat ||
      s.combat.owner !== o.owner ||
      s.combat.uid !== o.target?.id
    )
      return;
    const c = s.monsters.find((c) => c.uid === s.combat!.uid);
    if (!c) return;
    const roll = o.value!;
    s.die = roll;
    s.flags.lastAttackRoll = roll;
    const st = monsterStats(this, c),
      ps = passiveStats(this, o.owner);
    const hit = roll >= st.dc;
    let amount = hit ? ps.atk : st.atk;
    if (
      hit &&
      ((["hopper", "pin"].includes(key(c)) && roll === 6) ||
        (key(c) === "carrion_queen" && [4, 5].includes(roll)))
    )
      amount = 0;
    if (!hit && key(c) === "horf" && roll === 2) amount++;
    if (!hit && ["leaper", "mom"].includes(key(c)) && roll === 1) amount *= 2;
    s.players[o.owner].flags.attackRolls =
      (s.players[o.owner].flags.attackRolls || 0) + 1;
    this.log("D6 " + roll + " · " + (hit ? "impacto" : "fallo"));
    if (amount > 0)
      this.push(
        "Daño de combate · " + amount,
        o.owner,
        [
          {
            op: "damage",
            owner: o.owner,
            source: c,
            target: hit
              ? { kind: "monster", id: c.uid }
              : playerTarget(o.owner),
            n: amount,
            args: { combat: true },
          },
        ],
        "damage",
        c,
      );
    this.trigger("roll", o.owner, { value: roll, attackRoll: true, card: c });
  }
  purchase(o: Op) {
    const s = this.s,
      p = s.players[o.owner];
    if (p.dead || s.phase !== "action") return;
    if (!o.target) {
      this.ask(o.owner, "Elige qué comprar", [
        ...s.shop.map((c) =>
          this.option(
            c.name + " · " + this.price(o.owner) + " ¢",
            [{ ...o, target: { kind: "item", id: c.uid } }],
            c,
          ),
        ),
        this.option("Tesoro del mazo · 10 ¢", [
          { ...o, target: { kind: "item", id: "deck" } },
        ]),
      ]);
      return;
    }
    const cost = o.target.id === "deck" ? 10 : this.price(o.owner);
    if (p.coins < cost) {
      this.log("La compra falla: faltan monedas");
      return;
    }
    const idx = s.shop.findIndex((c) => c.uid === o.target!.id);
    const c =
      o.target.id === "deck"
        ? this.draw("treasure")
        : idx >= 0
          ? s.shop.splice(idx, 1)[0]
          : undefined;
    if (!c) return;
    this.gainCoins(o.owner, -cost);
    this.gainItem(o.owner, c);
    this.fill();
  }
  price(owner: number) {
    return Math.max(0, 10 - (this.has(owner, "steamy_sale") ? 5 : 0));
  }
  playerDeath(o: Op) {
    const p = this.s.players[o.owner];
    if (p.dead || p.hp > 0) {
      p.flags.deathResolving = 0;
      return;
    }
    p.flags.deathResolving = 1;
    if (!operationArguments(o)?.savesDone) {
      const saves = p.items.filter((c) =>
        ["guppys_collar", "broken_ankh"].includes(key(c)),
      );
      if (saves.length) {
        this.enqueue({
          op: "custom",
          owner: o.owner,
          key: "deathSave",
          args: { cards: saves, index: 0 },
        });
        return;
      }
    }
    p.dead = true;
    p.damage = p.maxHp;
    if (o.owner === this.s.turn) {
      this.cancelCombat();
      this.s.stack = this.s.stack.filter(
        (e) => !["phase", "declaration"].includes(e.kind),
      );
      if (this.s.mode === "solo") this.s.timer--;
    }
    this.log(p.name + " ha muerto");
    this.push(
      "Penalización de muerte",
      o.owner,
      [{ op: "penalty", owner: o.owner }],
      "penalty",
      p.character,
    );
    this.trigger("beforeDeath", o.owner);
  }
  penalty(o: Op) {
    const s = this.s,
      p = s.players[o.owner];
    let chooser = o.owner;
    const shadow = s.players.findIndex(
      (_, i) => i !== o.owner && this.has(i, "shadow"),
    );
    if (shadow >= 0) chooser = shadow;
    const penalty: Op[] = [];
    if (p.items.some((c) => !isEternal(c)))
      penalty.push({
        op: "select",
        owner: chooser,
        args: {
          query: "nonEternalItem",
          player: o.owner,
          title: "Muerte · elige el objeto que se destruye",
        },
        tasks: [
          { op: "destroy", owner: o.owner, target: targetSlot("$target") },
        ],
      });
    if (p.hand.length)
      penalty.push({
        op: "select",
        owner: o.owner,
        args: { query: "hand", title: "Muerte · elige un botín" },
        tasks: [
          {
            op: shadow >= 0 ? "takeLoot" : "discardCard",
            owner: shadow >= 0 ? shadow : o.owner,
            target: targetSlot("$target"),
          },
        ],
      });
    if (p.coins > 0) {
      if (shadow >= 0) {
        p.coins--;
        s.players[shadow].coins++;
      } else this.gainCoins(o.owner, -1);
    }
    p.tapped = true;
    p.items.forEach((c) => {
      if (cardAbilities(c).some((a) => a.tap)) c.tapped = true;
    });
    s.bonusPlays[o.owner] = 0;
    for (const c of p.curses) this.discard(c);
    p.curses = [];
    penalty.push({ op: "afterDeath", owner: o.owner });
    this.enqueue(...penalty);
  }
  monsterDeath(o: Op) {
    const s = this.s,
      c = s.monsters.find((c) => c.uid === o.source?.uid);
    if (!c || monsterStats(this, c).hp - (c.damage || 0) > 0) return;
    const index = s.monsters.indexOf(c);
    s.monsters.splice(index, 1);
    s.flags.pendingRefills = (s.flags.pendingRefills || 0) + 1;
    if (s.combat?.uid === c.uid) this.cancelCombat();
    const covered = s.covered[c.uid] || [];
    delete s.covered[c.uid];
    this.log(c.name + " muere");
    this.push(
      "Recompensas · " + c.name,
      o.owner,
      [
        {
          op: "monsterRewards",
          owner: o.owner,
          source: c,
          args: { index, covered },
        },
      ],
      "reward",
      c,
    );
    this.trigger("monsterDeath", o.owner, { card: c });
  }
  monsterRewards(o: Op) {
    const c = o.source!,
      r = rule(c).rewards,
      k = key(c);
    const finish: Op = {
      op: "custom",
      owner: o.owner,
      key: "finishMonster",
      source: c,
      args: operationArguments(o),
    };
    if (
      [
        "black_bony",
        "dinga",
        "keeper_head",
        "cursed_keeper_head",
        "holy_dinga",
        "holy_keeper_head",
      ].includes(k)
    ) {
      this.enqueue({
        op: "roll",
        owner: o.owner,
        source: c,
        tasks: [
          {
            op: "custom",
            owner: o.owner,
            key: "rollReward",
            source: c,
            bindValue: "$roll",
          },
          finish,
        ],
      });
      return;
    }
    if (r.Coin) this.gainCoins(o.owner, r.Coin);
    if (r.Loot) this.loot(o.owner, r.Loot);
    if (r.Treasure) this.treasure(o.owner, r.Treasure);
    if (k === "rag_man") {
      this.enqueue({
        op: "roll",
        owner: o.owner,
        source: c,
        tasks: [
          {
            op: "custom",
            owner: o.owner,
            key: "ragReward",
            source: c,
            bindValue: "$roll",
            args: operationArguments(o),
          },
        ],
      });
      return;
    }
    this.enqueue(finish);
  }
  custom(o: Op) {
    executeCustomEffect(this, o);
  }
  restoreCovered(c: Card) {
    const covered = this.s.covered[c.uid];
    if (covered?.length) {
      const top = covered.pop()!;
      this.s.monsters.push(top);
      this.s.covered[top.uid] = covered;
    }
    delete this.s.covered[c.uid];
  }
}
