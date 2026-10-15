# Arquitectura

## Estructura

- `mobile/`: aplicación React web; el nombre viene de su origen móvil.
- `mobile/hooks/useGameSession.ts`: estado de sesión, exclusión de acciones en curso,
  sondeo cancelable sin peticiones solapadas, guardado y recuperación.
- `mobile/services/session.ts`: transporte HTTP, identidad del dispositivo y almacenamiento.
- `mobile/components/`: cartas, paginación, modal de carta y reglas.
- `components/ui/dialog.tsx`: composición de Radix para foco, teclado y accesibilidad.
- `lib/game.ts`: API pública del motor; no contiene transporte ni persistencia.
- `lib/engine.ts`: estado, turnos, pila, daño, muerte, recompensas y coordinación.
- `lib/operations.ts`: intérprete de operaciones elementales.
- `lib/custom-effects.ts`: resolución de efectos particulares de cartas.
- `lib/actions.ts`: creación, validación de acciones, vistas privadas y consultas.
- `lib/effects.ts`: habilidades, pasivos, disparadores y traducción de cartas a operaciones.
- `lib/operation-arguments.ts`: argumentos tipados y sustitución de variables de efectos.
- `lib/game-types.ts`, `rules.ts`, `game-helpers.ts`: contratos y funciones compartidas.
- `lib/cards.json`, `card-rules.json`: catálogo y reglas normalizadas.
- `server/contracts.ts`: validación Zod de las peticiones y tipos de sala.
- `server/room-service.ts`: casos de uso y autorización de asientos.
- `server/room-store.ts`: SQLite y escritura condicional por versión.
- `server/http.ts`, `static.ts`, `main.ts`: HTTP, recursos estáticos y arranque.

## Flujo

En solitario, React llama a `act(estado, acción, asiento)` y guarda el resultado
localmente. `act` clona el estado antes de resolver: una acción rechazada no debe mutar
la entrada. El objeto `Engine` sí modifica su copia de trabajo de forma intencional.

En multijugador, el navegador envía solo una intención. Node valida el JSON, identifica
el asiento con el hash del token, carga el estado, ejecuta el mismo motor y guarda una
nueva versión. El cliente recibe `redact(estado, asiento)`, que oculta manos ajenas,
orden de mazos y elecciones privadas. La UI desactiva controles por comodidad;
la autoridad de reglas está en el motor del servidor.

Los efectos generan operaciones y decisiones explícitas. Una selección liga un objetivo;
una tirada liga un número. Las variables sin resolver se representan con campos tipados,
y el intérprete rechaza ejecutarlas. Las selecciones anidadas mantienen su propio ámbito.

## Decisiones

- HTTP con sondeo cada 1,5 segundos: suficiente para turnos, sin infraestructura WebSocket.
- SQLite integrado: una base por instalación y un solo proceso recomendado para esta edición.
- `UPDATE ... WHERE version=?`: evita sobrescribir una acción con estado obsoleto.
- React/TypeScript compartidos: no hay otro motor reimplementado en Java.
- Radix gestiona los modales; CSS fija el viewport y la paginación evita scroll.
- TypeScript estricto, sin `any` explícitos; contratos de entrada validados en ejecución.
- Un intérprete explícito centraliza las reglas; añadir una carta implica editar su
  comportamiento y sus pruebas, no añadir controles que alteren contadores directamente.

Las funciones usan `Math.random` para barajar y tirar, como en el código de origen.
Es un juego casual: no incorpora aleatoriedad auditable ni mecanismos para apuestas.

## Persistencia

SQLite almacena `code`, JSON del estado, hashes de asientos, versión y fecha de actualización.
Está en modo WAL. Solitario y token viven en localStorage (`fs-save`, `fs-token`).
No hay cuentas, contraseñas, recuperación de identidad, chat ni sincronización del solitario.
