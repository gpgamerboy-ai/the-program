// ============================================================
// COACH VIEW — coach.js v4 (messaging)
// ============================================================

const ENDPOINT = "https://script.google.com/macros/s/AKfycbyiJfEn8fIyMlupk-rrc15BkqVb_UgYsR-wfQQVKgIjH9_t6Xh5KoctO880qBnWa-VInQ/exec";
const COACH_KEY_STORAGE = "coachKey";

const $ = function (id) { return document.getElementById(id); };

let state = {
  key: null,
  athletes: [],
  logs: [],
  conversations: [],
  currentThread: null
};

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

  $("newMessageBtn").addEventListener("click", openCompose);
  $("composeModalClose").addEventListener("click", closeCompose);
  $("composeSendBtn").addEventListener("click", sendComposedMessage);
  $("threadModalClose").addEventListener("click", closeThread);
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
  state.conversations = [];
  state.currentThread = null;
  $("coachApp").classList.add("hidden");
  $("keyGate").classList.remove("hidden");
  $("coachKeyInput").value = "";
}

function showCoachApp() {
  $("keyGate").classList.add("hidden");
  $("coachApp").classList.remove("hidden");
}

async function loadAll() {
  await loadAthletes();
  await loadLogs();
  await loadConversations();
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
    populateComposeAthleteList();
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

async function loadConversations() {
  try {
    const res = await callAPI({ action: "listConversations", key: state.key });
    if (!res || !res.ok) {
      renderConversations([]);
      return;
    }
    state.conversations = res.conversations || [];
    renderConversations(state.conversations);
  } catch (e) {
    renderConversations([]);
  }
}

function renderConversations(list) {
  const container = $("conversationList");
  if (!list.length) {
    container.innerHTML = '<div class="conv-empty">No conversations yet. Tap "+ New Message" to start.</div>';
    return;
  }
  container.innerHTML = "";
  list.forEach(function (c) {
    const row = document.createElement("div");
    row.className = "conversation-row" + (c.unreadCount > 0 ? " unread" : "");
    const initial = (c.athlete || "?").charAt(0).toUpperCase();
    row.innerHTML =
      '<div class="conv-avatar">' + escapeHtml(initial) + '</div>' +
      '<div class="conv-info">' +
        '<div class="conv-name">' + escapeHtml(c.athlete || "") + '</div>' +
        '<div class="conv-snippet">' +
          (c.lastDirection === "in" ? "📩 " : "📤 ") +
          escapeHtml(c.lastText || "") +
        '</div>' +
      '</div>' +
      '<div class="conv-meta">' +
        '<div class="conv-time">' + formatTimestamp(c.lastTimestamp) + '</div>' +
        (c.unreadCount > 0 ? '<div class="conv-badge">' + c.unreadCount + '</div>' : '') +
      '</div>';

    row.addEventListener("click", function () {
      openThread(c.threadId, c.athlete);
    });

    container.appendChild(row);
  });
}

async function openThread(threadId, athleteName) {
  state.currentThread = { threadId: threadId, athlete: athleteName };
  $("threadModal").classList.remove("hidden");
  $("threadModalContent").innerHTML = '<h2>Loading…</h2>';

  try {
    const res = await callAPI({
      action: "getThread",
      key: state.key,
      threadId: threadId
    });
    if (!res || !res.ok) {
      $("threadModalContent").innerHTML = '<h2>' + escapeHtml(athleteName) + '</h2><p style="color:#9aa3b0;">Could not load thread.</p>';
      return;
    }
    renderThread(res.messages || [], athleteName);
  } catch (e) {
    $("threadModalContent").innerHTML = '<h2>' + escapeHtml(athleteName) + '</h2><p style="color:#9aa3b0;">Network error.</p>';
  }
}

function renderThread(messages, athleteName) {
  const sorted = messages.slice().sort(function (a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  let html = '<h2>Conversation with ' + escapeHtml(athleteName) + '</h2>';
  html += '<div class="msg-thread-meta">' + sorted.length + ' message' + (sorted.length === 1 ? '' : 's') + '</div>';
  html += '<div class="msg-thread-list">';

  if (!sorted.length) {
    html += '<div class="conv-empty">No messages yet.</div>';
  } else {
    sorted.forEach(function (m) {
      const isFromCoach = m.direction === "out";
      const cls = isFromCoach ? "msg-bubble msg-out" : "msg-bubble msg-in";
      const ts = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
      html += '<div class="' + cls + '">' +
                '<div class="msg-text">' + escapeHtml(m.text || "") + '</div>' +
                '<div class="msg-time">' + escapeHtml(ts) + '</div>' +
              '</div>';
    });
  }

  html += '</div>';
  html += '<div class="msg-reply-form">';
  html += '<textarea id="threadReplyInput" rows="2" placeholder="Type your reply..."></textarea>';
  html += '<button id="threadReplyBtn" class="primary-btn">Send</button>';
  html += '</div>';

  $("threadModalContent").innerHTML = html;

  const replyBtn = $("threadReplyBtn");
  if (replyBtn) replyBtn.addEventListener("click", function () { sendThreadReply(athleteName); });
}

async function sendThreadReply(athleteName) {
  const input = $("threadReplyInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) { showToast("Type a message first", true); return; }

  const btn = $("threadReplyBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }

  try {
    const res = await callAPI({
      action: "sendMessage",
      key: state.key,
      athlete: athleteName,
      text: text,
      threadId: state.currentThread.threadId
    });
    if (res && res.ok) {
      input.value = "";
      showToast("Sent");
      await openThread(state.currentThread.threadId, athleteName);
      await loadConversations();
    } else {
      showToast((res && res.error) || "Send failed", true);
      if (btn) { btn.disabled = false; btn.textContent = "Send"; }
    }
  } catch (e) {
    showToast("Network error", true);
    if (btn) { btn.disabled = false; btn.textContent = "Send"; }
  }
}

function closeThread() {
  $("threadModal").classList.add("hidden");
  state.currentThread = null;
}

function openCompose() {
  $("composeModal").classList.remove("hidden");
  $("composeText").value = "";
  $("composeAthlete").value = "";
}

function closeCompose() {
  $("composeModal").classList.add("hidden");
}

function populateComposeAthleteList() {
  const sel = $("composeAthlete");
  if (!sel) return;
  sel.innerHTML = '<option value="">— pick an athlete —</option>';
  state.athletes.forEach(function (a) {
    if (!a.active) return;
    const opt = document.createElement("option");
    opt.value = a.name;
    opt.textContent = a.name;
    sel.appendChild(opt);
  });
}

async function sendComposedMessage() {
  const athlete = $("composeAthlete").value;
  const text = $("composeText").value.trim();

  if (!athlete) { showToast("Pick an athlete", true); return; }
  if (!text) { showToast("Type a message", true); return; }

  const btn = $("composeSendBtn");
  btn.disabled = true;
  btn.textContent = "Sending...";

  const threadId = athlete + "-coach-malcolm";

  try {
    const res = await callAPI({
      action: "sendMessage",
      key: state.key,
      athlete: athlete,
      text: text,
      threadId: threadId
    });
    if (res && res.ok) {
      showToast("Message sent to " + athlete);
      closeCompose();
      await loadConversations();
    } else {
      showToast((res && res.error) || "Send failed", true);
      btn.disabled = false;
      btn.textContent = "Send Message";
    }
  } catch (e) {
    showToast("Network error", true);
    btn.disabled = false;
    btn.textContent = "Send Message";
  }
}

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
