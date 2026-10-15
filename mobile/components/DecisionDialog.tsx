import { useState } from "react";
import { ArrowRight, Check, Minimize2, ZoomIn, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import type { Choice, Prompt } from "../../lib/game-types";
import { image } from "../services/images";

/**
 * A pending engine decision. Card options are chosen in two steps (select,
 * then confirm) so they can be inspected first; text-only prompts choose on
 * click. Minimizing hides the dialog without answering it.
 */
export function DecisionDialog({
  prompt,
  chooserName,
  open,
  busy,
  onChoose,
  onMinimize,
}: {
  prompt: Prompt;
  chooserName: string;
  open: boolean;
  busy: boolean;
  onChoose: (choice: Choice) => void;
  onMinimize: () => void;
}) {
  const [selected, setSelected] = useState<Choice | null>(null);
  const [hovered, setHovered] = useState<Choice | null>(null);
  const [zoom, setZoom] = useState(false);
  const cardOptions = prompt.options.filter((o) => o.card);
  const textOptions = prompt.options.filter((o) => !o.card);
  const confirmMode = cardOptions.length > 0;
  const focus = hovered?.card ? hovered : selected?.card ? selected : null;
  const preview = focus ?? cardOptions[0] ?? null;
  const pick = (o: Choice) => (confirmMode ? setSelected(o) : onChoose(o));
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onMinimize()}>
      <DialogContent
        className={
          "mobile-dialog decision" + (confirmMode ? " with-cards" : "")
        }
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (!zoom) return;
          e.preventDefault();
          setZoom(false);
        }}
      >
        <header className="decision-head">
          <div>
            <DialogTitle>{prompt.title}</DialogTitle>
            <DialogDescription>
              {chooserName} · {prompt.options.length}{" "}
              {prompt.options.length === 1 ? "opción" : "opciones"}
            </DialogDescription>
          </div>
          <button
            className="ghost"
            onClick={onMinimize}
            title="Oculta la decisión para mirar la mesa"
          >
            <Minimize2 size={15} /> Ver tablero
          </button>
        </header>
        <div className="decision-body">
          <div className="decision-options">
            {cardOptions.length > 0 && (
              <div className="option-grid">
                {cardOptions.map((o) => (
                  <div
                    key={o.id}
                    className={
                      "option-card" + (selected?.id === o.id ? " selected" : "")
                    }
                    onMouseEnter={() => setHovered(o)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <button
                      className="option-pick"
                      disabled={busy}
                      aria-pressed={selected?.id === o.id}
                      onClick={() => pick(o)}
                      onDoubleClick={() => onChoose(o)}
                    >
                      <img src={image(o.card!)} alt={o.card!.name} />
                      <span>{o.label}</span>
                    </button>
                    <button
                      className="option-zoom"
                      aria-label={"Ampliar " + o.card!.name}
                      onClick={() => {
                        setSelected(o);
                        setZoom(true);
                      }}
                    >
                      <ZoomIn size={14} />
                    </button>
                    {selected?.id === o.id && (
                      <Check className="option-check" size={16} />
                    )}
                  </div>
                ))}
              </div>
            )}
            {textOptions.length > 0 && (
              <div className="option-list">
                {textOptions.map((o) => (
                  <button
                    key={o.id}
                    className={
                      "choice" + (selected?.id === o.id ? " selected" : "")
                    }
                    disabled={busy}
                    aria-pressed={selected?.id === o.id}
                    onClick={() => pick(o)}
                  >
                    <span>{o.label}</span>
                    {confirmMode ? (
                      selected?.id === o.id && <Check size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {preview?.card && (
            <aside className="decision-preview">
              <button
                className="preview-image"
                aria-label={"Ampliar " + preview.card.name}
                onClick={() => setZoom(true)}
              >
                <img key={preview.id} src={image(preview.card)} alt="" />
              </button>
              <strong>{preview.card.name}</strong>
              <div className="preview-links">
                <button className="ghost" onClick={() => setZoom(true)}>
                  <ZoomIn size={14} /> Ampliar
                </button>
                <a href={preview.card.url} target="_blank" rel="noreferrer">
                  Texto y aclaraciones ↗
                </a>
              </div>
            </aside>
          )}
        </div>
        {confirmMode && (
          <footer className="decision-foot">
            <span>
              {selected
                ? selected.label
                : "Selecciona una opción para continuar"}
            </span>
            <button
              className="primary"
              disabled={busy || !selected}
              onClick={() => selected && onChoose(selected)}
            >
              Confirmar <ArrowRight size={16} />
            </button>
          </footer>
        )}
        {zoom && preview?.card && (
          <div className="card-zoom" onClick={() => setZoom(false)}>
            <img src={image(preview.card)} alt={preview.card.name} />
            <button aria-label="Cerrar ampliación">
              <X size={18} />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
