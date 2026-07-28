/* ==========================================================================
   UPSI-OS · subjects.js
   Controller for subjects.html — the syllabus tree, the one place that
   owns completion / revision-state / per-subtopic notes writes.
   ========================================================================== */

(function () {
  let state = { subjects: [], search: "", activeSubjectId: null, priorityFilter: "all", expandedTopics: new Set() };

  async function boot() {
    await App.init();
    state.subjects = Storage.getSubjects() || [];
    const params = new URLSearchParams(location.search);
    state.activeSubjectId = params.get("subject") || (state.subjects[0] && state.subjects[0].id);
    renderTabs();
    renderSearchAndFilters();
    renderActiveSubject();
    wireSubtopicModal();
    // Set up event delegation once — never re-attach
    wireDelegatedEvents();
  }

  function renderTabs() {
    const tabs = document.querySelector("[data-subject-tabs]");
    tabs.innerHTML = state.subjects.map((s) => {
      const { done, total } = subjectProgress(s);
      return `
      <button class="chip subject-tab ${s.id === state.activeSubjectId ? "active" : ""}" data-subject-id="${s.id}" style="${s.id === state.activeSubjectId ? `border-color:${s.color}55;color:${s.color};background:${s.color}18` : ""}">
        <span class="subject-dot" style="background:${s.color};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px"></span>
        ${s.name} <span class="mono text-muted" style="margin-left:4px">${App.pct(done, total)}%</span>
      </button>`;
    }).join("");
    tabs.querySelectorAll(".subject-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeSubjectId = btn.dataset.subjectId;
        history.replaceState(null, "", `subjects.html?subject=${state.activeSubjectId}`);
        renderTabs();
        renderActiveSubject();
      });
    });
  }

  function subjectProgress(subject) {
    let total = 0, done = 0;
    subject.topics.forEach((t) => t.subtopics.forEach((st) => { total++; if (st.completed) done++; }));
    return { done, total };
  }

  function renderSearchAndFilters() {
    const searchInput = document.querySelector("[data-subject-search]");
    searchInput.addEventListener("input", App.debounce(() => {
      state.search = searchInput.value.trim().toLowerCase();
      renderActiveSubject();
    }, 200));

    document.querySelectorAll("[data-priority-filter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("[data-priority-filter]").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.priorityFilter = chip.dataset.priorityFilter;
        renderActiveSubject();
      });
    });
  }

  function renderActiveSubject() {
    const subject = state.subjects.find((s) => s.id === state.activeSubjectId);
    const container = document.querySelector("[data-topic-tree]");
    const progressWrap = document.querySelector("[data-subject-progress]");
    if (!subject) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${App.icon("empty")}</div><h4>No subject selected</h4></div>`;
      return;
    }

    const { done, total } = subjectProgress(subject);
    progressWrap.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:8px">
        <div class="flex items-center gap-2">
          <h2 style="font-size:16px">${subject.name}</h2>
          <button class="btn btn-ghost btn-icon" data-action="delete-subject" data-subject-id="${subject.id}" title="Delete subject" style="width:28px;height:28px;color:var(--accent-red)">${App.icon("trash")}</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="mono text-muted">${done} / ${total} completed</span>
          <button class="btn btn-primary btn-sm" data-action="add-topic" style="font-size:11px">+ Add Topic</button>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${App.pct(done, total)}%;background:${subject.color}"></div></div>
    `;

    // Wire delete subject / add topic buttons (they're outside [data-topic-tree])
    progressWrap.querySelector('[data-action="delete-subject"]')?.addEventListener("click", () => {
      if (confirm(`Delete subject "${subject.name}" and all its topics?`)) {
        deleteSubject(subject.id);
      }
    });
    progressWrap.querySelector('[data-action="add-topic"]')?.addEventListener("click", () => {
      openAddTopicModal(subject.id);
    });

    let topics = subject.topics;
    if (state.priorityFilter !== "all") topics = topics.filter((t) => t.priority === state.priorityFilter);
    if (state.search) {
      topics = topics
        .map((t) => ({ ...t, subtopics: t.subtopics.filter((st) => st.name.toLowerCase().includes(state.search) || t.name.toLowerCase().includes(state.search)) }))
        .filter((t) => t.subtopics.length > 0 || t.name.toLowerCase().includes(state.search));
    }

    if (topics.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${App.icon("empty")}</div><h4>No topics match</h4><p>Try a different search term or filter.</p></div>`;
      return;
    }

    container.innerHTML = topics.map((topic) => renderTopic(subject, topic)).join("");
  }

  function renderTopic(subject, topic) {
    const total = topic.subtopics.length;
    const done = topic.subtopics.filter((s) => s.completed).length;
    const isExpanded = state.expandedTopics.has(topic.id);
    return `
      <div class="card card-compact" style="margin-bottom:14px" data-topic-id="${topic.id}">
        <div class="topic-header flex items-center justify-between" data-action="toggle-topic" data-topic-id="${topic.id}">
          <div class="flex items-center gap-3">
            <svg class="chevron ${isExpanded ? "open" : ""}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            <h3 style="font-size:13.5px;text-transform:none;letter-spacing:0;color:var(--text-primary)">${topic.name}</h3>
            <span class="badge badge-${topic.priority}">${topic.priority}</span>
            <button class="btn btn-ghost btn-icon" data-action="delete-topic" data-topic-id="${topic.id}" title="Delete topic" style="width:24px;height:24px;color:var(--accent-red)">${App.icon("trash")}</button>
          </div>
          <span class="mono text-muted" style="font-size:11.5px">${done}/${total}</span>
        </div>
        <div class="progress-track thin" style="margin-bottom:12px">
          <div class="progress-fill" style="width:${App.pct(done, total)}%;background:${subject.color}"></div>
        </div>
        <div class="topic-body ${isExpanded ? "" : "collapsed"}">
          <div class="flex-col gap-2" style="padding-top:4px">
            ${topic.subtopics.map((st) => renderSubtopic(subject.id, topic.id, st)).join("")}
          </div>
          <div class="add-subtopic-row">
            <input type="text" data-action="add-subtopic-input" placeholder="Add subtopic…" />
            <button class="btn btn-sm btn-primary" data-action="add-subtopic-btn">+ Add</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderSubtopic(subjectId, topicId, st) {
    const revisionBadge = { pending: "badge-neutral", due: "badge-medium", revised: "badge-done" }[st.revision];
    const revisionLabel = { pending: "Not Started", due: "Due for Revision", revised: "Revised" }[st.revision];
    return `
      <div class="flex items-center gap-3" style="padding:8px 10px;border-radius:8px;background:var(--bg-panel-raised);border:1px solid var(--border)" data-subtopic-row data-subtopic-id="${st.id}">
        <input type="checkbox" ${st.completed ? "checked" : ""} data-action="toggle-complete" />
        <span style="flex:1;font-size:12.5px;${st.completed ? "color:var(--text-muted);text-decoration:line-through" : ""}">${st.name}</span>
        ${st.notes ? `<span class="badge badge-neutral" title="Has notes">note</span>` : ""}
        <button class="badge ${revisionBadge}" data-action="cycle-revision" style="border:none;cursor:pointer">${revisionLabel}</button>
        <button class="btn btn-ghost btn-icon" data-action="open-notes" title="Notes">${App.icon("notes")}</button>
        <button class="btn btn-ghost btn-icon" data-action="delete-subtopic" data-subtopic-id="${st.id}" title="Delete subtopic" style="width:24px;height:24px;color:var(--accent-red)">${App.icon("trash")}</button>
      </div>
    `;
  }

  let _delegatedWired = false;

  function wireDelegatedEvents() {
    if (_delegatedWired) return;
    _delegatedWired = true;

    const container = document.querySelector("[data-topic-tree]");

    container.addEventListener("click", (e) => {
      const activeSubject = state.subjects.find((s) => s.id === state.activeSubjectId);
      if (!activeSubject) return;

      // Check delete-topic FIRST — it's inside the topic-header but must not trigger toggle
      const delTopicBtn = e.target.closest('[data-action="delete-topic"]');
      if (delTopicBtn) {
        e.stopPropagation();
        const topicId = delTopicBtn.dataset.topicId;
        const topic = activeSubject.topics.find((t) => t.id === topicId);
        if (topic && confirm(`Delete topic "${topic.name}" and all its subtopics?`)) {
          deleteTopic(activeSubject.id, topicId);
        }
        return;
      }

      // Check toggle-topic — clicking the topic header toggles expand/collapse
      const header = e.target.closest('[data-action="toggle-topic"]');
      if (header) {
        const topicId = header.dataset.topicId;
        if (state.expandedTopics.has(topicId)) {
          state.expandedTopics.delete(topicId);
        } else {
          state.expandedTopics.add(topicId);
        }
        // Re-render so the DOM is always in sync with state.expandedTopics
        renderActiveSubject();
        return;
      }

      const toggleCheck = e.target.closest('[data-action="toggle-complete"]');
      if (toggleCheck) {
        const row = toggleCheck.closest("[data-subtopic-row]");
        if (row) {
          updateSubtopic(activeSubject.id, row.dataset.subtopicId, { completed: toggleCheck.checked });
        }
        return;
      }

      const revisionBtn = e.target.closest('[data-action="cycle-revision"]');
      if (revisionBtn) {
        const row = revisionBtn.closest("[data-subtopic-row]");
        if (row) {
          const order = ["pending", "due", "revised"];
          const current = findSubtopic(activeSubject.id, row.dataset.subtopicId);
          const next = order[(order.indexOf(current.revision) + 1) % order.length];
          updateSubtopic(activeSubject.id, row.dataset.subtopicId, { revision: next });
        }
        return;
      }

      const notesBtn = e.target.closest('[data-action="open-notes"]');
      if (notesBtn) {
        const row = notesBtn.closest("[data-subtopic-row]");
        if (row) {
          openSubtopicNotes(activeSubject.id, row.dataset.subtopicId);
        }
        return;
      }

      const delSubtopicBtn = e.target.closest('[data-action="delete-subtopic"]');
      if (delSubtopicBtn) {
        const row = delSubtopicBtn.closest("[data-subtopic-row]");
        if (row) {
          const st = findSubtopic(activeSubject.id, row.dataset.subtopicId);
          if (st && confirm(`Delete subtopic "${st.name}"?`)) {
            deleteSubtopic(activeSubject.id, row.dataset.subtopicId);
          }
        }
        return;
      }

      const addBtn = e.target.closest('[data-action="add-subtopic-btn"]');
      if (addBtn) {
        const card = addBtn.closest("[data-topic-id]");
        if (card) {
          const topicId = card.dataset.topicId;
          const input = card.querySelector('[data-action="add-subtopic-input"]');
          const name = input.value.trim();
          if (!name) {
            App.toast("Enter a subtopic name", "error");
            return;
          }
          addSubtopic(activeSubject.id, topicId, name);
          input.value = "";
        }
        return;
      }
    });

    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = e.target.closest('[data-action="add-subtopic-input"]');
        if (input) {
          const activeSubject = state.subjects.find((s) => s.id === state.activeSubjectId);
          if (!activeSubject) return;
          const card = input.closest("[data-topic-id]");
          if (card) {
            const topicId = card.dataset.topicId;
            const name = input.value.trim();
            if (!name) {
              App.toast("Enter a subtopic name", "error");
              return;
            }
            addSubtopic(activeSubject.id, topicId, name);
            input.value = "";
          }
        }
      }
    });
  }

  function findSubtopic(subjectId, subtopicId) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    for (const t of subject.topics) {
      const st = t.subtopics.find((s) => s.id === subtopicId);
      if (st) return st;
    }
    return null;
  }

  function updateSubtopic(subjectId, subtopicId, patch) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    for (const t of subject.topics) {
      const st = t.subtopics.find((s) => s.id === subtopicId);
      if (st) Object.assign(st, patch);
    }
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Progress saved");
  }

  /* ---------------------------------------------------------------- */
  /* Subtopic notes modal                                               */
  /* ---------------------------------------------------------------- */
  let pendingSubtopic = null;
  function openSubtopicNotes(subjectId, subtopicId) {
    const st = findSubtopic(subjectId, subtopicId);
    pendingSubtopic = { subjectId, subtopicId };
    document.querySelector("[data-note-modal-title]").textContent = st.name;
    document.querySelector("[data-note-modal-textarea]").value = st.notes || "";
    App.openModal(document.querySelector("[data-note-modal]"));
  }

  function wireSubtopicModal() {
    const overlay = document.querySelector("[data-note-modal]");
    App.wireModalDismiss(overlay);
    document.querySelector("[data-note-modal-save]").addEventListener("click", () => {
      const text = document.querySelector("[data-note-modal-textarea]").value;
      if (pendingSubtopic) {
        updateSubtopic(pendingSubtopic.subjectId, pendingSubtopic.subtopicId, { notes: text });
      }
      App.closeModal(overlay);
    });
  }

  /* ---------------------------------------------------------------- */
  /* CRUD helpers — delete subject / topic / subtopic, add subtopic     */
  /* ---------------------------------------------------------------- */
  function deleteSubject(subjectId) {
    state.subjects = state.subjects.filter((s) => s.id !== subjectId);
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    if (state.activeSubjectId === subjectId) {
      state.activeSubjectId = state.subjects[0]?.id || null;
      history.replaceState(null, "", `subjects.html?subject=${state.activeSubjectId || ""}`);
    }
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Subject deleted");
  }

  function deleteTopic(subjectId, topicId) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    subject.topics = subject.topics.filter((t) => t.id !== topicId);
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Topic deleted");
  }

  function deleteSubtopic(subjectId, subtopicId) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    for (const t of subject.topics) {
      t.subtopics = t.subtopics.filter((st) => st.id !== subtopicId);
    }
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Subtopic deleted");
  }

  function addSubtopic(subjectId, topicId, name) {
    const subject = state.subjects.find((s) => s.id === subjectId);
    if (!subject) return;
    const topic = subject.topics.find((t) => t.id === topicId);
    if (!topic) return;
    topic.subtopics.push({
      id: `subtopic_${Date.now()}`,
      name,
      completed: false,
      revision: "pending",
      notes: "",
    });
    // Auto-expand the topic so the user sees the new subtopic
    state.expandedTopics.add(topicId);
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast(`Subtopic "${name}" added`);
  }

  /* ---------------------------------------------------------------- */
  /* Add Topic modal                                                    */
  /* ---------------------------------------------------------------- */
  let pendingAddTopicSubjectId = null;

  function openAddTopicModal(subjectId) {
    pendingAddTopicSubjectId = subjectId;
    const overlay = document.querySelector("[data-add-topic-modal]");
    document.querySelector("[data-add-topic-name]").value = "";
    document.querySelector("[data-add-topic-priority]").value = "medium";
    App.openModal(overlay);
  }

  function wireAddTopicModal() {
    const overlay = document.querySelector("[data-add-topic-modal]");
    if (!overlay) return;
    App.wireModalDismiss(overlay);

    document.querySelector("[data-add-topic-save]").addEventListener("click", () => {
      const nameInput = document.querySelector("[data-add-topic-name]");
      const prioritySelect = document.querySelector("[data-add-topic-priority]");
      const name = nameInput.value.trim();
      if (!name) {
        App.toast("Please enter a topic name", "error");
        return;
      }

      const subject = state.subjects.find((s) => s.id === pendingAddTopicSubjectId);
      if (!subject) {
        App.toast("No subject selected", "error");
        return;
      }

      subject.topics.push({
        id: `topic_${Date.now()}`,
        name,
        priority: prioritySelect.value,
        subtopics: [],
      });

      Storage.saveSubjects(state.subjects);
      Storage.markActiveToday();
      renderTabs();
      renderActiveSubject();
      App.renderStatusbar();
      App.closeModal(overlay);
      App.toast(`Topic "${name}" added`);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Add Subject modal                                                  */
  /* ---------------------------------------------------------------- */
  const SUBJECT_COLORS = ["#6c5ce7", "#0984e3", "#00b894", "#fdcb6e", "#e17055", "#d63031", "#fd79a8", "#00cec9"];

  function wireAddSubjectModal() {
    const overlay = document.querySelector("[data-add-subject-modal]");
    const btn = document.querySelector("[data-add-subject-btn]");
    const nameInput = document.querySelector("[data-add-subject-name]");
    const colorWrap = document.querySelector("[data-add-subject-colors]");
    const saveBtn = document.querySelector("[data-add-subject-save]");

    if (!overlay || !btn) return;

    // Populate color swatches
    let selectedColor = SUBJECT_COLORS[0];
    colorWrap.innerHTML = SUBJECT_COLORS.map((c) =>
      `<button class="color-swatch" data-color="${c}" style="background:${c};width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;${c === selectedColor ? "border-color:#fff" : ""}"></button>`
    ).join("");

    colorWrap.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        colorWrap.querySelectorAll(".color-swatch").forEach((s) => s.style.borderColor = "transparent");
        swatch.style.borderColor = "#fff";
        selectedColor = swatch.dataset.color;
      });
    });

    // Open modal
    btn.addEventListener("click", () => {
      nameInput.value = "";
      selectedColor = SUBJECT_COLORS[0];
      colorWrap.querySelectorAll(".color-swatch").forEach((s, i) => {
        s.style.borderColor = i === 0 ? "#fff" : "transparent";
      });
      App.openModal(overlay);
    });

    // Dismiss wiring
    App.wireModalDismiss(overlay);

    // Save
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        App.toast("Please enter a subject name", "error");
        return;
      }

      const newSubject = {
        id: `subject_${Date.now()}`,
        name,
        color: selectedColor,
        topics: [],
      };

      state.subjects.push(newSubject);
      Storage.saveSubjects(state.subjects);
      Storage.markActiveToday();

      state.activeSubjectId = newSubject.id;
      history.replaceState(null, "", `subjects.html?subject=${state.activeSubjectId}`);
      renderTabs();
      renderActiveSubject();
      App.renderStatusbar();
      App.closeModal(overlay);
      App.toast(`Subject "${name}" created`);
    });
  }

  // Extend boot to wire the add-subject and add-topic modals
  const origBoot = boot;
  boot = function () {
    origBoot();
    wireAddSubjectModal();
    wireAddTopicModal();
  };

  document.addEventListener("DOMContentLoaded", boot);
})();

