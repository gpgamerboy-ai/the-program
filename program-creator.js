// ============================================================
// PROGRAM CREATOR — program-creator.js v5 (chunked GET save)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbyiJfEn8fIyMlupk-rrc15BkqVb_UgYsR-wfQQVKgIjH9_t6Xh5KoctO880qBnWa-VInQ/exec";
const COACH_KEY_STORAGE = "coachKey";
const COLS = 13;
const CHUNK_SIZE = 15;
const VALID_TARGET_TYPES = [
  "reps", "left_in_tank", "rpe", "failure", "burn", "feel", "amrap", "check",
  "duration", "interval_time", "distance", "pace", "reps_only", "touches", "custom"
];

const $ = function (id) { return document.getElementById(id); };

const state = {
  key: null,
  rows: [],
  issues: []
};

document.addEventListener("DOMContentLoaded", function () {
  wireEvents();
  renderPrompt();
  const saved = localStorage.getItem(COACH_KEY_STORAGE);
  if (saved) {
    state.key = saved;
    showApp();
  }
});

function wireEvents() {
  $("pcKeyBtn").addEventListener("click", handleKeySubmit);
  $("pcKeyInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleKeySubmit();
  });
  $("pcLogoutBtn").addEventListener("click", handleLogout);
  $("copyPromptBtn").addEventListener("click", copyPrompt);
  $("validateBtn").addEventListener("click", handleValidate);
  $("clearBtn").addEventListener("click", function () { $("pasteArea").value = ""; });
  $("saveBtn").addEventListener("click", handleSave);
  $("cancelBtn").addEventListener("click", function () {
    $("previewStep").classList.add("hidden");
  });
  $("saveModeSelect").addEventListener("change", syncSaveModeUI);
}

async function handleKeySubmit() {
  const key = $("pcKeyInput").value.trim();
  if (!key) return;
  state.key = key;
  try {
    const res = await callAPI({ action: "coachAthletes", key: key });
    if (!res || !res.ok) {
      $("pcKeyErr").textContent = (res && res.error) || "Invalid key";
      state.key = null;
      return;
    }
    localStorage.setItem(COACH_KEY_STORAGE, key);
    $("pcKeyErr").textContent = "";
    showApp();
  } catch (e) {
    $("pcKeyErr").textContent = "Network error";
  }
}

function handleLogout() {
  localStorage.removeItem(COACH_KEY_STORAGE);
  state.key = null;
  $("pcApp").classList.add("hidden");
  $("keyGate").classList.remove("hidden");
  $("pcKeyInput").value = "";
}

function showApp() {
  $("keyGate").classList.add("hidden");
  $("pcApp").classList.remove("hidden");
}

function normalizeDelimiters(line) {
  return String(line)
    .replace(/¦/g, "|").replace(/｜/g, "|").replace(/│/g, "|").replace(/┃/g, "|")
    .replace(/❘/g, "|").replace(/❙/g, "|").replace(/❚/g, "|").replace(/⁞/g, "|")
    .replace(/︱/g, "|").replace(/︳/g, "|");
}

function parseRow(line) {
  const normalized = normalizeDelimiters(line);
  const pipeCols = normalized.split("|");
  const tabCols = normalized.split("\t");
  return pipeCols.length >= tabCols.length ? pipeCols : tabCols;
}

function renderPrompt() {
  const prompt = [
    "Generate a training program as PIPE-DELIMITED rows for a Google Sheet.",
    "",
    "Return ONLY the rows. No headers. No markdown. No code fences. Plain text.",
    "",
    "Each row must have EXACTLY 13 values, separated by the ASCII pipe character |",
    "Always include all 13 values. If a value is empty, leave it blank between two pipes.",
    "",
    "Columns in order:",
    "",
    " 1. Program       — program name",
    " 2. Week          — week number (1-52, deload, or blank)",
    " 3. Day           — day letter (A, B, C, etc.)",
    " 4. Exercise      — exercise name",
    " 5. Type          — main, support, or blank",
    " 6. Rest          — rest time (e.g. 90s, 2min, or blank)",
    " 7. Tempo         — tempo code (e.g. 2/1/2/0, or blank)",
    " 8. SetNum        — set identifier (1, 2, 3, W1, W2, etc.)",
    " 9. TargetType    — one of: reps, left_in_tank, rpe, failure, burn, feel,",
    "                    amrap, check, duration, interval_time, distance, pace,",
    "                    reps_only, touches, custom, or blank",
    "10. TargetValue   — the target (e.g. 8-10, 30 sec, 5K, 50 touches, or blank)",
    "11. TargetNote    — coaching cue for this set (or blank)",
    "12. LoadLogic     — auto-load rule (or blank)",
    "13. Notes         — extra notes for this set (or blank)",
    "",
    "Example rows:",
    "Lopez Fall|1|A|Back Squat|main|2min|2/1/2/0|1|reps|8-10|2 in tank||",
    "Lopez Fall|1|A|Romanian Deadlift|support|90s||1|reps|10-12|feel it out||",
    "",
    "Use the ASCII pipe character (character code 124). Count your pipes: 12 per line.",
    "",
    "Now generate a program for: [INSERT YOUR REQUEST HERE]"
  ].join("\n");
  $("promptText").value = prompt;
}

async function copyPrompt() {
  const text = $("promptText").value;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Prompt copied to clipboard");
  } catch (e) {
    $("promptText").select();
    document.execCommand("copy");
    showToast("Prompt copied");
  }
}

