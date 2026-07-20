import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");

const NEW_CARDS_PER_SESSION = 20;
const MASTERED_INTERVAL_DAYS = 21;

// ---------- helpers ----------

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(days, 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// SM-2 simplificado. quality: 0 = otra vez, 4 = bien, 5 = fácil
function nextState(prog, quality) {
  let ease = prog?.ease ?? 2.5;
  let interval_days = prog?.interval_days ?? 0;
  let repetitions = prog?.repetitions ?? 0;

  if (quality < 3) {
    repetitions = 0;
    interval_days = 0;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease);
    repetitions += 1;
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }

  return {
    ease,
    interval_days,
    repetitions,
    due_date: addDaysStr(interval_days),
    last_reviewed: new Date().toISOString(),
  };
}

// ---------- data ----------

async function fetchWordsWithProgress() {
  const { data, error } = await supabase
    .from("words")
    .select("id, week, section, en, es, progress(id, ease, interval_days, repetitions, due_date)")
    .order("week", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data.map((w) => ({ ...w, progress: w.progress?.[0] ?? null }));
}

async function saveProgress(userId, wordId, state) {
  const { error } = await supabase
    .from("progress")
    .upsert(
      { user_id: userId, word_id: wordId, ...state },
      { onConflict: "user_id,word_id" }
    );
  if (error) throw error;
}

// ---------- screens ----------

function renderLoading() {
  app.innerHTML = `<p style="text-align:center; color: var(--muted); margin-top: 40px;">Cargando…</p>`;
}

function renderAuth() {
  app.innerHTML = `
    <div class="center-screen">
      <div class="card">
        <h1 style="margin-top:0;">Inglés B1 · Fichas</h1>
        <p style="color: var(--muted);">Ingresa tu correo y te enviamos un enlace para entrar (sin contraseña).</p>
        <form id="auth-form">
          <input type="email" id="email-input" placeholder="tu@correo.com" required autocomplete="email" />
          <button type="submit" class="primary" style="width:100%;">Enviar enlace mágico</button>
        </form>
        <p id="auth-msg" style="color: var(--muted); font-size: 0.9rem;"></p>
      </div>
    </div>
  `;
  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email-input").value.trim();
    const msg = document.getElementById("auth-msg");
    msg.textContent = "Enviando…";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    msg.textContent = error
      ? `Error: ${error.message}`
      : `Listo. Revisa ${email} y abre el enlace desde este mismo dispositivo.`;
  });
}

