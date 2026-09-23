import { test } from "node:test";
import assert from "node:assert/strict";
import { bindOperations, targetSlot } from "../../lib/operation-arguments";
import { Engine, newGame } from "../../lib/game";
import type { Op, Target } from "../../lib/game-types";

test("effect bindings preserve nested selection scopes and bind numeric dice slots", () => {
  const target: Target = { kind: "player", id: "1" };
  const operations: Op[] = [
    { op: "damage", owner: 0, target: targetSlot("$target"), bindN: "$roll" },
    {
      op: "select",
      owner: 0,
      args: { query: "player" },
      tasks: [{ op: "damage", owner: 0, target: targetSlot("$target") }],
    },
  ];
  const bound = bindOperations(
    bindOperations(operations, "$target", target),
    "$roll",
    4,
  );
  assert.deepEqual(bound[0].target, target);
  assert.equal(bound[0].n, 4);
  assert.equal(bound[0].bindN, undefined);
  assert.equal(bound[1].tasks![0].target!.kind, "placeholder");
  assert.equal(operations[0].target!.kind, "placeholder");
  const engine = new Engine(newGame("solo", ["A", "B"]));
  assert.throws(() => engine.run(operations[0]), /sin resolver/);
});
