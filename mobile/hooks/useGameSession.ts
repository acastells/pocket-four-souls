import { useCallback, useEffect, useRef, useState } from "react";
import { act, newGame } from "../../lib/game";
import type { Action, Game } from "../../lib/game-types";
import type { RoomRequest, RoomSnapshot } from "../../server/contracts";
import {
  clearSolo,
  readSolo,
  requestRoom,
  saveSolo,
} from "../services/session";
const POLL_INTERVAL_MS = 1500;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la acción";

/** Owns persistence and transport; presentation only sends legal user intents. */
export function useGameSession() {
  const [game, setGame] = useState<Game | null>(null);
  const [mode, setMode] = useState("solo");
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [seat, setSeat] = useState(0);
  const [joined, setJoined] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState(false);
  const meta = useRef({ room: "", version: -1 });
  const actionLock = useRef(false);
  useEffect(() => {
    try {
      setResume(!!readSolo());
    } catch (error) {
      setError(message(error));
    }
    const invitation = new URLSearchParams(location.search).get("room");
    if (invitation) {
      setCode(invitation);
      setMode("online");
    }
  }, []);
  useEffect(() => {
    if (game?.mode === "solo") {
      try {
        saveSolo(game);
        setResume(true);
      } catch {
        setError(
          "El navegador no permite guardar. La partida continuará solo en memoria.",
        );
      }
    }
  }, [game]);
  const receive = useCallback((snapshot: RoomSnapshot) => {
    if (
      meta.current.room === snapshot.code &&
      snapshot.version < meta.current.version
    )
      return;
    meta.current = { room: snapshot.code, version: snapshot.version };
    setGame(snapshot.state);
    setRoom(snapshot.code);
    setSeat(snapshot.seat);
    setJoined(snapshot.joined);
    setScreen("game");
  }, []);
  useEffect(() => {
    if (!room || screen !== "game") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await requestRoom(
          { op: "get", code: room },
          controller.signal,
        );
        if (!controller.signal.aborted) receive(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(message(error));
      }
      if (!controller.signal.aborted)
        timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }
    timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [room, screen, receive]);
  async function online(op: "create" | "join") {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const request: RoomRequest =
        op === "create"
          ? { op, name: name.trim() || "Jugador" }
          : { op, code, name: name.trim() || "Jugador" };
      receive(await requestRoom(request));
    } catch (error) {
      setError(message(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function start() {
    try {
      setGame(newGame("solo", ["Personaje 1", "Personaje 2"]));
      setSeat(0);
      setRoom("");
      meta.current = { room: "", version: -1 };
      setScreen("game");
      setError("");
    } catch (error) {
      setError(message(error));
    }
  }
  function resumeSolo() {
    try {
      const saved = readSolo();
      if (!saved) throw new Error("No hay una partida guardada");
      setGame(saved);
      setRoom("");
      meta.current = { room: "", version: -1 };
      setScreen("game");
      setError("");
    } catch (error) {
      setError(message(error));
    }
  }
  function reset() {
    setGame(null);
    setScreen("home");
    setRoom("");
    meta.current = { room: "", version: -1 };
    try {
      clearSolo();
      setResume(false);
    } catch (error) {
      setError(message(error));
    }
  }
  const activeSeat =
    game?.mode === "online"
      ? seat
      : (game?.prompt?.player ?? game?.priority ?? 0);
  async function dispatch(action: Action) {
    if (!game || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (game.mode === "online") {
        const request = {
          op: "action",
          code: meta.current.room,
          version: meta.current.version,
          action,
        } as const;
        // Input schema is shared with the server, not an unchecked cast from UI data.
        const { roomRequestSchema } = await import("../../server/contracts");
        receive(await requestRoom(roomRequestSchema.parse(request)));
      } else setGame(act(game, action, activeSeat));
    } catch (error) {
      setError(message(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  return {
    game,
    mode,
    setMode,
    screen,
    setScreen,
    name,
    setName,
    code,
    setCode,
    room,
    seat,
    joined,
    busy,
    error,
    setError,
    resume,
    start,
    resumeSolo,
    reset,
    online,
    dispatch,
    activeSeat,
  };
}
