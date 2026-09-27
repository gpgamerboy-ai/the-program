// ============================================================
// TIMER PLAYER — v5 (structure parser fix)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbyiJfEn8fIyMlupk-rrc15BkqVb_UgYsR-wfQQVKgIjH9_t6Xh5KoctO880qBnWa-VInQ/exec";

const state = {
  timerId: null,
  timer: null,
  token: null,
  coachKey: null,
  isPreview: false,
  athlete: null,
  phaseIndex: 0,
  round: 1,
  totalRounds: 1,
  timeLeft: 0,
  isPaused: false,
  isRunning: false,
  isLocked: false,
  structure: [],
  intervalHandle: null,
  inputPrompts: [],
  collectedInputs: [],
  pendingInput: null,
  completedRounds: 0,
  hasStarted: false,
  startTime: null,
  totalDuration: 0,
  scrollLocked: false
};

const $ = function (id) { return document.getElementById(id); };

const dom = {
  startScreen: $("startScreen"),
  startTitle: $("startTitle"),
  startSubtitle: $("startSubtitle"),
  startBtn: $("startBtn"),
  timerApp: $("timerApp"),
  masterClock: $("masterClock"),
  statElapsed: $("statElapsed"),
  statInterval: $("statInterval"),
  statRemaining: $("statRemaining"),
  intervalScroll: $("intervalScroll"),
  intervalList: $("intervalList"),
  hamburgerBtn: $("hamburgerBtn"),
  pauseBtn: $("pauseBtn"),
  pauseIcon: $("pauseIcon"),
  playIcon: $("playIcon"),
  lockBtn: $("lockBtn"),
  lockOpenIcon: $("lockOpenIcon"),
  lockClosedIcon: $("lockClosedIcon"),
  restartBtn: $("restartBtn"),
  exitBtn: $("exitBtn"),
  lockOverlay: $("lockOverlay"),
  unlockBtn: $("unlockBtn"),
  hamburgerMenu: $("hamburgerMenu"),
  menuExit: $("menuExit"),
  menuReset: $("menuReset"),
  menuLock: $("menuLock"),
  menuBack: $("menuBack"),
  inputModal: $("inputModal"),
  inputPrompt: $("inputPrompt"),
  inputField: $("inputField"),
  inputSubmit: $("inputSubmit"),
  completeModal: $("completeModal"),
  completeSummary: $("completeSummary"),
  completeDone: $("completeDone"),
  errorMsg: $("errorMsg")
};

document.addEventListener("DOMContentLoaded", function () {
  wireEvents();
  loadTimerFromURL();
});

function wireEvents() {
  dom.startBtn.addEventListener("click", handleStart);
  dom.pauseBtn.addEventListener("click", togglePause);
  dom.hamburgerBtn.addEventListener("click", openMenu);
  dom.lockBtn.addEventListener("click", toggleLock);
  dom.restartBtn.addEventListener("click", confirmRestart);
  dom.exitBtn.addEventListener("click", confirmExit);
  dom.unlockBtn.addEventListener("click", beginUnlockHold);
  dom.unlockBtn.addEventListener("touchend", cancelUnlockHold);
  dom.unlockBtn.addEventListener("mouseup", cancelUnlockHold);
  dom.unlockBtn.addEventListener("mouseleave", cancelUnlockHold);
  dom.menuExit.addEventListener("click", confirmExit);
  dom.menuReset.addEventListener("click", confirmRestart);
  dom.menuLock.addEventListener("click", lockFromMenu);
  dom.menuBack.addEventListener("click", closeMenu);
  dom.inputSubmit.addEventListener("click", submitInput);
  dom.completeDone.addEventListener("click", function () {
    dom.completeModal.classList.add("hidden");
    if (window.history.length > 1) window.history.back();
  });
}

function loadTimerFromURL() {
  const params = new URLSearchParams(window.location.search);
  state.timerId = params.get("id");
  state.isPreview = params.get("preview") === "1";
  state.coachKey = params.get("key");
  state.token = params.get("token") || localStorage.getItem("sessionToken");
  state.athlete = params.get("athlete") || localStorage.getItem("lastAthlete");

  if (!state.timerId) { showError("No timer ID provided. Use ?id=T001"); return; }

  if (state.isPreview) {
    if (!state.coachKey) { showError("Preview mode requires ?key=COACH_KEY"); return; }
  } else {
    if (!state.token) { showError("No session token. Log in to the athlete app first."); return; }
  }

  fetchTimer();
}

