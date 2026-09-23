# Four Souls · Pocket — código fuente local

Adaptación fan del juego base V2. Interfaz horizontal sin scroll, solitario con dos
personajes y salas online para 2–4 jugadores. Combate y efectos automatizados.
Incluye 340 imágenes y el catálogo de cartas, sin descargar recursos durante la partida.

Esta es una **edición independiente para ejecutar en tu ordenador**, derivada del
código publicado en Sites. Sustituye Cloudflare Workers/D1 por Node.js/SQLite.
No necesita cuenta de ChatGPT, Sites, Cloudflare, claves de API ni servicios de pago.
El sitio publicado no se modifica con este paquete.

## Arranque rápido

```sh
npm ci
npm run dev
```

2. Abre **http://127.0.0.1:5173**. 

## Partidas entre varios dispositivos

Copia `.env.example` como `.env` y cambia `HOST=127.0.0.1` por `HOST=0.0.0.0`.
Reinicia el servidor. Conecta los dispositivos a la misma red y abre en todos
`http://IP_DEL_ORDENADOR:5173`. Ejemplo: `http://192.168.1.40:5173`.

En cada dispositivo: Online → nombre → crear sala o introducir el código.
El anfitrión puede empezar cuando haya al menos dos jugadores. Para probarlo solo,
usa una ventana normal y otra de incógnito: dos pestañas normales comparten identidad.
Si aparece una solicitud del firewall, permite el acceso desde tu red privada.
No uses `127.0.0.1` desde el móvil: esa dirección apunta al propio móvil.

## Versión compilada

```sh
npm run build
npm start
```

Se sirve la misma interfaz y la misma API en el puerto configurado. La compilación
produce `dist/client` y `dist/server`. **El servidor sigue siendo necesario para las salas**.
Para alojar fuera de tu red, consulta [operación y despliegue](docs/OPERACION.md).

## Comprobar la calidad

```sh
npm run check
```

Ejecuta TypeScript estricto, ESLint sin avisos, comprobación de formato, pruebas
unitarias/integración y compilación. No requiere Android SDK.
Los controles no sustituyen una revisión humana de todas las combinaciones de cartas.
Véase [pruebas y límites de validación](docs/PRUEBAS.md).

## Documentación

| Documento                               | Contenido                                                      |
| --------------------------------------- | -------------------------------------------------------------- |
| [Instalación](docs/INSTALACION.md)      | Requisitos, configuración, LAN y solución de errores           |
| [Arquitectura](docs/ARQUITECTURA.md)    | Motor, interfaz, servidor, persistencia y decisiones de diseño |
| [API](docs/API.md)                      | Peticiones, respuestas, identidad, privacidad y concurrencia   |
| [Operación](docs/OPERACION.md)          | Copias de seguridad, despliegue, seguridad y actualización     |
| [Desarrollo y pruebas](docs/PRUEBAS.md) | Comandos, cobertura real y cómo añadir efectos                 |
| [Android](android/README.md)            | Herramientas, compilación, firma y configuración del servidor  |
| [Cambios](CHANGELOG.md)                 | Diferencias respecto a la edición de Sites                     |
| [Créditos](THIRD_PARTY_NOTICES.md)      | Procedencia de cartas y dependencias                           |

No se incluyen dependencias instaladas, credenciales, bases de datos de jugadores,
claves de firma, binarios APK ni el historial privado del repositorio.
