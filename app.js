const STORAGE_KEY = "mein-training-data";
// Bump this when the data shape changes and add a migration before accepting it.
const CURRENT_VERSION = 1;
const DEFAULT_PROMPT = `Bitte werte meinen persönlichen Trainingsfortschritt der letzten Wochen kurz und ehrlich aus.
• Bewerte den Fortschritt pro Übung und erkenne mögliche Stagnation.
• Sage konkret pro Übung, ob ich das Gewicht erhöhen sollte und wenn ja, um wie viel kg.
• Motiviere mich kurz und ehrlich.
Keine Vergleiche mit anderen Personen. Antworte kompakt, gut lesbar auf dem Handy und ohne lange Einleitung.

Meine Trainingsdaten:`;
const initialExercises = [
  "Latzug", "Leg Press", "Gluteus Machine (Kickback)",
  "Leg Flexion liegend", "Brustdrücken", "Rudern am Gerät"
];

const app = document.querySelector("#app");
const editor = document.querySelector("#editor");
const editorForm = document.querySelector("#editor-form");
const editorFields = document.querySelector("#editor-fields");
const toastElement = document.querySelector("#toast");
let data = loadData();
let activeTab = "training";
let selectedPlanId = data.plans[0]?.id ?? "";
let toastTimer;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialData();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.plans) || !Array.isArray(parsed.logs)) throw new Error("Ungültige lokale Daten.");
    if (!parsed.schemaVersion) parsed.schemaVersion = 1;
    if (parsed.schemaVersion > CURRENT_VERSION) throw new Error("Die lokalen Daten stammen aus einer neueren App-Version.");
    return {
      schemaVersion: CURRENT_VERSION,
      plans: parsed.plans,
      logs: parsed.logs,
      draft: parsed.draft ?? null,
      settings: { ...defaultSettings(), ...parsed.settings }
    };
  } catch (error) {
    console.error("Trainingsdaten konnten nicht geladen werden.", error);
    queueMicrotask(() => notify(`Daten konnten nicht geladen werden: ${error.message}`));
    return createInitialData();
  }
}

function defaultSettings() {
  return { analysisPrompt: DEFAULT_PROMPT, lastExportAt: null };
}

function createInitialData() {
  return {
    schemaVersion: CURRENT_VERSION,
    plans: [{
      id: uid(), name: "Mein Plan",
      exercises: initialExercises.map((name, order) => ({
        id: uid(), name, targetSets: 3, targetReps: 10, weightStep: 2.5, order
      }))
    }],
    logs: [], draft: null, settings: defaultSettings()
  };
}

