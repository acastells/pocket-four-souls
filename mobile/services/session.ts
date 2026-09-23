import type { Game } from "../../lib/game-types";
import type { RoomRequest, RoomSnapshot } from "../../server/contracts";
const SAVE_KEY = "fs-save";
const TOKEN_KEY = "fs-token";

export function getSessionToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  // getRandomValues also works on HTTP LAN origins, unlike randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}
export function readSolo(): Game | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const state: unknown = JSON.parse(raw);
  if (!isGame(state) || state.mode !== "solo")
    throw new Error("La partida guardada no es compatible.");
  return state;
}
export function saveSolo(state: Game) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
export function clearSolo() {
  localStorage.removeItem(SAVE_KEY);
}
function isGame(value: unknown): value is Game {
  if (typeof value !== "object" || value === null) return false;
  return (
    "rulesVersion" in value &&
    value.rulesVersion === 3 &&
    "players" in value &&
    Array.isArray(value.players) &&
    value.players.length >= 2 &&
    "stack" in value &&
    Array.isArray(value.stack) &&
    "decks" in value &&
    typeof value.decks === "object"
  );
}
export async function requestRoom(
  request: RoomRequest,
  signal?: AbortSignal,
): Promise<RoomSnapshot> {
  const response = await fetch("/api/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getSessionToken(),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("El servidor de partidas no está disponible.");
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "No se pudo conectar",
    );
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("state" in data) ||
    !isGame(data.state) ||
    !("code" in data) ||
    typeof data.code !== "string" ||
    !("version" in data) ||
    typeof data.version !== "number" ||
    !("seat" in data) ||
    typeof data.seat !== "number" ||
    !("joined" in data) ||
    typeof data.joined !== "number"
  )
    throw new Error("Respuesta de sala no válida");
  return {
    state: data.state,
    code: data.code,
    version: data.version,
    seat: data.seat,
    joined: data.joined,
  };
}
