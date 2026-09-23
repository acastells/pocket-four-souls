# Desarrollo, pruebas y límites

## Comandos

| Comando                | Qué comprueba                                                 |
| ---------------------- | ------------------------------------------------------------- |
| `npm run typecheck`    | TypeScript estricto en interfaz, motor, servidor y pruebas TS |
| `npm run lint`         | ESLint y reglas de hooks; cualquier aviso falla               |
| `npm run format:check` | Formato reproducible con Prettier                             |
| `npm run format`       | Aplica ese formato                                            |
| `npm test`             | Motor, variables de efectos, servicio de salas, SQLite y HTTP |
| `npm run build`        | Bundles web y servidor                                        |
| `npm run check`        | Todos los controles anteriores                                |

Las pruebas del motor cubren límites de turno, combate acertado/fallado, muerte,
recompensas, respuestas, D6, compras, eternos, privacidad, conservación de mazos,
resolución de cartas, costes y simulaciones completas de partidas.
Las pruebas locales añaden autenticación de asiento, privilegios del anfitrión,
límite de jugadores, control de versión, persistencia tras reinicio, entrada malformada,
origen HTTP, tamaño de petición y variables anidadas de efectos.

Los tests usan estados aislados; SQLite se crea en memoria o en una carpeta temporal.
No modifican `data/rooms.sqlite`. Las simulaciones usan una semilla para repetir resultados.
La prueba de recompensa fija el siguiente monstruo para que un evento aleatorio no cambie
el número de ataques permitido y produzca falsos fallos.

## Cambiar una regla o carta

1. Consulta `card-rules.json` y el texto oficial enlazado desde `cards.json`.
2. Añade una prueba con un estado pequeño y un resultado observable: vida, monedas,
   propietario, pila, permiso o conservación de cartas.
3. Cambia la interpretación en `effects.ts`, `operations.ts` o `custom-effects.ts`.
4. Mantén los permisos en `actions.ts`; la interfaz no es una barrera de seguridad.
5. Ejecuta `npm run check`. No aceptes cambiar solo la prueba para ocultar un fallo real.

Los identificadores de variables de selección se crean con `targetSlot`. Los resultados
numéricos diferidos usan `bindN` o `bindValue`; no se fuerzan cadenas a tipos numéricos.
El intérprete rechaza ejecutar una operación con variables aún pendientes.

## Alcance real

La entrega se verifica mediante tipos, lint, formato, pruebas automatizadas, compilación
y peticiones HTTP al servidor. No equivale a una auditoría formal de todas las reglas
oficiales ni a probar todas las combinaciones de 340 cartas. No se ha realizado una
prueba visual exhaustiva en dispositivos ni una prueba de carga.

El código Android se incluye para compilarlo por separado. Esta edición no entrega una
APK nueva verificada en dispositivo. Consulta android/README.md antes de compilar.
La ausencia de errores del linter no demuestra por sí sola ausencia de defectos de diseño.

## Resultado de esta entrega

Verificado en Linux con Node.js 24.19.0:

- Instalación limpia con `npm ci` y lockfile incluido.
- TypeScript estricto, ESLint sin avisos y formato: correctos.
- 23 pruebas automatizadas: correctas.
- Compilación Vite y servidor Node: correcta.
- Prueba HTTP en desarrollo y producción: página, imagen de carta, creación de sala,
  unión de segundo jugador e inicio de partida correctos.
- Sintaxis del script Python Android comprobada; APK no recompilada en esta entrega.

No se ha ejecutado el paquete en Windows o macOS en esta verificación.
