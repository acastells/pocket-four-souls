# Instalación y configuración

## Requisitos

- Node.js >=22.13 y npm. Comprobar con `node --version` y `npm --version`.
- Navegador actualizado con JavaScript, localStorage, ResizeObserver y structuredClone.
- Internet para `npm ci`; después, no se necesitan servicios externos para jugar en local.
- No necesitas instalar SQLite por separado: se usa `node:sqlite`, incluido en Node.
  Node 22 puede mostrar un aviso de que SQLite es experimental; no impide el arranque.

Desde la carpeta del proyecto, `npm ci` usa las versiones exactas de `package-lock.json`.
No uses `--force` o `--legacy-peer-deps` para resolver errores de instalación: conserva
el lockfile y comprueba primero la versión de Node y la conectividad.

## Variables

El servidor lee `.env` al arrancar. Las variables del proceso tienen prioridad.

| Variable        | Valor predeterminado | Uso                                                |
| --------------- | -------------------- | -------------------------------------------------- |
| `HOST`          | `127.0.0.1`          | Dirección donde escucha; `0.0.0.0` para LAN        |
| `PORT`          | `5173`               | Puerto HTTP, entre 1 y 65535                       |
| `DATABASE_PATH` | `data/rooms.sqlite`  | Archivo SQLite, relativo a la carpeta del proyecto |

Crear `.env` en PowerShell: `Copy-Item .env.example .env`.
En macOS/Linux: `cp .env.example .env`.
Las carpetas de la base de datos se crean automáticamente. No hay migraciones manuales
para esta primera versión local: el almacén crea su tabla al abrirse.

## Desarrollo y ejecución normal

- `npm run dev`: servidor Node + Vite; los cambios de interfaz se recargan.
  Reinicia el comando tras cambiar el backend o el motor importado por el servidor.
- `npm run build`: compila interfaz y servidor.
- `npm start`: sirve la compilación. Hay que volver a compilar tras cambiar el código.

Ejecuta siempre desde la raíz del proyecto. El servidor usa rutas relativas para `.env`,
`data` y `dist`. No hace falta ejecutar npm como administrador.

## Problemas habituales

| Síntoma                           | Solución                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| `npm` no se reconoce              | Instala Node y abre una terminal nueva                                    |
| No existe `node:sqlite`           | Actualiza a Node >=22.13                                                  |
| `EADDRINUSE`                      | Cambia `PORT` en `.env` o para el proceso que ocupa el puerto             |
| El móvil no conecta               | Usa la IP LAN, `HOST=0.0.0.0`, misma red y permiso de firewall            |
| Dos pestañas son el mismo jugador | Usa incógnito, otro perfil o dispositivo                                  |
| Partida guardada incompatible     | Crea otra partida; no hay migración desde estados antiguos de Sites       |
| No se puede guardar el solitario  | Permite almacenamiento local o usa un perfil normal; se avisa en pantalla |
| `npm start` devuelve errores/404  | Ejecuta `npm run build` antes y comprueba que estás en la raíz            |
| Falta una carta                   | Comprueba que el ZIP incluyó `public/cards`; vuelve a compilar            |
| Conflicto de versión de la sala   | Espera a la siguiente actualización y repite la acción                    |

Solitario y token de jugador se guardan por origen del navegador. Cambiar de puerto,
host o protocolo crea un origen distinto: no compartirá automáticamente esos datos.
