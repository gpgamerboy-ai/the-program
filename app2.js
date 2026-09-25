// ============================================================
// WORKOUT TRACKER — app2.js (v4)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbyCv5UAZrMpHJvXlGTbnqsA9wjHWKKR8pL3UQQvETdWQX2AVdpoC_21wnCNG2LVE9WO/exec";
const TUTORIAL_THRESHOLD = 30;

// ============================================================
// STATE
// ============================================================

const state = {
  token: null,
  athlete: null,
  program: null,
  programs: null,
  sessionCount: 0,
  currentPlan: null,
  lastTimeCache: {},
  offlineQueue: [],
  historyRows: []
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
// NETWORK (POST form-encoded)
// ============================================================

async function postJSON(payload) {
  const params = new URLSearchParams();
  Object.keys(payload).forEach(function (k) {
    const v = payload[k];
    if (v !== undefined && v !== null) params.append(k, String(v));
  });

  const res = await fetch(ENDPOINT, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "follow"
  });

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
      const res = await postJSON(Object.assign({ action: "logSet", token: state.token }, item));
      if (!res || !res.ok) remaining.push(item);
    } catch (e) {
      remaining.push(item);
    }
  }
  state.offlineQueue = remaining;
  saveOfflineQueue();

  if (!remaining.length) showToast("Offline sets synced", false);
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
    const res = await postJSON({ action: "listNames" });
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
  } catch (e) {
    // offline or server down
  }
}

// ============================================================
// LOGIN
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
    const res = await postJSON({ action: "login", name: name, pin: pin });
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
    state.sessionCount = res.sessionCount || 0;

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
  state.currentPlan = null;
  state.lastTimeCache = {};
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
  selectPlan(null);
  showWelcomePopup(false);
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
  html += '<span class="exercise-tag ' + tagClass + '">' + tagText + '</span>';
  html += '</div>';
  html += '<div class="exercise-meta">';
  html += '<strong>Rest:</strong> ' + escapeHtml(String(ex.rest)) + ' &nbsp;•&nbsp; ';
  html += '<strong>Tempo:</strong> ' + escapeHtml(String(ex.tempo));
  html += '</div>';
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

  const targetNote = setInfo.targetNote
    ? ' — <span style="color:#9aa3b0;font-weight:400;">' + escapeHtml(setInfo.targetNote) + '</span>'
    : '';

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
          '<div><label>Target</label><input type="text" value="' + escapeHtml(String(setInfo.target || "")) + '" readonly /></div>' +
          '<div><label>Weight</label><input type="number" id="' + idBase + '_w" placeholder="lb" /></div>' +
        '</div>' +
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

  return wrapper;
}

