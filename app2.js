// ============================================================
// THE PROGRAM — app2.js (v2)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbzA1JpCvFrKEXd4VhSec_f8uqH760HIXKv6DcenF06zySPxuGDT4KP8RBycZW5XDM2kaw/exec";
const TUTORIAL_THRESHOLD = 30;
const UNDO_WINDOW_MS = 3000;

// ============================================================
// STATE
// ============================================================

const state = {
  token: null,
  athlete: null,
  program: null,
  programs: null,
  profile: null,
  sessionCount: 0,
  currentPlan: null,
  lastTimeCache: {},
  offlineQueue: [],
  historyRows: [],
  sessionUnits: null,       // overrides profile.units for this session
  barToggleCount: 0,        // times user toggled bar hint in this session
  unitsToggleCount: 0
};

// ============================================================
// DOM SHORTCUTS
// ============================================================

const $ = function (id) { return document.getElementById(id); };

const dom = {
  offlineBanner: $("offlineBanner"),
  loginScreen: $("loginScreen"),
  appScreen: $("appScreen"),
  loginName: $("loginName"),
  loginPin: $("loginPin"),
  loginBtn: $("loginBtn"),
  loginError: $("loginError"),
  headerName: $("headerName"),
  helpBtn: $("helpBtn"),
  refreshBtn: $("refreshBtn"),
  logoutBtn: $("logoutBtn"),
  planBtns: document.querySelectorAll(".plan-btn"),
  exerciseList: $("exerciseList"),
  downloadCsvBtn: $("downloadCsvBtn"),
  downloadPdfBtn: $("downloadPdfBtn"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabWorkout: $("tab-workout"),
  tabHistory: $("tab-history"),
  historyList: $("historyList"),
  histPlanFilter: $("histPlanFilter"),
  histDaysFilter: $("histDaysFilter"),
  welcomePopup: $("welcomePopup"),
  popupContent: $("popupContent"),
  popupHideBtn: $("popupHideBtn"),
  popupDontShowBtn: $("popupDontShowBtn"),
  popupCloseX: $("popupCloseX"),
  lastTimeModal: $("lastTimeModal"),
  lastTimeContent: $("lastTimeContent"),
  lastTimeCloseX: $("lastTimeCloseX"),
  toast: $("toast")
};

// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  wireEvents();
  wireOfflineDetection();
  loadRememberedName();
});

function wireEvents() {
  dom.loginBtn.addEventListener("click", handleLogin);
  dom.loginPin.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleLogin();
  });

  dom.loginName.addEventListener("change", function () {
    localStorage.setItem("lastAthlete", dom.loginName.value);
    dom.loginPin.focus();
  });

  dom.planBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { selectPlan(btn.dataset.plan); });
  });

  dom.tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
  });

  dom.helpBtn.addEventListener("click", function () { showWelcomePopup(true); });
  dom.refreshBtn.addEventListener("click", refreshData);
  dom.logoutBtn.addEventListener("click", handleLogout);

  dom.downloadCsvBtn.addEventListener("click", downloadCsv);
  dom.downloadPdfBtn.addEventListener("click", downloadPdf);

  dom.popupHideBtn.addEventListener("click", hideWelcomePopup);
  dom.popupCloseX.addEventListener("click", hideWelcomePopup);
  dom.popupDontShowBtn.addEventListener("click", dontShowAgain);

  dom.lastTimeCloseX.addEventListener("click", function () {
    dom.lastTimeModal.classList.add("hidden");
  });

  dom.histPlanFilter.addEventListener("change", renderHistory);
  dom.histDaysFilter.addEventListener("change", loadAndRenderHistory);

  window.addEventListener("online", flushOfflineQueue);
  window.addEventListener("offline", function () {
    dom.offlineBanner.classList.remove("hidden");
  });
}

// ============================================================
// NETWORK — GET with query string (avoids Google's 405)
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
// OFFLINE
// ============================================================

function wireOfflineDetection() {
  if (!navigator.onLine) dom.offlineBanner.classList.remove("hidden");
  loadOfflineQueue();
}

function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem("offlineQueue");
    state.offlineQueue = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.offlineQueue = [];
  }
}

function saveOfflineQueue() {
  localStorage.setItem("offlineQueue", JSON.stringify(state.offlineQueue));
}

