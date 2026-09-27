// ============================================================
// TIMER BUILDER — v4 (preview button)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbzA1JpCvFrKEXd4VhSec_f8uqH760HIXKv6DcenF06zySPxuGDT4KP8RBycZW5XDM2kaw/exec";
const COACH_KEY_STORAGE = "coachKey";

const $ = function (id) { return document.getElementById(id); };

const state = {
  coachKey: null,
  timers: [],
  editingTimer: null,
  editingIntervalIndex: -1,
  editingCircuit: null,
  editingCircuitIndex: -1,
  quickDurationValue: null,
  clipboard: null,
  dragSourceIndex: -1,
  dragTargetIndex: -1
};

const COLORS = [
  "#b8f52c", "#ff3b30", "#c0c0c0", "#ff2cd9", "#00e5ff", "#ff9f1c",
  "#2e6cf6", "#9b59b6", "#f1c40f", "#e67e22", "#1abc9c", "#34495e"
];

// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  wireEvents();
  const saved = localStorage.getItem(COACH_KEY_STORAGE);
  if (saved) {
    state.coachKey = saved;
    showList();
    loadTimers();
  }
  renderColorPicker();
});

function wireEvents() {
  $("keyBtn").addEventListener("click", handleKeySubmit);
  $("keyInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleKeySubmit();
  });
  $("newTimerBtn").addEventListener("click", createNewTimer);
  $("signOutBtn").addEventListener("click", handleSignOut);
  $("backBtn").addEventListener("click", backToList);
  $("saveTimerBtn").addEventListener("click", saveTimer);
  $("previewBtn").addEventListener("click", previewTimer);
  $("addIntervalBtn").addEventListener("click", openNewIntervalModal);
  $("addCircuitBtn").addEventListener("click", openNewCircuitModal);
  $("intervalClose").addEventListener("click", closeIntervalModal);
  $("intervalSave").addEventListener("click", saveIntervalFromModal);
  document.querySelectorAll(".chip[data-sec]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      $("ivDuration").value = chip.dataset.sec;
      state.quickDurationValue = chip.dataset.sec;
      document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
      chip.classList.add("selected");
    });
  });
  $("circuitClose").addEventListener("click", closeCircuitModal);
  $("circuitSave").addEventListener("click", saveCircuitFromModal);
  $("circuitAddInterval").addEventListener("click", addInnerInterval);
}

// ============================================================
// KEY GATE
// ============================================================

async function handleKeySubmit() {
  const key = $("keyInput").value.trim();
  if (!key) return;
  try {
    const res = await callAPI({ action: "coachAthletes", key: key });
    if (!res || !res.ok) {
      $("keyErr").textContent = (res && res.error) || "Invalid key";
      return;
    }
    state.coachKey = key;
    localStorage.setItem(COACH_KEY_STORAGE, key);
    $("keyErr").textContent = "";
    showList();
    loadTimers();
  } catch (e) {
    $("keyErr").textContent = "Network error";
  }
}

function handleSignOut() {
  localStorage.removeItem(COACH_KEY_STORAGE);
  state.coachKey = null;
  $("keyGate").classList.remove("hidden");
  $("listView").classList.add("hidden");
  $("editorView").classList.add("hidden");
  $("keyInput").value = "";
}

function showList() {
  $("keyGate").classList.add("hidden");
  $("listView").classList.remove("hidden");
  $("editorView").classList.add("hidden");
}

function showEditor() {
  $("keyGate").classList.add("hidden");
  $("listView").classList.add("hidden");
  $("editorView").classList.remove("hidden");
}

// ============================================================
// LOAD TIMERS
// ============================================================

async function loadTimers() {
  const list = $("timerList");
  list.innerHTML = '<div class="empty-state">Loading timers…</div>';

  try {
    const res = await callAPI({ action: "getTimersByKey", key: state.coachKey });
    if (!res || !res.ok) {
      list.innerHTML = '<div class="empty-state">Could not load timers.</div>';
      return;
    }
    state.timers = res.timers || [];
    renderTimerList();
  } catch (e) {
    list.innerHTML = '<div class="empty-state">Network error loading timers.</div>';
  }
}

