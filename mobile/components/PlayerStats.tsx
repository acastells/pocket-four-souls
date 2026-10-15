import { Heart, Skull } from "lucide-react";
import { soulCount, type Player } from "../../lib/game";
const SOULS_TO_WIN = 4;
const SILVER_VALUE = 5;
/** Above this many icons a group collapses to one icon plus a number. */
const MAX_ICONS = 8;

const repeat = (n: number) =>
  Array.from({ length: Math.max(0, n) }, (_, i) => i);

export function PlayerStats({ player }: { player: Player }) {
  const hp = Math.max(0, player.hp);
  const lost = Math.max(0, player.maxHp - hp);
  const silver = Math.floor(player.coins / SILVER_VALUE);
  const gold = player.coins % SILVER_VALUE;
  const souls = soulCount(player);
  return (
    <span className="stats">
      <span
        className="stat hearts"
        title={`${hp} de ${player.maxHp} vidas`}
        aria-label={`${hp} de ${player.maxHp} vidas`}
      >
        {hp + lost > MAX_ICONS ? (
          <>
            <Heart className="heart full" />
            {hp}
          </>
        ) : (
          <>
            {repeat(hp).map((i) => (
              <Heart key={"h" + i} className="heart full" />
            ))}
            {repeat(lost).map((i) => (
              <Heart key={"l" + i} className="heart lost" />
            ))}
          </>
        )}
      </span>
      <span
        className="stat coins"
        title={`${player.coins} monedas`}
        aria-label={`${player.coins} monedas`}
      >
        {player.coins === 0 ? (
          <i className="coin empty" />
        ) : silver + gold > MAX_ICONS ? (
          <>
            <i className="coin gold" />
            {player.coins}
          </>
        ) : (
          <>
            {repeat(silver).map((i) => (
              <i key={"s" + i} className="coin silver" />
            ))}
            {repeat(gold).map((i) => (
              <i key={"g" + i} className="coin gold" />
            ))}
          </>
        )}
      </span>
      <span
        className="stat souls"
        title={`${souls} de ${SOULS_TO_WIN} almas`}
        aria-label={`${souls} de ${SOULS_TO_WIN} almas`}
      >
        {repeat(Math.max(SOULS_TO_WIN, souls)).map((i) => (
          <i key={i} className={"soul" + (i < souls ? " full" : "")} />
        ))}
      </span>
      {player.curses.length > 0 && (
        <span
          className="stat cursed"
          title={"Maldiciones: " + player.curses.map((c) => c.name).join(", ")}
          aria-label={`${player.curses.length} maldiciones`}
        >
          <Skull />
          {player.curses.length > 1 && player.curses.length}
        </span>
      )}
      {player.dead && <span className="dead">†</span>}
    </span>
  );
}
