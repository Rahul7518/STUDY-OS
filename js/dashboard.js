/* ==========================================================================
   UPSI-OS · dashboard.js
   Controller for index.html. Reads from Storage, never writes subject
   completion directly (that ownership lives in subjects.html) — the
   dashboard is a read-mostly cockpit view, plus today's mission checklist
   which writes back to the planner.
   ========================================================================== */

(function () {
  async function boot() {
    await App.init();
    renderHero();
    renderStats();
    renderTodayMission();
    renderWeeklyProgress();
    renderQuickSubjects();
    renderUpcomingRevision();
    renderMockSummary();
  }

  /* ---------------------------------------------------------------- */
  function renderHero() {
    const profile = Storage.getProfile();
    document.querySelector("[data-hero-name]").textContent = profile.name || "Aspirant";
    const quote = App.quoteOfTheDay();
    document.querySelector("[data-quote-text]").textContent = `"${quote}"`;

    const days = App.daysUntil(profile.examDate);
    const countdownEl = document.querySelector("[data-countdown]");
    if (days === null) {
      countdownEl.innerHTML = `<span class="num">—</span><span class="lbl">Set your exam date in Settings</span>`;
    } else if (days >= 0) {
      countdownEl.innerHTML = `<span class="num">${days}</span><span class="lbl">days remaining till your UP SI exam</span>`;
    } else {
      countdownEl.innerHTML = `<span class="num">${Math.abs(days)}</span><span class="lbl">days since your exam date — update it in Settings</span>`;
    }
  }

  /* ---------------------------------------------------------------- */
  function computeOverallProgress(subjects) {
    let total = 0, done = 0;
    subjects.forEach((s) => s.topics.forEach((t) => t.subtopics.forEach((st) => {
      total++; if (st.completed) done++;
    })));
    return { total, done, percent: App.pct(done, total) };
  }

  async function renderStats() {
    const subjects = Storage.getSubjects() || [];
    const progress = computeOverallProgress(subjects);
    const streak = Storage.getStreak();
    const plan = Storage.getDayPlan(App.todayISO());
    const mocks = Storage.getMocks();
    const lastMock = mocks[mocks.length - 1];

    const statRow = document.querySelector("[data-stat-row]");
    statRow.innerHTML = [
      statCard("Overall Syllabus", `${progress.percent}%`, `${progress.done} / ${progress.total} subtopics`, "accent-gold"),
      statCard("Current Streak", `${streak.current}`, `Longest: ${streak.longest} days`, "accent-teal"),
      statCard("Today's Questions", `${plan.questionsCompleted}/${plan.questionTarget}`, "Target for today", "accent-blue"),
      statCard("Last Mock Score", lastMock ? `${lastMock.score}` : "—", lastMock ? App.formatDateFull(lastMock.date) : "No mocks logged yet", "accent-purple"),
    ].join("");
  }

  function statCard(label, value, sub, colorVar) {
    return `
      <div class="card stat-card lift">
        <span class="stat-label">${label}</span>
        <span class="stat-value" style="color: var(--${colorVar})">${value}</span>
        <span class="stat-delta">${sub}</span>
      </div>`;
  }

  /* ---------------------------------------------------------------- */
  function renderTodayMission() {
    const dateStr = App.todayISO();
    const plan = Storage.getDayPlan(dateStr);
    const list = document.querySelector("[data-mission-list]");
    const allTasks = [...plan.tasks, ...plan.revisionTasks.map((t) => ({ ...t, isRevision: true }))];

    if (allTasks.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="icon">${App.icon("empty")}</div>
        <h4>No mission set for today</h4>
        <p>Head to Planner to add today's goals and tasks.</p>
      </div>`;
      return;
    }

    list.innerHTML = allTasks.map((task) => `
      <li class="mission-item ${task.done ? "done" : ""}" data-task-id="${task.id}" data-revision="${!!task.isRevision}">
        <input type="checkbox" ${task.done ? "checked" : ""} />
        <span class="mission-text">${App.escapeHtml(task.text)}</span>
        <span class="mission-meta">${task.isRevision ? "REVISION" : "TASK"}</span>
      </li>
    `).join("");

    list.querySelectorAll(".mission-item").forEach((item) => {
      item.querySelector("input").addEventListener("change", (e) => {
        toggleTask(dateStr, item.dataset.taskId, item.dataset.revision === "true", e.target.checked);
        item.classList.toggle("done", e.target.checked);
      });
    });
  }

  function toggleTask(dateStr, taskId, isRevision, done) {
    const plan = Storage.getDayPlan(dateStr);
    const bucket = isRevision ? plan.revisionTasks : plan.tasks;
    const task = bucket.find((t) => t.id === taskId);
    if (task) task.done = done;
    Storage.saveDayPlan(dateStr, plan);
    if (done) Storage.markActiveToday();
    App.renderStatusbar();
    renderStats();
  }

  /* ---------------------------------------------------------------- */
  function renderWeeklyProgress() {
    const wrap = document.querySelector("[data-weekly-bars]");
    const planner = Storage.getPlanner();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const plan = planner[iso];
      const hours = plan ? plan.hoursStudied : 0;
      days.push({ iso, dow: d.toLocaleDateString("en-IN", { weekday: "narrow" }), hours, isToday: i === 0 });
    }
    const maxHours = Math.max(...days.map((d) => d.hours), 6);
    wrap.innerHTML = days.map((d) => `
      <div class="weekly-bar-col ${d.isToday ? "today" : ""}">
        <span class="mono" style="font-size:10px;color:var(--text-muted)">${d.hours || ""}</span>
        <div class="weekly-bar" style="height:${App.clamp((d.hours / maxHours) * 100, 3, 100)}%"></div>
        <span class="weekly-bar-label">${d.dow}</span>
      </div>
    `).join("");
  }

  /* ---------------------------------------------------------------- */
  function renderQuickSubjects() {
    const subjects = Storage.getSubjects() || [];
    const grid = document.querySelector("[data-subject-quick-grid]");
    grid.innerHTML = subjects.map((s) => {
      let total = 0, done = 0;
      s.topics.forEach((t) => t.subtopics.forEach((st) => { total++; if (st.completed) done++; }));
      const p = App.pct(done, total);
      return `
        <a class="card card-compact subject-quick-card lift" href="subjects.html?subject=${s.id}">
          <div class="subject-quick-top">
            <span class="subject-dot" style="background:${s.color}"></span>
            <span class="subject-quick-pct">${p}%</span>
          </div>
          <h4>${s.name}</h4>
          <div class="progress-track thin"><div class="progress-fill" style="width:${p}%;background:${s.color}"></div></div>
        </a>`;
    }).join("");
  }

  /* ---------------------------------------------------------------- */
function renderUpcomingRevision() {
    const subjects = Storage.getSubjects() || [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const items = [];
    subjects.forEach((s) => s.topics.forEach((t) => t.subtopics.forEach((st) => {
      if (st.revision === "due" || st.nextRevisionDate) {
        items.push({ subject: s.name, color: s.color, name: st.name, nextRevisionDate: st.nextRevisionDate, revision: st.revision });
      }
    })));

    // Sort: nearest date first, then items without dates last
    items.sort((a, b) => {
      if (a.nextRevisionDate && b.nextRevisionDate) return a.nextRevisionDate.localeCompare(b.nextRevisionDate);
      if (a.nextRevisionDate) return -1;
      if (b.nextRevisionDate) return 1;
      return 0;
    });

    const list = document.querySelector("[data-revision-list]");
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="icon">${App.icon("empty")}</div>
        <h4>Nothing due for revision</h4>
        <p>Mark subtopics "Due for Revision" on the Subjects page to see them here.</p>
      </div>`;
      return;
    }

    const overdue = items.filter((i) => i.nextRevisionDate && App.daysUntil(i.nextRevisionDate) < 0);
    const upcoming = items.filter((i) => !i.nextRevisionDate || App.daysUntil(i.nextRevisionDate) >= 0);

    let html = "";
    if (overdue.length > 0) {
      html += `<div style="margin-bottom:8px"><span class="badge badge-high" style="font-size:10px">OVERDUE (${overdue.length})</span></div>`;
      html += overdue.slice(0, 4).map((d) => `
        <div class="revision-row overdue">
          <span>${d.name}</span>
          <span class="badge badge-medium" style="color:${d.color};background:${d.color}22">${d.subject}</span>
          <span class="mono" style="font-size:10px;color:var(--accent-red)">${App.formatDateFull(d.nextRevisionDate)}</span>
        </div>
      `).join("");
    }
    const displayUpcoming = upcoming.slice(0, 6 - (overdue.length > 0 ? Math.min(overdue.length, 4) : 0));
    if (displayUpcoming.length > 0) {
      if (overdue.length > 0) html += `<div style="margin:8px 0"><span class="badge badge-neutral" style="font-size:10px">UPCOMING (${displayUpcoming.length})</span></div>`;
      html += displayUpcoming.map((d) => `
        <div class="revision-row">
          <span>${d.name}</span>
          <span class="badge badge-medium" style="color:${d.color};background:${d.color}22">${d.subject}</span>
          ${d.nextRevisionDate ? `<span class="mono" style="font-size:10px;color:var(--text-muted)">${App.formatDateFull(d.nextRevisionDate)}</span>` : ""}
        </div>
      `).join("");
    }
    list.innerHTML = html;
  }

  /* ---------------------------------------------------------------- */
  function renderMockSummary() {
    const mocks = Storage.getMocks();
    const card = document.querySelector("[data-mock-summary]");
    if (mocks.length === 0) {
      card.innerHTML = `<div class="empty-state">
        <div class="icon">${App.icon("empty")}</div>
        <h4>No mock tests logged</h4>
        <p>Add your first mock result on the Mock Tracker page.</p>
      </div>`;
      return;
    }
    const last = mocks[mocks.length - 1];
    const prev = mocks[mocks.length - 2];
    const delta = prev ? last.score - prev.score : null;
    const avg = (mocks.reduce((sum, m) => sum + Number(m.score || 0), 0) / mocks.length).toFixed(1);
    card.innerHTML = `
      <div class="mock-summary-row">
        <div class="mock-summary-score">
          <div class="val" style="color:var(--accent-gold)">${last.score}</div>
          <div class="lbl">Latest Score</div>
        </div>
        <div class="mock-summary-score">
          <div class="val">${last.accuracy || "—"}%</div>
          <div class="lbl">Accuracy</div>
        </div>
        <div class="mock-summary-score">
          <div class="val">${avg}</div>
          <div class="lbl">Average</div>
        </div>
        <div class="mock-summary-score">
          <div class="val" style="color:${delta === null ? 'var(--text-muted)' : delta >= 0 ? 'var(--accent-teal)' : 'var(--accent-red)'}">
            ${delta === null ? "—" : (delta >= 0 ? "+" : "") + delta}
          </div>
          <div class="lbl">Trend</div>
        </div>
      </div>
      <a class="btn btn-ghost btn-sm" style="margin-top:16px;width:100%" href="mock.html">View full mock history →</a>
    `;
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
