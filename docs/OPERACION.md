# Operación y despliegue

## Datos y copias

Para una copia sencilla consistente: detén el servidor con Ctrl+C y copia todo `data/`
(o el directorio configurado). SQLite puede usar archivos `-wal` y `-shm`; no copies
solo el archivo principal mientras hay escrituras. Para restaurar, detén el proceso,
reemplaza el directorio y reinicia con la misma versión de código.

El solitario no está en SQLite. Vive en el navegador de cada jugador. Borrar datos
del sitio elimina su partida y token. Sin el token original no hay una función de
recuperación de asiento. Las salas tampoco se comparten entre instalaciones distintas.

No se exporta ninguna base del sitio de Sites. Esta edición crea una base vacía.
Para reiniciar todas las salas, detén el servidor y mueve `data/` a una copia aparte.

## Servidor propio

1. Instala Node y copia el proyecto con sus cartas.
2. Ejecuta `npm ci`, `npm run check` y `npm run build`.
3. Configura `.env`, manteniendo `HOST=127.0.0.1` si usas un proxy en la misma máquina.
4. Ejecuta `npm start` desde la carpeta del proyecto, con un supervisor que reinicie el
   proceso y establezca ese directorio de trabajo.
5. Publica mediante un proxy HTTPS con certificado válido. Envía interfaz y `/api/room`
   al mismo proceso. Preserva Host; no almacenes respuestas de `/api/room` en caché.
6. Conserva una ubicación persistente y escribible para SQLite y programa copias.

El servidor HTTP de desarrollo no es un despliegue público. La edición local carece
del control privado de acceso que aportaba Sites. Antes de exponerla a Internet,
protege el acceso (por ejemplo, red privada/VPN o control de acceso en el proxy),
limita peticiones y vigila tamaño de la base y uso de CPU. No se ha hecho una prueba de carga.
Usa un proceso; el JSON completo del estado se lee y escribe en cada acción.

## Actualizaciones

Guarda una copia de datos y código antes de actualizar. Instala con `npm ci`, ejecuta
las comprobaciones y compila. No cambies manualmente `rulesVersion` para forzar la carga
de una partida incompatible. No existe un migrador genérico de estados de juego.

`package-lock.json` permite repetir la instalación. Actualizar dependencias requiere
revisar sus notas, regenerar el lockfile y ejecutar las pruebas. El paquete no incluye
un servicio automático de actualizaciones ni telemetría.
