import type { Action, Card, Game, Player } from "../../lib/game-types";
import { cardAbilities, cardBlock, isMonster, isEternal } from "../../lib/game";
import { image } from "../services/images";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
export type CardSelection = { card: Card; from: string };
interface Props {
  selected: CardSelection | null;
  setSelected: (selection: CardSelection | null) => void;
  game: Game | null;
  player: Player | undefined;
  activeSeat: number;
  busy: boolean;
  canMain: boolean;
  availableNormal: boolean;
  action: (action: Action) => void;
}
export function CardDialog({
  selected,
  setSelected,
  game,
  player,
  activeSeat,
  busy,
  canMain,
  availableNormal,
  action,
}: Props) {
  return (
    <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
      <DialogContent className="mobile-dialog card-detail">
        <DialogTitle>{selected?.card.name}</DialogTitle>
        <DialogDescription>
          {selected && isEternal(selected.card)
            ? "Objeto eterno"
            : "Carta del juego base"}
        </DialogDescription>
        {selected && (
          <div className="detail-body">
            <img
              className="large-card"
              src={image(selected.card)}
              alt={selected.card.name}
            />
            <div className="card-actions">
              {game && selected.from === "hand" && (
                <>
                  <p>
                    {cardBlock(game, activeSeat, selected.card, "hand") ||
                      "Juega ahora o cierra la carta para esperar."}
                  </p>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !availableNormal ||
                      !!cardBlock(game, activeSeat, selected.card, "hand")
                    }
                    onClick={() =>
                      action({ type: "play", uid: selected.card.uid })
                    }
                  >
                    Jugar botín
                  </button>
                  <button
                    disabled={
                      busy ||
                      player?.tapped ||
                      !!cardBlock(game, activeSeat, selected.card, "hand")
                    }
                    onClick={() =>
                      action({
                        type: "play",
                        uid: selected.card.uid,
                        useCharacter: true,
                      })
                    }
                  >
                    Activar personaje y jugar
                  </button>
                </>
              )}
              {game && selected.from === "items" && (
                <>
                  {cardAbilities(selected.card).map((a, i) => (
                    <div key={i}>
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          !!cardBlock(
                            game,
                            activeSeat,
                            selected.card,
                            "items",
                            i,
                          )
                        }
                        onClick={() =>
                          action({
                            type: "activate",
                            uid: selected.card.uid,
                            ability: i,
                          })
                        }
                      >
                        {a.label}
                      </button>
                      <small>
                        {cardBlock(game, activeSeat, selected.card, "items", i)}
                      </small>
                    </div>
                  ))}
                  {!cardAbilities(selected.card).length && (
                    <p>Efecto pasivo · se aplica automáticamente.</p>
                  )}
                  {selected.card.id === "b2-theres_options" && (
                    <button
                      disabled={busy || activeSeat !== game.turn}
                      onClick={() => action({ type: "peekTreasure" })}
                    >
                      Mirar tesoro superior
                    </button>
                  )}
                </>
              )}
              {selected.from === "monsters" && isMonster(selected.card) && (
                <button
                  className="primary"
                  disabled={busy || !canMain}
                  onClick={() => action({ type: "attack" })}
                >
                  Declarar ataque
                </button>
              )}
              {selected.from === "shop" && (
                <button
                  className="primary"
                  disabled={busy || !canMain}
                  onClick={() => action({ type: "buy" })}
                >
                  Declarar compra
                </button>
              )}
              <a href={selected.card.url} target="_blank" rel="noreferrer">
                Texto y aclaraciones ↗
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
