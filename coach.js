// ============================================================
// COACH VIEW — coach.js (v2)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbyCv5UAZrMpHJvXlGTbnqsA9wjHWKKR8pL3UQQvETdWQX2AVdpoC_21wnCNG2LVE9WO/exec";

const COACH_KEY_STORAGE = "coachKey";

const $ = function (id) { return document.getElementById(id); };

let state = {
  key: null,
  athletes: [],
  logs: []
};

// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  wireEvents();
  const saved = localStorage.getItem(COACH_KEY_STORAGE);
  if (saved) {
    state.key = saved;
    showCoachApp();
    loadAll();
  }
});

function wireEvents() {
  $("coachKeyBtn").addEventListener("click", handleKeySubmit);
  $("coachKeyInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleKeySubmit();
  });
  $("coachLogoutBtn").addEventListener("click", handleLogout);
  $("coachRefreshBtn").addEventListener("click", loadAll);

  $("filterAthlete").addEventListener("change", loadLogs);
  $("filterPlan").addEventListener("change", loadLogs);
  $("filterDays").addEventListener("change", loadLogs);
}

async function handleKeySubmit() {
  const key = $("coachKeyInput").value.trim();
  if (!key) return;
  state.key = key;

  try {
    const res = await callAPI({ action: "coachAthletes", key: key });
    if (!res || !res.ok) {
      $("coachKeyErr").textContent = (res && res.error) ? res.error : "Invalid key";
      state.key = null;
      return;
    }
    localStorage.setItem(COACH_KEY_STORAGE, key);
    $("coachKeyErr").textContent = "";
    showCoachApp();
    loadAll();
  } catch (e) {
    $("coachKeyErr").textContent = "Network error: " + e.message;
  }
}

function handleLogout() {
  localStorage.removeItem(COACH_KEY_STORAGE);
  state.key = null;
  state.athletes = [];
  state.logs = [];
  $("coachApp").classList.add("hidden");
  $("keyGate").classList.remove("hidden");
  $("coachKeyInput").value = "";
}

function showCoachApp() {
  $("keyGate").classList.add("hidden");
  $("coachApp").classList.remove("hidden");
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadAll() {
  await loadAthletes();
  await loadLogs();
}

async function loadAthletes() {
  try {
    const res = await callAPI({ action: "coachAthletes", key: state.key });
    if (!res || !res.ok) {
      showToast((res && res.error) || "Could not load athletes", true);
      return;
    }
    state.athletes = res.athletes || [];
    renderAthletes();
    populateAthleteFilter();
  } catch (e) {
    showToast("Network error: " + e.message, true);
  }
}

async function loadLogs() {
  const athlete = $("filterAthlete").value;
  const plan = $("filterPlan").value;
  const days = $("filterDays").value;

  try {
    const res = await callAPI({
      action: "coachLogs",
      key: state.key,
      athlete: athlete,
      plan: plan,
      days: days
    });
    if (!res || !res.ok) {
      showToast((res && res.error) || "Could not load logs", true);
      return;
    }
    state.logs = res.rows || [];
    renderLogs();
  } catch (e) {
    showToast("Network error: " + e.message, true);
  }
}

// ============================================================
// RENDER — ATHLETES
// ============================================================

function renderAthletes() {
  const grid = $("athleteGrid");
  if (!state.athletes.length) {
    grid.innerHTML = '<div style="color:#9aa3b0;">No athletes found.</div>';
    return;
  }
  grid.innerHTML = "";
  state.athletes.forEach(function (a) {
    const card = document.createElement("div");
    card.className = "athlete-card";

    const activeLabel = a.active
      ? '<span style="color:#1f7a3d;">Active</span>'
      : '<span style="color:#b3402f;">Inactive</span>';

    card.innerHTML =
      '<h3>' + escapeHtml(a.name) + '</h3>' +
      '<div class="meta">' +
        'Program: <strong>' + escapeHtml(a.program) + '</strong><br>' +
        'Sessions: <strong>' + (a.sessionCount || 0) + '</strong> &nbsp;•&nbsp; ' +
        activeLabel +
      '</div>' +
      '<div class="actions">' +
        '<button data-action="view-logs" data-athlete="' + escapeHtml(a.name) + '">View logs</button>' +
        '<button data-action="reset-tutorial" data-athlete="' + escapeHtml(a.name) + '">Reset tutorial</button>' +
      '</div>';

    grid.appendChild(card);
  });

  grid.querySelectorAll("button[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const action = btn.dataset.action;
      const athlete = btn.dataset.athlete;
      if (action === "view-logs") {
        $("filterAthlete").value = athlete;
        loadLogs();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      } else if (action === "reset-tutorial") {
        resetTutorial(athlete);
      }
    });
  });
}

function populateAthleteFilter() {
  const sel = $("filterAthlete");
  const current = sel.value;
  sel.innerHTML = '<option value="">All</option>';
  state.athletes.forEach(function (a) {
    const opt = document.createElement("option");
    opt.value = a.name;
    opt.textContent = a.name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

async function resetTutorial(athlete) {
  if (!confirm("Reset tutorial for " + athlete + "? They will see the welcome popup again.")) return;
  try {
    const res = await callAPI({
      action: "resetTutorial",
      key: state.key,
      athlete: athlete
    });
    if (res && res.ok) {
      showToast("Tutorial reset for " + athlete);
    } else {
      showToast((res && res.error) || "Reset failed", true);
    }
  } catch (e) {
    showToast("Network error: " + e.message, true);
  }
}

// ============================================================
// RENDER — LOGS
// ============================================================

function renderLogs() {
  const tbody = $("logTableBody");
  if (!state.logs.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#9aa3b0;padding:24px;">No logs in this range.</td></tr>';
    return;
  }
  tbody.innerHTML = "";
  state.logs.forEach(function (r) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td>' + formatTimestamp(r.timestamp) + '</td>' +
      '<td>' + escapeHtml(r.athlete || "") + '</td>' +
      '<td>' + escapeHtml(r.plan || "") + '</td>' +
      '<td>' + escapeHtml(r.exercise || "") + '</td>' +
      '<td>' + escapeHtml(String(r.set || "")) + '</td>' +
      '<td>' + escapeHtml(String(r.weight || "")) + '</td>' +
      '<td>' + escapeHtml(String(r.reps || "")) + '</td>' +
      '<td class="grade-cell">' + escapeHtml(r.grade || "") + '</td>' +
      '<td class="notes-cell">' + escapeHtml(r.notes || "") + '</td>';
    tbody.appendChild(tr);
  });
}

// ============================================================
// NETWORK — GET with query params (avoids Google's 405 on POST)
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

  try {
    return JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "Bad response: " + text.slice(0, 120) };
  }
}

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function showToast(msg, isError) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden", "error", "warn");
  if (isError) t.classList.add("error");
  setTimeout(function () { t.classList.add("hidden"); }, 2400);
}
