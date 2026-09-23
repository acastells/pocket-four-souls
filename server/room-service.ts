import { createHash, randomBytes } from "node:crypto";
import { act, newGame, redact } from "../lib/game";
import {
  ApiError,
  type RoomRecord,
  type RoomRequest,
  type RoomSnapshot,
} from "./contracts";
import { RoomStore } from "./room-store";
const MAX_PLAYERS = 4;
const conflict = () =>
  new ApiError(
    409,
    "La mesa cambió. Actualiza la partida y vuelve a intentarlo.",
  );

export class RoomService {
  constructor(private readonly store: RoomStore) {}
  execute(request: RoomRequest, token: string): RoomSnapshot {
    if (!/^[a-f0-9-]{32,64}$/i.test(token))
      throw new ApiError(401, "Sesión no válida");
    const secret = createHash("sha256").update(token).digest("hex");
    if (request.op === "create") return this.create(request.name, secret);
    const room = this.store.get(request.code);
    if (!room) throw new ApiError(404, "No se ha encontrado esa sala");
    if (room.state.rulesVersion !== 3)
      throw new ApiError(
        409,
        "La sala usa otra versión del motor. Crea una sala nueva.",
      );
    let seat = room.seats.indexOf(secret);
    const previousVersion = room.version;
    if (request.op === "join" && seat < 0) {
      if (room.state.started)
        throw new ApiError(409, "La partida ya ha empezado");
      if (room.seats.length >= MAX_PLAYERS)
        throw new ApiError(409, "La sala está llena");
      seat = room.seats.length;
      room.seats.push(secret);
      room.state.players[seat].name = request.name;
    } else if (seat < 0) throw new ApiError(403, "Únete a la sala para jugar");
    else if (request.op === "get" || request.op === "join")
      return this.snapshot(room, seat);
    if (request.op === "action") {
      if (request.version !== room.version) throw conflict();
      if (request.action.type === "start") {
        if (seat !== 0)
          throw new ApiError(403, "Solo el anfitrión puede empezar");
        if (room.state.started)
          throw new ApiError(409, "La partida ya ha empezado");
        if (room.seats.length < 2)
          throw new ApiError(409, "Esperando otro jugador");
        room.state = newGame(
          "online",
          room.state.players
            .slice(0, room.seats.length)
            .map((player) => player.name),
        );
      }
      try {
        room.state = act(room.state, request.action, seat);
      } catch (error) {
        throw new ApiError(
          400,
          error instanceof Error ? error.message : "Acción no válida",
        );
      }
    }
    room.version++;
    room.updated = Date.now();
    if (!this.store.update(room, previousVersion)) throw conflict();
    return this.snapshot(room, seat);
  }
  private create(name: string, secret: string): RoomSnapshot {
    for (let attempt = 0; attempt < 5; attempt++) {
      const room: RoomRecord = {
        code: randomBytes(4).toString("hex").toUpperCase(),
        state: newGame("online", [name, "Jugador 2", "Jugador 3", "Jugador 4"]),
        seats: [secret],
        version: 0,
        updated: Date.now(),
      };
      if (this.store.insert(room)) return this.snapshot(room, 0);
    }
    throw new ApiError(503, "No se pudo crear la sala. Inténtalo de nuevo.");
  }
  private snapshot(room: RoomRecord, seat: number): RoomSnapshot {
    return {
      code: room.code,
      seat,
      version: room.version,
      state: redact(room.state, seat),
      joined: room.seats.length,
    };
  }
}
