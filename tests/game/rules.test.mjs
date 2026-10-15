import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["lib/game.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  newGame,
  act,
  redact,
  cards,
  Engine,
  cardAbilities,
  cardBlock,
  soulCount,
  rule,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(outputFiles[0].text).toString("base64")
);
let serial = 0;
const card = (id) => ({
  ...cards.find((c) => c.id === id),
  uid: "test" + ++serial,
});
const pick = (s) => {
  if (s.prompt.title === "Elige qué atacar") {
    const monsters = s.prompt.options
      .filter((x) => x.card)
      .sort(
        (a, b) =>
          (parseInt(rule(a.card).stats.HP) || 1) *
            (parseInt(rule(a.card).stats.DC) || 1) -
          (parseInt(rule(b.card).stats.HP) || 1) *
            (parseInt(rule(b.card).stats.DC) || 1),
      );
    const best = monsters[0];
    if (
      best &&
      (parseInt(rule(best.card).stats.HP) || 1) *
        (parseInt(rule(best.card).stats.DC) || 1) <=
        12
    )
      return best;
    return s.prompt.options.find((x) => x.label.includes("mazo")) || best;
  }
  return (
    s.prompt.options.find((x) =>
      /^(Terminar|No usar|No intercambiar|Dejar arriba|Rechazar)/.test(x.label),
    ) || s.prompt.options[0]
  );
};
function drain(s, max = 400) {
  let n = 0;
  while (!s.winner && (s.stack.length || s.prompt || s.queue.length)) {
    if (n++ > max)
      throw Error(
        "Resolution loop: " +
          JSON.stringify({
            stack: s.stack.map((x) => x.name),
            prompt: s.prompt?.title,
            queue: s.queue.map((o) => o.op),
            log: s.log.slice(0, 5),
          }),
      );
    if (s.prompt) {
      assert.ok(s.prompt.options.length, s.prompt.title);
      s = act(s, { type: "choose", choice: pick(s).id }, s.prompt.player);
    } else if (s.stack.length) {
      s = act(s, { type: s.mode === "solo" ? "resolve" : "pass" }, s.priority);
    } else {
      const e = new Engine(s);
      e.settle();
    }
  }
  return s;
}
function setup() {
  let s = newGame("solo", ["A", "B"]);
  s.stack = [];
  s.queue = [];
  s.prompt = null;
  s.turn = 0;
  s.startingSeat = 0;
  s.priority = 0;
  s.flags = {};
  s.phase = "action";
  s.players.forEach((p) => {
    p.character = card("b2-isaac");
    p.items = [card("b2-the_d6")];
    p.hand = [card("b2-a_penny"), card("b2-a_penny")];
    p.souls = [];
    p.coins = 3;
    p.damage = 0;
    p.dead = false;
    p.tapped = false;
    p.flags = {};
    p.temp = {};
  });
  s.monsters = [card("b2-monstro"), card("b2-dip")];
  s.shop = [card("b2-breakfast"), card("b2-dinner")];
  new Engine(s).refresh();
  return s;
}
function reject(s, a, seat = 0) {
  const before = structuredClone(s);
  assert.throws(() => act(s, a, seat));
  assert.deepEqual(s, before);
}
function choose(s, label) {
  assert.ok(s.prompt, "expected choice");
  const opt = s.prompt.options.find((x) => x.label.includes(label));
  assert.ok(opt, "missing choice " + label + " in " + s.prompt.title);
  return act(s, { type: "choose", choice: opt.id }, s.prompt.player);
}
function resolveOne(s) {
  return act(s, { type: "resolve" }, s.priority);
}
test("legacy modes, debug, free drawing, moving cards, repeat starts are rejected", () => {
  const s = setup();
  assert.throws(() => newGame("local", ["A", "B"]));
  for (const type of [
    "counter",
    "draw",
    "death",
    "timer",
    "move",
    "tapCharacter",
  ])
    reject(s, {
      type,
      deck: "loot",
      from: "monsters",
      to: "hand",
      uid: s.monsters[0].uid,
    });
  reject(s, { type: "start" });
  const legacy = { ...s, rulesVersion: 2 };
  reject(legacy, { type: "end" });
});
test("all 340 base cards have statistics/effects; 3+ cards excluded for two players", () => {
  assert.equal(cards.length, 340);
  for (const c of cards) assert.ok(rule(c).subtype, c.id);
  const s = newGame("solo", ["A", "B"]);
  for (const c of [
    ...Object.values(s.decks).flat(),
    ...s.shop,
    ...s.monsters,
    ...s.players.flatMap((p) => p.hand.concat(p.items)),
  ])
    assert.equal(rule(c).threePlus, false, c.id);
});
test("one automatic draw, one normal play, one character play, no free recharge", () => {
  let s = setup();
  const startLen = s.players[1].hand.length;
  s = drain(act(s, { type: "end" }, 0));
  assert.equal(s.players[1].hand.length, startLen + 1);
  s = drain(act(s, { type: "play", uid: s.players[1].hand[0].uid }, 1));
  reject(s, { type: "play", uid: s.players[1].hand[0].uid }, 1);
  s = drain(
    act(
      s,
      { type: "play", uid: s.players[1].hand[0].uid, useCharacter: true },
      1,
    ),
  );
  assert.equal(s.players[1].tapped, true);
  reject(s, { type: "tapCharacter" }, 1);
});
test("attack hit creates damage; damage reduces monster HP and winning grants exact rewards", () => {
  let s = setup();
  s.decks.monster = [card("b2-dip")];
  s.monsters[0].damage = 3;
  // Solo declarations resolve at once: the target prompt opens immediately.
  s = act(s, { type: "attack" }, 0);
  s = choose(s, "Monstro");
  const previous = Math.random;
  Math.random = () => 0.6;
  try {
    s = act(s, { type: "roll" }, 0);
  } finally {
    Math.random = previous;
  }
  assert.equal(s.monsters[0].damage, 3);
  s = resolveOne(s);
  assert.equal(s.stack.at(-1).kind, "damage");
  assert.equal(s.monsters[0].damage, 3);
  s = drain(s);
  assert.equal(soulCount(s.players[0]), 1);
  assert.equal(s.players[0].coins, 9);
  assert.equal(s.combat, null);
  assert.equal(s.monsters.length, 2);
  reject(s, { type: "attack" });
});
test("lethal missed attack pays death penalty, exhausts items and advances solo time", () => {
  let s = setup();
  s.players[0].damage = 1;
  s.players[0].items.push(card("b2-breakfast"));
  s.players[0].damage = 2;
  new Engine(s).refresh();
  const lostItem = s.players[0].items[1].uid;
  s = drain(act(s, { type: "attack" }, 0));
  assert.ok(s.combat);
  const previous = Math.random;
  Math.random = () => 0;
  try {
    s = act(s, { type: "roll" }, 0);
  } finally {
    Math.random = previous;
  }
  s = drain(s);
  assert.equal(s.turn, 1);
  assert.equal(s.timer, 7);
  assert.equal(s.players[0].coins, 2);
  assert.ok(!s.players[0].items.some((c) => c.uid === lostItem));
  assert.equal(s.players[0].hand.length, 1);
  assert.equal(s.players[0].items[0].tapped, false);
  assert.equal(s.players[0].hp, 2);
});
test("a bomb can kill the monster in response to a miss and cancel combat damage", () => {
  let s = setup();
  s.decks.monster = [card("b2-dip")];
  s.monsters[0].damage = 3;
  s.players[0].hand = [card("b2-bomb-2")];
  s = act(s, { type: "attack" }, 0);
  s = choose(s, "Monstro");
  const previous = Math.random;
  Math.random = () => 0;
  try {
    s = act(s, { type: "roll" }, 0);
  } finally {
    Math.random = previous;
  }
  s = act(s, { type: "play", uid: s.players[0].hand[0].uid }, 0);
  s = choose(s, "Monstro");
  s = resolveOne(s);
  s = drain(s);
  assert.equal(s.players[0].hp, 2);
  assert.equal(soulCount(s.players[0]), 1);
  assert.equal(s.combat, null);
});
test("D6 and stack priority; unauthorised seats cannot act or resolve online", () => {
  let s = setup();
  s.mode = "online";
  s = act(s, { type: "attack" }, 0);
  // The declarer passes automatically; seat 1 can respond, so it keeps priority.
  assert.equal(s.priority, 1);
  reject(s, { type: "resolve" }, 0);
  reject(s, { type: "pass" }, 0);
  reject(s, { type: "end" }, 1);
  s = act(s, { type: "pass" }, 1);
  s = choose(s, "Monstro");
  s = act(s, { type: "roll" }, 0);
  const item = s.players[0].items[0];
  s = act(s, { type: "activate", uid: item.uid }, 0);
  assert.equal(s.players[0].items[0].tapped, true);
  s = drain(s);
  reject(s, { type: "activate", uid: item.uid }, 0);
});
test("single purchase, sufficient coins, and eternal protection", () => {
  let s = setup();
  reject(s, { type: "buy" });
  s.players[0].coins = 30;
  s = drain(act(s, { type: "buy" }, 0));
  assert.equal(s.players[0].coins, 20);
  assert.equal(s.players[0].items.length, 2);
  reject(s, { type: "buy" });
  const eternal = card("b2-box");
  eternal.eternal = true;
  s.players[0].items.push(eternal);
  reject(s, { type: "activate", uid: eternal.uid });
});
test("hidden hands, private choices, and deck order never leak to other online seats", () => {
  let s = setup();
  s.players[0].items = [card("b2-sleight_of_hand")];
  s = resolveOne(
    act(s, { type: "activate", uid: s.players[0].items[0].uid }, 0),
  );
  s = choose(s, "Botín");
  const r = redact(s, 1);
  assert.ok(r.players[0].hand.every((c) => c.id === "hidden"));
  assert.ok(
    Object.values(r.decks)
      .flat()
      .every((c) => c.id === "hidden"),
  );
  assert.equal(r.prompt.options.length, 0);
  assert.equal(r.queue.length, 0);
  assert.ok(redact(s, 0).prompt.options.every((c) => c.tasks.length === 0));
  reject(s, { type: "choose", choice: s.prompt.options[0].id }, 1);
});
test("ordering a deck restores every card exactly once in the chosen order", () => {
  let s = setup();
  const e = new Engine(s);
  const before = s.decks.loot.map((c) => c.uid);
  e.enqueue({
    op: "custom",
    owner: 0,
    key: "peekDeck",
    n: 5,
    args: { deck: "loot", mode: "order" },
  });
  e.settle();
  const desired = s.prompt.options[0].card.uid;
  s = drain(s);
  assert.equal(s.decks.loot.at(-1).uid, desired);
  assert.deepEqual(s.decks.loot.map((c) => c.uid).sort(), before.sort());
});
test("every loot and activated card resolves without unknown effects", () => {
  for (const c0 of cards.filter(
    (c) =>
      c.type === "loot" ||
      (["treasure", "eternal"].includes(c.type) && cardAbilities(c).length),
  )) {
    for (
      let ability = 0;
      ability < Math.max(1, cardAbilities(c0).length);
      ability++
    ) {
      let s = setup();
      s.players.forEach((p) => {
        p.coins = 40;
        p.items.push(card("b2-breakfast"), card("b2-dinner"));
        p.souls = [card("b2-monstro")];
        p.hand = [card("b2-a_penny"), card("b2-a_penny")];
      });
      const c = { ...c0, uid: "subject", counters: 10 };
      if (c.type === "loot") s.players[0].hand.push(c);
      else s.players[0].items.push(c);
      const e = new Engine(s);
      e.push(
        "Tirada de prueba",
        0,
        [{ op: "coins", owner: 0, n: 0 }],
        "roll",
        undefined,
        { value: 3 },
      );
      e.push(
        "Habilidad de prueba",
        0,
        [{ op: "coins", owner: 0, n: 0 }],
        "ability",
      );
      new Engine(s).refresh();
      const zone = c.type === "loot" ? "hand" : "items";
      if (cardBlock(s, 0, c, zone, ability)) continue;
      try {
        s = act(
          s,
          {
            type: c.type === "loot" ? "play" : "activate",
            uid: c.uid,
            ability,
          },
          0,
        );
        s = drain(s, 900);
      } catch (err) {
        throw Error(c.id + " ability " + ability + ": " + err.message, {
          cause: err,
        });
      }
    }
  }
});
test("every monster death and event can finish resolving", () => {
  for (const c0 of cards.filter((c) => c.type === "monster")) {
    let s = setup();
    const c = { ...c0, uid: "subject" };
    s.monsters = [c, card("b2-clotty")];
    const e = new Engine(s);
    try {
      if ("HP" in rule(c).stats) {
        c.damage = 100;
        e.deaths();
      } else
        e.push(c.name, 0, [{ op: "event", owner: 0, source: c }], "trigger", c);
      s = drain(s, 900);
    } catch (err) {
      throw Error(c.id + ": " + err.message, { cause: err });
    }
  }
});
test("complete automated solo games reach a win or loss without a stuck state", () => {
  const previous = Math.random;
  try {
    for (let seed0 = 1; seed0 <= 25; seed0++) {
      let seed = seed0;
      Math.random = () =>
        (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      let s = newGame("solo", ["A", "B"]);
      let actions = 0;
      while (!s.winner && actions++ < 2500) {
        if (s.prompt) {
          s = act(s, { type: "choose", choice: pick(s).id }, s.prompt.player);
          continue;
        }
        if (s.stack.length) {
          s = act(s, { type: "resolve" }, s.priority);
          continue;
        }
        if (s.combat) {
          s = act(s, { type: "roll" }, s.combat.owner);
          continue;
        }
        const i = s.turn,
          p = s.players[i];
        const loot = p.hand.find((c) => !cardBlock(s, i, c, "hand"));
        if (loot) {
          s = act(
            s,
            {
              type: "play",
              uid: loot.uid,
              useCharacter: !(s.lootPlays || s.bonusPlays[i]),
            },
            i,
          );
          continue;
        }
        if (s.purchases && p.coins >= 10) {
          s = act(s, { type: "buy" }, i);
          continue;
        }
        if (s.attacks || s.flags.optionalDeck) {
          s = act(s, { type: "attack" }, i);
          continue;
        }
        s = act(s, { type: "end" }, i);
      }
      assert.ok(
        s.winner,
        "seed " +
          seed0 +
          " stuck " +
          s.prompt?.title +
          " " +
          s.stack.map((x) => x.name),
      );
    }
  } finally {
    Math.random = previous;
  }
});

test("an item gained or lost mid-turn updates the remaining loot allowance", () => {
  let s = setup();
  s = drain(act(s, { type: "play", uid: s.players[0].hand[0].uid }, 0));
  assert.equal(s.lootPlays, 0);
  const e = new Engine(s);
  const belly = card("b2-belly_button");
  e.gainItem(0, belly);
  e.refresh();
  assert.equal(s.lootPlays, 1);
  e.destroy({ kind: "item", id: belly.uid });
  e.refresh();
  assert.equal(s.lootPlays, 0);
});
test("damage prevention applies once; death prevention heals to one HP", () => {
  let s = setup();
  const e = new Engine(s);
  e.run({
    op: "prevent",
    owner: 0,
    target: { kind: "player", id: "0" },
    n: 2,
    key: "instancePoints",
  });
  e.damage({ kind: "player", id: "0" }, 1);
  assert.equal(s.players[0].hp, 2);
  e.damage({ kind: "player", id: "0" }, 1);
  assert.equal(s.players[0].hp, 1);
  s.players[0].items = [card("b2-guppys_collar")];
  e.damage({ kind: "player", id: "0" }, 1);
  e.deaths();
  const previous = Math.random;
  Math.random = () => 0.2;
  try {
    s = drain(s);
  } finally {
    Math.random = previous;
  }
  assert.equal(s.timer, 8);
  assert.equal(s.players[0].coins, 3);
  assert.equal(s.turn, 1);
});
test("online games with 3 and 4 players reach a winner through individual priority passes", () => {
  const previous = Math.random;
  try {
    for (const count of [3, 4]) {
      let seed = 100 + count;
      Math.random = () =>
        (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      let s = newGame(
        "online",
        Array.from({ length: count }, (_, i) => "Player " + i),
      );
      s = act(s, { type: "start" }, 0);
      let actions = 0;
      while (!s.winner && actions++ < 9000) {
        if (s.prompt) {
          s = act(s, { type: "choose", choice: pick(s).id }, s.prompt.player);
          continue;
        }
        if (s.stack.length) {
          s = act(s, { type: "pass" }, s.priority);
          continue;
        }
        if (s.combat) {
          s = act(s, { type: "roll" }, s.combat.owner);
          continue;
        }
        const i = s.turn,
          p = s.players[i],
          loot = p.hand.find((c) => !cardBlock(s, i, c, "hand"));
        if (loot) {
          s = act(
            s,
            {
              type: "play",
              uid: loot.uid,
              useCharacter: !(s.lootPlays || s.bonusPlays[i]),
            },
            i,
          );
          continue;
        }
        if (s.purchases && p.coins >= 10) {
          s = act(s, { type: "buy" }, i);
          continue;
        }
        if (s.attacks || s.flags.optionalDeck) {
          s = act(s, { type: "attack" }, i);
          continue;
        }
        s = act(s, { type: "end" }, i);
      }
      assert.ok(
        s.winner,
        count +
          " player game did not finish " +
          JSON.stringify({
            round: s.round,
            phase: s.phase,
            turn: s.turn,
            prompt: s.prompt?.title,
            stack: s.stack.map((x) => x.name),
            flags: s.flags,
            log: s.log.slice(0, 8),
            souls: s.players.map(soulCount),
          }),
      );
      assert.ok(s.players.some((p) => soulCount(p) >= 4));
    }
  } finally {
    Math.random = previous;
  }
});

test("paid destruction costs remove two distinct items before the ability enters the stack", () => {
  let s = setup();
  const contract = card("b2-contract_from_below"),
    cost1 = card("b2-breakfast"),
    cost2 = card("b2-dinner"),
    prize = card("b2-meat");
  s.players[0].items.push(contract, cost1, cost2);
  s.players[1].items.push(prize);
  new Engine(s).refresh();
  s = act(s, { type: "activate", uid: contract.uid }, 0);
  s = choose(s, "Meat");
  s = choose(s, "Breakfast");
  s = choose(s, "Dinner");
  assert.equal(s.stack.at(-1).kind, "ability");
  assert.ok(
    !s.players[0].items.some((c) => [cost1.uid, cost2.uid].includes(c.uid)),
  );
  assert.ok(s.players[1].items.some((c) => c.uid === prize.uid));
  s = drain(s);
  assert.ok(s.players[0].items.some((c) => c.uid === prize.uid));
  assert.ok(!s.players[1].items.some((c) => c.uid === prize.uid));
});
test("turn phases resolve at once instead of waiting for priority", () => {
  let s = setup();
  // No items, so no end-of-turn triggers stop the flow.
  s.players.forEach((p) => (p.items = []));
  const before = s.players[1].hand.length;
  s = act(s, { type: "end" }, 0);
  assert.equal(s.turn, 1);
  assert.ok(!s.stack.some((x) => x.kind === "phase"));
  assert.equal(s.players[1].hand.length, before + 1);
});
test("seats without a legal response pass automatically online", () => {
  let s = setup();
  s.mode = "online";
  s.players[1].hand = [];
  s.players[1].items = [];
  s.players[1].tapped = true;
  s = act(s, { type: "attack" }, 0);
  assert.equal(s.stack.length, 0);
  assert.equal(s.prompt?.title, "Elige qué atacar");
});
test("a player with a legal response keeps priority on rolls", () => {
  let s = setup();
  s = act(s, { type: "attack" }, 0);
  s = choose(s, "Monstro");
  s = act(s, { type: "roll" }, 0);
  assert.equal(s.stack.at(-1).kind, "roll");
  assert.equal(s.priority, 0);
});
