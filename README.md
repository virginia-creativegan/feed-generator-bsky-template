# Feed Generator para Bluesky

Servidor propio para gestionar colecciones manuales de posts de Bluesky, sin depender de apps de terceros ni de pagos.

Cada colección aparece en tu perfil de Bluesky como un feed al que cualquiera puede suscribirse. Los datos se guardan en `data.json` dentro de tu propio repositorio de GitHub.

## Características

- Interfaz web de administración
- Bookmarklet para añadir posts desde Bluesky con un clic
- Soporte para múltiples cuentas de Bluesky
- Iconos personalizados por feed
- Datos persistentes en GitHub (no se pierden con reinicios del servidor)
- Despliegue gratuito en Render.com

## Instalación

Sigue el manual paso a paso:

👉 [Manual de instalación y uso](MANUAL.md)

## Archivos

- `server.js` — servidor Express con la lógica del feed generator
- `admin.html` — interfaz web de administración (**editar con tus datos antes de usar**)
- `package.json` — dependencias Node.js

## Configuración necesaria en admin.html

Antes de subir a GitHub, edita `admin.html` y sustituye los placeholders por tus datos:

- `TU-DID-CUENTA-1` y `TU-DID-CUENTA-2` → tus DIDs de Bluesky
- `tu-handle-1` y `tu-handle-2` → tus handles de Bluesky

## Licencia

MIT
