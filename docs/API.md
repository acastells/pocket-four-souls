# API local

Todas las operaciones usan `POST /api/room`, JSON y `Authorization: Bearer TOKEN`.
El navegador genera un token aleatorio de 32 bytes y lo conserva localmente. El
servidor solo almacena su hash SHA-256. El token identifica un asiento: no es una cuenta.

`GET /api/network` devuelve `{ "urls": [...] }` con las direcciones de red local por
las que otros dispositivos pueden llegar al servidor (vacío si solo escucha en
`127.0.0.1`). Solo responde con direcciones a peticiones del propio equipo; desde
fuera devuelve una lista vacía. La pantalla de espera lo usa para que el QR de invitación funcione
aunque el anfitrión haya abierto la app como `localhost`.

## Peticiones

```json
{ "op": "create", "name": "Isaac" }
```

```json
{ "op": "join", "code": "ABCDEF12", "name": "Magdalene" }
```

```json
{ "op": "get", "code": "ABCDEF12" }
```

```json
{
  "op": "action",
  "code": "ABCDEF12",
  "version": 1,
  "action": { "type": "start" }
}
```

El código tiene ocho caracteres hexadecimales mayúsculos. Los nombres aceptan 1–24
caracteres tras quitar espacios. El esquema rechaza propiedades desconocidas, acciones
debug, valores no enteros e intentos de enviar el estado completo.

Acciones admitidas: `start`, `choose`, `pass`, `resolve`, `attack`, `roll`, `buy`,
`end`, `play`, `activate`, `peekTreasure`. Que el esquema admita una acción no significa
que sea legal en ese momento. Por ejemplo, el motor rechaza `resolve` en multijugador.

Campos opcionales de una acción: `uid` (carta), `choice` (decisión), `useCharacter`
(booleano) y `ability` (índice entero). Los objetivos se eligen con las decisiones que
produce el motor, no enviando cartas inventadas.

## Respuesta

```json
{ "code": "ABCDEF12", "seat": 0, "version": 2, "state": {}, "joined": 2 }
```

`state` representa aquí, de forma abreviada, el estado privado del asiento solicitante.
No envíes este ejemplo como partida real. El contrato completo está en `RoomSnapshot`
y `Game`. La versión crece cuando cambia la sala; leer o volver a unirse al mismo
asiento no la incrementa.

Errores: `{"error":"mensaje"}` con HTTP 400 (datos/acción), 401 (token), 403
(asiento/origen), 404 (sala), 405 (método), 409 (conflicto/capacidad), 413 (más de 16 KiB),
415 (tipo de contenido), 500 (error interno) o 503 (creación agotada).

Si hay 409, recupera la sala y decide si repetir. No reenvíes a ciegas acciones de gasto.
Las respuestas llevan `Cache-Control: no-store`. No se habilita CORS. Si hay cabecera
Origin, su host y puerto deben coincidir con Host; el proxy debe preservar Host.

## Límites de acceso

Solo miembros pueden consultar una sala. El anfitrión inicia; el motor controla prioridad
y pertenencia de cartas. Cualquiera que pueda acceder al servidor puede crear una sala o
unirse a una no iniciada con huecos si conoce el código. No hay autenticación global,
rate limiting, expulsión ni caducidad automática. Para Internet, añade esos controles
fuera del proceso; consulta OPERACION.md.
