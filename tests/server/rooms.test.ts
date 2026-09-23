import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RoomStore } from "../../server/room-store";
import { RoomService } from "../../server/room-service";
import { roomRequestSchema } from "../../server/contracts";
const token = () => randomBytes(32).toString("hex");

test("rooms enforce membership, host privileges, capacity and optimistic versions", () => {
  const store = new RoomStore(":memory:");
  const service = new RoomService(store);
  try {
    const host = token(),
      guest = token();
    const room = service.execute({ op: "create", name: "Host" }, host);
    assert.equal(room.joined, 1);
    assert.throws(
      () => service.execute({ op: "get", code: room.code }, guest),
      /Únete/,
    );
    const joined = service.execute(
      { op: "join", name: "Guest", code: room.code },
      guest,
    );
    assert.equal(joined.seat, 1);
    assert.equal(joined.version, 1);
    assert.equal(
      service.execute({ op: "join", name: "Guest", code: room.code }, guest)
        .version,
      1,
    );
    assert.throws(
      () =>
        service.execute(
          {
            op: "action",
            code: room.code,
            version: 1,
            action: { type: "start" },
          },
          guest,
        ),
      /anfitrión/,
    );
    assert.throws(
      () =>
        service.execute(
          {
            op: "action",
            code: room.code,
            version: 0,
            action: { type: "start" },
          },
          host,
        ),
      /mesa cambió/,
    );
    const started = service.execute(
      { op: "action", code: room.code, version: 1, action: { type: "start" } },
      host,
    );
    assert.equal(started.state.players.length, 2);
    assert.equal(started.state.started, true);
    assert.ok(
      started.state.players[1].hand.every((card) => card.id === "hidden"),
    );
    assert.throws(
      () =>
        service.execute({ op: "join", code: room.code, name: "Late" }, token()),
      /empezado/,
    );
  } finally {
    store.close();
  }
});

test("room capacity, failed actions and compare-and-swap preserve stored state", () => {
  const store = new RoomStore(":memory:");
  const service = new RoomService(store);
  try {
    const host = token();
    const room = service.execute({ op: "create", name: "Host" }, host);
    for (let i = 0; i < 3; i++)
      service.execute({ op: "join", code: room.code, name: "Guest" }, token());
    assert.throws(
      () =>
        service.execute(
          { op: "join", code: room.code, name: "Fifth" },
          token(),
        ),
      /llena/,
    );
    const before = store.get(room.code)!;
    assert.throws(() =>
      service.execute(
        {
          op: "action",
          code: room.code,
          version: before.version,
          action: { type: "roll" },
        },
        host,
      ),
    );
    assert.deepEqual(store.get(room.code), before);
    assert.equal(
      store.update({ ...before, version: before.version + 1 }, before.version),
      true,
    );
    assert.equal(
      store.update({ ...before, version: before.version + 1 }, before.version),
      false,
    );
  } finally {
    store.close();
  }
});

test("SQLite rooms survive a close/reopen and store token hashes only", () => {
  const dir = mkdtempSync(join(tmpdir(), "four-souls-"));
  const filename = join(dir, "rooms.sqlite");
  const host = token();
  let store = new RoomStore(filename);
  try {
    const result = new RoomService(store).execute(
      { op: "create", name: "Host" },
      host,
    );
    const row = store.get(result.code)!;
    assert.notEqual(row.seats[0], host);
    store.close();
    store = new RoomStore(filename);
    assert.equal(
      new RoomService(store).execute({ op: "get", code: result.code }, host)
        .code,
      result.code,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("schema rejects debug actions, client state injection and invalid ability indexes", () => {
  const base = { op: "action", code: "ABCDEF12", version: 0 };
  for (const action of [
    { type: "draw" },
    { type: "activate", ability: -1 },
    { type: "play", coins: 100 },
    { type: "choose", choice: 3 },
  ]) {
    assert.equal(
      roomRequestSchema.safeParse({ ...base, action }).success,
      false,
    );
  }
  assert.equal(
    roomRequestSchema.safeParse({
      op: "create",
      name: "A",
      state: { coins: 100 },
    }).success,
    false,
  );
  assert.equal(
    roomRequestSchema.safeParse({ op: "create", name: "A" }).success,
    true,
  );
});