function enqueueOffline(payload) {
  state.offlineQueue.push(payload);
  saveOfflineQueue();
}

async function flushOfflineQueue() {
  dom.offlineBanner.classList.add("hidden");
  if (!state.offlineQueue.length) return;
  if (!state.token) return;

  const remaining = [];
  for (let i = 0; i < state.offlineQueue.length; i++) {
    const item = state.offlineQueue[i];
    try {
      const res = await callAPI(Object.assign({ action: "logSet", token: state.token }, item));
      if (!res || !res.ok) remaining.push(item);
    } catch (e) {
      remaining.push(item);
    }
  }
  state.offlineQueue = remaining;
  saveOfflineQueue();
  if (!remaining.length) showToast("Offline sets synced");
}

// ============================================================
// REMEMBERED NAME
// ============================================================

function loadRememberedName() {
  const saved = localStorage.getItem("lastAthlete");
  if (saved) dom.loginName.value = saved;
  loadAthleteDropdown();
}

async function loadAthleteDropdown() {
  try {
    const res = await callAPI({ action: "listNames" });
    if (!res || !res.ok || !res.names) return;
    const current = dom.loginName.value;
    dom.loginName.innerHTML = '<option value="">— pick your name —</option>';
    res.names.forEach(function (name) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      dom.loginName.appendChild(opt);
    });
    if (current) dom.loginName.value = current;
  } catch (e) {}
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================

async function handleLogin() {
  const name = dom.loginName.value.trim();
  const pin = dom.loginPin.value.trim();
  if (!name || !pin) {
    dom.loginError.textContent = "Enter your name and PIN.";
    return;
  }

  dom.loginBtn.disabled = true;
  dom.loginBtn.textContent = "Logging in...";
  dom.loginError.textContent = "";

  try {
    const res = await callAPI({ action: "login", name: name, pin: pin });
    if (!res || !res.ok) {
      dom.loginError.textContent = (res && res.error) ? res.error : "Login failed.";
      dom.loginBtn.disabled = false;
      dom.loginBtn.textContent = "Log In";
      return;
    }

    state.token = res.token;
    state.athlete = res.athlete;
    state.program = res.program;
    state.programs = res.programs;
    state.profile = res.profile || {};
    state.sessionCount = res.sessionCount || 0;
    state.sessionUnits = null;
    state.barToggleCount = 0;
    state.unitsToggleCount = 0;

    localStorage.setItem("lastAthlete", name);
    localStorage.setItem("sessionToken", res.token);
    localStorage.setItem("sessionExpires", Date.now() + 12 * 3600 * 1000);

    enterApp();
  } catch (e) {
    dom.loginError.textContent = "Could not reach server. Check connection.";
    dom.loginBtn.disabled = false;
    dom.loginBtn.textContent = "Log In";
  }
}

function handleLogout() {
  state.token = null;
  state.athlete = null;
  state.program = null;
  state.programs = null;
  state.profile = null;
  state.currentPlan = null;
  state.lastTimeCache = {};
  state.sessionUnits = null;
  state.barToggleCount = 0;
  state.unitsToggleCount = 0;
  localStorage.removeItem("sessionToken");
  localStorage.removeItem("sessionExpires");
  dom.appScreen.classList.add("hidden");
  dom.loginScreen.classList.remove("hidden");
  dom.loginPin.value = "";
  dom.loginBtn.disabled = false;
  dom.loginBtn.textContent = "Log In";
}

function enterApp() {
  dom.loginScreen.classList.add("hidden");
  dom.appScreen.classList.remove("hidden");
  dom.headerName.textContent = state.athlete;
  renderProfileBar();
  selectPlan(null);
  showWelcomePopup(false);
}

// ============================================================
// PROFILE BAR
// ============================================================

