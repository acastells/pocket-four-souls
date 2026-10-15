import { createServer } from "node:http";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { RoomStore } from "./room-store";
import { RoomService } from "./room-service";
import { handleRoomRequest } from "./http";
import { serveStatic } from "./static";
import { sendNetwork } from "./network";
if (existsSync(".env")) loadEnvFile(".env");
const production = process.argv.includes("--production");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT debe estar entre 1 y 65535");
const store = new RoomStore(
  resolve(process.env.DATABASE_PATH || "data/rooms.sqlite"),
);
const service = new RoomService(store);
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({
      configFile: resolve("mobile/vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });
const server = createServer((req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/api/room") {
    void handleRoomRequest(req, res, service);
    return;
  }
  if (pathname === "/api/network" && req.method === "GET") {
    sendNetwork(res, host, port);
    return;
  }
  if (pathname.startsWith("/api/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (vite) vite.middlewares(req, res);
  else void serveStatic(req, res, resolve("dist/client"));
});
server.requestTimeout = 15000;
server.listen(port, host, () =>
  console.log(
    `Four Souls Pocket: http://${host}:${port} (${production ? "producción" : "desarrollo"})`,
  ),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    void Promise.resolve(vite?.close()).finally(() => {
      store.close();
    });
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
