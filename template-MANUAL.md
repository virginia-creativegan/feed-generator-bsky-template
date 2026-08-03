# Feed Generator para Bluesky — Manual de instalación y uso

---

## ¿Qué es esto?

Un servidor propio que gestiona colecciones manuales de posts de [Bluesky](https://bsky.app) sin depender de apps de terceros ni de pagos. Cada colección aparece en tu perfil de Bluesky como un **feed** al que cualquiera puede suscribirse.

Los datos (feeds y posts) se guardan en un archivo `data.json` dentro de tu repositorio privado de [GitHub](https://github.com), así que sobreviven a cualquier reinicio del servidor.

No es gran cosa y requiere un poco de conocimientos técnicos. Es lo que hay, no sé hacerlo mejor xD cualquier aportación es bienvenida.

---

## Lo que necesitas antes de empezar

- **Node.js** v18 o superior → https://nodejs.org
- **Git** → https://git-scm.com / https://git-scm.com/install/windows
- **Cuenta en GitHub** → https://github.com (gratuita)
- **Cuenta en Render.com** → https://render.com (gratuita)
- **Una cuenta de Bluesky** con la que publicarás los feeds

---

## PASO 1 — Obtener tu DID de Bluesky

El DID es el identificador único de tu cuenta. Abre esta URL en el navegador sustituyendo `TU-HANDLE` por tu handle de Bluesky (ej: `fulano.bsky.social`):

```
https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=TU-HANDLE
```

Guarda el valor de `did` que aparece (tiene este formato: `did:plc:xxxxxxxxxxxxxxxxxxxx`).

---

## PASO 2 — Descargar el código

1. Ir a https://github.com/virginia-creativegan/mi-feed-bsky
2. Pulsar **Code → Download ZIP**
3. Descomprimir en una carpeta, por ejemplo `C:\Users\TuUsuario\Documents\mi-feed-bsky`

---

## PASO 3 — Instalar dependencias

Abrir una terminal en esa carpeta y ejecutar:

```powershell
npm install
```

⚠️ En Windows, si aparece un error sobre "ejecución de scripts deshabilitada", ejecuta primero esto y vuelve a intentarlo:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## PASO 4 — Crear el repositorio en GitHub

1. Ir a https://github.com/new
2. Crear un repositorio **privado** con el nombre que quieras (ej: `mi-feed-bsky`)
3. No inicializar con ningún archivo

---

## PASO 5 — Crear un Personal Access Token en GitHub

Necesitas un token para que el servidor pueda guardar datos en tu repositorio.

1. Ir a https://github.com/settings/tokens/new
2. **Note:** `feed-bsky`
3. **Expiration:** No expiration
4. **Scopes:** marcar solo `repo`
5. Pulsar **Generate token** y copiar el token (solo se muestra una vez)

---

## PASO 6 — Subir el código a GitHub

En la terminal, dentro de la carpeta del proyecto:

```powershell
git config --global user.email "tu-email@ejemplo.com"
git config --global user.name "Tu Nombre"
git init
git add .
git commit -m "Feed generator inicial"
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git branch -M main
git push -u origin main
```

Sustituir `TU-USUARIO` y `TU-REPOSITORIO` por los valores reales.

Si Git pide credenciales al hacer el push:
- **Username:** tu nombre de usuario de GitHub
- **Password:** el Personal Access Token del Paso 5 (no tu contraseña de GitHub)

---

## PASO 7 — Desplegar en Render

1. Ir a https://render.com → **New +** → **Web Service**
2. Conectar tu cuenta de GitHub y seleccionar el repositorio
3. Configurar:
   - **Name:** el nombre que quieras
   - **Region:** la más cercana a ti (para España es Frankfurt)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. En **Advanced** (o Manage → Environment), añadir estas variables de entorno:

| Variable | Valor |
|----------|-------|
| `ADMIN_KEY` | Una contraseña que solo conozcas tú |
| `HOSTNAME` | (dejarlo vacío por ahora) |
| `GITHUB_TOKEN` | El token del Paso 5 |
| `GITHUB_REPO` | `TU-USUARIO/TU-REPOSITORIO` |

5. Pulsar **Deploy Web Service**

---

## PASO 8 — Configurar HOSTNAME

Cuando Render termine el deploy, te asignará una URL como:
`https://nombre-de-tu-servicio.onrender.com`

Cópiala y vuelve a las variables de entorno de Render. Actualiza `HOSTNAME` con ese valor **sin** `https://`:

```
HOSTNAME=nombre-de-tu-servicio.onrender.com
```

Render redesplegará automáticamente (o haz un deploy manual).

---

## PASO 9 — Verificar que funciona

Abre en el navegador:

```
https://nombre-de-tu-servicio.onrender.com/.well-known/did.json
```

Debe devolver un JSON con el DID. Si tarda, el servidor puede estar durmiendo la primera vez — espera 30-60 segundos y recarga. Si sigue sin responder, en Render ve a tu proyecto y pulsa **Manual Deploy → Deploy latest commit**.

---

## USO DIARIO

### Acceder a la interfaz de administración

```
https://nombre-de-tu-servicio.onrender.com/admin
```

La primera vez, introduce tu `ADMIN_KEY` en el campo de clave y pulsa **Guardar**. El navegador la recuerda.

### Instalar el bookmarklet (para añadir posts desde Bluesky)

1. Mostrar la barra de marcadores: **Ctrl+Shift+B**
2. Clic derecho → **Añadir marcador**
3. **Nombre:** `+ Feed Bsky`
4. **URL:** pegar este código, sustituyendo `TU-SERVIDOR` por el nombre de tu servicio en Render:

```
javascript:(function(){const m=location.href.match(/profile\/([^/]+)\/post\/([^/?]+)/);if(!m){alert('No estás en un post de Bluesky');return;}const handle=m[1];const rkey=m[2];const feed=prompt('ID del feed:');if(!feed)return;const key=localStorage.getItem('bskyAdminKey')||prompt('Clave admin:');localStorage.setItem('bskyAdminKey',key);const server='https://TU-SERVIDOR.onrender.com';function addPost(uri){fetch(server+'/admin/feeds/'+feed+'/posts',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':key},body:JSON.stringify({uri:uri})}).then(r=>r.json()).then(d=>alert(d.ok?'✓ Post añadido a '+feed:'✗ Error: '+d.error));}if(handle.startsWith('did:')){addPost('at://'+handle+'/app.bsky.feed.post/'+rkey);}else{fetch('https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle='+handle).then(r=>r.json()).then(d=>addPost('at://'+d.did+'/app.bsky.feed.post/'+rkey));}})();
```

Si tu URL es `https://mi-feed-bsky.onrender.com`, entonces `TU-SERVIDOR` = `mi-feed-bsky`.

---

## CREAR UN FEED NUEVO

### Paso 1 — Crear el feed en el servidor

1. Abrir la interfaz de administración
2. Ir a la sección **Crear nuevo feed**
3. Rellenar:
   - **Cuenta**: selecciona la cuenta de Bluesky
   - **ID**: sin espacios ni caracteres especiales (ej: `recetas`, `viajes`, `libros`)
   - **Nombre**: el que verá la gente en Bluesky
   - **Descripción**: una frase corta
4. Pulsar **Crear feed**
5. Aparece un enlace al feed — guárdalo

### Paso 2 — Registrar el feed en Bluesky

1. Ir a la sección **Registrar feed en Bluesky**
2. Seleccionar la cuenta correcta
3. Introducir la **App Password** de esa cuenta
   (Bluesky → Configuración → Privacidad y seguridad → Contraseñas de aplicación)
4. Escribir el ID del feed
5. Subir un icono si quieres (PNG o JPG, máx. 1MB) — opcional
6. Pulsar **Registrar en Bluesky**

### Paso 3 — Anclar el feed en tu perfil

1. Abrir la URL del feed: `https://bsky.app/profile/TU-HANDLE/feed/ID-DEL-FEED`
2. Pulsar la chincheta 📌 o **"Add to my feeds"**

> ✸ Sin este paso el feed funciona pero no aparece en tu lista de feeds del perfil.

### Paso 4 — Añadir posts

Con el bookmarklet estando **en** cualquier post de Bluesky, o desde la interfaz web.
La contraseña que pide es la **ADMIN_KEY**, no la App Password de Bluesky.

---

## CAMBIAR EL ICONO DE UN FEED

1. Abrir la interfaz de administración
2. Ir a la sección **Cambiar icono de un feed**
3. Seleccionar cuenta, App Password, ID del feed y nueva imagen
4. Pulsar **Cambiar icono**

El icono puede tardar 2-3 minutos en actualizarse (caché de Bluesky). Recargar con **Ctrl+Shift+R**.

---

## ACTUALIZAR EL SERVIDOR

Cuando modifiques `server.js` o `admin.html`:

```powershell
cd RUTA-A-TU-CARPETA
git pull
git add server.js admin.html
git commit -m "Descripción del cambio"
git push
```

Render redespliega automáticamente. Si tienes prisa, puedes forzarlo desde el panel de Render → tu servicio → **Manual Deploy → Deploy latest commit**. Los datos no se pierden — están en GitHub.

---

## NOTAS IMPORTANTES

- **El servidor duerme** tras 15 minutos sin actividad (plan gratuito de Render). La primera petición puede tardar 30-60 segundos. Es normal.
- **Los datos son persistentes** — están en `data.json` en tu repositorio de GitHub, no en el servidor.
- **Las cuentas en la interfaz web** — el archivo `admin.html` viene configurado con cuentas de ejemplo. Antes de usarlo, ábrelo con un editor de texto y sustituye los handles y DIDs por los tuyos. Busca las líneas con `<option value="did:plc:...">` y cámbialas.
- **La App Password de Bluesky** es diferente a tu contraseña principal. Créala en Bluesky → Configuración → Privacidad y seguridad → Contraseñas de aplicación.
- **La ADMIN_KEY** es la contraseña que tú eliges para proteger tu interfaz de administración. No la confundas con la App Password de Bluesky.

---

## CONTRASEÑAS — Por si te lías

| Contraseña | De dónde sale | Dónde te la pide |
|------------|---------------|------------------|
| **ADMIN_KEY** (tupassword) | La elegiste tú al configurar el servidor | Interfaz web `/admin` y bookmarklet |
| **App Password de Bluesky** (xxxx-xxxx-xxxx-xxxx) | Bluesky → Configuración → Contraseñas de aplicación | Interfaz web en "Registrar feed" y "Cambiar icono" |
| **Personal Access Token de GitHub** (ghp_...) | GitHub → Settings → Tokens | Solo al configurar Render (variable `GITHUB_TOKEN`) — no te lo vuelve a pedir en el uso diario |

---

Aportaciones, correcciones y demás: https://bsky.app/profile/creativegan.net
