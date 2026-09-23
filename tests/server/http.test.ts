import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { RoomStore } from "../../server/room-store";
import { RoomService } from "../../server/room-service";
import { handleRoomRequest } from "../../server/http";

test("HTTP endpoint validates method, origin, JSON, token and body size", async () => {
  const store = new RoomStore(":memory:");
  const service = new RoomService(store);
  const server = createServer(
    (req, res) => void handleRoomRequest(req, res, service),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + randomBytes(32).toString("hex"),
  };
  try {
    assert.equal((await fetch(base)).status, 405);
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers: { ...headers, Origin: "https://untrusted.invalid" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base, { method: "POST", headers, body: "not json" })).status,
      400,
    );
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"op":"create","name":"A"}',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base, {
          method: "POST",
          headers,
          body: JSON.stringify({
            op: "create",
            name: "A",
            padding: "a".repeat(20000),
          }),
        })
      ).status,
      413,
    );
    const response = await fetch(base, {
      method: "POST",
      headers,
      body: '{"op":"create","name":"A"}',
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.joined, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});
