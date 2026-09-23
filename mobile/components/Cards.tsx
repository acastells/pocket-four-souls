import { useState, useEffect, useRef } from "react";
import {
  getMonsterStats,
  isMonster,
  type Card,
  type Game,
} from "../../lib/game";
import { Pages } from "./Pages";
import { image } from "../services/images";
export function Cards({
  cards,
  game,
  onSelect,
}: {
  cards: Card[];
  game: Game | null;
  onSelect: (c: Card) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState(4);
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
  return (
    <div ref={ref} className="cards">
      <Pages
        items={cards}
        size={size}
        render={(c) => {
          const st = game && isMonster(c) ? getMonsterStats(game, c) : null;
          return (
            <button
              className={
                "card " +
                (c.tapped ? "tapped " : "") +
                (game?.combat?.uid === c.uid ? "fighting" : "")
              }
              disabled={c.id === "hidden"}
              aria-label={"Ver " + c.name}
              onClick={() => onSelect(c)}
            >
              <img src={image(c)} alt={c.name} />
              {st ? (
                <span>
                  ♥ {Math.max(0, st.hp - (c.damage || 0))} · ⚄ {st.dc}+ · ⚔{" "}
                  {st.atk}
                </span>
              ) : (
                <span>
                  {c.name}
                  {c.counters ? ` · ${c.counters}` : ""}
                  {c.tapped ? " · agotado" : ""}
                </span>
              )}
            </button>
          );
        }}
      />
    </div>
  );
}