function handleValidate() {
  const raw = $("pasteArea").value;
  if (!raw.trim()) {
    showToast("Paste the AI response first", true);
    return;
  }

  const lines = raw.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
  state.rows = [];

  lines.forEach(function (line, i) {
    const cols = parseRow(line);
    const row = { lineNum: i + 1, cols: [], errors: [], warnings: [] };
    row.cols = cols.map(function (c) { return String(c).trim(); });

    if (row.cols.length < COLS) {
      const missing = COLS - row.cols.length;
      row.warnings.push("Padded " + missing + " empty column(s) to reach 13");
      while (row.cols.length < COLS) row.cols.push("");
    }
    if (row.cols.length > COLS) {
      row.errors.push("Found " + row.cols.length + " columns (max 13)");
    }

    const program = row.cols[0];
    const day = row.cols[2];
    const exercise = row.cols[3];
    const setNum = row.cols[7];
    const targetType = row.cols[8];

    if (!program) row.errors.push("Column 1 (Program) is empty");
    if (!day) row.errors.push("Column 3 (Day) is empty");
    if (!exercise) row.errors.push("Column 4 (Exercise) is empty");
    if (!setNum) row.errors.push("Column 8 (SetNum) is empty");

    if (targetType && VALID_TARGET_TYPES.indexOf(targetType) === -1) {
      row.warnings.push("TargetType '" + targetType + "' not in known list");
    }

    state.rows.push(row);
  });

  renderPreview();
  $("previewStep").classList.remove("hidden");
  $("previewStep").scrollIntoView({ behavior: "smooth" });
}

function renderPreview() {
  const body = $("previewBody");
  body.innerHTML = "";

  const errorCount = state.rows.filter(function (r) { return r.errors.length > 0; }).length;
  const warnCount = state.rows.filter(function (r) { return r.errors.length === 0 && r.warnings.length > 0; }).length;
  const okCount = state.rows.length - errorCount - warnCount;
  const programs = {};
  state.rows.forEach(function (r) { if (r.cols[0]) programs[r.cols[0]] = true; });

  $("previewSummary").innerHTML =
    '<span>Total: <strong>' + state.rows.length + '</strong></span>' +
    '<span>Valid: <strong style="color:#1f7a3d;">' + okCount + '</strong></span>' +
    '<span>Warnings: <strong style="color:#d29a1f;">' + warnCount + '</strong></span>' +
    '<span>Errors: <strong style="color:#b3402f;">' + errorCount + '</strong></span>' +
    '<span>Programs: <strong>' + Object.keys(programs).join(", ") + '</strong></span>';

  const issueList = $("issueList");
  if (errorCount === 0 && warnCount === 0) {
    issueList.innerHTML = "";
  } else {
    let html = '<div class="pc-issue-list"><strong>Issues:</strong><ul>';
    state.rows.forEach(function (r) {
      r.errors.forEach(function (e) {
        html += '<li>Row ' + r.lineNum + ': <strong>' + escapeHtml(e) + '</strong></li>';
      });
      r.warnings.forEach(function (w) {
        html += '<li>Row ' + r.lineNum + ': ' + escapeHtml(w) + '</li>';
      });
    });
    html += '</ul></div>';
    issueList.innerHTML = html;
  }

  state.rows.forEach(function (r) {
    const tr = document.createElement("tr");
    if (r.errors.length) tr.className = "error";
    else if (r.warnings.length) tr.className = "warn";
    let html = '<td>' + r.lineNum + '</td>';
    for (let c = 0; c < COLS; c++) {
      html += '<td>' + escapeHtml(r.cols[c] || "") + '</td>';
    }
    tr.innerHTML = html;
    body.appendChild(tr);
  });

  const programNames = Object.keys(programs);
  if (programNames.length === 1 && !$("programNameInput").value) {
    $("programNameInput").value = programNames[0];
  }
}

function syncSaveModeUI() {}

async function handleSave() {
  const errorCount = state.rows.filter(function (r) { return r.errors.length > 0; }).length;
  if (errorCount > 0) {
    showToast("Fix " + errorCount + " error(s) before saving", true);
    return;
  }

  const programName = $("programNameInput").value.trim();
  if (!programName) { showToast("Enter a program name", true); return; }

  const mode = $("saveModeSelect").value;
  if (mode === "replace") {
    if (!confirm("Replace ALL rows for '" + programName + "'? This cannot be undone.")) return;
  }

  const btn = $("saveBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const allRows = state.rows.map(function (r) { return r.cols; });
  const chunks = [];
  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    chunks.push(allRows.slice(i, i + CHUNK_SIZE));
  }

  let totalSaved = 0;
  let failed = false;

  for (let c = 0; c < chunks.length; c++) {
    btn.textContent = "Saving " + (c + 1) + "/" + chunks.length + "...";
    const chunkMode = (c === 0) ? mode : "append";
    try {
      const res = await callAPI({
        action: "saveProgramRows",
        key: state.key,
        programName: programName,
        mode: chunkMode,
        rows: JSON.stringify(chunks[c])
      });
      if (res && res.ok) {
        totalSaved += (res.count || chunks[c].length);
      } else {
        showToast("Chunk " + (c + 1) + " failed: " + ((res && res.error) || "unknown"), true);
        failed = true;
        break;
      }
    } catch (e) {
      showToast("Chunk " + (c + 1) + " network error: " + e.message, true);
      failed = true;
      break;
    }
  }

  btn.disabled = false;
  btn.textContent = "Save to sheet";

  if (!failed) {
    showToast("Saved " + totalSaved + " rows to '" + programName + "'");
    $("pasteArea").value = "";
    $("previewStep").classList.add("hidden");
    state.rows = [];
  }
}

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let toastTimer = null;
function showToast(msg, isError) {
  const t = $("pcToast");
  t.textContent = msg;
  t.classList.remove("hidden", "error");
  if (isError) t.classList.add("error");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2800);
}