async function renderHome(session) {
  renderLoading();
  let words;
  try {
    words = await fetchWordsWithProgress();
  } catch (err) {
    app.innerHTML = `<p style="color:var(--again); text-align:center;">Error cargando palabras: ${escapeHtml(err.message)}</p>`;
    return;
  }

  const today = todayStr();
  const byWeek = new Map();
  for (const w of words) {
    if (!byWeek.has(w.week)) byWeek.set(w.week, []);
    byWeek.get(w.week).push(w);
  }

  const weekCards = [...byWeek.keys()]
    .sort((a, b) => a - b)
    .map((week) => {
      const list = byWeek.get(week);
      const total = list.length;
      const due = list.filter((w) => !w.progress || w.progress.due_date <= today).length;
      const mastered = list.filter((w) => w.progress && w.progress.interval_days >= MASTERED_INTERVAL_DAYS).length;
      const pct = Math.round((mastered / total) * 100);
      return `
        <div class="week-card" data-week="${week}">
          <div>
            <div class="title">Semana ${week}</div>
            <div class="subtitle">${total} palabras · ${mastered} dominadas</div>
            <div class="progress-bar-track" style="width:180px;">
              <div class="progress-bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
          <div class="badge">${due > 0 ? `${due} para hoy` : "al día"}</div>
        </div>
      `;
    })
    .join("");

  app.innerHTML = `
    <header class="topbar">
      <div class="logo"><h1>Inglés B1</h1></div>
      <div class="top-actions">
        <button class="link" id="logout-btn">Salir</button>
      </div>
    </header>
    <div class="week-list">
      ${weekCards || `<p style="color:var(--muted);">Todavía no hay palabras cargadas.</p>`}
    </div>
    <footer class="small-print">${session.user.email}</footer>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => supabase.auth.signOut());
  document.querySelectorAll(".week-card").forEach((el) => {
    el.addEventListener("click", () => {
      const week = Number(el.dataset.week);
      startStudySession(session, byWeek.get(week), week);
    });
  });
}

function startStudySession(session, weekWords, week) {
  const today = todayStr();
  const dueCards = weekWords.filter((w) => w.progress && w.progress.due_date <= today);
  const newCards = shuffle(weekWords.filter((w) => !w.progress)).slice(0, NEW_CARDS_PER_SESSION);
  let queue = shuffle([...dueCards, ...newCards]);

  const stats = { reviewed: 0, again: 0, good: 0, easy: 0, total: queue.length };

  if (queue.length === 0) {
    renderAllCaughtUp(session, week);
    return;
  }

  renderStudyCard();

  function renderStudyCard() {
    const card = queue[0];
    const remaining = queue.length;
    app.innerHTML = `
      <div class="study-header">
        <button class="link" id="exit-btn">← Semanas</button>
        <span>Semana ${week} · quedan ${remaining}</span>
      </div>
      <div class="flip-hint-row">Toca la ficha para ver la respuesta</div>
      <div class="flashcard-wrap">
        <div class="flashcard" id="flashcard">
          <span class="section-tag">${escapeHtml(card.section)}</span>
          <div class="word" id="card-front">${escapeHtml(card.en)}</div>
        </div>
      </div>
      <div id="answer-area"></div>
    `;
    document.getElementById("exit-btn").addEventListener("click", () => renderHome(session));
    document.getElementById("flashcard").addEventListener("click", flipCard);
  }

  function flipCard() {
    const card = queue[0];
    document.getElementById("card-front").outerHTML = `<div class="translation" id="card-front">${escapeHtml(card.es)}</div>`;
    document.getElementById("answer-area").innerHTML = `
      <div class="answer-buttons">
        <button class="btn-again" data-q="0">Otra vez</button>
        <button class="btn-good" data-q="4">Bien</button>
        <button class="btn-easy" data-q="5">Fácil</button>
      </div>
    `;
    document.getElementById("flashcard").removeEventListener("click", flipCard);
    document.querySelectorAll("[data-q]").forEach((btn) => {
      btn.addEventListener("click", () => answer(Number(btn.dataset.q)));
    });
  }

  async function answer(quality) {
    const card = queue.shift();
    const state = nextState(card.progress, quality);
    card.progress = { ...card.progress, ...state };
    stats.reviewed += 1;
    if (quality < 3) { stats.again += 1; queue.splice(Math.min(3, queue.length), 0, card); }
    else if (quality === 4) stats.good += 1;
    else stats.easy += 1;

    saveProgress(session.user.id, card.id, state).catch((err) => console.error("No se pudo guardar el progreso:", err));

    if (queue.length === 0) renderSummary(session, week, stats);
    else renderStudyCard();
  }
}

function renderAllCaughtUp(session, week) {
  app.innerHTML = `
    <div class="center-screen">
      <div class="card" style="text-align:center;">
        <div class="summary-emoji">✅</div>
        <h2>¡Al día!</h2>
        <p style="color:var(--muted);">No hay tarjetas pendientes en la Semana ${week} por ahora.</p>
        <button class="primary" id="back-btn">Volver a Semanas</button>
      </div>
    </div>
  `;
  document.getElementById("back-btn").addEventListener("click", () => renderHome(session));
}

function renderSummary(session, week, stats) {
  app.innerHTML = `
    <div class="center-screen">
      <div class="card" style="text-align:center;">
        <div class="summary-emoji">🎉</div>
        <h2>Sesión completa</h2>
        <p style="color:var(--muted);">Semana ${week} · ${stats.reviewed} tarjetas repasadas</p>
        <p style="color:var(--muted); font-size:0.9rem;">Otra vez: ${stats.again} · Bien: ${stats.good} · Fácil: ${stats.easy}</p>
        <button class="primary" id="back-btn">Volver a Semanas</button>
      </div>
    </div>
  `;
  document.getElementById("back-btn").addEventListener("click", () => renderHome(session));
}

// ---------- boot ----------

renderLoading();

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) renderHome(session);
  else renderAuth();
});

const { data: { session } } = await supabase.auth.getSession();
if (session) renderHome(session);
else renderAuth();