async function fetchTimer() {
  try {
    const params = new URLSearchParams();
    params.append("action", "getTimer");
    params.append("timerId", state.timerId);

    if (state.isPreview) {
      params.append("key", state.coachKey);
    } else {
      params.append("token", state.token);
    }

    const res = await fetch(ENDPOINT + "?" + params.toString(), { method: "GET" });
    const data = await res.json();
    if (!data || !data.ok) {
      showError((data && data.error) || "Could not load timer");
      return;
    }
    state.timer = data.timer;
    dom.startTitle.textContent = state.timer.timerName || "Timer";
    dom.startSubtitle.textContent = state.isPreview
      ? "Preview mode — no logging"
      : "Tap START to begin";
  } catch (e) {
    showError("Network error loading timer");
  }
}

// ============================================================
// STRUCTURE PARSER — handles string OR already-parsed array
// ============================================================

function parseStructure(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw || "[]"); }
    catch (e) { return []; }
  }
  return [];
}

function expandStructure(raw) {
  const flat = [];
  (raw || []).forEach(function (iv) {
    if (iv.type === "circuit") {
      const rounds = parseInt(iv.rounds, 10) || 1;
      const inner = iv.intervals || [];
      for (let r = 1; r <= rounds; r++) {
        inner.forEach(function (innerIv) {
          const copy = Object.assign({}, innerIv);
          copy.roundNumber = r;
          copy.totalRoundCount = rounds;
          flat.push(copy);
        });
        if (iv.afterEach && r < rounds) flat.push(Object.assign({}, iv.afterEach));
      }
      if (iv.afterCircuit) flat.push(Object.assign({}, iv.afterCircuit));
    } else {
      flat.push(Object.assign({}, iv));
    }
  });
  return flat;
}

function handleStart() {
  state.hasStarted = true;
  state.startTime = Date.now();

  dom.startScreen.classList.add("hidden");
  dom.timerApp.classList.remove("hidden");

  const t = state.timer;

  const rawStructure = parseStructure(t.structure);
  state.structure = expandStructure(rawStructure);

  state.inputPrompts = parseStructure(t.inputPrompts);

  if (!state.structure.length) {
    showError("Timer has no intervals defined");
    return;
  }

  state.totalDuration = state.structure.reduce(function (sum, iv) {
    return sum + (parseInt(iv.duration, 10) || 0);
  }, 0);

  const workIntervals = state.structure.filter(function (iv) { return iv.type === "work"; });
  state.totalRounds = workIntervals.length || 1;

  state.phaseIndex = 0;
  state.completedRounds = 0;

  renderIntervalList();

  speak(t.ttsTitle || t.timerName || "Starting timer");

  setTimeout(function () { beginInterval(0); }, 3000);
}

function beginInterval(index) {
  if (index >= state.structure.length) { completeTimer(); return; }

  const iv = state.structure[index];
  state.phaseIndex = index;
  state.timeLeft = parseInt(iv.duration, 10) || 0;
  state.isRunning = true;
  state.isPaused = false;

  dom.pauseIcon.classList.remove("hidden");
  dom.playIcon.classList.add("hidden");

  document.body.className = "phase-" + (iv.type || "work");
  updateMasterClock();
  updateStats();
  updateIntervalList();
  scrollToCurrent();

  speak(iv.name || iv.type);

  const nextIv = state.structure[index + 1];
  if (nextIv && shouldCue("nextUp")) {
    setTimeout(function () {
      speak("Next: " + (nextIv.name || nextIv.type));
    }, 1500);
  }

  startTicking();
}

function startTicking() {
  if (state.intervalHandle) clearInterval(state.intervalHandle);

  state.intervalHandle = setInterval(function () {
    if (state.isPaused) return;

    state.timeLeft--;

    const iv = state.structure[state.phaseIndex];
    const halfwayThreshold = Math.floor((parseInt(iv.duration, 10) || 0) / 2);
    if (state.timeLeft === halfwayThreshold && shouldCue("halfway")) speak("Halfway");
    if (state.timeLeft <= 3 && state.timeLeft > 0 && shouldCue("countdown3s")) speak(String(state.timeLeft));

    if (state.timeLeft <= 0) {
      clearInterval(state.intervalHandle);
      state.isRunning = false;
      endInterval();
      return;
    }

    updateMasterClock();
    updateStats();
  }, 1000);
}

function endInterval() {
  const iv = state.structure[state.phaseIndex];
  if (iv.type === "work") state.completedRounds++;

  const prompt = state.inputPrompts.find(function (p) {
    return p.atEnd && (p.afterInterval === state.phaseIndex + 1 || p.afterType === iv.type);
  });

  if (prompt) {
    state.pendingInput = prompt;
    showInputPrompt(prompt);
    return;
  }
  nextInterval();
}