function renderTimerList() {
  const list = $("timerList");
  if (!state.timers.length) {
    list.innerHTML = '<div class="empty-state">No timers yet. Tap "New Timer" to create one.</div>';
    return;
  }

  list.innerHTML = "";
  state.timers.forEach(function (timer) {
    const card = document.createElement("div");
    card.className = "timer-card";

    const intervalCount = parseIntervalCount(timer.structure);

    card.innerHTML =
      '<div class="timer-card-info">' +
        '<div class="timer-card-name">' + escapeHtml(timer.timerName || "(unnamed)") + '</div>' +
        '<div class="timer-card-meta">' +
          escapeHtml(timer.timerId) + ' • ' +
          intervalCount + ' interval' + (intervalCount === 1 ? '' : 's') + ' • ' +
          formatDuration(timer.totalDuration || 0) +
        '</div>' +
      '</div>' +
      '<button class="timer-card-delete" data-id="' + escapeHtml(timer.timerId) + '">×</button>';

    card.querySelector(".timer-card-info").addEventListener("click", function () {
      editExistingTimer(timer);
    });

    card.querySelector(".timer-card-delete").addEventListener("click", function (e) {
      e.stopPropagation();
      deleteTimer(timer.timerId);
    });

    list.appendChild(card);
  });
}

function parseIntervalCount(structureJson) {
  try {
    const raw = JSON.parse(structureJson || "[]");
    return raw.length;
  } catch (e) { return 0; }
}

// ============================================================
// NEW / EDIT TIMER
// ============================================================

function createNewTimer() {
  state.editingTimer = {
    timerId: "",
    timerName: "",
    timerType: "intervals",
    totalDuration: 0,
    structure: [],
    ttsTitle: "",
    ttsCues: { halfway: true, countdown3s: true, nextUp: true },
    defaultColors: {},
    requiresInput: false,
    inputPrompts: [],
    musicTrack: "",
    notes: ""
  };
  openEditor();
}

function editExistingTimer(timer) {
  let structure = [];
  let cues = { halfway: true, countdown3s: true, nextUp: true };
  let prompts = [];

  try { structure = JSON.parse(timer.structure || "[]"); } catch (e) {}
  try { cues = JSON.parse(timer.ttsCues || "{}"); } catch (e) {}
  try { prompts = JSON.parse(timer.inputPrompts || "[]"); } catch (e) {}

  state.editingTimer = {
    timerId: timer.timerId,
    timerName: timer.timerName,
    timerType: timer.timerType,
    totalDuration: timer.totalDuration,
    structure: structure,
    ttsTitle: timer.ttsTitle || "",
    ttsCues: cues,
    defaultColors: {},
    requiresInput: timer.requiresInput || false,
    inputPrompts: prompts,
    musicTrack: timer.musicTrack || "",
    notes: timer.notes || ""
  };
  openEditor();
}

function openEditor() {
  const t = state.editingTimer;

  $("editorTitle").textContent = t.timerId ? "Edit Timer" : "New Timer";
  $("timerName").value = t.timerName || "";
  $("timerType").value = t.timerType || "intervals";
  $("ttsTitle").value = t.ttsTitle || "";
  $("timerNotes").value = t.notes || "";
  $("cueHalfway").checked = t.ttsCues.halfway !== false;
  $("cueCountdown").checked = t.ttsCues.countdown3s !== false;
  $("cueNextUp").checked = t.ttsCues.nextUp !== false;

  renderIntervalEditorList();
  showEditor();
}

function backToList() {
  state.editingTimer = null;
  state.clipboard = null;
  showList();
  loadTimers();
}

// ============================================================
// PREVIEW
// ============================================================

function previewTimer() {
  const t = state.editingTimer;
  if (!t.timerId) {
    showToast("Save the timer first, then preview", true);
    return;
  }
  const url = "timer.html?id=" + encodeURIComponent(t.timerId) +
    "&preview=1&key=" + encodeURIComponent(state.coachKey);
  window.open(url, "_blank");
}

// ============================================================
// RENDER INTERVAL EDITOR LIST
// ============================================================

