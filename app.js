import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");

const NEW_CARDS_PER_SESSION = 20;
const MASTERED_INTERVAL_DAYS = 21;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const state = {
  session: null,
  words: [], // todas las palabras con su progreso, cargadas una vez por sesión
  selection: new Set(), // ids de palabras elegidas manualmente
};

// ---------- helpers ----------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function humanizeDelta(ms) {
  const min = Math.round(ms / MINUTE);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const hours = Math.round(ms / (60 * MINUTE));
  if (hours < 24) return `${hours} h`;
  const days = Math.round(ms / DAY);
  return `${days} d`;
}

function dueBadge(word, now) {
  if (!word.progress) return { text: "nueva", cls: "is-new" };
  const due = new Date(word.progress.due_at);
  if (due <= now) return { text: "pendiente", cls: "is-due" };
  return { text: `en ${humanizeDelta(due - now)}`, cls: "" };
}

// Repaso de 4 botones: Otra vez / Difícil / Bien / Fácil.
// 'new' y 'step1' son pasos de aprendizaje en minutos; 'review' crece por días (estilo SM-2).
function nextState(prog, answer) {
  const stage = prog?.stage ?? "new";
  let ease = prog?.ease ?? 2.5;
  let interval_days = prog?.interval_days ?? 0;
  let newStage;
  let dueMs;

  if (stage === "review") {
    if (answer === "again") {
      newStage = "step1"; dueMs = 1 * MINUTE; ease = Math.max(1.3, ease - 0.2); interval_days = 0;
    } else if (answer === "hard") {
      newStage = "review"; interval_days = Math.max(1, Math.round(interval_days * 1.2));
      ease = Math.max(1.3, ease - 0.15); dueMs = interval_days * DAY;
    } else if (answer === "good") {
      newStage = "review"; interval_days = Math.max(1, Math.round(interval_days * ease)); dueMs = interval_days * DAY;
    } else {
      newStage = "review"; interval_days = Math.max(1, Math.round(interval_days * ease * 1.3));
      ease = ease + 0.15; dueMs = interval_days * DAY;
    }
  } else {
    if (answer === "again") {
      newStage = "step1"; dueMs = 1 * MINUTE;
    } else if (answer === "hard") {
      newStage = "step1"; dueMs = 6 * MINUTE;
    } else if (answer === "good") {
      if (stage === "step1") { newStage = "review"; interval_days = 1; dueMs = 1 * DAY; }
      else { newStage = "step1"; dueMs = 10 * MINUTE; }
    } else {
      newStage = "review"; interval_days = 5; dueMs = 5 * DAY;
    }
  }

  return {
    stage: newStage,
    ease,
    interval_days,
    due_at: new Date(Date.now() + dueMs).toISOString(),
    last_reviewed: new Date().toISOString(),
  };
}

function previewLabel(prog, answer) {
  const result = nextState(prog, answer);
  return humanizeDelta(new Date(result.due_at).getTime() - Date.now());
}

// ---------- data ----------

