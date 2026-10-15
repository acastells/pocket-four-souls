# Cambios de la edición local 1.0

Origen: revisión `d112a5faad9d53b241fd1416b38a65048fdc373c` del proyecto Four Souls Pocket.

- Sustituidos Vinext, Workers, D1 y configuración de Sites por Vite, Node HTTP y SQLite.
- Eliminadas dependencias y componentes del starter que esta aplicación no usa.
- Separados presentación, sesión, transporte, contratos, casos de uso y persistencia.
- Separados API pública del motor, coordinación, acciones, operaciones y efectos particulares.
- Eliminados `any` explícitos y conversiones de cadenas a objetivos/números; variables de efectos tipadas.
- Código fuente formateado, TypeScript estricto y ESLint con cero avisos exigidos.
- Validación de entrada, límite de JSON, rechazo de origen ajeno, tokens con hash,
  conflictos de versión y ocultación de información privada.
- Sondeo sin solapamientos y cancelable al cambiar de pantalla; errores de guardado visibles.
- Generación de token compatible con HTTP en red local.
- Eliminada temporalmente la versión Android para centrarse en la web.
- Documentación de instalación, API, operación, pruebas; pruebas de integración locales.

Esta entrega es una copia portable: no publica cambios en el sitio existente y no
contiene cuentas, partidas, datos de salas ni claves de firma del proyecto anterior.
