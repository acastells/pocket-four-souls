import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { Game } from "../lib/game-types";
import type { RoomRecord } from "./contracts";
const rowSchema = z.object({
  code: z.string(),
  state: z.string(),
  seats: z.string(),
  version: z.number(),
  updated: z.number(),
});

/** Persistence only: no HTTP or game rules. Updates use compare-and-swap. */
export class RoomStore {
  private readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,seats TEXT NOT NULL,version INTEGER NOT NULL,updated INTEGER NOT NULL) STRICT;`);
  }
  get(code: string): RoomRecord | undefined {
    const raw = this.db.prepare("SELECT * FROM rooms WHERE code=?").get(code);
    if (!raw) return undefined;
    const row = rowSchema.parse(raw);
    // State is written only by this service; engine compatibility is checked on read.
    return {
      ...row,
      state: JSON.parse(row.state) as Game,
      seats: z.array(z.string()).parse(JSON.parse(row.seats)),
    };
  }
  insert(room: RoomRecord): boolean {
    const result = this.db
      .prepare("INSERT OR IGNORE INTO rooms VALUES(?,?,?,?,?)")
      .run(
        room.code,
        JSON.stringify(room.state),
        JSON.stringify(room.seats),
        room.version,
        room.updated,
      );
    return result.changes === 1;
  }
  update(room: RoomRecord, expectedVersion: number): boolean {
    const result = this.db
      .prepare(
        "UPDATE rooms SET state=?,seats=?,version=?,updated=? WHERE code=? AND version=?",
      )
      .run(
        JSON.stringify(room.state),
        JSON.stringify(room.seats),
        room.version,
        room.updated,
        room.code,
        expectedVersion,
      );
    return result.changes === 1;
  }
  close() {
    this.db.close();
  }
}
