import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
const rulesText = [
  [
    "Cuatro almas",
    "En solitario, reúne cuatro almas entre tus dos personajes antes de agotar ocho rondas. Morir durante tu turno también reduce el tiempo. Online, gana el primer jugador con cuatro almas.",
  ],
  [
    "Tu turno",
    "Recarga tus cartas y roba un botín automáticamente. Dispones de una jugada de botín, una compra y un ataque, salvo efectos. Puedes activar tu personaje para jugar un botín adicional.",
  ],
  [
    "Combate",
    "Declara un ataque y elige un monstruo o el mazo. Cada tirada puede dañar al monstruo o a tu personaje. Sigue tirando hasta que una muerte o un efecto termine el combate.",
  ],
  [
    "Respuestas",
    "Los efectos, dados y daños pasan por la pila. Juega tus respuestas antes de pasar prioridad. En solitario, cede prioridad para responder con el otro personaje. Resolver confirma que ninguno responde.",
  ],
  [
    "Decisiones",
    "Elige los objetivos que te pide el juego. Recompensas, almas, daños y penalizaciones son automáticos. Al morir, eliges qué objeto y qué botín perder. Las cartas mantienen su texto original en inglés.",
  ],
];

export function RulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rulePage, setRulePage] = useState(0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mobile-dialog rules">
        <DialogTitle>{rulesText[rulePage][0]}</DialogTitle>
        <DialogDescription>
          Reglas · {rulePage + 1} / {rulesText.length}
        </DialogDescription>
        <p>{rulesText[rulePage][1]}</p>
        <div className="pager">
          <button
            disabled={!rulePage}
            onClick={() => setRulePage((n) => n - 1)}
          >
            Anterior
          </button>
          <a
            href="https://foursouls.com/rules/extended-rulebook/"
            target="_blank"
            rel="noreferrer"
          >
            Reglas oficiales ↗
          </a>
          <button
            disabled={rulePage === rulesText.length - 1}
            onClick={() => setRulePage((n) => n + 1)}
          >
            Siguiente
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
