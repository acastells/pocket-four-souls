import { z } from "zod";
import type { Game } from "../lib/game-types";

const actionSchema = z
  .object({
    type: z.enum([
      "start",
      "choose",
      "pass",
      "resolve",
      "attack",
      "roll",
      "buy",
      "end",
      "play",
      "activate",
      "peekTreasure",
    ]),
    uid: z.string().min(1).max(120).optional(),
    choice: z.string().min(1).max(120).optional(),
    useCharacter: z.boolean().optional(),
    ability: z.number().int().min(0).max(20).optional(),
  })
  .strict();
const roomCode = z.string().regex(/^[A-F0-9]{8}$/);
const name = z.string().trim().min(1).max(24).default("Jugador");
export const roomRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), name }).strict(),
  z.object({ op: z.literal("join"), code: roomCode, name }).strict(),
  z.object({ op: z.literal("get"), code: roomCode }).strict(),
  z
    .object({
      op: z.literal("action"),
      code: roomCode,
      version: z.number().int().nonnegative(),
      action: actionSchema,
    })
    .strict(),
]);
export type RoomRequest = z.infer<typeof roomRequestSchema>;
export interface RoomSnapshot {
  code: string;
  seat: number;
  version: number;
  state: Game;
  joined: number;
}
export interface RoomRecord {
  code: string;
  state: Game;
  seats: string[];
  version: number;
  updated: number;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