function renderProfileBar() {
  const existing = $("profileBar");
  if (existing) existing.remove();

  if (!state.profile || !state.profile.experienceLevel) return;

  const bar = document.createElement("div");
  bar.id = "profileBar";
  bar.className = "profile-bar";

  const units = state.sessionUnits || state.profile.units || "lb";
  const level = state.profile.experienceLevel || "";
  const goals = state.profile.goals || "";

  let html = '<span class="profile-item">' + escapeHtml(state.athlete) + '</span>';
  if (level) html += '<span class="profile-item">' + escapeHtml(level) + '</span>';
  html += '<button class="profile-item profile-units-btn" id="unitsToggleBtn">' + escapeHtml(units) + '</button>';
  if (goals) html += '<span class="profile-item profile-goals">' + escapeHtml(goals) + '</span>';

  bar.innerHTML = html;
  dom.exerciseList.parentNode.insertBefore(bar, dom.exerciseList);

  const unitsBtn = $("unitsToggleBtn");
  if (unitsBtn) {
    unitsBtn.addEventListener("click", handleUnitsToggle);
  }
}

function handleUnitsToggle() {
  state.sessionUnits = (state.sessionUnits || state.profile.units) === "lb" ? "kg" : "lb";
  state.unitsToggleCount++;
  renderProfileBar();
  if (state.currentPlan) renderExerciseCards(state.currentPlan);

  if (state.unitsToggleCount === 3) {
    offerUnitsChange();
  }
}

function offerUnitsChange() {
  if (!confirm("You keep switching units. Want to make " + state.sessionUnits + " your default?")) return;
  showToast("Noted. Update your profile in the sheet to make it permanent.");
  state.unitsToggleCount = 0;
}

// ============================================================
// PLAN SELECTION
// ============================================================

function selectPlan(plan) {
  state.currentPlan = plan;
  dom.planBtns.forEach(function (b) {
    b.classList.toggle("active", b.dataset.plan === plan);
  });
  if (!plan) {
    dom.exerciseList.innerHTML = "";
    return;
  }
  renderExerciseCards(plan);
  loadLastTimesForPlan(plan);
}

function renderExerciseCards(plan) {
  const exercises = (state.programs && state.programs[plan]) || [];
  if (!exercises.length) {
    dom.exerciseList.innerHTML = '<div class="history-empty">No exercises found for this plan.</div>';
    return;
  }
  dom.exerciseList.innerHTML = "";
  exercises.forEach(function (ex) {
    dom.exerciseList.appendChild(buildExerciseCard(ex, plan));
  });
}

function buildExerciseCard(ex, plan) {
  const card = document.createElement("div");
  card.className = "exercise-card";

  const tagClass = ex.type === "main" ? "" : "support";
  const tagText = ex.type === "main" ? "MAIN" : "SUPPORT";

  let html = "";
  html += '<div class="exercise-head">';
  html += '<h3 class="exercise-name">' + escapeHtml(ex.name) + '</h3>';
  if (ex.type) html += '<span class="exercise-tag ' + tagClass + '">' + tagText + '</span>';
  html += '</div>';

  const metaParts = [];
  if (ex.rest) metaParts.push('<strong>Rest:</strong> ' + escapeHtml(String(ex.rest)));
  if (ex.tempo) metaParts.push('<strong>Tempo:</strong> ' + escapeHtml(String(ex.tempo)));
  if (metaParts.length) html += '<div class="exercise-meta">' + metaParts.join(' &nbsp;•&nbsp; ') + '</div>';

  if (ex.notes) html += '<div class="exercise-notes">' + escapeHtml(ex.notes) + '</div>';
  html += '<div class="set-compare" data-exercise="' + escapeHtml(ex.name) + '"></div>';
  html += '<button class="full-history-link" data-exercise="' + escapeHtml(ex.name) + '">Open full history for this lift</button>';

  card.innerHTML = html;
  const compareEl = card.querySelector(".set-compare");
  ex.sets.forEach(function (s) {
    compareEl.appendChild(buildSetCompare(s, ex.name, plan));
  });
  card.querySelector(".full-history-link").addEventListener("click", function () {
    openLastTimeModal(ex.name);
  });
  return card;
}

