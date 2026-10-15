import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
const chapters: [title: string, points: string[]][] = [
  [
    "Cuatro almas",
    [
      "En solitario, reúne cuatro almas entre tus dos personajes antes de agotar ocho rondas.",
      "Morir durante tu turno también reduce el tiempo.",
      "Online, gana el primer jugador con cuatro almas.",
    ],
  ],
  [
    "Tu turno",
    [
      "Recarga tus cartas y roba un botín automáticamente.",
      "Dispones de una jugada de botín, una compra y un ataque, salvo efectos.",
      "Puedes activar tu personaje para jugar un botín adicional.",
    ],
  ],
  [
    "Combate",
    [
      "Declara un ataque y elige un monstruo o el mazo.",
      "Cada tirada puede dañar al monstruo o a tu personaje.",
      "Sigue tirando hasta que una muerte o un efecto termine el combate.",
    ],
  ],
  [
    "Respuestas",
    [
      "Los efectos, dados y daños pasan por la pila.",
      "Juega tus respuestas antes de pasar prioridad.",
      "En solitario, cede prioridad para responder con el otro personaje. Resolver confirma que ninguno responde.",
    ],
  ],
  [
    "Decisiones",
    [
      "Elige los objetivos que te pide el juego.",
      "Recompensas, almas, daños y penalizaciones son automáticos.",
      "Al morir, eliges qué objeto y qué botín perder.",
      "Las cartas mantienen su texto original en inglés.",
    ],
  ],
];

export function RulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mobile-dialog rules">
        <DialogTitle>Reglas</DialogTitle>
        <DialogDescription>
          Lo esencial para jugar, paso a paso.
        </DialogDescription>
        <nav className="rules-index" aria-label="Capítulos">
          {chapters.map(([title], i) => (
            <button
              key={title}
              onClick={() =>
                steps.current[i]?.scrollIntoView({ block: "start" })
              }
            >
              <b>{i + 1}</b>
              {title}
            </button>
          ))}
        </nav>
        <ol className="rules-steps">
          {chapters.map(([title, points], i) => (
            <li
              key={title}
              className="rule-step"
              ref={(el) => {
                steps.current[i] = el;
              }}
            >
              <b aria-hidden="true">{i + 1}</b>
              <div>
                <h3>{title}</h3>
                <ul>
                  {points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <footer className="rules-footer">
          <a
            href="https://foursouls.com/rules/extended-rulebook/"
            target="_blank"
            rel="noreferrer"
          >
            Reglas oficiales ↗
          </a>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
