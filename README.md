# Inglés B1 · Fichas de estudio

App de fichas (estilo Anki) para repasar vocabulario de inglés B1, semana a semana.
Funciona en el celular y el computador desde el navegador, con tu progreso sincronizado
entre ambos.

## 1. Crear el proyecto de Supabase (una sola vez)

1. Entra a https://supabase.com y crea una cuenta gratis.
2. Crea un **New project** (elige cualquier nombre y contraseña de base de datos, guárdala).
3. Cuando el proyecto esté listo, ve a **SQL Editor** (menú izquierdo) → **New query**.
4. Pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
5. Abre otra **New query**, pega el contenido de [`supabase/semana_01.sql`](supabase/semana_01.sql) y dale **Run**.
   (Esto carga las 62 palabras de la Semana 1).
6. Ve a **Authentication → Providers** y confirma que **Email** esté habilitado
   (viene habilitado por defecto). No hace falta contraseña: usamos "enlace mágico".
7. Ve a **Authentication → URL Configuration** y en **Redirect URLs** agrega la URL donde
   vayas a publicar la app (ej: `https://TU-USUARIO.github.io/ingles-b1/`). Puedes agregarla
   después de publicar en GitHub Pages (paso 3).
8. Ve a **Project Settings → API**. Copia el **Project URL** y la **anon public key**.

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

## 5. Agregar una semana nueva

Cuando tengas la siguiente lista de palabras, pásamela y te genero un archivo
`supabase/semana_NN.sql` como el de la Semana 1. Solo tienes que pegarlo en el
**SQL Editor** de Supabase y darle Run — no hay que tocar el código ni volver a publicar
nada. La semana nueva aparece sola en la pantalla principal de la app.

## Cómo funciona el repaso

Cada ficha muestra la palabra en inglés; al tocarla se voltea y muestra la traducción.
Luego eliges:

- **Otra vez**: no te la sabías, vuelve a aparecer en la misma sesión y mañana.
- **Bien**: la recordaste, vuelve en unos días.
- **Fácil**: la sabes muy bien, vuelve en más tiempo.

El intervalo crece automáticamente cada vez que la aciertas (repetición espaciada,
igual que Anki), así que las palabras que ya dominas aparecen cada vez menos.