async function fetchWordsWithProgress() {
  const { data, error } = await supabase
    .from("words")
    .select("id, week, section, en, es, progress(id, stage, ease, interval_days, due_at)")
    .order("week", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data.map((w) => ({ ...w, progress: w.progress?.[0] ?? null }));
}

async function saveProgress(userId, wordId, newState) {
  const { error } = await supabase
    .from("progress")
    .upsert({ user_id: userId, word_id: wordId, ...newState }, { onConflict: "user_id,word_id" });
  if (error) throw error;
}

// ---------- selección (estilo Drive) ----------

function selectionBarHtml() {
  if (state.selection.size === 0) return "";
  return `
    <div class="selection-bar">
      <span class="count">${state.selection.size} seleccionada${state.selection.size === 1 ? "" : "s"}</span>
      <div class="actions">
        <button class="link" id="clear-selection-btn">Vaciar</button>
        <button class="primary" id="start-selection-btn">Comenzar con estas</button>
      </div>
    </div>
  `;
}

function attachSelectionBarHandlers(rerender) {
  document.getElementById("clear-selection-btn")?.addEventListener("click", () => {
    state.selection.clear();
    rerender();
  });
  document.getElementById("start-selection-btn")?.addEventListener("click", () => {
    const cards = state.words.filter((w) => state.selection.has(w.id));
    startStudySession(cards, { label: `${cards.length} seleccionadas`, onExit: rerender });
  });
}

// ---------- pantallas ----------

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

async function loadRoot() {
  renderLoading();
  try {
    state.words = await fetchWordsWithProgress();
  } catch (err) {
    app.innerHTML = `<p style="color:var(--again); text-align:center;">Error cargando palabras: ${escapeHtml(err.message)}</p>`;
    return;
  }
  drawRoot();
}

function groupByWeek() {
  const byWeek = new Map();
  for (const w of state.words) {
    if (!byWeek.has(w.week)) byWeek.set(w.week, []);
    byWeek.get(w.week).push(w);
  }
  return byWeek;
}

function drawRoot() {
  const now = new Date();
  const byWeek = groupByWeek();
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  const dueReview = state.words.filter((w) => w.progress && new Date(w.progress.due_at) <= now);
  const dueNew = shuffle(state.words.filter((w) => !w.progress)).slice(0, NEW_CARDS_PER_SESSION);
  const autoQueue = shuffle([...dueReview, ...dueNew]);

  const allSelected = state.words.length > 0 && state.words.every((w) => state.selection.has(w.id));

  const weekRows = weeks
    .map((week) => {
      const list = byWeek.get(week);
      const total = list.length;
      const selectedCount = list.filter((w) => state.selection.has(w.id)).length;
      const due = list.filter((w) => !w.progress || new Date(w.progress.due_at) <= now).length;
      const mastered = list.filter((w) => w.progress?.stage === "review" && w.progress.interval_days >= MASTERED_INTERVAL_DAYS).length;
      return `
        <div class="folder-row" data-week="${week}">
          <input type="checkbox" data-week-checkbox="${week}" ${selectedCount === total && total > 0 ? "checked" : ""} />
          <div class="row-main">
            <div class="title">📁 Semana ${week}</div>
            <div class="subtitle">${total} palabras · ${mastered} dominadas${due > 0 ? ` · ${due} pendientes` : ""}</div>
          </div>
          <span class="chevron">›</span>
        </div>
      `;
    })
    .join("");

  app.innerHTML = `
    <header class="topbar">
      <h1>Inglés B1</h1>
      <button class="link" id="logout-btn">Salir</button>
    </header>
    <button class="primary quick-action-row" id="auto-review-btn" ${autoQueue.length === 0 ? "disabled" : ""}>
      <span>Repasar pendientes ahora</span>
      <span>${autoQueue.length}</span>
    </button>
    <div class="select-bar">
      <span style="color:var(--muted); font-size:0.85rem;">Elegir tarjetas manualmente</span>
      <button class="ghost" id="select-all-btn">${allSelected ? "Deseleccionar todo" : "Seleccionar todo"}</button>
    </div>
    <div class="week-list">${weekRows || `<p style="color:var(--muted);">No hay palabras cargadas.</p>`}</div>
    ${selectionBarHtml()}
    <footer class="small-print">${state.session.user.email}</footer>
  `;

  document.querySelectorAll("[data-week-checkbox]").forEach((cb) => {
    const week = Number(cb.dataset.weekCheckbox);
    const list = byWeek.get(week);
    const selectedCount = list.filter((w) => state.selection.has(w.id)).length;
    cb.indeterminate = selectedCount > 0 && selectedCount < list.length;
  });

  document.getElementById("logout-btn").addEventListener("click", () => supabase.auth.signOut());
  document.getElementById("auto-review-btn").addEventListener("click", () => {
    startStudySession(autoQueue, { label: "Repaso de hoy", onExit: drawRoot });
  });
  document.getElementById("select-all-btn").addEventListener("click", () => {
    if (allSelected) state.selection.clear();
    else state.words.forEach((w) => state.selection.add(w.id));
    drawRoot();
  });
  document.querySelectorAll("[data-week-checkbox]").forEach((cb) => {
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      const week = Number(cb.dataset.weekCheckbox);
      const list = byWeek.get(week);
      const allIn = list.every((w) => state.selection.has(w.id));
      list.forEach((w) => (allIn ? state.selection.delete(w.id) : state.selection.add(w.id)));
      drawRoot();
    });
  });
  document.querySelectorAll(".folder-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.matches('input[type="checkbox"]')) return;
      drawWeek(Number(row.dataset.week));
    });
  });
  attachSelectionBarHandlers(drawRoot);
}