// ============================================================
// LOG A SET
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
      const res = await postJSON(Object.assign({ action: "logSet", token: state.token }, payload));
      if (res && res.ok) {
        btn.classList.add("logged");
        btn.textContent = "Done";
        showToast("Logged " + exerciseName + " — Set " + setInfo.set);
        refreshLastTimeForExercise(exerciseName);
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
    } catch (e) {
      // fall through to offline
    }
  }

  enqueueOffline(payload);
  btn.classList.add("queued");
  btn.textContent = "Queued";
  showToast("Saved offline — will sync later", "warn");
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
    const res = await postJSON({
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
  } catch (e) {
    // offline
  }
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
    const res = await postJSON({
      action: "history",
      token: state.token,
      days: days
    });
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
      '<li>Pick your plan for today (A, B, or C).</li>' +
      '<li>Each exercise shows <strong>Last Time</strong> on the left, <strong>Today</strong> on the right.</li>' +
      '<li>Enter Weight, Reps, Grade, and Notes for each set.</li>' +
      '<li>Tap <strong>Log</strong> when a set is done.</li>' +
      '<li>Offline? Your sets save and sync when you\'re back online.</li>' +
    '</ul>' +

    '<h3>Terms</h3>' +

    '<h4>Ramp-Up Sets</h4>' +
    '<p>Lighter sets before your work sets. Purpose is to warm up the movement, not to tire you out.</p>' +

    '<h4>Work Sets</h4>' +
    '<p>Your real sets at working weight. These are the ones that make you stronger.</p>' +

    '<h4>Left in the Tank</h4>' +
    '<p>How many more reps you could have done before failing. 4 in the tank = you had 4 reps left.</p>' +

    '<h4>Rest</h4>' +
    '<p>Time to take between sets. Shown at the top of each lift.</p>' +

    '<h4>Tempo = W/X/Y/Z</h4>' +
    '<p>W = first motion<br>X = pause before 2nd motion<br>Y = second motion<br>Z = time between reps<br>If an X is shown instead of a number, move with speed.</p>' +

    '<h4>Target Rep Range</h4>' +
    '<p>Use loads that have you failing in this range. If you exceed or fall short, adjust the weight. This is a skill that gets better with practice.</p>' +

    '<h4>Grade</h4>' +
    '<p>Give the grade and explain WHY in the notes. Notes also serve as cues for better performance — read your notes from the last set before each new set.</p>' +

    '<h3>Movement Preps : Warm-Ups</h3>' +

    '<h4>World\'s Greatest Stretch Walking (dynamic)</h4>' +
    '<ul>' +
      '<li>Stand tall.</li>' +
      '<li>Step out like stepping over a puddle.</li>' +
      '<li>Elbow to instep.</li>' +
      '<li>Twist away.</li>' +
      '<li>Frame the foot: one hand on each side.</li>' +
      '<li>Straighten front leg.</li>' +
      '<li>Draw hands back toward heel, rock back on heel.</li>' +
      '<li>Step forward, reach up tall, repeat.</li>' +
      '<li>5-6 minutes — start slow and hold, work up to a flow.</li>' +
    '</ul>' +

    '<h4>Kick Series (dynamic)</h4>' +
    '<ul>' +
      '<li>Lie in Jesus pose, arms out, legs straight.</li>' +
      '<li>Right leg up to \'check-in\', kick leg up.</li>' +
      '<li>Left leg up to \'check-in\', kick leg up.</li>' +
      '<li>Right leg folds over and back.</li>' +
      '<li>Left leg folds over and back.</li>' +
      '<li>Right leg: kick up + fold over + back + down.</li>' +
      '<li>Left leg: kick up + fold over + back + down.</li>' +
      '<li>4-6 minutes — this is a conversation you are having with your body, asking permission to move and listening to what your body is telling you.</li>' +
    '</ul>' +

    '<h3>Cool Down / Recovery</h3>' +

    '<h4>World\'s Greatest Stretch Walking (slow)</h4>' +
    '<p>Same movement pattern as warm-up. Slower pace, longer holds. 4-6 minutes, rest as needed. Recover. Breathe easily.</p>' +

    '<h4>Kick Series (slow)</h4>' +
    '<p>Same sequence as warm-up. Slow and controlled. 1 round. Focus on breathing and range. 4-6 minutes, rest as needed. Recover. Breathe easily.</p>' +

    '<h3>Coach</h3>' +
    '<p>I am your Coach. If you need to, just call me: <a href="tel:9734526850">973.452.6850</a></p>';

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
  if (!plan) {
    showToast("Pick a plan first, then download", true);
    return;
  }

  const lines = [];
  lines.push(["Athlete", "Plan", "Exercise", "Set", "Target", "Weight", "Reps", "Grade", "Notes"].join(","));

  if (state.programs[plan]) {
    state.programs[plan].forEach(function (ex) {
      ex.sets.forEach(function (s) {
        lines.push([
          csv(state.athlete || ""),
          csv(plan),
          csv(ex.name),
          csv(String(s.set)),
          csv(String(s.target || "")),
          "",
          "",
          "",
          ""
        ].join(","));
      });
    });
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  triggerDownload(blob, "empty-log-" + (state.athlete || "athlete") + "-" + new Date().toISOString().slice(0, 10) + ".csv");
}

function downloadPdf() {
  const plan = state.currentPlan;
  if (!plan || !state.programs[plan]) {
    showToast("Pick a plan first, then download", true);
    return;
  }

  const w = window.open("", "_blank");
  let html = '';
  html += '<html><head><title>Empty Log — Plan ' + plan + '</title>';
  html += '<style>body{font-family:sans-serif;padding:20px;} h1{font-size:18px;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #999;padding:6px;font-size:12px;text-align:left;} th{background:#eee;} .notes-col{width:25%;}</style>';
  html += '</head><body>';
  html += '<h1>Empty Log — ' + escapeHtml(state.athlete || "") + ' — Plan ' + plan + '</h1>';
  html += '<p>Date: ___________________</p>';
  html += '<table><thead><tr><th>Exercise</th><th>Set</th><th>Target</th><th>Weight</th><th>Reps</th><th>Grade</th><th class="notes-col">Notes</th></tr></thead><tbody>';

  state.programs[plan].forEach(function (ex) {
    ex.sets.forEach(function (s, i) {
      html += '<tr>';
      html += '<td>' + (i === 0 ? escapeHtml(ex.name) : "") + '</td>';
      html += '<td>' + escapeHtml(String(s.set)) + '</td>';
      html += '<td>' + escapeHtml(String(s.target || "")) + '</td>';
      html += '<td></td><td></td><td></td><td></td>';
      html += '</tr>';
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
  showToast("Refreshing…", false);
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