function renderIntervalEditorList() {
  const t = state.editingTimer;
  const list = $("intervalList");

  if (!t.structure.length) {
    list.innerHTML = '<div class="empty-state">No intervals yet. Add one.</div>';
    return;
  }

  list.innerHTML = "";

  if (state.clipboard) {
    const pasteBar = document.createElement("div");
    pasteBar.className = "paste-bar";
    pasteBar.innerHTML =
      '<span class="paste-label">Copied: ' + escapeHtml(state.clipboard.name || state.clipboard.type) + '</span>' +
      '<button class="paste-btn">Paste Here</button>' +
      '<button class="clear-clip-btn">Clear</button>';

    pasteBar.querySelector(".paste-btn").addEventListener("click", function () {
      pasteAt(0);
    });
    pasteBar.querySelector(".clear-clip-btn").addEventListener("click", function () {
      state.clipboard = null;
      renderIntervalEditorList();
    });

    list.appendChild(pasteBar);
  }

  t.structure.forEach(function (iv, i) {
    list.appendChild(renderIntervalRow(iv, i));
  });
}

function renderIntervalRow(iv, index) {
  const row = document.createElement("div");
  row.className = "interval-row";
  if (iv.type === "circuit") row.classList.add("is-circuit");
  row.dataset.index = index;
  row.draggable = false;

  const color = iv.color || (iv.type === "circuit" ? "#2e6cf6" : "#b8f52c");
  const isCircuit = iv.type === "circuit";

  const name = isCircuit
    ? (iv.name || "Circuit")
    : (iv.name || iv.type || "Interval");

  const meta = isCircuit
    ? iv.rounds + " rounds × " + (iv.intervals || []).length + " intervals"
    : formatDuration(iv.duration || 0) + " • " + (iv.type || "work");

  row.innerHTML =
    '<div class="drag-handle" title="Drag to reorder">⋮⋮</div>' +
    '<div class="interval-swatch" style="background:' + color + '"></div>' +
    '<div class="interval-info">' +
      '<div class="interval-name-row">' + escapeHtml(name) + '</div>' +
      '<div class="interval-meta">' + escapeHtml(meta) + '</div>' +
    '</div>' +
    '<div class="interval-row-actions">' +
      '<button class="interval-copy-btn" data-act="copy" data-idx="' + index + '" title="Copy">📋</button>' +
      '<button class="interval-move-btn" data-act="up" data-idx="' + index + '">↑</button>' +
      '<button class="interval-move-btn" data-act="down" data-idx="' + index + '">↓</button>' +
      '<button class="interval-delete-btn" data-act="del" data-idx="' + index + '">×</button>' +
    '</div>';

  row.querySelector(".interval-info").addEventListener("click", function () {
    if (isCircuit) openCircuitModal(index);
    else openIntervalModal(index);
  });

  row.querySelectorAll("button[data-act]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const act = btn.dataset.act;
      const idx = parseInt(btn.dataset.idx, 10);
      if (act === "up") moveInterval(idx, -1);
      else if (act === "down") moveInterval(idx, 1);
      else if (act === "del") deleteInterval(idx);
      else if (act === "copy") copyInterval(idx);
    });
  });

  attachDragHandlers(row, index);

  return row;
}

function attachDragHandlers(row, index) {
  const handle = row.querySelector(".drag-handle");

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag, { passive: false });

  function startDrag(e) {
    e.preventDefault();
    row.draggable = true;
    state.dragSourceIndex = index;
    row.classList.add("dragging");
  }

  row.addEventListener("dragstart", function (e) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    state.dragSourceIndex = index;
    row.classList.add("dragging");
  });

  row.addEventListener("dragend", function () {
    row.classList.remove("dragging");
    row.draggable = false;
    clearDragHints();
    state.dragSourceIndex = -1;
    state.dragTargetIndex = -1;
  });

  row.addEventListener("dragover", function (e) {
    if (state.dragSourceIndex < 0 || state.dragSourceIndex === index) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = row.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const before = e.clientY < midpoint;

    clearDragHints();
    row.classList.add(before ? "drag-over-top" : "drag-over-bottom");
    state.dragTargetIndex = before ? index : index + 1;
  });

  row.addEventListener("drop", function (e) {
    e.preventDefault();
    if (state.dragTargetIndex < 0) return;
    performDragReorder(state.dragSourceIndex, state.dragTargetIndex);
  });
}

