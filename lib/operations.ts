import { cardEffect, monsterStats, passiveStats } from "./effects";
import type { Engine } from "./engine";
import { clone, playerTarget } from "./game-helpers";
import type { Op, Target } from "./game-types";
import {
  bindOperations as bind,
  operationArguments,
  playerIndex,
  targetSlot,
} from "./operation-arguments";
import { isEternal, isTrinket, key } from "./rules";
export function executeOperation(engine: Engine, o: Op) {
  if (o.target?.kind === "placeholder" || o.bindN || o.bindValue)
    throw Error("Efecto con una variable sin resolver");
  const s = engine.s,
    p = s.players[o.owner],
    f = engine.find(o.target),
    n = o.n ?? 1;
  switch (o.op) {
    case "prepareEffect":
      engine.prepareEffect(o);
      break;
    case "effectEnd":
      break;
    case "select": {
      const options = engine
        .targets(operationArguments(o).query, o.owner, operationArguments(o))
        .map((t) =>
          engine.option(
            t.label,
            bind(
              o.tasks || [],
              operationArguments(o).bind || "$target",
              t.target,
            ),
            t.card,
          ),
        );
      if (operationArguments(o).optional)
        options.push(engine.option("No usar", []));
      engine.ask(
        o.owner,
        operationArguments(o).title || "Elige un objetivo",
        options,
      );
      break;
    }
    case "menu":
      engine.ask(
        o.owner,
        operationArguments(o).title,
        operationArguments(o)
          .options.filter((x) => engine.possible(x.tasks))
          .map((x) => engine.option(x.label, x.tasks, x.card)),
      );
      break;
    case "coins":
      engine.gainCoins(f?.owner ?? o.owner, n);
      break;
    case "loot":
      engine.loot(f?.owner ?? o.owner, n);
      break;
    case "treasure":
      engine.treasure(f?.owner ?? o.owner, n);
      break;
    case "damage":
      if (o.target && n > 0 && !f?.player?.dead) {
        if (
          !operationArguments(o)?.prevention &&
          ((f?.player && engine.has(f.owner, "guppys_hairball")) ||
            (f?.card && key(f.card) === "the_duke_of_flies"))
        ) {
          engine.enqueue({
            op: "roll",
            owner: f?.owner ?? o.owner,
            source: f?.card || engine.item(f!.owner, "guppys_hairball"),
            tasks: [
              {
                op: "custom",
                owner: o.owner,
                key: "preventRoll",
                bindValue: "$roll",
                args: { damage: o, duke: !!f?.card },
              },
            ],
          });
          break;
        }
        engine.damage(o.target, n, o.source, !!operationArguments(o)?.combat);
      }
      break;
    case "damageAll": {
      const tasks: Op[] = s.players.flatMap((_, i) =>
        !operationArguments(o)?.others || i !== o.owner
          ? [
              {
                op: "damage",
                owner: o.owner,
                source: o.source,
                target: playerTarget(i),
                n,
              },
            ]
          : [],
      );
      if (operationArguments(o)?.monsters)
        tasks.push(
          ...s.monsters.map((c) => ({
            op: "damage",
            owner: o.owner,
            source: o.source,
            target: { kind: "monster", id: c.uid } as Target,
            n,
          })),
        );
      engine.enqueue(...tasks);
      break;
    }
    case "heal":
      if (f?.player) {
        f.player.damage = Math.max(0, f.player.damage - n);
      } else if (f?.card) f.card.damage = Math.max(0, (f.card.damage || 0) - n);
      break;
    case "buff":
      if (f?.player) {
        f.player.temp[o.key!] = (f.player.temp[o.key!] || 0) + n;
      } else if (f?.card)
        s.flags[o.key + ":" + f.card.uid] =
          (s.flags[o.key + ":" + f.card.uid] || 0) + n;
      else p.temp[o.key!] = (p.temp[o.key!] || 0) + n;
      break;
    case "flag":
      s.flags[o.key!] = n;
      break;
    case "playerFlag":
      (f?.player || p).flags[o.key!] = n;
      break;
    case "recharge":
      if (f?.card) f.card.tapped = false;
      else if (o.source) {
        const c = p.items.find((c) => c.uid === o.source!.uid);
        if (c) c.tapped = false;
      } else if (f?.player) f.player.tapped = false;
      break;
    case "rechargeAll":
      p.items.forEach((c) => (c.tapped = false));
      break;
    case "destroy":
      if (o.target) engine.destroy(o.target);
      break;
    case "destroySelf":
      if (o.source) {
        const current = engine.find({ kind: "item", id: o.source.uid });
        if (current?.card && !isEternal(current.card))
          engine.destroy({ kind: "item", id: o.source.uid });
        else {
          while (
            s.queue.length &&
            !["effectEnd", "finishLoot"].includes(s.queue[0].op)
          )
            s.queue.shift();
        }
      }
      break;
    case "kill":
      if (f?.player && !f.player.dead) {
        f.player.damage = f.player.maxHp;
      } else if (f?.card && o.target?.kind === "monster")
        f.card.damage = monsterStats(engine, f.card).hp;
      break;
    case "prevent":
      if (f?.player) {
        if (o.key === "instancePoints") f.player.temp.preventUpTo = n;
        else if (o.key === "reduce") f.player.temp.reduceOne = 1;
        else if (o.key === "points")
          f.player.temp.prevent = (f.player.temp.prevent || 0) + n;
        else
          f.player.temp.preventInstance =
            (f.player.temp.preventInstance || 0) + n;
      } else if (f?.card)
        s.flags[
          (o.key === "reduce"
            ? "reduce:"
            : ["points", "instancePoints"].includes(o.key || "")
              ? "points:"
              : "prevent:") + f.card.uid
        ] = n;
      break;
    case "discardChoice": {
      const who = playerIndex(operationArguments(o).player, o.owner);
      const hand = s.players[who].hand;
      if (n > 0 && hand.length)
        engine.enqueue({
          op: "select",
          owner: o.owner,
          args: {
            query: "hand",
            player: who,
            title:
              "Elige " + Math.min(n, hand.length) + " botín para descartar",
          },
          tasks: [
            {
              op: "discardCard",
              owner: o.owner,
              target: targetSlot("$target"),
            },
            ...(n > 1 ? [{ ...o, n: n - 1 }] : []),
          ],
        });
      break;
    }
    case "discardCard":
      if (f?.card && f.zone === s.players[f.owner].hand) {
        f.zone.splice(f.index!, 1);
        engine.discard(f.card);
      }
      break;
    case "topHand":
      if (f?.card && f.zone === s.players[f.owner].hand) {
        f.zone.splice(f.index!, 1);
        s.decks.loot.push(f.card);
      }
      break;
    case "gainSoul":
      if (o.source) {
        engine.takeSoul(o.owner, { ...o.source, soulValue: n });
      }
      break;
    case "itemSoul":
      if (o.source) {
        const idx = p.items.findIndex((c) => c.uid === o.source!.uid);
        if (idx >= 0) {
          const [c] = p.items.splice(idx, 1);
          engine.takeSoul(o.owner, { ...c, soulValue: n });
        }
      }
      break;
    case "stealCoins":
      if (f?.player && f.owner !== o.owner) {
        const amount = Math.min(n, f.player.coins);
        f.player.coins -= amount;
        p.coins += amount;
        engine.log(p.name + " roba " + amount + " ¢ a " + f.player.name);
      }
      break;
    case "stealLoot":
      if (f?.player && f.owner !== o.owner && f.player.hand.length) {
        const i = Math.floor(Math.random() * f.player.hand.length);
        p.hand.push(...f.player.hand.splice(i, 1));
      }
      break;
    case "takeLoot":
      if (f?.card && f.zone === s.players[f.owner].hand) {
        p.hand.push(...f.zone.splice(f.index!, 1));
      }
      break;
    case "giveLoot":
      if (f?.player && f.player.hand.length) {
        engine.enqueue({
          op: "select",
          owner: f.owner,
          args: { query: "hand", title: "Entrega un botín a " + p.name },
          tasks: [
            { op: "takeLoot", owner: o.owner, target: targetSlot("$target") },
          ],
        });
      }
      break;
    case "stealItem":
      if (
        f?.card &&
        f.owner !== o.owner &&
        !isEternal(f.card) &&
        f.zone === s.players[f.owner].items
      ) {
        f.zone.splice(f.index!, 1);
        engine.gainItem(o.owner, f.card);
      }
      break;
    case "stealSoul":
      if (f?.card && f.zone === s.players[f.owner].souls) {
        f.zone.splice(f.index!, 1);
        engine.takeSoul(o.owner, f.card);
      }
      break;
    case "swapItem": {
      const other = engine.find(operationArguments(o).other);
      if (
        f?.card &&
        other?.card &&
        !isEternal(f.card) &&
        !isEternal(other.card) &&
        f.zone &&
        other.zone
      ) {
        f.zone[f.index!] = other.card;
        other.zone[other.index!] = f.card;
      }
      break;
    }
    case "swapLoot": {
      const other = engine.find(operationArguments(o).other);
      if (
        f?.card &&
        other?.card &&
        f.card.type === "loot" &&
        other.card.type === "loot" &&
        f.zone &&
        other.zone
      ) {
        f.zone[f.index!] = other.card;
        other.zone[other.index!] = f.card;
      }
      break;
    }
    case "rotateHands": {
      const hands = s.players.map((p) => p.hand);
      s.players.forEach(
        (p, i) =>
          (p.hand = hands[(i + s.players.length - 1) % s.players.length]),
      );
      break;
    }
    case "counter": {
      const c = o.source
        ? p.items.find((c) => c.uid === o.source!.uid)
        : f?.card;
      if (c) c.counters = Math.max(0, (c.counters || 0) + n);
      break;
    }
    case "copyItem":
      if (f?.card && o.source && !isEternal(f.card)) {
        const own = p.items.find((c) => c.uid === o.source!.uid);
        if (own) {
          if (operationArguments(o)?.temporary) own.original = clone(own);
          Object.assign(own, {
            ...f.card,
            uid: own.uid,
            eternal: own.eternal,
            type: own.type,
            tapped: own.tapped,
            counters: own.counters,
          });
        }
      }
      break;
    case "roll": {
      const value = Math.max(
        1,
        Math.min(6, 1 + Math.floor(Math.random() * 6) + (p.temp.roll || 0)),
      );
      s.die = value;
      const remaining = s.queue.splice(0);
      const entry = engine.push(
        "Tirada · " + (o.source?.name || p.name),
        o.owner,
        [
          {
            op: "rolled",
            owner: o.owner,
            source: o.source,
            args: operationArguments(o),
            tasks: o.tasks,
          },
          ...remaining,
        ],
        "roll",
        o.source,
        { value },
      );
      engine.trigger("rollWould", o.owner, { value, entry });
      break;
    }
    case "rolled": {
      const value = o.value!;
      engine.trigger("roll", o.owner, { value, attackRoll: false });
      if (o.tasks) engine.enqueue(...bind(o.tasks, "$roll", value));
      else
        engine.enqueue({
          op: "cardRoll",
          owner: o.owner,
          source: o.source,
          value,
          args: operationArguments(o),
        });
      break;
    }
    case "modRoll":
      if (f?.entry?.kind === "roll") {
        f.entry.value = Math.max(1, Math.min(6, (f.entry.value || 1) + n));
        f.entry.name = "Tirada modificada · " + f.entry.value;
      }
      break;
    case "setRoll":
      if (f?.entry?.kind === "roll") {
        f.entry.value = Math.max(1, Math.min(6, n));
        f.entry.name = "Tirada modificada · " + f.entry.value;
      }
      break;
    case "reroll":
      if (f?.entry?.kind === "roll") {
        f.entry.value = Math.max(
          1,
          Math.min(
            6,
            1 +
              Math.floor(Math.random() * 6) +
              (f.entry.attackRoll
                ? passiveStats(engine, f.owner).roll
                : s.players[f.owner].temp.roll || 0),
          ),
        );
        s.die = f.entry.value;
        engine.log("Nueva tirada: " + f.entry.value);
        engine.trigger("rollWould", f.owner, {
          value: f.entry.value,
          entry: f.entry,
        });
      }
      break;
    case "cancel":
      if (f?.entry && ["loot", "ability"].includes(f.entry.kind)) {
        const idx = s.stack.indexOf(f.entry);
        s.stack.splice(idx, 1);
        if (f.entry.kind === "loot" && f.entry.sourceCard)
          engine.discard(f.entry.sourceCard);
      }
      break;
    case "lootPlays":
      s.bonusPlays[o.owner] += n;
      break;
    case "attacks":
      s.flags.attackGrants = (s.flags.attackGrants || 0) + n;
      break;
    case "extraTurn":
      s.extraTurns.push(o.owner);
      break;
    case "end":
      s.phase = "ending";
      engine.cancelCombat();
      if (operationArguments(o)?.cancel) {
        for (const e of s.stack)
          if (e.kind === "loot" && e.sourceCard) engine.discard(e.sourceCard);
        s.stack = [];
      }
      if (!s.flags.endTriggered) {
        s.flags.endTriggered = 1;
        engine.trigger("end", s.turn);
      }
      break;
    case "startAttack":
      engine.startAttack(o);
      break;
    case "attackRoll":
      engine.attackRoll(o);
      break;
    case "purchase":
      engine.purchase(o);
      break;
    case "playerDeath":
      engine.playerDeath(o);
      break;
    case "penalty":
      engine.penalty(o);
      break;
    case "afterDeath":
      engine.trigger("afterDeath", o.owner);
      if (o.owner === s.turn) {
        s.phase = "ending";
        if (!s.flags.endTriggered) {
          s.flags.endTriggered = 1;
          engine.trigger("end", o.owner);
        }
      }
      break;
    case "monsterDeath":
      engine.monsterDeath(o);
      break;
    case "monsterRewards":
      engine.monsterRewards(o);
      break;
    case "lootStep":
      s.phase = "action";
      engine.loot(
        o.owner,
        1 +
          (engine.has(o.owner, "moms_purse") ? 1 : 0) +
          (engine.has(o.owner, "moms_coin_purse") ? 1 : 0),
      );
      break;
    case "card":
    case "cardRoll":
    case "event":
      engine.enqueue(...cardEffect(engine, o));
      break;
    case "finishLoot":
      if (
        o.source &&
        !isTrinket(o.source) &&
        !["lost_soul", "xix_the_sun"].includes(key(o.source))
      )
        engine.discard(o.source);
      break;
    case "finishEvent": {
      if (o.source) {
        const idx = s.monsters.findIndex((c) => c.uid === o.source!.uid);
        if (idx >= 0) {
          s.monsters.splice(idx, 1);
          engine.discard(o.source);
          engine.restoreCovered(o.source);
        }
      }
      break;
    }
    case "trinket":
      if (o.source) engine.gainItem(o.owner, o.source);
      break;
    case "custom":
      engine.custom(o);
      break;
    default:
      throw Error("Efecto no reconocido: " + o.op);
  }
}