function buildSetCompare(setInfo, exerciseName, plan) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "contents";

  const setNum = String(setInfo.set);
  const safeEx = sanitizeId(exerciseName);
  const safeSet = sanitizeId(setNum);
  const idBase = "set_" + safeEx + "_" + safeSet + "_" + plan;

  const targetLabel = renderTargetLabel(setInfo);
  const targetNote = setInfo.targetNote ? ' — <span style="color:#9aa3b0;font-weight:400;">' + escapeHtml(setInfo.targetNote) + '</span>' : '';
  const units = state.sessionUnits || (state.profile && state.profile.units) || "lb";

  const showBarBtn = state.profile && state.profile.showBarLoading;

  wrapper.innerHTML =
    '<div class="compare-col">' +
      '<div class="compare-label">Last Time</div>' +
      '<div class="compare-set" id="' + idBase + '_last">' +
        '<div class="set-name">Set ' + escapeHtml(setNum) + '</div>' +
        '<div class="set-data dim">—</div>' +
      '</div>' +
    '</div>' +
    '<div class="compare-col">' +
      '<div class="compare-label">Today</div>' +
      '<div class="compare-set current">' +
        '<div class="set-name">Set ' + escapeHtml(setNum) + targetNote + '</div>' +
        '<div class="set-input">' +
          '<div><label>Target</label><input type="text" value="' + escapeHtml(targetLabel) + '" readonly /></div>' +
          '<div><label>Weight (' + units + ')</label><input type="number" id="' + idBase + '_w" placeholder="' + units + '" /></div>' +
        '</div>' +
        (showBarBtn ? '<button class="bar-hint-btn" id="' + idBase + '_bar">Load the bar</button>' : '') +
        '<div class="bar-load-display" id="' + idBase + '_bardisplay"></div>' +
        '<div class="set-input">' +
          '<div><label>Reps</label><input type="number" id="' + idBase + '_r" placeholder="reps" /></div>' +
          '<div><label>Grade</label><select id="' + idBase + '_g">' +
            '<option value="">—</option>' +
            '<option>A+</option><option>A</option><option>A-</option>' +
            '<option>B+</option><option>B</option><option>B-</option>' +
            '<option>C+</option><option>C</option><option>C-</option>' +
            '<option>D</option><option>F</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="set-input">' +
          '<div class="set-input-full"><label>Notes</label><input type="text" id="' + idBase + '_n" placeholder="" /></div>' +
        '</div>' +
        '<button class="log-btn" id="' + idBase + '_btn">Log</button>' +
      '</div>' +
    '</div>';

  const logBtn = wrapper.querySelector("#" + idBase + "_btn");
  logBtn.addEventListener("click", function () {
    handleLogSet(exerciseName, plan, setInfo, idBase);
  });

  if (showBarBtn) {
    const barBtn = wrapper.querySelector("#" + idBase + "_bar");
    if (barBtn) {
      barBtn.addEventListener("click", function () {
        handleBarHintClick(idBase);
      });
    }
  }

  return wrapper;
}

function renderTargetLabel(setInfo) {
  const type = setInfo.targetType || "reps";
  const val = String(setInfo.target || "").trim();

  if (type === "reps")          return val || "";
  if (type === "left_in_tank")  return val ? (val + " in tank") : "left in tank";
  if (type === "rpe")           return val ? ("RPE " + val) : "RPE";
  if (type === "failure")       return "to failure";
  if (type === "burn")          return "work to a burn";
  if (type === "feel")          return val || "feel it out";
  if (type === "time")          return val || "timed";
  if (type === "amrap")         return val ? (val + " AMRAP") : "AMRAP";
  if (type === "check")         return "✓";
  return val;
}

// ============================================================
// BAR LOADING HINT
// ============================================================

const BAR_OPTIONS_LB = [11, 22, 33, 44, 45, 55, 65];
const BAR_OPTIONS_KG = [5, 10, 15, 20, 25, 30];

function handleBarHintClick(idBase) {
  state.barToggleCount++;

  const units = state.sessionUnits || (state.profile && state.profile.units) || "lb";
  const options = units === "kg" ? BAR_OPTIONS_KG : BAR_OPTIONS_LB;

  const choice = prompt(
    "Which bar? Enter the number:\n" +
    options.map(function (o, i) { return (i + 1) + ") " + o + " " + units; }).join("\n") +
    "\n" + (options.length + 1) + ") other"
  );

  if (!choice) return;
  const idx = parseInt(choice, 10) - 1;

  let barWeight;
  if (idx >= 0 && idx < options.length) {
    barWeight = options[idx];
  } else {
    const custom = prompt("Enter bar weight in " + units + ":");
    if (!custom) return;
    barWeight = parseFloat(custom);
    if (isNaN(barWeight)) return;
  }

  const targetWeight = parseFloat($(idBase + "_w").value);
  if (isNaN(targetWeight)) {
    showToast("Enter the total weight first, then load the bar.");
    return;
  }

  const display = calculateBarLoad(targetWeight, barWeight, units);
  $(idBase + "_bardisplay").textContent = display;

  if (state.barToggleCount === 3) {
    offerBarPreferenceChange();
  }
}

