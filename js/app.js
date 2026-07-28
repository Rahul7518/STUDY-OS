/* ==========================================================================
   UPSI-OS · app.js
   Shell-level logic shared by every page: sidebar, topbar, statusbar,
   theme application, toast/modal helpers, icon set, and small utilities.
   Page-specific logic lives in dashboard.js / planner.js / mock.js / etc,
   each of which calls App.init() first.
   ========================================================================== */

const App = (() => {
  /* ---------------------------------------------------------------- */
  /* Icon set — inline SVG strings, no external icon font/CDN needed    */
  /* ---------------------------------------------------------------- */
  const ICONS = {
    dashboard: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    subjects: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="M4 19.5V4.5"/><path d="M8 7h8M8 11h6"/></svg>',
    planner: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/><path d="m8.5 14 2 2 4-4"/></svg>',
    mock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v5h5M9 13l2 2 4-4"/></svg>',
    notes: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/><path d="M8 10h8M8 14h5"/></svg>',
    settings: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.4-2-3.4-2.3.7a8 8 0 0 0-2.6-1.5L14 2h-4l-.5 2.4a8 8 0 0 0-2.6 1.5l-2.3-.7-2 3.4 2 1.4a7.9 7.9 0 0 0 0 3l-2 1.4 2 3.4 2.3-.7c.77.65 1.65 1.16 2.6 1.5L10 22h4l.5-2.4a8 8 0 0 0 2.6-1.5l2.3.7 2-3.4-2-1.4Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6M4 4v16"/></svg>',
    flame: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.3-2-.8-2.6.8.3 2.8 1.8 2.8 5.1a6 6 0 1 1-12 0c0-4 2-6 4-9.5Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
    empty: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
  };

  const QUOTES = [
    "Discipline is choosing between what you want now and what you want most.",
    "The uniform is earned in silence, long before it is worn in public.",
    "Every solved question today is one less surprise on exam day.",
    "Consistency beats intensity — show up even on the slow days.",
    "Your competition is asleep. Your notebook is not.",
    "Revision is where marks are actually won.",
    "Small daily targets compound into a selection.",
    "Stay accountable to the plan, not to your mood.",
    "A calm mind reads faster than an anxious one — breathe, then begin.",
    "You don't need motivation at 5 AM. You need a routine.",
  ];

  function icon(name) { return ICONS[name] || ""; }

  /* ---------------------------------------------------------------- */
  /* Theme                                                              */
  /* ---------------------------------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  }

  /* ---------------------------------------------------------------- */
  /* Sidebar / shell wiring                                             */
  /* ---------------------------------------------------------------- */
  function initSidebar() {
    const shell = document.querySelector(".app-shell");
    const btn = document.querySelector(".sidebar-collapse-btn");
    if (!shell || !btn) return;
    const collapsed = localStorage.getItem("upsios:sidebar-collapsed") === "1";
    if (collapsed) shell.classList.add("sidebar-collapsed");
    btn.addEventListener("click", () => {
      shell.classList.toggle("sidebar-collapsed");
      localStorage.setItem("upsios:sidebar-collapsed", shell.classList.contains("sidebar-collapsed") ? "1" : "0");
    });
  }

  function highlightActiveNav() {
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === current) link.classList.add("active");
    });
  }

  /* ---------------------------------------------------------------- */
  /* Statusbar — the "duty roster" strip, present on every page         */
  /* ---------------------------------------------------------------- */
  function renderStatusbar() {
    const bar = document.querySelector("[data-statusbar]");
    if (!bar) return;
    const streak = Storage.getStreak();
    const usage = Storage.getStorageUsage();
    const usageKb = (usage / 1024).toFixed(1);
    const profile = Storage.getProfile();
    bar.innerHTML = `
      <div class="statusbar-group">
        <span class="statusbar-item"><span class="statusbar-dot"></span> Local Session Active</span>
        <span class="statusbar-item">${icon("flame")} <strong>${streak.current}</strong> day streak</span>
        <span class="statusbar-item">Storage: <strong>${usageKb} KB</strong></span>
      </div>
      <div class="statusbar-group">
        <span class="statusbar-item">${profile.name || "Aspirant"}</span>
        <span class="statusbar-item mono">${formatDate(new Date())}</span>
      </div>
    `;
  }

  /* ---------------------------------------------------------------- */
  /* Toasts                                                             */
  /* ---------------------------------------------------------------- */
  function ensureToastStack() {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type = "success", ttl = 2800) {
    const stack = ensureToastStack();
    const el = document.createElement("div");
    el.className = `toast${type === "error" ? " error" : ""}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 200ms ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 200);
    }, ttl);
  }

  /* ---------------------------------------------------------------- */
  /* Modal helper                                                        */
  /* ---------------------------------------------------------------- */
  function openModal(overlayEl) {
    overlayEl.classList.add("open");
    overlayEl.setAttribute("aria-hidden", "false");
  }
  function closeModal(overlayEl) {
    overlayEl.classList.remove("open");
    overlayEl.setAttribute("aria-hidden", "true");
  }
  function wireModalDismiss(overlayEl) {
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeModal(overlayEl);
    });
    overlayEl.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(overlayEl));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal(overlayEl);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Formatting utilities                                               */
  /* ---------------------------------------------------------------- */
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function formatDate(d) {
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
  }
  function formatDateFull(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function daysUntil(iso) {
    if (!iso) return null;
    const target = new Date(iso + "T00:00:00");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function pct(part, whole) { return whole > 0 ? clamp(Math.round((part / whole) * 100), 0, 100) : 0; }
  function debounce(fn, wait = 500) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }
  function quoteOfTheDay() {
    const dayIndex = Math.floor(Date.now() / 86400000);
    return QUOTES[dayIndex % QUOTES.length];
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------- */
  /* Boot sequence — call once per page                                 */
  /* ---------------------------------------------------------------- */
  async function init() {
    Storage.ensureBootstrapped();
    const settings = Storage.getSettings();
    applyTheme(settings.theme);
    initSidebar();
    highlightActiveNav();
    renderStatusbar();
    await Storage.seedSubjectsIfEmpty();

    document.addEventListener("upsios:storage-error", () => {
      toast("Storage limit reached — export your data from Settings.", "error", 4500);
    });
  }

  return {
    icon, QUOTES, toast, openModal, closeModal, wireModalDismiss,
    todayISO, formatDate, formatDateFull, daysUntil, clamp, pct, debounce,
    quoteOfTheDay, escapeHtml, renderStatusbar, applyTheme, init,
  };
})();
