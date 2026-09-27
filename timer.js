/* ============================================================
   TIMER BUILDER — styles v2
   ============================================================ */

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --bg: #0f1115;
  --bg-card: #181b22;
  --bg-elevated: #1a1e26;
  --bg-input: #0f1115;
  --border: #262a33;
  --border-strong: #2c313c;
  --text: #e8e8e8;
  --text-dim: #9aa3b0;
  --text-bright: #ffffff;
  --accent: #2e6cf6;
  --success: #1f7a3d;
  --danger: #b3402f;
  --warn: #d29a1f;
  --radius: 10px;
  --radius-lg: 14px;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}

.hidden { display: none !important; }
a { color: var(--accent); text-decoration: none; }

/* ============================================================
   KEY GATE
   ============================================================ */

.key-gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.key-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px 22px;
}

.key-card h1 {
  margin: 0 0 4px;
  font-size: 22px;
  text-align: center;
}

.key-card .sub {
  margin: 0 0 24px;
  color: var(--text-dim);
  font-size: 14px;
  text-align: center;
}

.key-card input {
  width: 100%;
  padding: 14px 12px;
  font-size: 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text);
}

.key-card input:focus { outline: none; border-color: var(--accent); }

.error-text {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
  margin-top: 12px;
  min-height: 16px;
}

/* ============================================================
   BUTTONS
   ============================================================ */

.primary-btn {
  width: 100%;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  border-radius: var(--radius);
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  margin-top: 16px;
}

.primary-btn.small {
  width: auto;
  padding: 8px 16px;
  font-size: 13px;
  margin-top: 0;
}

.primary-btn:active { opacity: 0.8; }
.primary-btn:disabled { opacity: 0.6; }

.secondary-btn {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius);
  border: 1px solid var(--border-strong);
  background: var(--bg-elevated);
  color: var(--text);
  cursor: pointer;
}

.secondary-btn.small {
  padding: 6px 12px;
  font-size: 12px;
}

.secondary-btn:active {
  border-color: var(--accent);
  color: var(--accent);
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  border: 1px solid var(--border-strong);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-btn:active {
  background: var(--accent);
  border-color: var(--accent);
}

/* ============================================================
   APP HEADER
   ============================================================ */

.app-view { min-height: 100vh; }

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.app-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  flex: 1;
  text-align: center;
}

.app-header h1:first-child { text-align: left; }

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ============================================================
   TIMER LIST
   ============================================================ */

.timer-list {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 60px;
}

.timer-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 10px;
  cursor: pointer;
}

.timer-card:active { border-color: var(--accent); }

.timer-card-info { flex: 1; min-width: 0; }

.timer-card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-bright);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timer-card-meta {
  font-size: 12px;
  color: var(--text-dim);
}

.timer-card-delete {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--danger);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.timer-card-delete:active {
  background: var(--danger);
  color: #fff;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-dim);
  font-size: 14px;
}

.empty-state.small {
  padding: 20px;
  font-size: 13px;
}

/* ============================================================
   EDITOR MAIN
   ============================================================ */

.editor-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 80px;
}

.form-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 6px;
}

.form-label:first-child { margin-top: 0; }

.form-card input[type="text"],
.form-card input[type="number"],
.form-card select,
.form-card textarea {
  width: 100%;
  padding: 12px;
  font-size: 15px;
  border-radius: var(--radius);
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text);
  font-family: inherit;
}

.form-card input:focus,
.form-card select:focus,
.form-card textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-card textarea {
  resize: vertical;
  min-height: 44px;
}

/* ============================================================
   TOGGLES
   ============================================================ */

.toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.toggle-label input {
  margin: 0;
  width: auto;
  accent-color: var(--accent);
}

/* ============================================================
   SECTION HEAD
   ============================================================ */

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.section-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ============================================================
   INTERVAL LIST
   ============================================================ */

.interval-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.interval-list.small {
  gap: 6px;
}

.interval-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.15s, opacity 0.15s;
}

.interval-row:active { border-color: var(--accent); }

.interval-row.small {
  padding: 8px 12px;
  font-size: 13px;
}

.interval-row.dragging {
  opacity: 0.4;
}

.interval-row.drag-over-top {
  border-top: 3px solid var(--accent);
}

.interval-row.drag-over-bottom {
  border-bottom: 3px solid var(--accent);
}

.drag-handle {
  cursor: grab;
  color: var(--text-dim);
  font-size: 16px;
  padding: 4px 6px;
  user-select: none;
  letter-spacing: -2px;
  line-height: 1;
}

.drag-handle:active {
  cursor: grabbing;
  color: var(--accent);
}

.interval-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.15);
}

.interval-swatch.small {
  width: 16px;
  height: 16px;
}

.interval-info { flex: 1; min-width: 0; }

.interval-name-row {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-bright);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.interval-meta {
  font-size: 12px;
  color: var(--text-dim);
}

.interval-row-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

.interval-copy-btn,
.interval-move-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
}

.interval-copy-btn:active,
.interval-move-btn:active {
  color: var(--accent);
  border-color: var(--accent);
}

.interval-delete-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--danger);
  font-size: 16px;
  cursor: pointer;
}

.interval-delete-btn:active {
  background: var(--danger);
  color: #fff;
}

.interval-row.is-circuit {
  border-color: var(--accent);
  background: rgba(46, 108, 246, 0.08);
}

/* ============================================================
   PASTE BAR
   ============================================================ */

.paste-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(46, 108, 246, 0.15);
  border: 1px dashed var(--accent);
  border-radius: var(--radius);
  font-size: 13px;
  margin-bottom: 6px;
}

.paste-label {
  flex: 1;
  color: var(--accent);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paste-btn {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

.paste-btn:active { opacity: 0.8; }

.clear-clip-btn {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}

.clear-clip-btn:active { color: var(--danger); }

/* ============================================================
   MODALS
   ============================================================ */

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px 16px;
  overflow-y: auto;
}

.modal-card {
  width: 100%;
  max-width: 500px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 22px 20px;
  position: relative;
  margin: auto 0;
}

.modal-card.wide { max-width: 640px; }

.modal-card h2 {
  margin: 0 0 16px;
  font-size: 19px;
}

.modal-x {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 20px;
  cursor: pointer;
}

/* ============================================================
   QUICK DURATIONS
   ============================================================ */

.quick-durations {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.chip {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-input);
  color: var(--text-dim);
  cursor: pointer;
}

.chip:active,
.chip.selected {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

/* ============================================================
   COLOR PICKER
   ============================================================ */

.color-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
  margin-top: 4px;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-swatch.selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--accent);
}

/* ============================================================
   TOAST
   ============================================================ */

.toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success);
  color: #fff;
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  z-index: 200;
  max-width: calc(100% - 40px);
  text-align: center;
}

.toast.error { background: var(--danger); }
.toast.warn { background: var(--warn); color: #1a1a1a; }

/* ============================================================
   RESPONSIVE
   ============================================================ */

@media (max-width: 480px) {
  .form-card { padding: 14px; }
  .section-head { gap: 8px; }
  .section-actions { width: 100%; }
  .section-actions button { flex: 1; }
}