function calculateBarLoad(totalWeight, barWeight, units) {
  const plateInventory = (state.profile.plateInventory || "")
    .split(",")
    .map(function (s) { return parseFloat(s.trim()); })
    .filter(function (n) { return !isNaN(n) && n > 0; })
    .sort(function (a, b) { return b - a; });

  if (!plateInventory.length) {
    return "No plate inventory set in profile.";
  }

  const perSide = (totalWeight - barWeight) / 2;
  if (perSide < 0) {
    return barWeight + ": (bar only — target too light)";
  }
  if (perSide === 0) {
    return barWeight + ": bar only";
  }

  const used = [];
  let remaining = perSide;
  for (let i = 0; i < plateInventory.length; i++) {
    const plate = plateInventory[i];
    while (remaining >= plate - 0.001) {
      used.push(plate);
      remaining -= plate;
    }
  }

  const loadableTotal = barWeight + (perSide - remaining) * 2;
  const rounding = Math.abs(loadableTotal - totalWeight) > 0.01
    ? ' (~' + loadableTotal + ' ' + units + ')'
    : '';

  if (!used.length) {
    return barWeight + ": bar only" + rounding;
  }

  const summary = used.join("/");
  return barWeight + ": " + summary + " (each side)" + rounding;
}

function offerBarPreferenceChange() {
  if (!confirm("You keep loading the bar. Want to show the load button on every set?")) return;
  showToast("Noted. Update your profile in the sheet to make it permanent.");
  state.barToggleCount = 0;
}

// ============================================================
// LOG A SET (with undo)
// ============================================================

async function handleLogSet(exerciseName, plan, setInfo, idBase) {
  const weight = $(idBase + "_w").value;
  const reps = $(idBase + "_r").value;
  const grade = $(idBase + "_g").value;
  const notes = $(idBase + "_n").value;

  if (!weight && !reps) {
    showToast("Enter weight or reps first", true);
    return;
  }

  const payload = {
    athlete: state.athlete,
    program: state.program,
    plan: plan,
    exercise: exerciseName,
    set: String(setInfo.set),
    target: String(setInfo.target || ""),
    weight: weight,
    reps: reps,
    grade: grade,
    notes: notes
  };

  const btn = $(idBase + "_btn");
  btn.disabled = true;
  btn.textContent = "...";

  if (navigator.onLine) {
    try {
      const res = await callAPI(Object.assign({ action: "logSet", token: state.token }, payload));
      if (res && res.ok) {
        btn.classList.add("logged");
        btn.textContent = "Logged — Undo?";
        showToast("Logged " + exerciseName + " — Set " + setInfo.set);
        refreshLastTimeForExercise(exerciseName);
        startUndoWindow(idBase, exerciseName, plan);
        return;
      } else if (res && res.error && res.error.toLowerCase().indexOf("expired") !== -1) {
        showToast("Session expired. Please log in again.", true);
        handleLogout();
        return;
      } else {
        showToast((res && res.error) ? res.error : "Log failed", true);
        btn.disabled = false;
        btn.textContent = "Log";
        return;
      }
    } catch (e) {}
  }

  enqueueOffline(payload);
  btn.classList.add("queued");
  btn.textContent = "Queued";
  showToast("Saved offline — will sync later", "warn");
}

function startUndoWindow(idBase, exerciseName, plan) {
  const btn = $(idBase + "_btn");
  let secondsLeft = Math.floor(UNDO_WINDOW_MS / 1000);

  const interval = setInterval(function () {
    secondsLeft--;
    if (secondsLeft > 0) {
      btn.textContent = "Logged — Undo (" + secondsLeft + ")";
    } else {
      clearInterval(interval);
      btn.classList.remove("logged");
      btn.disabled = false;
      btn.textContent = "Log";
    }
  }, 1000);

  const undoHandler = function () {
    clearInterval(interval);
    showToast("Undo — open the History tab to edit or delete this set.", "warn");
    btn.classList.remove("logged");
    btn.disabled = false;
    btn.textContent = "Log";
  };
  btn.addEventListener("click", undoHandler, { once: true });
}