function nextInterval() {
  const next = state.phaseIndex + 1;
  if (next >= state.structure.length) { completeTimer(); }
  else { beginInterval(next); }
}

function jumpToInterval(index) {
  if (state.isLocked) return;

  const iv = state.structure[state.phaseIndex];
  const elapsedInCurrent = iv ? (parseInt(iv.duration, 10) - state.timeLeft) : 0;
  const meaningful = elapsedInCurrent > 3 && index !== state.phaseIndex;

  if (meaningful) {
    if (!confirm("Jump to this interval? Current interval will be skipped.")) return;
  }

  if (state.intervalHandle) clearInterval(state.intervalHandle);
  state.isRunning = false;
  state.isPaused = false;

  dom.pauseIcon.classList.remove("hidden");
  dom.playIcon.classList.add("hidden");

  let workCount = 0;
  for (let i = 0; i < index; i++) {
    if (state.structure[i].type === "work") workCount++;
  }
  state.completedRounds = workCount;

  beginInterval(index);
}

function renderIntervalList() {
  dom.intervalList.innerHTML = "";

  state.structure.forEach(function (iv, i) {
    const card = document.createElement("div");
    card.className = "interval-card";
    card.dataset.index = i;
    card.dataset.type = iv.type || "work";
    card.style.cursor = "pointer";

    const color = iv.color || colorForType(iv.type);
    card.style.background = color;

    const label = getLabelForPosition(i);
    const name = iv.name || iv.type || "";
    const dur = formatDuration(parseInt(iv.duration, 10) || 0);

    card.innerHTML =
      '<div class="iv-label">' + escapeHtml(label) + '</div>' +
      '<div class="iv-name">' + escapeHtml(name) + '</div>' +
      '<div class="iv-duration">' + dur + '</div>';

    card.addEventListener("click", function () {
      jumpToInterval(i);
    });

    dom.intervalList.appendChild(card);
  });
}

function updateIntervalList() {
  const cards = dom.intervalList.querySelectorAll(".interval-card");
  cards.forEach(function (card, i) {
    card.classList.remove("current", "next", "upcoming", "past");

    if (i < state.phaseIndex) card.classList.add("past");
    else if (i === state.phaseIndex) card.classList.add("current");
    else if (i === state.phaseIndex + 1) card.classList.add("next");
    else card.classList.add("upcoming");

    const label = card.querySelector(".iv-label");
    if (label) label.textContent = getLabelForPosition(i);
  });
}

function scrollToCurrent() {
  if (state.scrollLocked || state.isLocked) return;
  const currentCard = dom.intervalList.querySelector(".interval-card.current");
  if (!currentCard) return;

  const scrollBox = dom.intervalScroll;
  const cardTop = currentCard.offsetTop;
  const cardHeight = currentCard.offsetHeight;
  const boxHeight = scrollBox.clientHeight;

  const targetScroll = cardTop - (boxHeight / 2) + (cardHeight / 2);

  scrollBox.scrollTo({ top: targetScroll, behavior: "smooth" });
}

function getLabelForPosition(i) {
  if (i < state.phaseIndex) return "PAST";
  if (i === state.phaseIndex) return "CURRENT INTERVAL";
  if (i === state.phaseIndex + 1) return "UP NEXT";
  return "UPCOMING";
}

function updateMasterClock() {
  dom.masterClock.textContent = formatDuration(state.timeLeft);
}

function updateStats() {
  const elapsed = state.startTime
    ? Math.floor((Date.now() - state.startTime) / 1000)
    : 0;

  const totalIntervals = state.structure.length;
  const currentIntervalNum = state.phaseIndex + 1;

  const remainingTotal =
    state.timeLeft +
    state.structure.slice(state.phaseIndex + 1).reduce(function (sum, iv) {
      return sum + (parseInt(iv.duration, 10) || 0);
    }, 0);

  dom.statElapsed.textContent = formatDuration(elapsed);
  dom.statInterval.textContent = currentIntervalNum + "/" + totalIntervals;
  dom.statRemaining.textContent = formatDuration(remainingTotal);
}

function togglePause() {
  state.isPaused = !state.isPaused;
  if (state.isPaused) {
    dom.pauseIcon.classList.add("hidden");
    dom.playIcon.classList.remove("hidden");
    speak("Paused");
  } else {
    dom.pauseIcon.classList.remove("hidden");
    dom.playIcon.classList.add("hidden");
    speak("Resume");
  }
}