function drawWeek(week) {
  const now = new Date();
  const list = state.words.filter((w) => w.week === week).sort((a, b) => a.id - b.id);
  const bySection = new Map();
  for (const w of list) {
    if (!bySection.has(w.section)) bySection.set(w.section, []);
    bySection.get(w.section).push(w);
  }

  const dueList = list.filter((w) => !w.progress || new Date(w.progress.due_at) <= now);
  const allSelected = list.length > 0 && list.every((w) => state.selection.has(w.id));

  const sectionsHtml = [...bySection.entries()]
    .map(([section, words]) => {
      const selectedCount = words.filter((w) => state.selection.has(w.id)).length;
      const rows = words
        .map((w) => {
          const badge = dueBadge(w, now);
          const checked = state.selection.has(w.id);
          return `
            <div class="word-row" data-id="${w.id}">
              <input type="checkbox" data-word-checkbox="${w.id}" ${checked ? "checked" : ""} />
              <div class="row-main">
                <span class="en">${escapeHtml(w.en)}</span>
                <span class="es">${escapeHtml(w.es)}</span>
              </div>
              <span class="due-badge ${badge.cls}">${badge.text}</span>
            </div>
          `;
        })
        .join("");
      return `
        <div class="section-header">
          <input type="checkbox" data-section-checkbox="${escapeHtml(section)}" ${selectedCount === words.length ? "checked" : ""} />
          <span class="label">${escapeHtml(section)} (${words.length})</span>
        </div>
        ${rows}
      `;
    })
    .join("");

  app.innerHTML = `
    <div class="breadcrumb">
      <button class="link" id="back-to-root">‹ B1</button>
      <span>/ Semana ${week}</span>
    </div>
    <button class="primary quick-action-row" id="week-review-btn" ${dueList.length === 0 ? "disabled" : ""}>
      <span>Repasar pendientes de esta semana</span>
      <span>${dueList.length}</span>
    </button>
    <div class="select-bar">
      <span style="color:var(--muted); font-size:0.85rem;">${list.length} palabras</span>
      <button class="ghost" id="select-all-week-btn">${allSelected ? "Deseleccionar todo" : "Seleccionar todo"}</button>
    </div>
    ${sectionsHtml}
    ${selectionBarHtml()}
  `;

  document.querySelectorAll("[data-section-checkbox]").forEach((cb) => {
    const words = bySection.get(cb.dataset.sectionCheckbox);
    const selectedCount = words.filter((w) => state.selection.has(w.id)).length;
    cb.indeterminate = selectedCount > 0 && selectedCount < words.length;
  });

  document.getElementById("back-to-root").addEventListener("click", drawRoot);
  document.getElementById("week-review-btn").addEventListener("click", () => {
    startStudySession(shuffle(dueList), { label: `Semana ${week} · pendientes`, onExit: () => drawWeek(week) });
  });
  document.getElementById("select-all-week-btn").addEventListener("click", () => {
    if (allSelected) list.forEach((w) => state.selection.delete(w.id));
    else list.forEach((w) => state.selection.add(w.id));
    drawWeek(week);
  });
  document.querySelectorAll("[data-section-checkbox]").forEach((cb) => {
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      const words = bySection.get(cb.dataset.sectionCheckbox);
      const allIn = words.every((w) => state.selection.has(w.id));
      words.forEach((w) => (allIn ? state.selection.delete(w.id) : state.selection.add(w.id)));
      drawWeek(week);
    });
  });
  document.querySelectorAll(".word-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.matches('input[type="checkbox"]')) return;
      const id = Number(row.dataset.id);
      if (state.selection.has(id)) state.selection.delete(id);
      else state.selection.add(id);
      drawWeek(week);
    });
  });
  attachSelectionBarHandlers(() => drawWeek(week));
}