// ============================================================
// LAST TIME
// ============================================================

async function loadLastTimesForPlan(plan) {
  const exercises = (state.programs && state.programs[plan]) || [];
  for (let i = 0; i < exercises.length; i++) {
    await loadLastTimeForExercise(exercises[i].name);
  }
}

async function loadLastTimeForExercise(exerciseName) {
  if (!state.token) return;
  try {
    const res = await callAPI({
      action: "lastTime",
      token: state.token,
      exercise: exerciseName
    });
    if (res && res.ok) {
      state.lastTimeCache[exerciseName] = {
        lastSession: res.lastSession,
        recentSessions: res.recentSessions || []
      };
      if (typeof res.sessionCount === "number") {
        state.sessionCount = res.sessionCount;
      }
      paintLastTimeForExercise(exerciseName);
    }
  } catch (e) {}
}

function refreshLastTimeForExercise(exerciseName) {
  loadLastTimeForExercise(exerciseName);
}

function paintLastTimeForExercise(exerciseName) {
  const data = state.lastTimeCache[exerciseName];
  if (!data || !data.lastSession) return;
  const sets = data.lastSession.sets || [];
  const cards = dom.exerciseList.querySelectorAll(".set-compare");
  cards.forEach(function (compareEl) {
    if (compareEl.dataset.exercise !== exerciseName) return;
    const lastCells = compareEl.querySelectorAll('.compare-set[id$="_last"]');
    lastCells.forEach(function (cell, i) {
      const s = sets[i];
      if (!s) {
        cell.innerHTML = '<div class="set-name">Set ' + (i + 1) + '</div><div class="set-data dim">—</div>';
        return;
      }
      const dataStr =
        (s.weight ? escapeHtml(String(s.weight)) + " lb" : "") +
        (s.reps ? " x " + escapeHtml(String(s.reps)) : "") +
        (s.grade ? ' <span class="set-grade">' + escapeHtml(s.grade) + '</span>' : "");
      const notesStr = s.notes ? '<div class="set-notes">' + escapeHtml(s.notes) + '</div>' : '';
      cell.innerHTML =
        '<div class="set-name">Set ' + escapeHtml(String(s.set)) + '</div>' +
        '<div class="set-data">' + dataStr + '</div>' +
        notesStr;
    });
  });
}

