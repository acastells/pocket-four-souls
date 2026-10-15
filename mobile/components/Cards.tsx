import { useState, useEffect, useRef } from "react";
import { isMonster, type Card, type Game } from "../../lib/game";
import { Pages } from "./Pages";
import { image } from "../services/images";
/** Elements with this attribute accept cards dropped from a draggable row. */
export const DROP_ATTRIBUTE = "data-card-drop";
const DRAG_THRESHOLD_PX = 8;

type Drag = { card: Card; x: number; y: number; over: Element | null };

export function Cards({
  cards,
  game,
  onSelect,
  playable,
  onDrop,
  fresh,
}: {
  cards: Card[];
  game: Game | null;
  onSelect: (c: Card) => void;
  /** When given, cards it rejects are dimmed and cannot be dragged. */
  playable?: (c: Card) => boolean;
  onDrop?: (c: Card) => void;
  /** Uids of cards that just arrived, highlighted for a moment. */
  fresh?: ReadonlySet<string>;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState(4),
    [drag, setDrag] = useState<Drag | null>(null);
  const pointer = useRef<{ card: Card; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const cardWidth = Math.max(65, (height - 28) * 0.69);
      setSize(Math.max(1, Math.min(8, Math.floor(width / (cardWidth + 8)))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    document.body.classList.toggle("dragging-card", !!drag);
    drag?.over?.classList.add("drop-over");
    return () => {
      document.body.classList.remove("dragging-card");
      drag?.over?.classList.remove("drop-over");
    };
  }, [drag]);
  const dropTarget = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest(`[${DROP_ATTRIBUTE}]`) ?? null;
  return (
    <div ref={ref} className="cards">
      <Pages
        items={cards}
        size={size}
        render={(c) => {
          const canPlay = playable ? playable(c) : true;
          const draggable = !!onDrop && canPlay;
          return (
            <button
              className={
                "card " +
                (c.tapped ? "tapped " : "") +
                (playable && !canPlay ? "unplayable " : "") +
                (draggable ? "draggable " : "") +
                (drag?.card.uid === c.uid ? "dragging " : "") +
                (fresh?.has(c.uid) ? "fresh " : "") +
                (game?.combat?.uid === c.uid ? "fighting" : "")
              }
              disabled={c.id === "hidden"}
              aria-label={"Ver " + c.name}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onSelect(c);
              }}
              onPointerDown={(e) => {
                suppressClick.current = false;
                if (!draggable || e.button !== 0) return;
                pointer.current = { card: c, x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const start = pointer.current;
                if (!start) return;
                if (
                  !drag &&
                  Math.hypot(e.clientX - start.x, e.clientY - start.y) <
                    DRAG_THRESHOLD_PX
                )
                  return;
                setDrag({
                  card: start.card,
                  x: e.clientX,
                  y: e.clientY,
                  over: dropTarget(e.clientX, e.clientY),
                });
              }}
              onPointerUp={(e) => {
                pointer.current = null;
                if (!drag) return;
                suppressClick.current = true;
                setDrag(null);
                if (dropTarget(e.clientX, e.clientY)) onDrop?.(drag.card);
              }}
              onPointerCancel={() => {
                pointer.current = null;
                setDrag(null);
              }}
            >
              <img src={image(c)} alt={c.name} draggable={false} />
              {isMonster(c) && !!c.damage && (
                <b className="damage-badge">−{c.damage} ♥</b>
              )}
              {!isMonster(c) && (!!c.counters || c.tapped) && (
                <span>
                  {[c.counters, c.tapped && "agotado"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </button>
          );
        }}
      />
      {drag && (
        <img
          className="drag-ghost"
          src={image(drag.card)}
          alt=""
          style={{ left: drag.x, top: drag.y }}
        />
      )}
    </div>
  );
}
