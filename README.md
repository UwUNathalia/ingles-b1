# Inglés B1 · Fichas de estudio

App de fichas (estilo Anki) para repasar vocabulario de inglés B1, semana a semana.
Funciona en el celular y el computador desde el navegador, con tu progreso sincronizado
entre ambos.

## 1. Crear el proyecto de Supabase (una sola vez)

1. Entra a https://supabase.com y crea una cuenta gratis.
2. Crea un **New project** (elige cualquier nombre y contraseña de base de datos, guárdala).
3. Cuando el proyecto esté listo, ve a **SQL Editor** (menú izquierdo) → **New query**.
4. Pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
5. Repite **New query** → pegar → **Run** con cada archivo `supabase/semana_NN.sql`, uno por
   uno, del `semana_01.sql` al `semana_30.sql` (están todos en la carpeta [`supabase/`](supabase)).
   (Esto carga las 2000 palabras de las semanas 1 a 30, el curso B1 completo).
6. Ve a **Authentication → Providers** y confirma que **Email** esté habilitado
   (viene habilitado por defecto). No hace falta contraseña: usamos "enlace mágico".
7. Ve a **Authentication → URL Configuration** y en **Redirect URLs** agrega la URL donde
   vayas a publicar la app (ej: `https://TU-USUARIO.github.io/ingles-b1/`). Puedes agregarla
   después de publicar en GitHub Pages (paso 3).
8. Ve a **Project Settings → API**. Copia el **Project URL** y la **anon public key**
   (o "publishable key" en proyectos nuevos).

## 2. Configurar la app con tus llaves

Abre [`config.js`](config.js) y reemplaza los dos valores:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

Estas llaves son públicas por diseño (Supabase las protege con Row Level Security,
ya configurado en `schema.sql`): cada usuario solo puede ver y editar su propio progreso.

## 3. Publicar gratis en GitHub Pages

```bash
cd ingles-b1
git init
git add .
git commit -m "App de fichas ingles B1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/ingles-b1.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: `main` branch, carpeta `/ (root)`** → Save.
En un par de minutos tu app queda disponible en:

```
https://TU-USUARIO.github.io/ingles-b1/
```

Ábrela desde el celular y el computador con esa misma URL — el progreso se sincroniza
automáticamente porque vive en Supabase, no en el navegador.

No olvides volver al paso 1.7 y agregar esta URL exacta a **Redirect URLs** en Supabase,
o el enlace mágico de login no te va a devolver a la app.

## 4. Iniciar sesión

Abre la URL, escribe tu correo y dale **Enviar enlace mágico**. Revisa tu correo y abre
el enlace **desde el mismo dispositivo/navegador** donde quieres iniciar sesión. Repite
esto la primera vez en cada dispositivo (celular y computador) — después queda la sesión
guardada.

Después de pedir un enlace, el botón queda deshabilitado 60 segundos (con cuenta
regresiva) aunque cierres la página o la sesión — es para no gastar de un tirón el
cupo de correos del plan gratis de Supabase, que es bastante bajo.

## 5. Agregar una semana nueva

Cuando tengas la siguiente lista de palabras, pásamela y te genero un archivo
`supabase/semana_NN.sql` como los anteriores. Solo tienes que pegarlo en el
**SQL Editor** de Supabase y darle Run — no hay que tocar el código ni volver a publicar
nada. La semana nueva aparece sola como una carpeta más en la pantalla principal.

## Cómo elegir qué estudiar

La pantalla principal es "Inglés B1" con una carpeta por semana. Puedes:

- Tocar **Repasar pendientes ahora** para una sesión automática con todo lo que toca
  repasar hoy (mezclando todas las semanas), sin elegir nada a mano.
- Marcar los checkboxes para elegir tarjetas sueltas, secciones enteras (el checkbox del
  encabezado de cada tema) o semanas completas (el checkbox de la carpeta), igual que en
  Google Drive. Arriba hay un botón **Seleccionar todo / Deseleccionar todo**, y en cuanto
  eliges algo aparece abajo una barra con **Comenzar con estas**.
- Entrar a una carpeta de semana para ver sus tarjetas agrupadas por tema, con un badge
  que indica si cada una es "nueva", está "pendiente" o "en cuánto tiempo" vuelve a
  aparecer.

## Cómo funciona el repaso

Cada ficha muestra la palabra en inglés; al tocarla se voltea y muestra la traducción,
junto con 4 botones (igual que Anki), cada uno mostrando cuánto falta para que la
tarjeta vuelva a aparecer:

- **Otra vez**: no te la sabías → vuelve en **1 minuto**.
- **Difícil**: te costó → vuelve en **6 minutos**.
- **Bien**: la recordaste → la primera vez vuelve en **10 minutos**; la siguiente vez que
  la aciertes con "Bien" ya pasa a repasos por días, creciendo cada vez más (repetición
  espaciada, como en Anki).
- **Fácil**: la sabes muy bien → salta directo a **~5 días**.

Si prefieres que "Bien" no pase nunca a días y se quede fijo en minutos, o quieres
cambiar alguno de estos tiempos, dime y lo ajusto en `nextState()` dentro de
[`app.js`](app.js).
