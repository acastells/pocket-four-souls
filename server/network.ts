import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
const WILDCARD_HOSTS = ["0.0.0.0", "::", ""];
const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "::1"];
const LOOPBACK_PEERS = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];

/** Lower is better: home networks first, link-local addresses last. */
function rank(address: string) {
  if (address.startsWith("192.168.")) return 0;
  if (address.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  if (address.startsWith("169.254.")) return 9;
  return 5;
}

/**
 * Addresses other devices can use to reach this server. Empty when it only
 * listens on loopback, so the client can explain how to enable LAN play.
 */
export function lanUrls(
  host: string,
  port: number,
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces(),
): string[] {
  if (LOOPBACK_HOSTS.includes(host)) return [];
  if (!WILDCARD_HOSTS.includes(host)) return [`http://${host}:${port}`];
  return Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    .sort((a, b) => rank(a) - rank(b))
    .map((address) => `http://${address}:${port}`);
}

/** Only the machine running the server learns its LAN addresses. */
export function sendNetwork(
  req: IncomingMessage,
  res: ServerResponse,
  host: string,
  port: number,
) {
  const local = LOOPBACK_PEERS.includes(req.socket.remoteAddress ?? "");
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify({ urls: local ? lanUrls(host, port) : [] }));
}