function clearDragHints() {
  document.querySelectorAll(".interval-row").forEach(function (r) {
    r.classList.remove("drag-over-top", "drag-over-bottom");
  });
}

function performDragReorder(fromIndex, toIndex) {
  const arr = state.editingTimer.structure;
  if (fromIndex < 0 || fromIndex >= arr.length) return;

  const moved = arr.splice(fromIndex, 1)[0];
  if (toIndex > fromIndex) toIndex--;
  arr.splice(toIndex, 0, moved);

  state.dragSourceIndex = -1;
  state.dragTargetIndex = -1;
  renderIntervalEditorList();
}

// ============================================================
// COPY / PASTE
// ============================================================

function copyInterval(index) {
  const source = state.editingTimer.structure[index];
  state.clipboard = JSON.parse(JSON.stringify(source));
  showToast("Copied: " + (state.clipboard.name || state.clipboard.type));
  renderIntervalEditorList();
}

function pasteAt(insertIndex) {
  if (!state.clipboard) return;
  const copy = JSON.parse(JSON.stringify(state.clipboard));
  state.editingTimer.structure.splice(insertIndex, 0, copy);
  renderIntervalEditorList();
  showToast("Pasted");
}

// ============================================================
// MOVE / DELETE
// ============================================================

function moveInterval(index, direction) {
  const arr = state.editingTimer.structure;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= arr.length) return;
  const temp = arr[index];
  arr[index] = arr[newIdx];
  arr[newIdx] = temp;
  renderIntervalEditorList();
}

function deleteInterval(index) {
  if (!confirm("Delete this interval?")) return;
  state.editingTimer.structure.splice(index, 1);
  renderIntervalEditorList();
}

// ============================================================
// INTERVAL MODAL
// ============================================================

function openNewIntervalModal() {
  state.editingIntervalIndex = -1;
  $("intervalModalTitle").textContent = "Add Interval";
  $("ivName").value = "";
  $("ivType").value = "work";
  $("ivDuration").value = "";
  $("ivColorCustom").value = "";
  state.quickDurationValue = null;
  document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
  selectColorSwatch("#b8f52c");
  $("intervalModal").classList.remove("hidden");
}

function openIntervalModal(index) {
  const iv = state.editingTimer.structure[index];
  state.editingIntervalIndex = index;
  $("intervalModalTitle").textContent = "Edit Interval";
  $("ivName").value = iv.name || "";
  $("ivType").value = iv.type || "work";
  $("ivDuration").value = iv.duration || "";
  $("ivColorCustom").value = "";
  document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
  if (iv.color) selectColorSwatch(iv.color);
  else selectColorSwatch("#b8f52c");
  $("intervalModal").classList.remove("hidden");
}

function closeIntervalModal() {
  $("intervalModal").classList.add("hidden");
  state.editingIntervalIndex = -1;
}

function saveIntervalFromModal() {
  const name = $("ivName").value.trim();
  const type = $("ivType").value;
  const duration = parseInt($("ivDuration").value, 10);
  const color = $("ivColorCustom").value.trim() || getSelectedColor() || "#b8f52c";

  if (!name) { showToast("Give the interval a name", true); return; }
  if (!duration || duration < 1) { showToast("Set a duration", true); return; }

  const newInterval = {
    name: name,
    type: type,
    duration: duration,
    color: color
  };

  if (state.editingIntervalIndex >= 0) {
    state.editingTimer.structure[state.editingIntervalIndex] = newInterval;
  } else {
    state.editingTimer.structure.push(newInterval);
  }

  closeIntervalModal();
  renderIntervalEditorList();
}

// ============================================================
// COLOR PICKER
// ============================================================

function renderColorPicker() {
  const picker = $("colorPicker");
  picker.innerHTML = "";
  COLORS.forEach(function (color) {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.addEventListener("click", function () {
      selectColorSwatch(color);
      $("ivColorCustom").value = "";
    });
    picker.appendChild(swatch);
  });
}

