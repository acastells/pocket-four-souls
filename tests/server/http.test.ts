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

test("LAN addresses: none on loopback, private IPv4 first on all interfaces", async () => {
  const { lanUrls } = await import("../../server/network");
  const nic = (address: string, internal = false) => ({
    address,
    netmask: "255.255.255.0",
    family: "IPv4" as const,
    mac: "00:00:00:00:00:00",
    internal,
    cidr: null,
  });
  const interfaces = {
    lo: [nic("127.0.0.1", true)],
    wsl: [nic("172.20.0.1")],
    wifi: [nic("192.168.1.40")],
    auto: [nic("169.254.3.3")],
  };
  assert.deepEqual(lanUrls("127.0.0.1", 5173, interfaces), []);
  assert.deepEqual(lanUrls("0.0.0.0", 5173, interfaces), [
    "http://192.168.1.40:5173",
    "http://172.20.0.1:5173",
    "http://169.254.3.3:5173",
  ]);
  assert.deepEqual(lanUrls("192.168.1.40", 80, interfaces), [
    "http://192.168.1.40:80",
  ]);
});
