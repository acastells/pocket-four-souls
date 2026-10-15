import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import type { Card, Game, Player } from "../../lib/game";
export type Panel = "collections" | "log" | "stack";

const collections = [
  ["items", "Almas extra"],
  ["souls", "Tus almas"],
  ["curses", "Maldiciones"],
  ["loot", "Descarte botín"],
  ["monster", "Descarte monstruos"],
  ["treasure", "Descarte tesoros"],
] as const;
const titles: Record<Panel, [string, string]> = {
  collections: ["Colecciones", "Almas, maldiciones y descartes de la mesa."],
  log: ["Registro", "Lo último que ha pasado aparece primero."],
  stack: ["Pila", "Los efectos se resuelven de arriba abajo."],
};

/** Secondary table information, opened from the toolbar. */
export function TablePanels({
  panel,
  onClose,
  game,
  player,
  cardRow,
}: {
  panel: Panel | null;
  onClose: () => void;
  game: Game;
  player: Player;
  cardRow: (list: Card[], from: string) => React.ReactNode;
}) {
  const [collection, setCollection] =
    useState<(typeof collections)[number][0]>("items");
  const list =
    collection === "items"
      ? game.bonus
      : collection === "souls"
        ? player.souls
        : collection === "curses"
          ? player.curses
          : game.discard[collection] || [];
  return (
    <Dialog open={panel !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="mobile-dialog panel">
        {panel && (
          <>
            <DialogTitle>{titles[panel][0]}</DialogTitle>
            <DialogDescription>{titles[panel][1]}</DialogDescription>
          </>
        )}
        {panel === "collections" ? (
          <>
            <nav className="collection-nav">
              {collections.map(([id, label]) => (
                <button
                  className={collection === id ? "active" : ""}
                  key={id}
                  onClick={() => setCollection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {cardRow(list, "collection-" + collection)}
          </>
        ) : panel === "log" ? (
          <ol className="panel-list">
            {game.log.length ? (
              [...game.log].reverse().map((line, i) => (
                <li
                  key={game.log.length - i}
                  className={i === 0 ? "latest" : ""}
                >
                  <span>{game.log.length - i}</span>
                  {line}
                </li>
              ))
            ) : (
              <li className="empty">Aún no ha pasado nada.</li>
            )}
          </ol>
        ) : panel === "stack" ? (
          <ol className="panel-list">
            {game.stack.length ? (
              [...game.stack].reverse().map((entry, i) => (
                <li key={entry.uid + i} className={i === 0 ? "latest" : ""}>
                  <span>{i === 0 ? "Siguiente" : i + 1}</span>
                  <strong>{entry.name}</strong>
                  {entry.kind === "roll" && (
                    <em className="roll">dado {entry.value}</em>
                  )}
                  {entry.cancelled && <em>cancelado</em>}
                </li>
              ))
            ) : (
              <li className="empty">La pila está vacía.</li>
            )}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
