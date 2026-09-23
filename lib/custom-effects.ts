import { cardAbilities } from "./effects";
import type { Engine } from "./engine";
import { shuffle, soulCount } from "./game-helpers";
import type { Card, Op } from "./game-types";
import { operationArguments, targetSlot } from "./operation-arguments";
import { isEternal, isMonster, key, souls } from "./rules";
export function executeCustomEffect(engine: Engine, o: Op) {
  const s = engine.s,
    p = s.players[o.owner],
    f = engine.find(o.target),
    c = o.source,
    n = o.n ?? 1;
  switch (o.key) {
    case "finishMonster": {
      if (!c) return;
      s.flags.pendingRefills = Math.max(0, (s.flags.pendingRefills || 0) - 1);
      const covered = operationArguments(o)?.covered || [];
      if (covered.length) {
        const top = covered.pop()!;
        s.covered[top.uid] = covered;
        s.monsters.splice(
          Math.min(operationArguments(o).index, s.monsters.length),
          0,
          top,
        );
      }
      if (key(c) === "delirium")
        s.decks.monster.splice(Math.max(0, s.decks.monster.length - 5), 0, {
          ...c,
          damage: 0,
        });
      else if (souls(c)) engine.takeSoul(o.owner, c);
      else engine.discard(c);
      engine.fill();
      break;
    }
    case "rollReward":
      if (c) {
        const value =
          (o.value || 1) *
          (key(c) === "dinga" && s.flags.lastAttackRoll === 6 ? 2 : 1);
        if (key(c) === "black_bony") engine.loot(o.owner, value);
        else engine.gainCoins(o.owner, value);
      }
      break;
    case "ragReward":
      if (c && [1, 6].includes(o.value!)) {
        s.flags.pendingRefills = Math.max(0, (s.flags.pendingRefills || 0) - 1);
        s.decks.monster.push({ ...c, damage: 0 });
        const covered = operationArguments(o)?.covered || [];
        if (covered.length) {
          const top = covered.pop()!;
          s.covered[top.uid] = covered;
          s.monsters.push(top);
        }
        engine.fill();
      } else engine.enqueue({ ...o, key: "finishMonster" });
      break;
    case "deathSave": {
      const cards = operationArguments(o).cards || [];
      const i = operationArguments(o).index;
      if (i >= cards.length) {
        engine.enqueue({
          op: "playerDeath",
          owner: o.owner,
          args: { savesDone: true },
        });
        break;
      }
      engine.enqueue({
        op: "roll",
        owner: o.owner,
        source: cards[i],
        tasks: [
          {
            op: "custom",
            owner: o.owner,
            key: "deathSaveResult",
            source: cards[i],
            bindValue: "$roll",
            args: { cards, index: i },
          },
        ],
      });
      break;
    }
    case "deathSaveResult":
      if (
        (key(c!) === "guppys_collar" && o.value! <= 3) ||
        (key(c!) === "broken_ankh" && o.value === 6)
      ) {
        p.flags.deathResolving = 0;
        p.damage = Math.max(0, p.maxHp - 1);
        engine.log(p.name + " evita la muerte");
        s.stack = s.stack.filter(
          (e) => !(e.kind === "death" && e.owner === o.owner),
        );
        if (o.owner === s.turn)
          engine.enqueue({ op: "end", owner: o.owner, args: { cancel: true } });
      } else
        engine.enqueue({
          ...o,
          key: "deathSave",
          args: {
            ...operationArguments(o),
            index: operationArguments(o).index + 1,
          },
        });
      break;
    case "cover": {
      if (!c) return;
      if (!o.target) {
        engine.ask(
          o.owner,
          "Elige el hueco para " + c.name,
          s.monsters
            .filter((x) => s.combat?.uid !== x.uid)
            .map((x) =>
              engine.option(
                "Cubrir " + x.name,
                [{ ...o, target: { kind: "monster", id: x.uid } }],
                x,
              ),
            ),
        );
        if (!s.prompt) {
          s.monsters.push(c);
          if (operationArguments(o)?.attack && isMonster(c))
            engine.enqueue({
              op: "startAttack",
              owner: o.owner,
              target: { kind: "monster", id: c.uid },
            });
          else if (!isMonster(c))
            engine.push(
              c.name,
              s.turn,
              [{ op: "event", owner: s.turn, source: c }],
              "trigger",
              c,
            );
        }
        break;
      }
      const idx = s.monsters.findIndex((x) => x.uid === o.target!.id);
      if (idx < 0) {
        s.decks.monster.push(c);
        break;
      }
      const old = s.monsters[idx];
      s.covered[c.uid] = [...(s.covered[old.uid] || []), old];
      delete s.covered[old.uid];
      s.monsters[idx] = c;
      if (!isMonster(c))
        engine.push(
          c.name,
          s.turn,
          [{ op: "event", owner: s.turn, source: c }],
          "trigger",
          c,
        );
      else if (operationArguments(o)?.attack)
        engine.enqueue({
          op: "startAttack",
          owner: o.owner,
          target: { kind: "monster", id: c.uid },
        });
      break;
    }
    case "preventRoll": {
      const damage = operationArguments(o).damage as Op;
      const prevented = operationArguments(o).duke
        ? o.value === 1
        : o.value === 6;
      engine.enqueue({
        ...damage,
        n: Math.max(
          0,
          (damage.n || 1) -
            (prevented ? (operationArguments(o).duke ? damage.n || 1 : 1) : 0),
        ),
        args: { ...damage.args, prevention: true },
      });
      break;
    }
    case "rechargePlayerItems":
      if (f?.player) f.player.items.forEach((c) => (c.tapped = false));
      break;
    case "addPlayerAttack":
      if (f?.owner === s.turn)
        s.flags.attackGrants = (s.flags.attackGrants || 0) + n;
      break;
    case "targetDiscard":
      if (f) engine.enqueue({ op: "discardChoice", owner: f.owner, n });
      break;
    case "targetLoseSoul":
      if (f) engine.enqueue({ op: "custom", owner: f.owner, key: "loseSoul" });
      break;
    case "giveSoul":
      if (f?.player)
        engine.ask(
          f.owner,
          "Entrega un alma a " + p.name,
          f.player.souls.map((c) =>
            engine.option(
              c.name,
              [
                {
                  op: "stealSoul",
                  owner: o.owner,
                  target: { kind: "soul", id: c.uid },
                },
              ],
              c,
            ),
          ),
        );
      break;
    case "pandoraSoul":
      if (c) {
        const idx = s.discard.treasure.findIndex((x) => x.uid === c.uid);
        if (idx >= 0)
          engine.takeSoul(o.owner, {
            ...s.discard.treasure.splice(idx, 1)[0],
            soulValue: 1,
          });
      }
      break;
    case "revealCover": {
      const x = engine.draw("monster");
      if (x)
        engine.enqueue({
          op: "custom",
          owner: o.owner,
          key: "cover",
          source: x,
        });
      break;
    }
    case "incubusSwap":
      if (f?.player) {
        engine.ask(o.owner, "Elige el botín que quieres intercambiar", [
          ...f.player.hand.map((c) =>
            engine.option(
              c.name,
              [
                {
                  op: "select",
                  owner: o.owner,
                  args: {
                    query: "hand",
                    title: "Elige tu botín para el intercambio",
                    optional: true,
                  },
                  tasks: [
                    {
                      op: "swapLoot",
                      owner: o.owner,
                      target: targetSlot("$target"),
                      args: { other: { kind: "hand", id: c.uid } },
                    },
                  ],
                },
              ],
              c,
            ),
          ),
          engine.option("No intercambiar", []),
        ]);
      }
      break;
    case "expand":
      if (operationArguments(o).deck === "shop") {
        s.shopSlots += n;
      } else {
        s.monsterSlots += n;
      }
      engine.fill();
      break;
    case "forceAttack":
      if (o.target) {
        if (s.attacks > 0) s.forcedUid = o.target.id;
      } else {
        s.flags.mustAttack = (s.flags.mustAttack || 0) + n;
        s.flags.attackGrants = (s.flags.attackGrants || 0) + n;
      }
      break;
    case "optionalDeck":
      s.flags.optionalDeck = (s.flags.optionalDeck || 0) + n;
      break;
    case "forceDeck":
      s.flags.mustDeck = (s.flags.mustDeck || 0) + n;
      s.flags.attackGrants = (s.flags.attackGrants || 0) + n;
      break;
    case "replace": {
      const zone =
        operationArguments(o).deck === "treasure" ? s.shop : s.monsters;
      const cs = o.target
        ? zone.filter((c) => c.uid === o.target!.id)
        : [...zone];
      for (const x of cs) {
        if (s.combat?.uid === x.uid) continue;
        zone.splice(zone.indexOf(x), 1);
        if (operationArguments(o).bottom)
          s.decks[operationArguments(o).deck].unshift(x);
        else engine.discard(x);
        const covered = s.covered[x.uid];
        if (covered?.length) {
          const top = covered.pop()!;
          s.covered[top.uid] = covered;
          zone.push(top);
        }
        delete s.covered[x.uid];
      }
      engine.fill();
      break;
    }
    case "peekDeck": {
      if (!operationArguments(o)?.deck) {
        engine.ask(
          o.owner,
          "Elige un mazo",
          ["loot", "treasure", "monster"].map((deck) =>
            engine.option(
              (
                {
                  loot: "Botín",
                  treasure: "Tesoros",
                  monster: "Monstruos",
                } as Record<string, string>
              )[deck],
              [{ ...o, args: { ...operationArguments(o), deck } }],
            ),
          ),
        );
        break;
      }
      const deck = operationArguments(o).deck;
      const list =
        operationArguments(o).cards ||
        s.decks[deck].splice(-Math.min(n, s.decks[deck].length)).reverse();
      if (!list.length) {
        if (operationArguments(o).ordered)
          s.decks[deck].push(
            ...[...(operationArguments(o).ordered || [])].reverse(),
          );
        break;
      }
      const mode = operationArguments(o).mode || "bottom";
      if (mode === "order") {
        engine.ask(
          o.owner,
          "Ordena el mazo · elige la siguiente carta superior",
          list.map((c: Card) =>
            engine.option(
              c.name,
              [
                {
                  ...o,
                  args: {
                    ...operationArguments(o),
                    cards: list.filter((x: Card) => x.uid !== c.uid),
                    ordered: [...(operationArguments(o).ordered || []), c],
                  },
                },
              ],
              c,
            ),
          ),
        );
        break;
      }
      const top = list[0];
      if (mode === "topOne") {
        engine.ask(
          o.owner,
          "Elige la carta que quedará arriba",
          list.map((c: Card) =>
            engine.option(
              c.name,
              [
                {
                  op: "custom",
                  owner: o.owner,
                  key: "restoreDeck",
                  args: {
                    deck,
                    top: [c],
                    bottom: list.filter((x: Card) => x.uid !== c.uid),
                  },
                },
              ],
              c,
            ),
          ),
        );
        break;
      }
      const opts = [
        engine.option(
          "Dejar arriba",
          [
            {
              op: "custom",
              owner: o.owner,
              key: "restoreDeck",
              args: { deck, top: list },
            },
          ],
          top,
        ),
      ];
      if (mode !== "look")
        opts.push(
          engine.option(
            mode === "discard" ? "Descartar" : "Poner abajo",
            [
              {
                op: "custom",
                owner: o.owner,
                key: "restoreDeck",
                args: {
                  deck,
                  top: list.slice(1),
                  bottom: mode === "discard" ? [] : [top],
                  discard: mode === "discard" ? [top] : [],
                },
              },
            ],
            top,
          ),
        );
      engine.ask(o.owner, "Mazo de " + deck, opts);
      break;
    }
    case "restoreDeck":
      for (const x of operationArguments(o).discard || []) engine.discard(x);
      s.decks[operationArguments(o).deck].unshift(
        ...(Array.isArray(operationArguments(o).bottom)
          ? (operationArguments(o).bottom as Card[])
          : []),
      );
      s.decks[operationArguments(o).deck].push(
        ...(operationArguments(o).top || []).reverse(),
      );
      break;
    case "lookHand": {
      const who = f?.owner ?? o.owner;
      const list = s.players[who].hand;
      engine.ask(
        o.owner,
        "Mano de " + s.players[who].name,
        list.length
          ? list.map((c) => engine.option(c.name, [], c))
          : [engine.option("Mano vacía", [])],
      );
      break;
    }
    case "justice":
      if (f?.player) {
        engine.loot(o.owner, Math.max(0, f.player.hand.length - p.hand.length));
        engine.gainCoins(o.owner, Math.max(0, f.player.coins - p.coins));
      }
      break;
    case "curse":
      if (c && f?.player) {
        const idx = s.monsters.findIndex((x) => x.uid === c.uid);
        if (idx >= 0) s.monsters.splice(idx, 1);
        f.player.curses.push(c);
        engine.restoreCovered(c);
        engine.fill();
      }
      break;
    case "destroyCurse": {
      const opts = s.players.flatMap((p) =>
        p.curses.map((c) =>
          engine.option(
            p.name + " · " + c.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "removeCurse",
                target: { kind: "item", id: c.uid },
              },
            ],
            c,
          ),
        ),
      );
      engine.ask(o.owner, "Elige la maldición", opts);
      break;
    }
    case "removeCurse":
      if (f?.card && f.zone) {
        f.zone.splice(f.index!, 1);
        engine.discard(f.card);
      }
      break;
    case "destroySoul":
      if (f?.card && f.zone === s.players[f.owner].souls) {
        f.zone.splice(f.index!, 1);
        engine.discard(f.card);
      }
      break;
    case "judgement": {
      const max = Math.max(...s.players.map(soulCount));
      engine.ask(
        o.owner,
        "Elige un jugador con más almas",
        s.players.flatMap((p, i) =>
          soulCount(p) === max
            ? [
                engine.option(p.name, [
                  { op: "custom", owner: i, key: "loseSoul" },
                ]),
              ]
            : [],
        ),
      );
      break;
    }
    case "loseSoul":
      engine.ask(
        o.owner,
        "Elige el alma que pierdes",
        p.souls.map((c) =>
          engine.option(
            c.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "destroySoul",
                target: { kind: "soul", id: c.uid },
              },
            ],
            c,
          ),
        ),
      );
      break;
    case "guppySearch": {
      const matches = s.decks.treasure.filter((c) => /guppy/i.test(c.name));
      engine.ask(
        o.owner,
        "Elige un objeto Guppy",
        matches.map((c) =>
          engine.option(
            c.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "takeTreasure",
                args: { uid: c.uid },
              },
            ],
            c,
          ),
        ),
      );
      s.decks.treasure = shuffle(s.decks.treasure);
      break;
    }
    case "takeTreasure": {
      const idx = s.decks.treasure.findIndex(
        (c) => c.uid === operationArguments(o).uid,
      );
      if (idx >= 0)
        engine.gainItem(o.owner, s.decks.treasure.splice(idx, 1)[0]);
      break;
    }
    case "greedEvent": {
      const max = Math.max(...s.players.map((p) => p.coins));
      engine.ask(
        o.owner,
        "Elige un jugador con más monedas",
        s.players.flatMap((p, i) =>
          p.coins === max
            ? [engine.option(p.name, [{ op: "coins", owner: i, n: -p.coins }])]
            : [],
        ),
      );
      break;
    }
    case "sun":
      if (c) {
        s.decks.loot.unshift(c);
        if (o.owner === s.turn) s.extraTurns.push(o.owner);
      }
      break;
    case "discardMonsterTop": {
      const list = s.discard.monster.filter(isMonster);
      const opts = list.map((c) =>
        engine.option(
          c.name,
          [
            {
              op: "custom",
              owner: o.owner,
              key: "returnMonster",
              args: { uid: c.uid },
            },
            ...(operationArguments(o)?.repeat ? [o] : []),
          ],
          c,
        ),
      );
      if (operationArguments(o)?.repeat)
        opts.push(engine.option("Terminar", []));
      engine.ask(o.owner, "Elige un monstruo del descarte", opts);
      break;
    }
    case "returnMonster": {
      const idx = s.discard.monster.findIndex(
        (c) => c.uid === operationArguments(o).uid,
      );
      if (idx >= 0) s.decks.monster.push(s.discard.monster.splice(idx, 1)[0]);
      break;
    }
    case "discardTops":
      for (const deck of operationArguments(o)?.deck
        ? [operationArguments(o).deck]
        : ["loot", "monster", "treasure"]) {
        const x = engine.draw(deck);
        if (x) engine.discard(x);
      }
      break;
    case "discardToTop": {
      const opts = ["loot", "monster", "treasure"]
        .filter((k) => s.discard[k].length)
        .map((k) =>
          engine.option(
            k + " · " + s.discard[k].at(-1)!.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "restoreDiscard",
                args: { deck: k },
              },
            ],
            s.discard[k].at(-1),
          ),
        );
      engine.ask(o.owner, "Elige un descarte", opts);
      break;
    }
    case "restoreDiscard": {
      const x = s.discard[operationArguments(o).deck].pop();
      if (x) s.decks[operationArguments(o).deck].push(x);
      break;
    }
    case "goatHead": {
      const opts = p.hand.map((c) =>
        engine.option(
          "Descartar " + c.name,
          [
            {
              op: "discardCard",
              owner: o.owner,
              target: { kind: "hand", id: c.uid },
            },
            { ...o, n: n + 1 },
          ],
          c,
        ),
      );
      opts.push(
        engine.option(
          "Terminar · robar " + (n - 1),
          n > 1 ? [{ op: "loot", owner: o.owner, n: n - 1 }] : [],
        ),
      );
      engine.ask(o.owner, "Goat Head · cambia tu botín", opts);
      break;
    }
    case "restock": {
      const opts = s.shop.map((c) =>
        engine.option(
          "Descartar " + c.name,
          [
            {
              op: "custom",
              owner: o.owner,
              key: "replace",
              target: { kind: "item", id: c.uid },
              args: { deck: "treasure" },
            },
            o,
          ],
          c,
        ),
      );
      opts.push(engine.option("Terminar", []));
      engine.ask(o.owner, "Restock · renovar tienda", opts);
      break;
    }
    case "rerollItem":
      if (f?.card && !isEternal(f.card)) {
        engine.destroy(o.target!);
        engine.treasure(f.owner, 1);
      }
      break;
    case "rerollAll":
      if (f?.player)
        for (const x of [...f.player.items])
          if (!isEternal(x)) {
            engine.destroy({ kind: "item", id: x.uid });
            engine.treasure(f.owner, 1);
          }
      break;
    case "giveItem":
      {
        const other = engine.find(operationArguments(o).other);
        if (f?.card && other?.player && !isEternal(f.card)) {
          f.zone!.splice(f.index!, 1);
          engine.gainItem(other.owner, f.card);
        }
      }
      break;
    case "stealShop": {
      const opts = [
        ...engine
          .targets("nonEternalItem", o.owner)
          .map((t) =>
            engine.option(
              t.label,
              [{ op: "stealItem", owner: o.owner, target: t.target }],
              t.card,
            ),
          ),
        ...s.shop.map((c) =>
          engine.option(
            c.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "takeShop",
                args: { uid: c.uid },
              },
            ],
            c,
          ),
        ),
      ];
      engine.ask(o.owner, "Elige un objeto para robar", opts);
      break;
    }
    case "takeShop": {
      const idx = s.shop.findIndex((c) => c.uid === operationArguments(o).uid);
      if (idx >= 0) engine.gainItem(o.owner, s.shop.splice(idx, 1)[0]);
      engine.fill();
      break;
    }
    case "cambion":
      if (c) {
        const item = p.items.find((x) => x.uid === c.uid);
        if (item) {
          item.counters = (item.counters || 0) + n;
          while (item.counters >= 6) {
            item.counters -= 6;
            engine.treasure(o.owner, 1);
          }
        }
      }
      break;
    case "hauntPass":
      if (c && f?.player) {
        const idx = p.items.findIndex((x) => x.uid === c.uid);
        if (idx >= 0) {
          p.items.splice(idx, 1);
          engine.gainItem(f.owner, c);
        }
      }
      break;
    case "peep": {
      const idx = s.decks.monster.findIndex((c) => key(c) === "the_bloat");
      if (idx >= 0)
        engine.enqueue({
          op: "custom",
          owner: o.owner,
          key: "cover",
          source: s.decks.monster.splice(idx, 1)[0],
        });
      s.decks.monster = shuffle(s.decks.monster);
      break;
    }
    case "vote": {
      const votes = operationArguments(o)?.votes || [];
      const voter = votes.length;
      if (voter >= s.players.length) {
        const totals: Record<string, number> = {};
        votes.forEach((x: string) => (totals[x] = (totals[x] || 0) + 1));
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        if (
          sorted.length &&
          (sorted.length === 1 || sorted[0][1] > sorted[1][1])
        )
          engine.destroy({ kind: "item", id: sorted[0][0] });
        break;
      }
      engine.ask(
        voter,
        "Vota qué objeto destruir",
        engine
          .targets("nonEternalItem", voter)
          .map((t) =>
            engine.option(
              t.label,
              [{ ...o, args: { votes: [...votes, t.target.id] } }],
              t.card,
            ),
          ),
      );
      break;
    }
    case "placebo": {
      const opts = engine
        .targets("nonEternalItem", o.owner, {
          exclude: c?.uid,
        })
        .filter((t) =>
          cardAbilities(t.card!).some(
            (a) => a.tap && !["placebo"].includes(key(t.card!)),
          ),
        );
      engine.ask(
        o.owner,
        "Elige la habilidad que copiar",
        opts.map((t) =>
          engine.option(
            t.label,
            [
              {
                op: "card",
                owner: o.owner,
                source: c,
                args: { ability: 0, copy: true, effectCard: t.card },
              },
            ],
            t.card,
          ),
        ),
      );
      break;
    }
    case "crystal":
      engine.ask(
        o.owner,
        "Predice la próxima tirada",
        [1, 2, 3, 4, 5, 6].map((v) =>
          engine.option(String(v), [
            { op: "playerFlag", owner: o.owner, key: "crystal", n: v },
          ]),
        ),
      );
      break;
    case "splitDamage":
      if (n > 0)
        engine.enqueue({
          op: "select",
          owner: o.owner,
          args: {
            query: "playerOrMonster",
            title: "Reparte el daño · " + n + " restante",
          },
          tasks: [
            {
              op: "damage",
              owner: o.owner,
              target: targetSlot("$target"),
              n: 1,
            },
            ...(n > 1 ? [{ ...o, n: n - 1 }] : []),
          ],
        });
      break;
    case "eden": {
      const options = s.decks.treasure.splice(-3);
      engine.ask(
        o.owner,
        "Eden · elige tu objeto eterno",
        options.map((c) =>
          engine.option(
            c.name,
            [
              {
                op: "custom",
                owner: o.owner,
                key: "edenPick",
                source: c,
                args: { rest: options.filter((x) => x.uid !== c.uid) },
              },
            ],
            c,
          ),
        ),
      );
      break;
    }
    case "edenPick":
      if (c) {
        engine.gainItem(o.owner, { ...c, eternal: true });
        s.decks.treasure.unshift(...(operationArguments(o).rest || []));
      }
      break;
    default:
      throw Error("Efecto especial no reconocido: " + o.key);
  }
}
