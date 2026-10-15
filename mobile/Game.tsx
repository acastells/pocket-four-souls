"use client";
import { useState } from "react";
import { RulesDialog } from "./components/RulesDialog";
import { CardDialog } from "./components/CardDialog";
import { useGameSession } from "./hooks/useGameSession";
import { useHandDraws } from "./hooks/useHandDraws";
import { useLastPlay } from "./hooks/useLastPlay";
import { Cards } from "./components/Cards";
import { PlayerStats } from "./components/PlayerStats";
import { TablePanels, type Panel } from "./components/TablePanels";
import { DecisionDialog } from "./components/DecisionDialog";
import { image } from "./services/images";
import {
  BookOpen,
  ArrowRight,
  Dices,
  Library,
  ScrollText,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, Action, cardAbilities, cardBlock, key } from "@/lib/game";
export default function Home() {
  const {
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
  } = useGameSession();
  const { fresh, notice } = useHandDraws(game, room, seat);
  const lastPlay = useLastPlay(game);
  const [rules, setRules] = useState(false),
    [selected, setSelected] = useState<{ card: Card; from: string } | null>(
      null,
    ),
    [inspect, setInspect] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  // Id of a decision the player minimized to look at the board.
  const [hiddenPrompt, setHiddenPrompt] = useState<string | null>(null);
  const player = game?.players[activeSeat];
  function action(action: Action) {
    setSelected(null);
    void dispatch(action);
  }
  const canMain =
    !!game &&
    game.started &&
    !game.winner &&
    !game.prompt &&
    !game.stack.length &&
    !game.combat &&
    activeSeat === game.turn &&
    activeSeat === game.priority &&
    !player?.dead &&
    game.phase === "action";
  const myPrompt =
    game?.prompt &&
    !game.winner &&
    (game.mode === "solo" || game.prompt.player === seat)
      ? game.prompt
      : null;
  const promptHidden = !!myPrompt && hiddenPrompt === myPrompt.id;
  // Mirrors the engine's checks so exhausted actions show as disabled.
  const canAttack =
    canMain &&
    (game.attacks > 0 ||
      !!game.flags.optionalDeck ||
      !!player?.items.some(
        (c) => key(c) === "bum_bo" && (c.counters || 0) >= 25,
      ));
  const canBuy = canMain && game.purchases > 0;
  const top = game?.stack.at(-1),
    fighting = game?.monsters.find((c) => c.uid === game.combat?.uid);
  // The card shown in the play zone: what is resolving now, or the last play.
  const liveCard = top && top.kind !== "roll" ? top.sourceCard : undefined;
  const shownPlay = top ? liveCard : lastPlay?.sourceCard;
  const ownerName = (owner: number) =>
    game?.players[owner]?.character.name ?? "";
  const availableNormal =
    !!game &&
    ((activeSeat === game.turn &&
      game.phase === "action" &&
      game.lootPlays > 0) ||
      game.bonusPlays[activeSeat] > 0);
  const showCard = (card: Card, from: string) => {
    if (card.id !== "hidden") setSelected({ card, from });
  };
  const canPlayFromHand = (card: Card) =>
    !!game &&
    !!player &&
    (availableNormal || !player.tapped) &&
    !cardBlock(game, activeSeat, card, "hand");
  // Passive items stay lit; items whose abilities are all blocked are dimmed.
  const canUseItem = (card: Card) =>
    !game ||
    cardAbilities(card).length === 0 ||
    cardAbilities(card).some(
      (_, i) => !cardBlock(game, activeSeat, card, "items", i),
    );
  // Spending the character is never implicit: without a loot play left, a
  // dropped card opens its dialog so the player chooses explicitly.
  const playFromHand = (card: Card) =>
    availableNormal
      ? action({ type: "play", uid: card.uid })
      : showCard(card, "hand");
  const cardRow = (list: Card[], from: string) => (
    <Cards
      key={from}
      cards={list}
      game={game}
      onSelect={(c) => showCard(c, from)}
    />
  );
  return (
    <main className="pocket">
      <header className="toolbar">
        <button onClick={() => setScreen("home")} className="wordmark">
          <img className="logo" src="/favicon.svg" alt="" />
          FOUR SOULS <small>POCKET</small>
        </button>
        <span>
          {screen === "game" && game
            ? game.mode === "solo"
              ? `${game.timer} rondas restantes`
              : `Sala ${room}`
            : ""}
        </span>
        <nav className="toolbar-menu" aria-label="Información de la partida">
          {screen === "game" && game?.started && (
            <>
              <button
                aria-label="Colecciones"
                onClick={() => setPanel("collections")}
              >
                <Library size={16} />
                <span>Colecciones</span>
              </button>
              <button aria-label="Registro" onClick={() => setPanel("log")}>
                <ScrollText size={16} />
                <span>Registro</span>
              </button>
              <button
                className={game.stack.length ? "has-stack" : ""}
                aria-label="Pila"
                onClick={() => setPanel("stack")}
              >
                <Layers size={16} />
                <span>Pila</span>
                <b className="badge">{game.stack.length}</b>
              </button>
            </>
          )}
          <button aria-label="Reglas" onClick={() => setRules(true)}>
            <BookOpen size={16} />
            <span>Reglas</span>
          </button>
        </nav>
      </header>
      {screen === "home" ? (
        <section className="home">
          <div className="home-art">
            <img src={image({ id: "b2-isaac" })} alt="Isaac" />
            <h1>
              El sótano
              <br />
              te espera.
            </h1>
          </div>
          <div className="home-controls">
            <nav>
              <button
                className={mode === "solo" ? "active" : ""}
                onClick={() => setMode("solo")}
              >
                Solitario
              </button>
              <button
                className={mode === "online" ? "active" : ""}
                onClick={() => setMode("online")}
              >
                Online · 2–4
              </button>
            </nav>
            {game && (
              <button className="primary" onClick={() => setScreen("game")}>
                Volver a la partida <ArrowRight size={18} />
              </button>
            )}
            {mode === "solo" ? (
              <>
                <p>Dos personajes. Cuatro almas. Ocho rondas.</p>
                <button className="primary" onClick={start}>
                  Nueva partida <ArrowRight size={18} />
                </button>
                {resume && game?.mode !== "solo" && (
                  <button onClick={resumeSolo}>Continuar partida</button>
                )}
              </>
            ) : (
              <>
                <div className="login-line">
                  <small>Conecta los dispositivos al mismo servidor.</small>
                </div>
                <input
                  aria-label="Tu nombre"
                  placeholder="Tu nombre"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => online("create")}
                >
                  Crear sala
                </button>
                <div className="join-row">
                  <input
                    aria-label="Código de sala"
                    placeholder="CÓDIGO DE SALA"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  <button
                    disabled={busy || code.length !== 8}
                    onClick={() => online("join")}
                  >
                    Unirme
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : game && player ? (
        <>
          {!game.started ? (
            <section className="waiting">
              <h1>Sala {room}</h1>
              <p>{joined} de 4 jugadores · comparte el código</p>
              {seat === 0 ? (
                <button
                  className="primary"
                  disabled={busy || joined < 2}
                  onClick={() => action({ type: "start" })}
                >
                  Empezar partida
                </button>
              ) : (
                <p>Esperando al anfitrión…</p>
              )}
              <small>
                Comparte la dirección del servidor y el código de sala.
              </small>
            </section>
          ) : (
            <section className="play">
              <div className="players">
                {game.players.map((p, i) => (
                  <button
                    className={
                      "player " +
                      (i === game.turn ? "current " : "") +
                      (i === activeSeat ? "controlled" : "")
                    }
                    onClick={() => setInspect(i)}
                    key={i}
                  >
                    <img src={image(p.character)} alt="" />
                    <div>
                      <strong>
                        <span className="player-name">{p.character.name}</span>
                        {i === activeSeat && <em className="you">TÚ</em>}
                      </strong>
                      <PlayerStats player={p} />
                    </div>
                  </button>
                ))}
              </div>
              <section className="table board">
                <section>
                  <h3>Monstruos</h3>
                  {cardRow(game.monsters, "monsters")}
                </section>
                <section>
                  <h3>Tienda</h3>
                  {cardRow(game.shop, "shop")}
                </section>
              </section>
              <aside className="actions" data-card-drop="">
                <div className="turn">
                  <small>RONDA {game.round} · TURNO</small>
                  <strong>{game.players[game.turn].character.name}</strong>
                </div>
                {game.die > 0 && (
                  <div className="die">
                    <Dices />
                    <b key={game.die}>{game.die}</b>
                    <span>{fighting ? fighting.name : "Último dado"}</span>
                  </div>
                )}
                <div
                  className="priority"
                  key={(top?.uid ?? "") + (game.prompt?.id ?? "")}
                >
                  {shownPlay && (
                    <>
                      <small className="play-caption">
                        {top
                          ? "En la pila · " + ownerName(top.owner)
                          : "Última jugada · " +
                            ownerName(lastPlay?.owner ?? 0)}
                      </small>
                      <img
                        className={"play-card" + (top ? "" : " past")}
                        src={image(shownPlay)}
                        alt={shownPlay.name}
                        onClick={() => showCard(shownPlay, "stack")}
                      />
                    </>
                  )}
                  <strong>
                    {game.prompt
                      ? "Elige para continuar"
                      : top
                        ? liveCard
                          ? game.stack.length > 1
                            ? `${game.stack.length} efectos en la pila`
                            : "Esperando respuestas"
                          : top.name
                        : fighting
                          ? "En combate"
                          : "Tu próxima acción"}
                  </strong>
                  <small>
                    {game.priority === activeSeat
                      ? "Tienes prioridad"
                      : game.players[game.priority].name + " tiene prioridad"}
                  </small>
                </div>
                <div className="action-buttons">
                  {promptHidden && (
                    <button
                      className="primary resume-decision"
                      onClick={() => setHiddenPrompt(null)}
                    >
                      Volver a decidir
                      <small>{myPrompt?.title}</small>
                    </button>
                  )}
                  {!game.prompt &&
                    (game.stack.length > 0 ? (
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          (game.mode === "online" && game.priority !== seat)
                        }
                        onClick={() =>
                          action({
                            type: game.mode === "solo" ? "resolve" : "pass",
                          })
                        }
                      >
                        {game.mode === "solo"
                          ? "Resolver"
                          : `Pasar (${game.passes}/${game.players.length})`}
                      </button>
                    ) : fighting ? (
                      <button
                        className="primary"
                        disabled={busy || activeSeat !== game.combat?.owner}
                        onClick={() => action({ type: "roll" })}
                      >
                        Tirar ataque
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={busy || !canAttack}
                          title={
                            canMain && !canAttack
                              ? "Ya has usado tus ataques este turno"
                              : undefined
                          }
                          onClick={() => action({ type: "attack" })}
                        >
                          Atacar
                        </button>
                        <button
                          disabled={busy || !canBuy}
                          title={
                            canMain && !canBuy
                              ? "Ya has usado tu compra este turno"
                              : undefined
                          }
                          onClick={() => action({ type: "buy" })}
                        >
                          Comprar
                        </button>
                        <button
                          className="primary"
                          disabled={busy || !canMain}
                          onClick={() => action({ type: "end" })}
                        >
                          Terminar turno
                        </button>
                      </>
                    ))}
                  {!game.prompt &&
                    !(game.mode === "online" && game.stack.length > 0) && (
                      <button
                        disabled={busy || game.priority !== activeSeat}
                        onClick={() => action({ type: "pass" })}
                      >
                        Ceder prioridad
                      </button>
                    )}
                </div>
              </aside>
              <section className="hand">
                <div
                  className="hand-group items"
                  style={{ flexGrow: Math.max(1, player.items.length) }}
                >
                  <small className="group-label">Objetos</small>
                  <Cards
                    key="items"
                    cards={player.items}
                    game={game}
                    onSelect={(c) => showCard(c, "items")}
                    playable={canUseItem}
                  />
                </div>
                <div
                  className="hand-group"
                  style={{ flexGrow: Math.max(2, player.hand.length) }}
                >
                  <div className="hand-status">
                    <span className={player.tapped ? "chip off" : "chip"}>
                      {player.tapped ? "Personaje agotado" : "Personaje listo"}
                    </span>
                    <span className="chip">
                      Jugadas{" "}
                      {(activeSeat === game.turn ? game.lootPlays : 0) +
                        game.bonusPlays[activeSeat]}
                    </span>
                  </div>
                  <Cards
                    key="hand"
                    cards={player.hand}
                    game={game}
                    onSelect={(c) => showCard(c, "hand")}
                    playable={canPlayFromHand}
                    fresh={fresh}
                    onDrop={busy ? undefined : playFromHand}
                  />
                </div>
              </section>
            </section>
          )}
        </>
      ) : null}
      {notice && (
        <div className="notice" key={notice.id} role="status">
          {notice.cards.map((c) => (
            <img key={c.uid} src={image(c)} alt="" />
          ))}
          <span>{notice.text}</span>
        </div>
      )}
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button aria-label="Cerrar aviso" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      <Dialog
        open={inspect !== null}
        onOpenChange={(v) => !v && setInspect(null)}
      >
        <DialogContent className="mobile-dialog">
          <DialogTitle>
            {inspect !== null && game?.players[inspect].name}
          </DialogTitle>
          <DialogDescription>
            Personaje, objetos, maldiciones y almas.
          </DialogDescription>
          {inspect !== null &&
            game &&
            cardRow(
              [
                game.players[inspect].character,
                ...game.players[inspect].items,
                ...game.players[inspect].curses,
                ...game.players[inspect].souls,
              ],
              "inspect",
            )}
        </DialogContent>
      </Dialog>
      <RulesDialog open={rules} onOpenChange={setRules} />
      {game && player && (
        <TablePanels
          panel={panel}
          onClose={() => setPanel(null)}
          game={game}
          player={player}
          cardRow={cardRow}
        />
      )}
      <CardDialog
        {...{
          selected,
          setSelected,
          game,
          player,
          activeSeat,
          busy,
          canAttack,
          canBuy,
          availableNormal,
          action,
        }}
      />
      {game && myPrompt && (
        <DecisionDialog
          key={myPrompt.id}
          prompt={myPrompt}
          chooserName={game.players[myPrompt.player].character.name}
          open={!promptHidden}
          busy={busy}
          onChoose={(o) => action({ type: "choose", choice: o.id })}
          onMinimize={() => setHiddenPrompt(myPrompt.id)}
        />
      )}
      <Dialog open={!!game?.winner} onOpenChange={() => {}}>
        <DialogContent className="mobile-dialog" showCloseButton={false}>
          <DialogTitle>{game?.winner}</DialogTitle>
          <DialogDescription>El sótano espera una revancha.</DialogDescription>
          <button className="primary" onClick={reset}>
            Volver al inicio
          </button>
        </DialogContent>
      </Dialog>
      <div className="rotate-message">
        Gira el dispositivo para jugar en horizontal.
      </div>
    </main>
  );
}
