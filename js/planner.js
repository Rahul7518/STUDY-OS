/* ==========================================================================
   UPSI-OS · planner.js
   Controller for planner.html. Every field autosaves to Storage on a
   short debounce so the person never has to press a "save" button.
   ========================================================================== */

(function () {
  let selectedDate = App.todayISO();
  let currentPlan = null;

  async function boot() {
    await App.init();
    renderDateStrip();
    loadPlan();
    wireGoalInputs();
    wireTaskForms();
  }

  /* ---------------------------------------------------------------- */
  function renderDateStrip() {
    const strip = document.querySelector("[data-date-strip]");
    const planner = Storage.getPlanner();
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, d });
    }
    strip.innerHTML = days.map(({ iso, d }) => {
      const hasData = !!planner[iso];
      return `
        <button class="date-chip ${iso === selectedDate ? "active" : ""} ${hasData ? "has-data" : ""}" data-date="${iso}">
          <span class="dow">${d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
          <span class="dnum">${d.getDate()}</span>
          <span class="marker"></span>
        </button>`;
    }).join("");
    strip.querySelectorAll(".date-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        selectedDate = chip.dataset.date;
        renderDateStrip();
        loadPlan();
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function loadPlan() {
    currentPlan = Storage.getDayPlan(selectedDate);
    document.querySelector("[data-planner-date-label]").textContent = App.formatDateFull(selectedDate);
    document.querySelector("[data-question-target]").value = currentPlan.questionTarget;
    document.querySelector("[data-question-done]").value = currentPlan.questionsCompleted;
    document.querySelector("[data-hour-target]").value = currentPlan.hourTarget;
    document.querySelector("[data-hour-done]").value = currentPlan.hoursStudied;
    updateMiniProgress();
    renderTasks();
  }

  function persist(showToast = true) {
    const indicator = document.querySelector("[data-autosave-indicator]");
    indicator.classList.add("saving");
    Storage.saveDayPlan(selectedDate, currentPlan);
    Storage.markActiveToday();
    App.renderStatusbar();
    setTimeout(() => {
      indicator.classList.remove("saving");
      indicator.querySelector("span").textContent = "Saved";
    }, 350);
    renderDateStrip();
  }
  const debouncedPersist = App.debounce(persist, 500);

  function updateMiniProgress() {
    document.querySelector("[data-question-progress]").style.width =
      App.pct(currentPlan.questionsCompleted, currentPlan.questionTarget) + "%";
    document.querySelector("[data-hour-progress]").style.width =
      App.pct(currentPlan.hoursStudied, currentPlan.hourTarget) + "%";
  }

  /* ---------------------------------------------------------------- */
  function wireGoalInputs() {
    const map = [
      ["[data-question-target]", "questionTarget"],
      ["[data-question-done]", "questionsCompleted"],
      ["[data-hour-target]", "hourTarget"],
      ["[data-hour-done]", "hoursStudied"],
    ];
    map.forEach(([sel, key]) => {
      document.querySelector(sel).addEventListener("input", (e) => {
        currentPlan[key] = Number(e.target.value) || 0;
        updateMiniProgress();
        debouncedPersist();
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function renderTasks() {
    renderTaskGroup("[data-task-list]", currentPlan.tasks, false);
    renderTaskGroup("[data-revision-task-list]", currentPlan.revisionTasks, true);
  }

  function renderTaskGroup(selector, tasks, isRevision) {
    const list = document.querySelector(selector);
    if (tasks.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:24px">
        <p>${isRevision ? "No revision tasks yet." : "No tasks added for this day."}</p>
      </div>`;
      return;
    }
    list.innerHTML = tasks.map((task) => `
      <div class="task-row ${task.done ? "done" : ""} ${isRevision ? "revision" : ""}" data-task-id="${task.id}">
        <input type="checkbox" ${task.done ? "checked" : ""} data-action="toggle" />
        <input type="text" class="task-text" value="${App.escapeHtml(task.text)}" data-action="edit" />
        <button class="btn btn-ghost btn-icon" data-action="delete">${App.icon("trash")}</button>
      </div>
    `).join("");

    list.querySelectorAll(".task-row").forEach((row) => {
      const id = row.dataset.taskId;
      const bucket = isRevision ? currentPlan.revisionTasks : currentPlan.tasks;
      row.querySelector('[data-action="toggle"]').addEventListener("change", (e) => {
        const t = bucket.find((x) => x.id === id);
        t.done = e.target.checked;
        row.classList.toggle("done", t.done);
        persist(false);
      });
      row.querySelector('[data-action="edit"]').addEventListener("input", App.debounce((e) => {
        const t = bucket.find((x) => x.id === id);
        t.text = e.target.value;
        persist(false);
      }, 400));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        const arr = isRevision ? currentPlan.revisionTasks : currentPlan.tasks;
        const idx = arr.findIndex((x) => x.id === id);
        arr.splice(idx, 1);
        persist(false);
        renderTasks();
      });
    });
  }

  function wireTaskForms() {
    document.querySelector("[data-add-task-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.querySelector("[data-add-task-input]");
      if (!input.value.trim()) return;
      currentPlan.tasks.push({ id: `t_${Date.now()}`, text: input.value.trim(), done: false });
      input.value = "";
      persist(false);
      renderTasks();
    });
    document.querySelector("[data-add-revision-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.querySelector("[data-add-revision-input]");
      if (!input.value.trim()) return;
      currentPlan.revisionTasks.push({ id: `r_${Date.now()}`, text: input.value.trim(), done: false });
      input.value = "";
      persist(false);
      renderTasks();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