function confirmRestart() {
  if (confirm("Restart timer from the beginning?")) {
    if (state.intervalHandle) clearInterval(state.intervalHandle);
    state.phaseIndex = 0;
    state.completedRounds = 0;
    state.isPaused = false;
    state.isRunning = false;
    state.startTime = Date.now();
    closeMenu();
    beginInterval(0);
  }
}

function confirmExit() {
  if (confirm("Exit timer? Progress will be lost.")) {
    if (state.intervalHandle) clearInterval(state.intervalHandle);
    if (window.history.length > 1) window.history.back();
  }
}

let unlockTimer = null;

function toggleLock() {
  if (state.isLocked) unlockLock();
  else lockInterface();
}

function lockInterface() {
  state.isLocked = true;
  state.scrollLocked = true;
  dom.lockOverlay.classList.remove("hidden");
  dom.intervalScroll.style.overflowY = "hidden";
  closeMenu();
}

function unlockLock() {
  state.isLocked = false;
  state.scrollLocked = false;
  dom.lockOverlay.classList.add("hidden");
  dom.intervalScroll.style.overflowY = "auto";
}

function beginUnlockHold() {
  unlockTimer = setTimeout(function () {
    unlockLock();
  }, 2000);
}

function cancelUnlockHold() {
  if (unlockTimer) {
    clearTimeout(unlockTimer);
    unlockTimer = null;
  }
}

function lockFromMenu() {
  closeMenu();
  setTimeout(lockInterface, 200);
}

function openMenu() {
  dom.hamburgerMenu.classList.remove("hidden");
  state.isPaused = true;
}

function closeMenu() {
  dom.hamburgerMenu.classList.add("hidden");
  if (state.isRunning && !state.isLocked) {
    state.isPaused = false;
  }
}

function showInputPrompt(prompt) {
  state.pendingInput = prompt;
  dom.inputPrompt.textContent = prompt.prompt || "Enter value";
  dom.inputField.value = "";
  dom.inputModal.classList.remove("hidden");
  dom.inputField.focus();
}

function submitInput() {
  const value = dom.inputField.value.trim();
  if (value === "") return;

  state.collectedInputs.push({
    prompt: state.pendingInput.prompt,
    value: value,
    intervalIndex: state.phaseIndex
  });

  dom.inputModal.classList.add("hidden");
  state.pendingInput = null;
  nextInterval();
}

async function completeTimer() {
  if (state.intervalHandle) clearInterval(state.intervalHandle);
  state.isRunning = false;

  const summary = "Completed " + state.completedRounds + " round" + (state.completedRounds === 1 ? "" : "s");
  dom.completeSummary.textContent = state.isPreview ? summary + " (preview — not logged)" : summary;
  dom.completeModal.classList.remove("hidden");

  speak("Timer complete");

  if (!state.isPreview) {
    await logTimerCompletion();
  }
}

async function logTimerCompletion() {
  const inputData = state.collectedInputs.length ? JSON.stringify(state.collectedInputs) : "";
  const firstInput = state.collectedInputs.length ? state.collectedInputs[0].value : "";

  const params = new URLSearchParams();
  params.append("action", "logSet");
  params.append("token", state.token);
  params.append("plan", state.timer.timerType || "timer");
  params.append("exercise", "Timer: " + (state.timer.timerName || state.timerId));
  params.append("set", "1");
  params.append("target", String(state.timer.totalDuration || 0));
  params.append("reps", String(firstInput));
  params.append("duration", String(state.timer.totalDuration || 0));
  params.append("roundsCompleted", String(state.completedRounds));
  params.append("inputData", inputData);
  params.append("notes", "");

  try { await fetch(ENDPOINT + "?" + params.toString(), { method: "GET" }); } catch (e) {}
}

function colorForType(type) {
  if (type === "rest") return "#ff3b30";
  if (type === "prep") return "#c0c0c0";
  if (type === "mobility") return "#ff2cd9";
  if (type === "lift") return "#00e5ff";
  if (type === "cooldown") return "#ff9f1c";
  if (type === "circuit") return "#00e5ff";
  return "#b8f52c";
}

function formatDuration(seconds) {
  const s = Math.max(0, seconds | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

function shouldCue(name) {
  if (!state.timer || !state.timer.ttsCues) return true;
  const cues = parseStructure(state.timer.ttsCues);
  if (typeof cues === "object" && !Array.isArray(cues)) {
    return cues[name] !== false;
  }
  return true;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showError(msg) {
  dom.errorMsg.textContent = msg;
  dom.errorMsg.classList.remove("hidden");
  setTimeout(function () { dom.errorMsg.classList.add("hidden"); }, 6000);
}