function selectColorSwatch(color) {
  document.querySelectorAll(".color-swatch").forEach(function (s) {
    s.classList.toggle("selected", s.dataset.color === color);
  });
}

function getSelectedColor() {
  const sel = document.querySelector(".color-swatch.selected");
  return sel ? sel.dataset.color : null;
}

// ============================================================
// CIRCUIT MODAL
// ============================================================

function openNewCircuitModal() {
  state.editingCircuitIndex = -1;
  state.editingCircuit = {
    type: "circuit",
    name: "",
    rounds: 8,
    intervals: [],
    afterCircuit: null
  };
  $("circuitName").value = "";
  $("circuitRounds").value = 8;
  $("circuitAfterEach").value = "";
  $("circuitAfterCircuit").value = "";
  renderCircuitInnerList();
  $("circuitModal").classList.remove("hidden");
}

function openCircuitModal(index) {
  const c = state.editingTimer.structure[index];
  state.editingCircuitIndex = index;
  state.editingCircuit = {
    type: "circuit",
    name: c.name || "",
    rounds: c.rounds || 1,
    intervals: c.intervals || [],
    afterCircuit: c.afterCircuit || null
  };
  $("circuitName").value = c.name || "";
  $("circuitRounds").value = c.rounds || 1;
  $("circuitAfterEach").value = c.afterEach ? c.afterEach.duration : "";
  $("circuitAfterCircuit").value = c.afterCircuit ? c.afterCircuit.duration : "";
  renderCircuitInnerList();
  $("circuitModal").classList.remove("hidden");
}

function closeCircuitModal() {
  $("circuitModal").classList.add("hidden");
  state.editingCircuit = null;
  state.editingCircuitIndex = -1;
}

function renderCircuitInnerList() {
  const c = state.editingCircuit;
  const list = $("circuitIntervalList");

  if (!c.intervals.length) {
    list.innerHTML = '<div class="empty-state small">No intervals yet</div>';
    return;
  }

  list.innerHTML = "";
  c.intervals.forEach(function (iv, i) {
    const row = document.createElement("div");
    row.className = "interval-row small";
    const color = iv.color || "#b8f52c";
    row.innerHTML =
      '<div class="interval-swatch small" style="background:' + color + '"></div>' +
      '<div class="interval-info">' +
        '<div class="interval-name-row">' + escapeHtml(iv.name || iv.type) + '</div>' +
        '<div class="interval-meta">' + formatDuration(iv.duration || 0) + '</div>' +
      '</div>' +
      '<button class="interval-delete-btn" data-idx="' + i + '">×</button>';

    row.querySelector(".interval-delete-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      c.intervals.splice(i, 1);
      renderCircuitInnerList();
    });

    list.appendChild(row);
  });
}

function addInnerInterval() {
  const c = state.editingCircuit;
  const name = prompt("Interval name (e.g. Work):");
  if (!name) return;
  const durationStr = prompt("Duration in seconds:");
  const duration = parseInt(durationStr, 10);
  if (!duration || duration < 1) return;
  const typeChoice = prompt("Type? work / rest / mobility / lift / cooldown", "work") || "work";
  const color = typeChoice === "rest" ? "#ff3b30" : "#b8f52c";

  c.intervals.push({
    name: name,
    type: typeChoice,
    duration: duration,
    color: color
  });

  renderCircuitInnerList();
}

function saveCircuitFromModal() {
  const c = state.editingCircuit;
  const name = $("circuitName").value.trim();
  const rounds = parseInt($("circuitRounds").value, 10) || 1;
  const afterEach = parseInt($("circuitAfterEach").value, 10) || 0;
  const afterCircuit = parseInt($("circuitAfterCircuit").value, 10) || 0;

  if (!name) { showToast("Give the circuit a name", true); return; }
  if (!c.intervals.length) { showToast("Add at least one inner interval", true); return; }

  const circuit = {
    type: "circuit",
    name: name,
    rounds: rounds,
    intervals: c.intervals
  };

  if (afterEach > 0) {
    circuit.afterEach = { name: "Round Rest", type: "rest", duration: afterEach, color: "#ff3b30" };
  }
  if (afterCircuit > 0) {
    circuit.afterCircuit = { name: "Block Rest", type: "rest", duration: afterCircuit, color: "#ff3b30" };
  }

  if (state.editingCircuitIndex >= 0) {
    state.editingTimer.structure[state.editingCircuitIndex] = circuit;
  } else {
    state.editingTimer.structure.push(circuit);
  }

  closeCircuitModal();
  renderIntervalEditorList();
}

