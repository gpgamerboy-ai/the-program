// ============================================================
// TIMER PLAYER — with start button
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbzA1JpCvFrKEXd4VhSec_f8uqH760HIXKv6DcenF06zySPxuGDT4KP8RBycZW5XDM2kaw/exec";

const state = {
  timerId: null,
  timer: null,
  token: null,
  athlete: null,
  phaseIndex: 0,
  round: 1,
  totalRounds: 1,
  timeLeft: 0,
  isPaused: false,
  isRunning: false,
  structure: [],
  intervalHandle: null,
  inputPrompts: [],
  collectedInputs: [],
  pendingInput: null,
  completedRounds: 0,
  hasStarted: false
};

const $ = function (id) { return document.getElementById(id); };

const dom = {
  startScreen: $("startScreen"),
  startTitle: $("startTitle"),
  startSubtitle: $("startSubtitle"),
  startBtn: $("startBtn"),
  timerApp: $("timerApp"),
  phaseBanner: $("phaseBanner"),
  timeDisplay: $("timeDisplay"),
  intervalName: $("intervalName"),
  intervalInfo: $("intervalInfo"),
  progressFill: $("progressFill"),
  roundInfo: $("roundInfo"),
  pauseBtn: $("pauseBtn"),
  skipBtn: $("skipBtn"),
  stopBtn: $("stopBtn"),
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
  dom.skipBtn.addEventListener("click", skipInterval);
  dom.stopBtn.addEventListener("click", confirmStop);
  dom.inputSubmit.addEventListener("click", submitInput);
  dom.completeDone.addEventListener("click", function () {
    dom.completeModal.classList.add("hidden");
    if (window.history.length > 1) window.history.back();
  });
}

function loadTimerFromURL() {
  const params = new URLSearchParams(window.location.search);
  state.timerId = params.get("id");
  state.token = params.get("token") || localStorage.getItem("sessionToken");
  state.athlete = params.get("athlete") || localStorage.getItem("lastAthlete");

  if (!state.timerId) {
    showError("No timer ID provided. Use ?id=T001");
    return;
  }
  if (!state.token) {
    showError("No session token. Log in to the athlete app first.");
    return;
  }
  fetchTimer();
}

async function fetchTimer() {
  try {
    const params = new URLSearchParams();
    params.append("action", "getTimer");
    params.append("token", state.token);
    params.append("timerId", state.timerId);

    const res = await fetch(ENDPOINT + "?" + params.toString(), { method: "GET" });
    const data = await res.json();

    if (!data || !data.ok) {
      showError((data && data.error) || "Could not load timer");
      return;
    }
    state.timer = data.timer;
    prepareStartScreen();
  } catch (e) {
    showError("Network error loading timer");
  }
}

function prepareStartScreen() {
  // Show the timer name on the start card
  dom.startTitle.textContent = state.timer.timerName || "Timer";
  dom.startSubtitle.textContent = "Tap START to begin";
  // Start screen is visible by default. Timer app is hidden.
}

function handleStart() {
  // User gesture just happened. Now we can speak.
  state.hasStarted = true;
  dom.startScreen.classList.add("hidden");
  dom.timerApp.classList.remove("hidden");

  const t = state.timer;

  try { state.structure = JSON.parse(t.structure || "[]"); }
  catch (e) { state.structure = []; }

  try { state.inputPrompts = JSON.parse(t.inputPrompts || "[]"); }
  catch (e) { state.inputPrompts = []; }

  if (!state.structure.length) {
    showError("Timer has no intervals defined");
    return;
  }

  state.totalRounds = state.structure.filter(function (iv) { return iv.type === "work"; }).length || 1;
  state.phaseIndex = 0;
  state.round = 1;
  state.completedRounds = 0;

  speak(t.ttsTitle || t.timerName || "Starting timer");

  setTimeout(function () { beginInterval(0); }, 3000);
}

function beginInterval(index) {
  if (index >= state.structure.length) {
    completeTimer();
    return;
  }

  const iv = state.structure[index];
  state.phaseIndex = index;
  state.timeLeft = parseInt(iv.duration, 10) || 0;
  state.isRunning = true;

  updatePhaseUI(iv);
  updateTimerDisplay();

  speak(iv.name || iv.type);

  const nextIv = state.structure[index + 1];
  if (nextIv && shouldCue("nextUp")) {
    setTimeout(function () {
      speak("Next: " + (nextIv.name || nextIv.type));
    }, 1500);
  }

  if (iv.type === "work") {
    state.round = state.completedRounds + 1;
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
    if (state.timeLeft === halfwayThreshold && shouldCue("halfway")) {
      speak("Halfway");
    }

    if (state.timeLeft <= 3 && state.timeLeft > 0 && shouldCue("countdown3s")) {
      speak(String(state.timeLeft));
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.intervalHandle);
      state.isRunning = false;
      endInterval();
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function endInterval() {
  const iv = state.structure[state.phaseIndex];

  if (iv.type === "work") {
    state.completedRounds++;
  }

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
  if (next >= state.structure.length) {
    completeTimer();
  } else {
    beginInterval(next);
  }
}

function updatePhaseUI(iv) {
  document.body.className = "phase-" + (iv.type || "work");
  const typeLabel = (iv.type || "work").toUpperCase();
  dom.phaseBanner.textContent = typeLabel;
  dom.intervalName.textContent = iv.name || iv.type || "";

  if (iv.type === "work") {
    dom.roundInfo.textContent = "Round " + (state.completedRounds + 1) + " of " + state.totalRounds;
  } else {
    dom.roundInfo.textContent = "";
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(Math.max(0, state.timeLeft) / 60);
  const secs = Math.max(0, state.timeLeft) % 60;
  dom.timeDisplay.textContent =
    String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");

  const iv = state.structure[state.phaseIndex];
  if (iv && iv.duration > 0) {
    const elapsed = iv.duration - state.timeLeft;
    const pct = Math.min(100, (elapsed / iv.duration) * 100);
    dom.progressFill.style.width = pct + "%";
  }
}

function togglePause() {
  state.isPaused = !state.isPaused;
  dom.pauseBtn.textContent = state.isPaused ? "Resume" : "Pause";
  speak(state.isPaused ? "Paused" : "Resume");
}

function skipInterval() {
  if (state.intervalHandle) clearInterval(state.intervalHandle);
  state.isRunning = false;
  endInterval();
}

function confirmStop() {
  if (confirm("Stop the timer? Progress will be lost.")) {
    if (state.intervalHandle) clearInterval(state.intervalHandle);
    state.isPaused = false;
    state.isRunning = false;
    if (window.history.length > 1) window.history.back();
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
  dom.completeSummary.textContent = summary;
  dom.completeModal.classList.remove("hidden");

  speak("Timer complete");
  await logTimerCompletion();
}

async function logTimerCompletion() {
  const inputData = state.collectedInputs.length
    ? JSON.stringify(state.collectedInputs)
    : "";
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

  try {
    await fetch(ENDPOINT + "?" + params.toString(), { method: "GET" });
  } catch (e) {}
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
  try {
    const cues = JSON.parse(state.timer.ttsCues);
    return cues[name] !== false;
  } catch (e) {
    return true;
  }
}

function showError(msg) {
  dom.errorMsg.textContent = msg;
  dom.errorMsg.classList.remove("hidden");
  setTimeout(function () {
    dom.errorMsg.classList.add("hidden");
  }, 6000);
}