function persist() {
  data.schemaVersion = CURRENT_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function formatNumber(value) {
  return Number(value).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function notify(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("visible"), 3000);
}

function saveAndRender(message) {
  try {
    try {
      persist();
    } catch (error) {
      console.error("Trainings-Zwischenstand konnte nicht gespeichert werden.", error);
      notify(`Zwischenstand konnte nicht gespeichert werden: ${error.message}`);
    }
    render();
    if (message) notify(message);
  } catch (error) {
    console.error("Speichern fehlgeschlagen.", error);
    notify(`Speichern fehlgeschlagen: ${error.message}`);
  }
}

function sortedExercises(plan) {
  return [...(plan?.exercises ?? [])].sort((a, b) => a.order - b.order);
}

function lastLogFor(planId, exerciseId) {
  return data.logs
    .filter(log => log.planId === planId && log.exercises.some(item => item.exerciseId === exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.exercises.find(item => item.exerciseId === exerciseId) ?? null;
}

function startTraining(planId) {
  const plan = data.plans.find(item => item.id === planId);
  if (!plan) return;
  selectedPlanId = planId;
  data.draft = {
    id: uid(), planId, date: new Date().toISOString().slice(0, 10),
    exercises: sortedExercises(plan).map(exercise => {
      const previous = lastLogFor(planId, exercise.id);
      return {
        exerciseId: exercise.id,
        sets: previous?.sets?.length
          ? previous.sets.map(set => ({ reps: set.reps ?? "", weight: set.weight ?? "" }))
          : Array.from({ length: exercise.targetSets }, () => ({ reps: "", weight: "" }))
      };
    })
  };
  activeTab = "training";
  saveAndRender();
}

function render() {
  document.querySelectorAll(".tabs button").forEach(button => {
    if (button.dataset.tab === activeTab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (activeTab === "plans") renderPlans();
  else if (activeTab === "history") renderHistory();
  else if (activeTab === "settings") renderSettings();
  else renderTraining();
}

function renderTraining() {
  const plans = data.plans;
  if (data.draft && !plans.some(plan => plan.id === data.draft.planId)) data.draft = null;
  if (!plans.some(plan => plan.id === selectedPlanId)) selectedPlanId = plans[0]?.id ?? "";
  if (!data.draft) {
    app.innerHTML = `
      <div class="section-head"><h2>Dein nächstes Training</h2></div>
      ${plans.length ? `
        <div class="card hero-card">
          <h2>Bereit, loszulegen?</h2>
          <p>Wähle deinen Plan und starte dein Training.</p>
          <label class="field"><span>Trainingsplan</span><select class="plan-select" id="start-plan">${plans.map(plan => `<option value="${escapeHtml(plan.id)}" ${plan.id === selectedPlanId ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("")}</select></label>
          <button class="button full" id="start-training" style="background:#1c2710;color:#c6f36b">Training starten</button>
        </div>` : `<div class="card empty">Lege zuerst unter <strong>Pläne</strong> einen Trainingsplan an.</div>`}
      ${data.logs.length ? `<div class="section-head"><h2>Zuletzt trainiert</h2><span class="muted">${escapeHtml(formatDate(data.logs.slice().sort((a,b) => b.date.localeCompare(a.date))[0].date))}</span></div>` : ""}
      <p class="hint">Deine Daten bleiben auf diesem Gerät. Es gibt keine Konten und keine Cloud.</p>`;
    return;
  }
  const plan = plans.find(item => item.id === data.draft.planId);
  const cards = sortedExercises(plan).map(exercise => {
    const sessionExercise = data.draft.exercises.find(item => item.exerciseId === exercise.id);
    if (!sessionExercise) return "";
    const previous = lastLogFor(plan.id, exercise.id);
    const lastHitTargets = previous?.sets?.length > 0 && previous.sets.every(set =>
      Number(set.reps) >= exercise.targetReps && set.weight !== "" && Number.isFinite(Number(set.weight))
    );
    const suggestedWeight = lastHitTargets ? Math.max(...previous.sets.map(set => Number(set.weight))) + Number(exercise.weightStep) : null;
    return `
      <article class="card exercise-card" data-exercise-id="${escapeHtml(exercise.id)}">
        <div class="exercise-title"><div><h3>${escapeHtml(exercise.name)}</h3><p>Ziel: ${exercise.targetSets} Sätze · ${exercise.targetReps} Wiederholungen</p></div><button class="icon-button" data-action="remove-exercise" aria-label="${escapeHtml(exercise.name)} aus diesem Training entfernen">×</button></div>
        <div class="set-head"><span>Satz</span><span>Wdh.</span><span></span><span>kg</span></div>
        ${sessionExercise.sets.map((set, index) => `
          <div class="set-row" data-set-index="${index}">
            <span class="set-index">${index + 1}</span>
            <input aria-label="Satz ${index + 1}, Wiederholungen" data-field="reps" type="number" min="0" step="1" inputmode="numeric" placeholder="–" value="${escapeHtml(set.reps)}">
            <span class="muted">×</span>
            <input aria-label="Satz ${index + 1}, Gewicht in kg" data-field="weight" type="number" min="0" step="0.5" inputmode="decimal" placeholder="–" value="${escapeHtml(set.weight)}">
          </div>`).join("")}
        ${sessionExercise.sets.map((set, index) => `
          <div class="set-controls" data-set-index="${index}">
            <span></span>
            <div class="stepper"><button data-action="reps-down" aria-label="Wiederholungen verringern">−</button><button data-action="reps-up" aria-label="Wiederholungen erhöhen">+</button></div>
            <span></span>
            <div class="stepper"><button data-action="weight-down" aria-label="Gewicht verringern">−</button><button data-action="weight-up" aria-label="Gewicht erhöhen">+</button></div>
          </div>`).join("")}
        <button class="small-button" data-action="remove-set" ${sessionExercise.sets.length <= 1 ? "disabled" : ""}>− Letzten Satz entfernen</button>
        ${suggestedWeight !== null ? `<div class="suggestion"><span>Gewicht erhöhen auf <strong>${formatNumber(suggestedWeight)} kg</strong></span><button class="small-button" data-action="apply-suggestion">Übernehmen</button></div>` : ""}
        <button class="small-button" data-action="add-set">＋ Satz hinzufügen</button>
      </article>`;
  }).join("");
  app.innerHTML = `
    <div class="section-head"><div><h2>${escapeHtml(plan.name)}</h2><p class="hint">Training vom ${escapeHtml(formatDate(data.draft.date))}</p></div><button class="small-button" data-action="cancel-training">Abbrechen</button></div>
    ${cards || `<div class="card empty">In diesem Training sind keine Übungen. Du kannst es trotzdem speichern.</div>`}
    <button class="button primary full" id="save-training">Training speichern</button>
    <p class="hint">Dein Zwischenstand wird automatisch auf diesem Gerät gespeichert.</p>`;
}

function renderPlans() {
  app.innerHTML = `
    <div class="section-head"><h2>Deine Pläne</h2><button class="button primary" data-action="new-plan">＋ Neuer Plan</button></div>
    ${data.plans.length ? data.plans.map(plan => `
      <section class="card">
        <div class="plan-item"><div><h3>${escapeHtml(plan.name)}</h3><p>${plan.exercises.length} Übungen</p></div>
          <div class="row"><button class="icon-button" data-action="rename-plan" data-plan-id="${escapeHtml(plan.id)}" aria-label="Plan umbenennen">✎</button><button class="icon-button" data-action="delete-plan" data-plan-id="${escapeHtml(plan.id)}" aria-label="Plan löschen">⌫</button></div>
        </div>
        <div style="margin-top:14px">${sortedExercises(plan).map((exercise, index, exercises) => `
          <div class="plan-item">
            <div><strong>${escapeHtml(exercise.name)}</strong><p>${exercise.targetSets} × ${exercise.targetReps} · Schritt ${formatNumber(exercise.weightStep)} kg</p></div>
            <div class="row">
              <div class="move-controls"><button data-action="move-exercise" data-plan-id="${escapeHtml(plan.id)}" data-exercise-id="${escapeHtml(exercise.id)}" data-direction="-1" aria-label="Übung nach oben" ${index === 0 ? "disabled" : ""}>↑</button><button data-action="move-exercise" data-plan-id="${escapeHtml(plan.id)}" data-exercise-id="${escapeHtml(exercise.id)}" data-direction="1" aria-label="Übung nach unten" ${index === exercises.length - 1 ? "disabled" : ""}>↓</button></div>
              <button class="icon-button" data-action="edit-exercise" data-plan-id="${escapeHtml(plan.id)}" data-exercise-id="${escapeHtml(exercise.id)}" aria-label="Übung bearbeiten">✎</button>
              <button class="icon-button" data-action="delete-exercise" data-plan-id="${escapeHtml(plan.id)}" data-exercise-id="${escapeHtml(exercise.id)}" aria-label="Übung entfernen">×</button>
            </div>
          </div>`).join("")}</div>
        <button class="small-button" style="margin-top:12px" data-action="new-exercise" data-plan-id="${escapeHtml(plan.id)}">＋ Übung hinzufügen</button>
      </section>`).join("") : `<div class="card empty">Noch keine Pläne angelegt.</div>`}
    <p class="hint">Die Reihenfolge hier dient der Anzeige. Im Training kannst du Übungen beliebig bearbeiten.</p>`;
}

function makeChart(values, label, unit) {
  if (!values.length) return `<p class="hint">Noch keine Daten für ein Diagramm.</p>`;
  const width = 320, height = 130, padX = 28, padY = 16;
  const nums = values.map(item => item.value);
  const min = Math.min(...nums), max = Math.max(...nums);
  const range = max - min || 1;
  const points = values.map((item, index) => ({
    x: padX + (values.length === 1 ? 0 : (index / (values.length - 1)) * (width - padX * 2)),
    y: height - padY - ((item.value - min) / range) * (height - padY * 2),
    item
  }));
  const polyline = points.map(point => `${point.x},${point.y}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
    <line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" stroke="var(--line)"/>
    <polyline points="${polyline}" fill="none" stroke="#88bd3d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(({x,y,item}) => `<circle cx="${x}" cy="${y}" r="4" fill="#88bd3d"><title>${escapeHtml(formatDate(item.date))}: ${formatNumber(item.value)} ${unit}</title></circle>`).join("")}
    <text class="chart-label" x="${padX}" y="${height-1}">${escapeHtml(formatDate(values[0].date))}</text>
    <text class="chart-label" x="${width-padX}" y="${height-1}" text-anchor="end">${escapeHtml(formatDate(values.at(-1).date))}</text>
    <text class="chart-label" x="${padX}" y="12">${formatNumber(max)} ${escapeHtml(unit)}</text>
  </svg>`;
}

function renderHistory() {
  const logs = data.logs.slice().sort((a, b) => b.date.localeCompare(a.date));
  const weeklyCount = data.logs.filter(log => {
    const date = new Date(`${log.date}T12:00:00`);
    const now = new Date();
    const days = (now - date) / 86400000;
    return days >= 0 && days < 7;
  }).length;
  const exerciseNames = new Map(data.plans.flatMap(plan => plan.exercises.map(exercise => [exercise.id, exercise.name])));
  data.logs.forEach(log => log.exercises.forEach(entry => {
    if (!exerciseNames.has(entry.exerciseId) && entry.exerciseName) exerciseNames.set(entry.exerciseId, entry.exerciseName);
  }));
  const allExerciseIds = [...new Set(data.logs.flatMap(log => log.exercises.map(exercise => exercise.exerciseId)))];
  const records = allExerciseIds.map(exerciseId => {
    const points = data.logs.flatMap(log => {
      const entry = log.exercises.find(item => item.exerciseId === exerciseId);
      if (!entry) return [];
      const sets = entry.sets
        .filter(set => set.reps !== "" && set.weight !== "")
        .map(set => ({ reps: Number(set.reps), weight: Number(set.weight) }))
        .filter(set => Number.isFinite(set.reps) && Number.isFinite(set.weight));
      if (!sets.length) return [];
      return [{ date: log.date, max: Math.max(...sets.map(set => set.weight)), volume: sets.reduce((sum, set) => sum + set.reps * set.weight, 0) }];
    }).sort((a, b) => a.date.localeCompare(b.date));
    return { exerciseId, name: exerciseNames.get(exerciseId) ?? "Entfernte Übung", points };
  }).filter(record => record.points.length);
  const personalBests = records.filter(record => record.points.length).map(record => ({
    name: record.name,
    max: Math.max(...record.points.map(point => point.max))
  }));
  app.innerHTML = `
    <div class="section-head"><h2>Dein Verlauf</h2></div>
    <div class="stats">
      <div class="stat"><strong>${weeklyCount}</strong><span>Trainings in den letzten 7 Tagen</span></div>
      <div class="stat"><strong>${data.logs.length}</strong><span>Trainings insgesamt</span></div>
    </div>
    ${personalBests.length ? `<section class="card"><h3>Persönliche Bestwerte</h3>${personalBests.map(record => `<div class="plan-item"><strong>${escapeHtml(record.name)}</strong><span>${formatNumber(record.max)} kg</span></div>`).join("")}</section>` : ""}
    ${records.length ? records.map(record => `
      <section class="card"><h3>${escapeHtml(record.name)}</h3>
        <div class="history-exercise"><p class="hint">Maximalgewicht</p>${makeChart(record.points.map(point => ({ date: point.date, value: point.max })), `${record.name}: Maximalgewicht`, "kg")}</div>
        <div class="history-exercise"><p class="hint">Gesamtvolumen</p>${makeChart(record.points.map(point => ({ date: point.date, value: point.volume })), `${record.name}: Gesamtvolumen`, "kg")}</div>
      </section>`).join("") : `<div class="card empty">Dein Verlauf erscheint hier, sobald du ein Training gespeichert hast.</div>`}
    <div class="section-head"><h2>Vergangene Trainings</h2></div>
    ${logs.length ? logs.map(log => `
      <section class="card history-entry"><div class="row spread"><h3>${escapeHtml(data.plans.find(plan => plan.id === log.planId)?.name ?? "Gelöschter Plan")}</h3><span class="muted">${escapeHtml(formatDate(log.date))}</span></div>
        ${log.exercises.map(entry => `<div class="history-exercise"><strong>${escapeHtml(exerciseNames.get(entry.exerciseId) ?? "Entfernte Übung")}</strong><p>${entry.sets.map(set => `${escapeHtml(set.reps || "–")} x ${escapeHtml(set.weight || "–")} kg`).join(" · ") || "Keine Sätze"}</p></div>`).join("")}
      </section>`).join("") : `<div class="card empty">Noch keine gespeicherten Trainings.</div>`}
    <button class="button primary full" data-action="copy-analysis" ${logs.length ? "" : "disabled"}>Auswertung kopieren</button>`;
}

function renderSettings() {
  const oldExport = !data.settings.lastExportAt || Date.now() - new Date(data.settings.lastExportAt).getTime() > 30 * 86400000;
  app.innerHTML = `
    <div class="section-head"><h2>Einstellungen</h2></div>
    <section class="card">
      <h3>Auswertungs-Prompt</h3><p class="hint">Dieser Text wird deinen Trainingsdaten beim Kopieren vorangestellt.</p>
      <label class="field"><span>Prompt-Text</span><textarea id="analysis-prompt">${escapeHtml(data.settings.analysisPrompt)}</textarea></label>
      <button class="button secondary" data-action="save-prompt">Prompt speichern</button>
    </section>
    <section class="card">
      <h3>Backup deiner Daten</h3>
      <p class="hint">${data.settings.lastExportAt ? `Letzter Export: ${escapeHtml(new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.settings.lastExportAt)))}` : "Noch kein Export erstellt."}</p>
      ${oldExport ? `<p class="notice">Denk daran, deine Daten gelegentlich zu exportieren. Backups liegen außerhalb dieser App.</p>` : ""}
      <div class="row wrap"><button class="button primary" data-action="export-data">Exportieren</button><button class="button secondary" data-action="import-data">Importieren</button></div>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </section>
    <section class="card"><h3>Privat &amp; lokal</h3><p class="hint">Deine Trainingsdaten werden nur in diesem Browser auf diesem Gerät gespeichert. Es werden keine Daten übertragen.</p>
      <p class="footnote muted">Schema-Version ${CURRENT_VERSION} · Installiere die App über das Browser-Menü auf deinem Startbildschirm.</p>
    </section>`;
}

function openEditor(title, fields, onSave) {
  document.querySelector("#dialog-title").textContent = title;
  editorFields.innerHTML = fields;
  editorForm.onsubmit = event => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    onSave(new FormData(editorForm));
    editor.close();
  };
  editor.showModal();
}

function openPlanEditor(plan = null) {
  openEditor(plan ? "Plan umbenennen" : "Neuer Trainingsplan", `
    <label class="field"><span>Name</span><input name="name" required maxlength="60" value="${escapeHtml(plan?.name ?? "")}" placeholder="z. B. Ganzkörper"></label>`,
  form => {
    const name = String(form.get("name")).trim();
    if (!name) return;
    if (plan) plan.name = name;
    else {
      const created = { id: uid(), name, exercises: [] };
      data.plans.push(created);
      selectedPlanId = created.id;
    }
    saveAndRender(plan ? "Plan umbenannt." : "Plan angelegt.");
  });
}

function openExerciseEditor(plan, exercise = null) {
  openEditor(exercise ? "Übung bearbeiten" : "Übung hinzufügen", `
    <label class="field"><span>Name der Übung</span><input name="name" required maxlength="80" value="${escapeHtml(exercise?.name ?? "")}"></label>
    <label class="field"><span>Ziel-Sätze</span><input name="targetSets" type="number" min="1" max="30" step="1" required value="${exercise?.targetSets ?? 3}"></label>
    <label class="field"><span>Ziel-Wiederholungen</span><input name="targetReps" type="number" min="1" max="100" step="1" required value="${exercise?.targetReps ?? 10}"></label>
    <label class="field"><span>Gewichtsschritt (kg)</span><input name="weightStep" type="number" min="0.1" max="100" step="0.1" required value="${exercise?.weightStep ?? 2.5}"></label>`,
  form => {
    const updated = {
      name: String(form.get("name")).trim(),
      targetSets: Number(form.get("targetSets")),
      targetReps: Number(form.get("targetReps")),
      weightStep: Number(form.get("weightStep"))
    };
    if (!updated.name || !updated.targetSets || !updated.targetReps || !updated.weightStep) return;
    if (exercise) Object.assign(exercise, updated);
    else plan.exercises.push({ id: uid(), ...updated, order: plan.exercises.length });
    saveAndRender(exercise ? "Übung aktualisiert." : "Übung hinzugefügt.");
  });
}

function updateDraftFromCard(card) {
  const sessionExercise = data.draft?.exercises.find(item => item.exerciseId === card.dataset.exerciseId);
  if (!sessionExercise) return;
  sessionExercise.sets = [...card.querySelectorAll(".set-row")].map(row => ({
    reps: row.querySelector('[data-field="reps"]').value,
    weight: row.querySelector('[data-field="weight"]').value
  }));
  persist();
}

function saveTraining() {
  if (!data.draft) return;
  const plan = data.plans.find(item => item.id === data.draft.planId);
  const log = {
    id: data.draft.id, planId: data.draft.planId, date: data.draft.date,
    exercises: data.draft.exercises.map(entry => ({
      exerciseId: entry.exerciseId,
      exerciseName: plan.exercises.find(exercise => exercise.id === entry.exerciseId)?.name ?? "Entfernte Übung",
      sets: entry.sets.map(set => ({
        reps: set.reps === "" ? "" : Number(set.reps),
        weight: set.weight === "" ? "" : Number(set.weight)
      }))
    }))
  };
  if (!plan) { notify("Der Trainingsplan ist nicht mehr vorhanden."); return; }
  data.logs.push(log);
  data.draft = null;
  saveAndRender("Training gespeichert.");
}

function formatAnalysisData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 56);
  return data.logs.filter(log => new Date(`${log.date}T12:00:00`) >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const plan = data.plans.find(item => item.id === log.planId);
      const exercises = log.exercises.map(entry => {
        const name = plan?.exercises.find(item => item.id === entry.exerciseId)?.name ?? entry.exerciseName ?? "Entfernte Übung";
        const sets = entry.sets.map(set => `${set.reps || "–"} x ${set.weight || "–"} kg`).join(", ");
        return `  ${name}: ${sets || "keine Sätze"}`;
      });
      return `${formatDate(log.date)}${plan ? ` · ${plan.name}` : ""}\n${exercises.join("\n")}`;
    }).join("\n\n");
}

async function copyAnalysis() {
  const content = `${data.settings.analysisPrompt.trim()}\n\n${formatAnalysisData() || "Für die letzten 8 Wochen liegen noch keine Trainingsdaten vor."}`;
  try {
    await navigator.clipboard.writeText(content);
    notify("Auswertung in die Zwischenablage kopiert.");
  } catch (error) {
    console.warn("Clipboard-API nicht verfügbar; zeige Text zum manuellen Kopieren.", error);
    openEditor("Auswertung kopieren", `<label class="field"><span>Text markieren und kopieren</span><textarea id="copy-fallback" readonly>${escapeHtml(content)}</textarea></label>`, () => {});
    setTimeout(() => {
      const textarea = document.querySelector("#copy-fallback");
      textarea?.focus(); textarea?.select();
    }, 0);
  }
}

function exportData() {
  try {
    const now = new Date();
    data.settings.lastExportAt = now.toISOString();
    persist();
    const payload = JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mein-training-${now.toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    render();
    notify("Backup wurde exportiert.");
  } catch (error) {
    console.error("Export fehlgeschlagen.", error);
    notify(`Export fehlgeschlagen: ${error.message}`);
  }
}

function validImport(candidate) {
  const validId = value => typeof value === "string" && value.length > 0;
  const validNumberOrEmpty = value => value === "" || value === null ||
    ((typeof value === "number" || typeof value === "string") &&
      String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0);
  const validSet = set => Boolean(set && validNumberOrEmpty(set.reps) && validNumberOrEmpty(set.weight));
  const validExerciseEntry = entry => entry && validId(entry.exerciseId) &&
    (entry.exerciseName === undefined || typeof entry.exerciseName === "string") &&
    Array.isArray(entry.sets) && entry.sets.every(validSet);
  const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00`));
  return candidate && Number.isInteger(candidate.schemaVersion) && candidate.schemaVersion > 0 && candidate.schemaVersion <= CURRENT_VERSION &&
    Array.isArray(candidate.plans) && Array.isArray(candidate.logs) &&
    candidate.plans.every(plan => validId(plan.id) && typeof plan.name === "string" && Array.isArray(plan.exercises) &&
      plan.exercises.every(exercise => validId(exercise.id) && typeof exercise.name === "string" &&
        Number.isInteger(exercise.targetSets) && exercise.targetSets > 0 &&
        Number.isInteger(exercise.targetReps) && exercise.targetReps > 0 &&
        Number.isFinite(exercise.weightStep) && exercise.weightStep > 0 && Number.isFinite(exercise.order))) &&
    candidate.logs.every(log => validId(log.id) && validId(log.planId) && validDate(log.date) &&
      Array.isArray(log.exercises) && log.exercises.every(validExerciseEntry)) &&
    (candidate.draft === null || candidate.draft === undefined ||
      (validId(candidate.draft.id) && validId(candidate.draft.planId) && validDate(candidate.draft.date) &&
        Array.isArray(candidate.draft.exercises) && candidate.draft.exercises.every(validExerciseEntry))) &&
    (candidate.settings === undefined || candidate.settings &&
      typeof candidate.settings.analysisPrompt === "string" &&
      (candidate.settings.lastExportAt === null || typeof candidate.settings.lastExportAt === "string"));
}

async function importFile(file) {
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!validImport(imported)) throw new Error("Datei hat kein unterstütztes Datenformat.");
    if (!confirm("Bestehende Daten vollständig durch das Backup ersetzen?")) return;
    data = {
      schemaVersion: CURRENT_VERSION, plans: imported.plans, logs: imported.logs,
      draft: imported.draft ?? null, settings: { ...defaultSettings(), ...imported.settings }
    };
    selectedPlanId = data.plans[0]?.id ?? "";
    saveAndRender("Backup importiert.");
  } catch (error) {
    console.error("Import fehlgeschlagen.", error);
    notify(`Import fehlgeschlagen: ${error.message}`);
  }
}

app.addEventListener("input", event => {
  const card = event.target.closest(".exercise-card");
  if (card && event.target.matches("input")) updateDraftFromCard(card);
});

app.addEventListener("change", event => {
  if (event.target.id === "start-plan") selectedPlanId = event.target.value;
});

app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (button.dataset.tab) {
    activeTab = button.dataset.tab; render(); return;
  }
  if (button.id === "start-training") { startTraining(document.querySelector("#start-plan").value); return; }
  if (button.id === "save-training") { saveTraining(); return; }
  if (!action) return;
  const plan = data.plans.find(item => item.id === button.dataset.planId);
  const exercise = plan?.exercises.find(item => item.id === button.dataset.exerciseId);
  if (action === "new-plan") openPlanEditor();
  else if (action === "rename-plan" && plan) openPlanEditor(plan);
  else if (action === "delete-plan" && plan && confirm(`Plan „${plan.name}“ wirklich löschen? Zugehörige Trainings bleiben im Verlauf erhalten.`)) {
    data.plans = data.plans.filter(item => item.id !== plan.id);
    if (data.draft?.planId === plan.id) data.draft = null;
    saveAndRender("Plan gelöscht.");
  } else if (action === "new-exercise" && plan) openExerciseEditor(plan);
  else if (action === "edit-exercise" && plan && exercise) openExerciseEditor(plan, exercise);
  else if (action === "delete-exercise" && plan && exercise && confirm(`Übung „${exercise.name}“ aus dem Plan entfernen?`)) {
    plan.exercises = plan.exercises.filter(item => item.id !== exercise.id);
    if (data.draft?.planId === plan.id) {
      data.draft.exercises = data.draft.exercises.filter(item => item.exerciseId !== exercise.id);
    }
    saveAndRender("Übung entfernt.");
  } else if (action === "move-exercise" && plan && exercise) {
    const list = sortedExercises(plan);
    const index = list.findIndex(item => item.id === exercise.id);
    const swap = index + Number(button.dataset.direction);
    if (list[swap]) [list[index], list[swap]] = [list[swap], list[index]];
    list.forEach((item, order) => item.order = order);
    saveAndRender();
  } else if (action === "add-set" || action === "remove-set" || action === "remove-exercise" || action === "weight-up" || action === "weight-down" || action === "reps-up" || action === "reps-down" || action === "apply-suggestion") {
    const card = button.closest(".exercise-card");
    const draftExercise = data.draft?.exercises.find(item => item.exerciseId === card.dataset.exerciseId);
    const planExercise = data.plans.find(item => item.id === data.draft.planId)?.exercises.find(item => item.id === card.dataset.exerciseId);
    if (!draftExercise || !planExercise) return;
    if (action === "add-set") draftExercise.sets.push({ reps: "", weight: "" });
    if (action === "remove-set" && draftExercise.sets.length > 1) draftExercise.sets.pop();
    if (action === "remove-exercise") data.draft.exercises = data.draft.exercises.filter(item => item.exerciseId !== draftExercise.exerciseId);
    if (action === "weight-up" || action === "weight-down" || action === "reps-up" || action === "reps-down") {
      const controls = button.closest(".set-controls");
      const row = card.querySelector(`.set-row[data-set-index="${controls.dataset.setIndex}"]`);
      const isWeight = action.startsWith("weight");
      const input = row.querySelector(`[data-field="${isWeight ? "weight" : "reps"}"]`);
      const current = Number(input.value) || 0;
      const increment = isWeight ? Number(planExercise.weightStep) : 1;
      input.value = String(Math.max(0, current + (action.endsWith("up") ? increment : -increment)));
      updateDraftFromCard(card);
    }
    if (action === "apply-suggestion") {
      const previous = lastLogFor(data.draft.planId, planExercise.id);
      if (!previous?.sets?.length) return;
      draftExercise.sets = previous.sets.map(set => ({
        reps: set.reps ?? "",
        weight: Number.isFinite(Number(set.weight)) ? String(Number(set.weight) + Number(planExercise.weightStep)) : ""
      }));
    }
    saveAndRender();
  } else if (action === "cancel-training") {
    if (confirm("Training abbrechen und den Zwischenstand verwerfen?")) { data.draft = null; saveAndRender("Training abgebrochen."); }
  } else if (action === "copy-analysis") copyAnalysis();
  else if (action === "save-prompt") {
    data.settings.analysisPrompt = document.querySelector("#analysis-prompt").value;
    saveAndRender("Prompt gespeichert.");
  } else if (action === "export-data") exportData();
  else if (action === "import-data") document.querySelector("#import-file").click();
});

app.addEventListener("change", event => {
  if (event.target.id === "import-file") importFile(event.target.files[0]);
});

document.querySelectorAll(".tabs button").forEach(button => button.addEventListener("click", () => {
  activeTab = button.dataset.tab; render();
}));

if ("storage" in navigator && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (!granted) console.info("Persistenter Speicher wurde vom Browser nicht gewährt.");
  }).catch(error => console.warn("Speicher-Persistenz konnte nicht angefragt werden.", error));
}
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./service-worker.js").catch(error => console.error("Service Worker konnte nicht registriert werden.", error));
}
render();
