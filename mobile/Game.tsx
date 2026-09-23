"use client";
import { useState } from "react";
import { RulesDialog } from "./components/RulesDialog";
import { CardDialog } from "./components/CardDialog";
import { useGameSession } from "./hooks/useGameSession";
import { Cards } from "./components/Cards";
import { Pages } from "./components/Pages";
import { image } from "./services/images";
import { BookOpen, ArrowRight, Heart, Coins, Gem, Dices } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, Action, soulCount } from "@/lib/game";
export default function Home({ native = false }: { native?: boolean }) {
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
  const [rules, setRules] = useState(false),
    [selected, setSelected] = useState<{ card: Card; from: string } | null>(
      null,
    ),
    [inspect, setInspect] = useState<number | null>(null),
    [tab, setTab] = useState("table");
  const [collection, setCollection] = useState("items");
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
  const top = game?.stack.at(-1),
    fighting = game?.monsters.find((c) => c.uid === game.combat?.uid);
  const availableNormal =
    !!game &&
    ((activeSeat === game.turn &&
      game.phase === "action" &&
      game.lootPlays > 0) ||
      game.bonusPlays[activeSeat] > 0);
  const showCard = (card: Card, from: string) => {
    if (card.id !== "hidden") setSelected({ card, from });
  };
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
          FOUR SOULS <small>POCKET</small>
        </button>
        <span>
          {screen === "game" && game
            ? game.mode === "solo"
              ? `${game.timer} rondas restantes`
              : `Sala ${room}`
            : "BASE V2 · FAN NO OFICIAL"}
        </span>
        <button aria-label="Reglas" onClick={() => setRules(true)}>
          <BookOpen size={18} />
        </button>
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
            <small>Combate y efectos automáticos.</small>
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
            {mode === "solo" ? (
              <>
                <p>Dos personajes. Cuatro almas. Ocho rondas.</p>
                <button className="primary" onClick={start}>
                  Nueva partida <ArrowRight size={18} />
                </button>
                {resume && (
                  <button onClick={resumeSolo}>Continuar partida</button>
                )}
                <small>
                  Guardado automático
                  {native ? " · disponible sin conexión" : ""}.
                </small>
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
                        {p.character.name}
                        {i === activeSeat ? " · TÚ" : ""}
                      </strong>
                      <span>
                        <Heart />
                        {p.hp} <Coins />
                        {p.coins} <Gem />
                        {soulCount(p)}/4 {p.dead ? "†" : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <section className="table">
                <nav className="tabs">
                  {[
                    ["table", "Mesa"],
                    ["inventory", "Objetos"],
                    ["other", "Colecciones"],
                    ["history", "Registro"],
                    ["stack", `Pila (${game.stack.length})`],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={tab === id ? "active" : ""}
                      onClick={() => setTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="table-content">
                  {tab === "table" ? (
                    <div className="board">
                      <section>
                        <h3>
                          Monstruos{" "}
                          <small>{game.decks.monster.length} en mazo</small>
                        </h3>
                        {cardRow(game.monsters, "monsters")}
                      </section>
                      <section>
                        <h3>
                          Tienda <small>{game.purchases} compra</small>
                        </h3>
                        {cardRow(game.shop, "shop")}
                      </section>
                    </div>
                  ) : tab === "inventory" ? (
                    <section className="collection">
                      <h3>Objetos de {player.character.name}</h3>
                      {cardRow(player.items, "items")}
                    </section>
                  ) : tab === "other" ? (
                    <section className="collection">
                      <nav className="collection-nav">
                        {[
                          ["items", "Almas extra"],
                          ["souls", "Tus almas"],
                          ["curses", "Maldiciones"],
                          ["loot", "Descarte botín"],
                          ["monster", "Descarte monstruos"],
                          ["treasure", "Descarte tesoros"],
                        ].map(([id, label]) => (
                          <button
                            className={collection === id ? "active" : ""}
                            key={id}
                            onClick={() => setCollection(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </nav>
                      {cardRow(
                        collection === "items"
                          ? game.bonus
                          : collection === "souls"
                            ? player.souls
                            : collection === "curses"
                              ? player.curses
                              : game.discard[collection] || [],
                        "collection-" + collection,
                      )}
                    </section>
                  ) : tab === "history" ? (
                    <Pages
                      items={game.log}
                      size={3}
                      render={(l) => <p className="log-line">{l}</p>}
                    />
                  ) : (
                    <Pages
                      items={[...game.stack].reverse()}
                      size={3}
                      render={(c, i) => (
                        <p className="log-line">
                          <strong>
                            {i === 0 ? "Siguiente · " : ""}
                            {c.name}
                          </strong>
                          {c.kind === "roll" ? ` · dado ${c.value}` : ""}
                        </p>
                      )}
                      empty="La pila está vacía."
                    />
                  )}
                </div>
              </section>
              <aside className="actions">
                <div className="turn">
                  <small>RONDA {game.round} · TURNO</small>
                  <strong>{game.players[game.turn].character.name}</strong>
                </div>
                <div className="die">
                  <Dices />
                  <b>{game.die}</b>
                  <span>{fighting ? fighting.name : "Último dado"}</span>
                </div>
                <div className="priority">
                  <strong>
                    {game.prompt
                      ? "Elige para continuar"
                      : top
                        ? top.name
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
                          disabled={
                            busy ||
                            !canMain ||
                            (game.attacks <= 0 &&
                              !game.flags.optionalDeck &&
                              !player.items.some(
                                (c) =>
                                  c.name === "Bum-Bo!" &&
                                  (c.counters || 0) >= 25,
                              ))
                          }
                          onClick={() => action({ type: "attack" })}
                        >
                          Atacar
                        </button>
                        <button
                          disabled={busy || !canMain || game.purchases <= 0}
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
                  {!game.prompt && (
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
                <h3>
                  Mano · {player.character.name}{" "}
                  <small>
                    {player.hand.length} cartas ·{" "}
                    {player.tapped
                      ? "personaje agotado"
                      : "personaje disponible"}{" "}
                    · {activeSeat === game.turn ? game.lootPlays : 0}+
                    {game.bonusPlays[activeSeat]} jugadas
                  </small>
                </h3>
                {cardRow(player.hand, "hand")}
              </section>
            </section>
          )}
        </>
      ) : null}
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
      <CardDialog
        {...{
          selected,
          setSelected,
          game,
          player,
          activeSeat,
          busy,
          canMain,
          availableNormal,
          action,
        }}
      />
      <Dialog
        open={
          !!game?.prompt &&
          !game?.winner &&
          (game.mode === "solo" || game.prompt.player === seat)
        }
        onOpenChange={() => {}}
      >
        <DialogContent
          className="mobile-dialog decision"
          showCloseButton={false}
        >
          <DialogTitle>{game?.prompt?.title}</DialogTitle>
          <DialogDescription>
            {game?.prompt && game.players[game.prompt.player].name} · elige para
            continuar
          </DialogDescription>
          <Pages
            key={game?.prompt?.id}
            items={game?.prompt?.options || []}
            size={3}
            render={(o) => (
              <button
                className="choice"
                disabled={busy}
                onClick={() => action({ type: "choose", choice: o.id })}
              >
                {o.card && <img src={image(o.card)} alt="" />}
                <span>{o.label}</span>
                <ArrowRight size={18} />
              </button>
            )}
          />
        </DialogContent>
      </Dialog>
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