const ANSWERS = [
  { key: "again", label: "Otra vez", cls: "btn-again" },
  { key: "hard", label: "Difícil", cls: "btn-hard" },
  { key: "good", label: "Bien", cls: "btn-good" },
  { key: "easy", label: "Fácil", cls: "btn-easy" },
];

function startStudySession(cards, { label, onExit }) {
  const queue = shuffle(cards);
  if (queue.length === 0) {
    app.innerHTML = `
      <div class="center-screen">
        <div class="card" style="text-align:center;">
          <div class="summary-emoji">✅</div>
          <h2>Nada por aquí</h2>
          <p style="color:var(--muted);">No hay tarjetas para "${escapeHtml(label)}".</p>
          <button class="primary" id="back-btn">Volver</button>
        </div>
      </div>
    `;
    document.getElementById("back-btn").addEventListener("click", onExit);
    return;
  }

  const stats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };

  function paint() {
    const card = queue[0];
    app.innerHTML = `
      <div class="study-header">
        <button class="link" id="exit-btn">← Salir</button>
        <span>${escapeHtml(label)} · quedan ${queue.length}</span>
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
    document.getElementById("exit-btn").addEventListener("click", onExit);
    document.getElementById("flashcard").addEventListener("click", flip);
  }

  function flip() {
    const card = queue[0];
    document.getElementById("card-front").outerHTML = `<div class="translation" id="card-front">${escapeHtml(card.es)}</div>`;
    document.getElementById("answer-area").innerHTML = `
      <div class="answer-buttons">
        ${ANSWERS.map(
          (a) => `
          <button class="${a.cls}" data-answer="${a.key}">
            <span>${a.label}</span>
            <span class="interval">${previewLabel(card.progress, a.key)}</span>
          </button>
        `
        ).join("")}
      </div>
    `;
    document.getElementById("flashcard").removeEventListener("click", flip);
    document.querySelectorAll("[data-answer]").forEach((btn) => {
      btn.addEventListener("click", () => answer(btn.dataset.answer));
    });
  }

  function answer(key) {
    const card = queue.shift();
    const newState = nextState(card.progress, key);
    card.progress = { ...(card.progress || {}), ...newState };
    stats.reviewed += 1;
    stats[key] += 1;
    if (key === "again") queue.splice(Math.min(3, queue.length), 0, card);

    saveProgress(state.session.user.id, card.id, newState).catch((err) =>
      console.error("No se pudo guardar el progreso:", err)
    );

    if (queue.length === 0) renderSummary();
    else paint();
  }

  function renderSummary() {
    app.innerHTML = `
      <div class="center-screen">
        <div class="card" style="text-align:center;">
          <div class="summary-emoji">🎉</div>
          <h2>Sesión completa</h2>
          <p style="color:var(--muted);">${escapeHtml(label)} · ${stats.reviewed} tarjetas repasadas</p>
          <p style="color:var(--muted); font-size:0.9rem;">
            Otra vez: ${stats.again} · Difícil: ${stats.hard} · Bien: ${stats.good} · Fácil: ${stats.easy}
          </p>
          <button class="primary" id="back-btn">Volver</button>
        </div>
      </div>
    `;
    document.getElementById("back-btn").addEventListener("click", onExit);
  }

  paint();
}

// ---------- boot ----------

renderLoading();

// TOKEN_REFRESHED se dispara cada ~hora sin cambiar de usuario: solo refrescamos
// el objeto de sesión (para que saveProgress siga autenticado) sin redibujar nada,
// para no interrumpir una sesión de estudio o borrar la selección en curso.
supabase.auth.onAuthStateChange((event, session) => {
  state.session = session;
  if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
  state.selection.clear();
  if (session) loadRoot();
  else renderAuth();
});

const { data: { session: initialSession } } = await supabase.auth.getSession();
state.session = initialSession;
if (initialSession) loadRoot();
else renderAuth();