function openLastTimeModal(exerciseName) {
  const data = state.lastTimeCache[exerciseName];
  const recent = (data && data.recentSessions) || [];
  if (!recent.length) {
    dom.lastTimeContent.innerHTML =
      '<h2>' + escapeHtml(exerciseName) + '</h2>' +
      '<p style="color:#9aa3b0;">No previous sessions logged yet.</p>';
    dom.lastTimeModal.classList.remove("hidden");
    return;
  }

  let html = '<h2>' + escapeHtml(exerciseName) + '</h2>';
  html += '<p style="color:#9aa3b0;font-size:13px;">Last ' + recent.length + ' session' + (recent.length > 1 ? 's' : '') + '.</p>';
  html += '<div class="lt-grid">';
  recent.forEach(function (session) {
    html += '<div class="lt-session-col"><h4>' + escapeHtml(session.date) + '</h4>';
    session.sets.forEach(function (s) {
      html += '<div class="lt-set">';
      html += '<span class="lt-set-num">Set ' + escapeHtml(String(s.set)) + ':</span> ';
      html += (s.weight ? escapeHtml(String(s.weight)) + " lb" : "");
      html += (s.reps ? " x " + escapeHtml(String(s.reps)) : "");
      html += (s.grade ? ' <span class="lt-set-grade">' + escapeHtml(s.grade) + '</span>' : "");
      html += (s.notes ? '<span class="lt-set-notes">' + escapeHtml(s.notes) + '</span>' : "");
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  dom.lastTimeContent.innerHTML = html;
  dom.lastTimeModal.classList.remove("hidden");
}

// ============================================================
// TABS
// ============================================================

function switchTab(tabName) {
  dom.tabBtns.forEach(function (b) {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  dom.tabWorkout.classList.toggle("hidden", tabName !== "workout");
  dom.tabHistory.classList.toggle("hidden", tabName !== "history");
  if (tabName === "history") loadAndRenderHistory();
}

// ============================================================
// HISTORY
// ============================================================

async function loadAndRenderHistory() {
  dom.historyList.innerHTML = '<div class="history-empty">Loading…</div>';
  try {
    const days = parseInt(dom.histDaysFilter.value, 10) || 30;
    const res = await callAPI({ action: "history", token: state.token, days: days });
    if (!res || !res.ok) {
      dom.historyList.innerHTML = '<div class="history-empty">Could not load history.</div>';
      return;
    }
    state.historyRows = res.rows || [];
    renderHistory();
  } catch (e) {
    dom.historyList.innerHTML = '<div class="history-empty">Offline — no history available.</div>';
  }
}

function renderHistory() {
  const rows = state.historyRows || [];
  const planFilter = dom.histPlanFilter.value;
  const filtered = planFilter ? rows.filter(function (r) { return r.plan === planFilter; }) : rows;

  if (!filtered.length) {
    dom.historyList.innerHTML = '<div class="history-empty">No sessions in this range.</div>';
    return;
  }

  const byDate = {};
  filtered.forEach(function (r) {
    const d = new Date(r.timestamp);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  });

  const dates = Object.keys(byDate).sort().reverse();
  dom.historyList.innerHTML = "";

  dates.forEach(function (dateKey) {
    const sessionsForDate = byDate[dateKey];
    const plan = sessionsForDate[0].plan;
    const totalSets = sessionsForDate.length;
    const totalLifts = new Set(sessionsForDate.map(function (r) { return r.exercise; })).size;

    const el = document.createElement("div");
    el.className = "history-session";
    el.innerHTML =
      '<div class="history-session-head">' +
        '<div>' +
          '<div class="history-date">' + formatDate(dateKey) + ' — Plan ' + escapeHtml(plan) + '</div>' +
          '<div class="history-summary">' + totalLifts + ' lifts, ' + totalSets + ' sets</div>' +
        '</div>' +
        '<div class="history-toggle">›</div>' +
      '</div>' +
      '<div class="history-body hidden"></div>';

    const body = el.querySelector(".history-body");
    const byLift = {};
    const liftOrder = [];
    sessionsForDate.forEach(function (r) {
      if (!byLift[r.exercise]) { byLift[r.exercise] = []; liftOrder.push(r.exercise); }
      byLift[r.exercise].push(r);
    });

    liftOrder.forEach(function (liftName) {
      const liftSets = byLift[liftName];
      const liftEl = document.createElement("div");
      liftEl.className = "history-lift";

      let html = '<div class="history-lift-name">' + escapeHtml(liftName) + '</div>';
      liftSets.forEach(function (s) {
        const line = (s.weight ? s.weight + " lb" : "") + (s.reps ? " x " + s.reps : "");
        html +=
          '<div class="history-set-row">' +
            '<div class="history-set-num">S' + escapeHtml(String(s.set)) + '</div>' +
            '<div class="history-set-data">' + escapeHtml(line || "—") + '</div>' +
            '<div class="history-set-grade">' + escapeHtml(s.grade || "") + '</div>' +
          '</div>' +
          (s.notes ? '<div class="history-set-notes">"' + escapeHtml(s.notes) + '"</div>' : "");
      });
      liftEl.innerHTML = html;
      body.appendChild(liftEl);
    });

    el.querySelector(".history-session-head").addEventListener("click", function () {
      el.classList.toggle("open");
      body.classList.toggle("hidden");
    });

    dom.historyList.appendChild(el);
  });
}

// ============================================================
// WELCOME POPUP
// ============================================================

function showWelcomePopup(fromHelpButton) {
  if (!fromHelpButton && localStorage.getItem("hideTutorial") === "1") return;

  dom.popupContent.innerHTML =
    '<h2>How to use this app</h2>' +
    '<ul>' +
      '<li>Pick your plan for today.</li>' +
      '<li>Each exercise shows <strong>Last Time</strong> on the left, <strong>Today</strong> on the right.</li>' +
      '<li>Enter Weight, Reps, Grade, and Notes for each set.</li>' +
      '<li>Tap <strong>Log</strong> when a set is done. You have 3 seconds to undo.</li>' +
      '<li>Offline? Your sets save and sync when you\'re back online.</li>' +
    '</ul>' +

    '<h3>Terms</h3>' +
    '<h4>Rest</h4><p>Time to take between sets. Shown at the top of each lift.</p>' +
    '<h4>Tempo = W/X/Y/Z</h4><p>W = first motion, X = pause before 2nd motion, Y = second motion, Z = time between reps. If an X is shown, move with speed.</p>' +
    '<h4>Target Rep Range</h4><p>Use loads that have you failing in this range. Adjust the weight if you fall outside. This is a skill.</p>' +
    '<h4>Grade</h4><p>Give the grade and explain WHY in the notes. Notes serve as cues for the next session.</p>' +

    '<h3>Coach</h3>' +
    '<p>I am your Coach. If you need me, call: <a href="tel:9734526850">973.452.6850</a></p>';

  if (state.sessionCount >= TUTORIAL_THRESHOLD) {
    dom.popupDontShowBtn.classList.remove("hidden");
  } else {
    dom.popupDontShowBtn.classList.add("hidden");
  }
  dom.welcomePopup.classList.remove("hidden");
}

function hideWelcomePopup() {
  dom.welcomePopup.classList.add("hidden");
}

function dontShowAgain() {
  localStorage.setItem("hideTutorial", "1");
  hideWelcomePopup();
}

// ============================================================
// DOWNLOAD EMPTY LOG
// ============================================================

function downloadCsv() {
  const plan = state.currentPlan;
  if (!plan) { showToast("Pick a plan first, then download", true); return; }
  const lines = [];
  lines.push(["Athlete","Plan","Exercise","Set","Target","Weight","Reps","Grade","Notes"].join(","));
  if (state.programs[plan]) {
    state.programs[plan].forEach(function (ex) {
      ex.sets.forEach(function (s) {
        lines.push([
          csv(state.athlete || ""), csv(plan), csv(ex.name), csv(String(s.set)),
          csv(renderTargetLabel(s)), "", "", "", ""
        ].join(","));
      });
    });
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  triggerDownload(blob, "empty-log-" + (state.athlete || "athlete") + "-" + new Date().toISOString().slice(0,10) + ".csv");
}

function downloadPdf() {
  const plan = state.currentPlan;
  if (!plan || !state.programs[plan]) { showToast("Pick a plan first, then download", true); return; }
  const w = window.open("", "_blank");
  let html = '<html><head><title>Empty Log — Plan ' + plan + '</title>';
  html += '<style>body{font-family:sans-serif;padding:20px;} h1{font-size:18px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #999;padding:6px;font-size:12px;text-align:left;} th{background:#eee;}</style>';
  html += '</head><body>';
  html += '<h1>Empty Log — ' + escapeHtml(state.athlete || "") + ' — Plan ' + plan + '</h1>';
  html += '<p>Date: ___________________</p>';
  html += '<table><thead><tr><th>Exercise</th><th>Set</th><th>Target</th><th>Weight</th><th>Reps</th><th>Grade</th><th>Notes</th></tr></thead><tbody>';
  state.programs[plan].forEach(function (ex) {
    ex.sets.forEach(function (s, i) {
      html += '<tr><td>' + (i === 0 ? escapeHtml(ex.name) : '') + '</td><td>' + escapeHtml(String(s.set)) + '</td><td>' + escapeHtml(renderTargetLabel(s)) + '</td><td></td><td></td><td></td><td></td></tr>';
    });
  });
  html += '</tbody></table></body></html>';
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function () { w.print(); }, 400);
}

function csv(v) {
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// REFRESH
// ============================================================

async function refreshData() {
  showToast("Refreshing…");
  if (state.currentPlan) await loadLastTimesForPlan(state.currentPlan);
  if (!dom.tabHistory.classList.contains("hidden")) await loadAndRenderHistory();
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

function sanitizeId(s) {
  return String(s).replace(/[^a-z0-9]/gi, "_");
}

function formatDate(yyyymmdd) {
  const parts = yyyymmdd.split("-");
  const dt = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function showToast(msg, isError) {
  dom.toast.textContent = msg;
  dom.toast.classList.remove("hidden", "error", "warn");
  if (isError === true) dom.toast.classList.add("error");
  else if (isError === "warn") dom.toast.classList.add("warn");
  setTimeout(function () { dom.toast.classList.add("hidden"); }, 2400);
}