// ============================================================
// SAVE TIMER
// ============================================================

async function saveTimer() {
  const t = state.editingTimer;
  const name = $("timerName").value.trim();

  if (!name) { showToast("Timer needs a name", true); return; }
  if (!t.structure.length) { showToast("Add at least one interval", true); return; }

  let timerId = t.timerId;
  if (!timerId) {
    timerId = "T" + Date.now().toString().slice(-8);
  }

  const totalDuration = computeTotalDuration(t.structure);

  const payload = {
    action: "saveTimer",
    key: state.coachKey,
    timerId: timerId,
    timerName: name,
    timerType: $("timerType").value,
    totalDuration: totalDuration,
    structure: JSON.stringify(t.structure),
    ttsTitle: $("ttsTitle").value,
    ttsCues: JSON.stringify({
      halfway: $("cueHalfway").checked,
      countdown3s: $("cueCountdown").checked,
      nextUp: $("cueNextUp").checked
    }),
    defaultColors: "{}",
    requiresInput: t.requiresInput ? "TRUE" : "FALSE",
    inputPrompts: JSON.stringify(t.inputPrompts || []),
    musicTrack: t.musicTrack || "",
    notes: $("timerNotes").value
  };

  const btn = $("saveTimerBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const res = await callAPI(payload);
    if (res && res.ok) {
      showToast("Timer saved");
      t.timerId = timerId;
      setTimeout(backToList, 600);
    } else {
      showToast((res && res.error) || "Save failed", true);
      btn.disabled = false;
      btn.textContent = "Save";
    }
  } catch (e) {
    showToast("Network error", true);
    btn.disabled = false;
    btn.textContent = "Save";
  }
}

function computeTotalDuration(structure) {
  let total = 0;
  structure.forEach(function (iv) {
    if (iv.type === "circuit") {
      const inner = (iv.intervals || []).reduce(function (sum, x) {
        return sum + (parseInt(x.duration, 10) || 0);
      }, 0);
      const afterEach = iv.afterEach ? (iv.afterEach.duration || 0) * Math.max(0, iv.rounds - 1) : 0;
      const afterCircuit = iv.afterCircuit ? (iv.afterCircuit.duration || 0) : 0;
      total += (inner * iv.rounds) + afterEach + afterCircuit;
    } else {
      total += parseInt(iv.duration, 10) || 0;
    }
  });
  return total;
}

// ============================================================
// DELETE TIMER
// ============================================================

async function deleteTimer(timerId) {
  if (!confirm("Delete this timer? This cannot be undone.")) return;
  try {
    const res = await callAPI({ action: "deleteTimer", key: state.coachKey, timerId: timerId });
    if (res && res.ok) {
      showToast("Timer deleted");
      loadTimers();
    } else {
      showToast((res && res.error) || "Delete failed", true);
    }
  } catch (e) {
    showToast("Network error", true);
  }
}

// ============================================================
// HELPERS
// ============================================================

async function callAPI(payload) {
  const params = new URLSearchParams();
  Object.keys(payload).forEach(function (k) {
    const v = payload[k];
    if (v !== undefined && v !== null) params.append(k, String(v));
  });
  const url = ENDPOINT + "?" + params.toString();
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { return { ok: false, error: "Bad response: " + text.slice(0, 120) }; }
}

function formatDuration(seconds) {
  const s = Math.max(0, seconds | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, isError) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden", "error", "warn");
  if (isError) t.classList.add("error");
  setTimeout(function () { t.classList.add("hidden"); }, 2400);
}
