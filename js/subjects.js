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
    wireDelegatedEvents();
  }

  function renderTabs() {
    const tabs = document.querySelector("[data-subject-tabs]");
    var html = "";
    for (var i = 0; i < state.subjects.length; i++) {
      var s = state.subjects[i];
      var prog = subjectProgress(s);
      var done = prog.done;
      var total = prog.total;
      var isActive = s.id === state.activeSubjectId;
      var style = isActive ? 'border-color:' + s.color + '55;color:' + s.color + ';background:' + s.color + '18' : '';
      html += '<button class="chip subject-tab ' + (isActive ? "active" : "") + '" data-subject-id="' + s.id + '" style="' + style + '">';
      html += '<span class="subject-dot" style="background:' + s.color + ';width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px"></span>';
      html += s.name + ' <span class="mono text-muted" style="margin-left:4px">' + App.pct(done, total) + '%</span>';
      html += '</button>';
    }
    tabs.innerHTML = html;
    var btns = tabs.querySelectorAll(".subject-tab");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        state.activeSubjectId = this.dataset.subjectId;
        history.replaceState(null, "", "subjects.html?subject=" + state.activeSubjectId);
        renderTabs();
        renderActiveSubject();
      });
    }
  }

  function subjectProgress(subject) {
    var total = 0;
    var done = 0;
    for (var ti = 0; ti < subject.topics.length; ti++) {
      var t = subject.topics[ti];
      for (var si = 0; si < t.subtopics.length; si++) {
        total++;
        if (t.subtopics[si].completed) done++;
      }
    }
    return { done: done, total: total };
  }

  function renderSearchAndFilters() {
    var searchInput = document.querySelector("[data-subject-search]");
    searchInput.addEventListener("input", App.debounce(function () {
      state.search = searchInput.value.trim().toLowerCase();
      renderActiveSubject();
    }, 200));

    var chips = document.querySelectorAll("[data-priority-filter]");
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener("click", function () {
        var allChips = document.querySelectorAll("[data-priority-filter]");
        for (var j = 0; j < allChips.length; j++) {
          allChips[j].classList.remove("active");
        }
        this.classList.add("active");
        state.priorityFilter = this.dataset.priorityFilter;
        renderActiveSubject();
      });
    }
  }

  function renderActiveSubject() {
    var subject = null;
    for (var si = 0; si < state.subjects.length; si++) {
      if (state.subjects[si].id === state.activeSubjectId) {
        subject = state.subjects[si];
        break;
      }
    }
    var container = document.querySelector("[data-topic-tree]");
    var progressWrap = document.querySelector("[data-subject-progress]");
    if (!subject) {
      container.innerHTML = '<div class="empty-state"><div class="icon">' + App.icon("empty") + '</div><h4>No subject selected</h4></div>';
      return;
    }

    var prog = subjectProgress(subject);
    var done = prog.done;
    var total = prog.total;
    var pct = App.pct(done, total);
    var h = '';
    h += '<div class="flex items-center justify-between" style="margin-bottom:8px">';
    h += '<div class="flex items-center gap-2">';
    h += '<h2 style="font-size:16px">' + subject.name + '</h2>';
    h += '<button class="btn btn-ghost btn-icon" data-action="delete-subject" data-subject-id="' + subject.id + '" title="Delete subject" style="width:28px;height:28px;color:var(--accent-red)">' + App.icon("trash") + '</button>';
    h += '</div>';
    h += '<div class="flex items-center gap-2">';
    h += '<span class="mono text-muted">' + done + ' / ' + total + ' completed</span>';
    h += '<button class="btn btn-primary btn-sm" data-action="add-topic" style="font-size:11px">+ Add Topic</button>';
    h += '</div>';
    h += '</div>';
    h += '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + subject.color + '"></div></div>';
    progressWrap.innerHTML = h;

    var delBtn = progressWrap.querySelector('[data-action="delete-subject"]');
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        if (confirm("Delete subject \"" + subject.name + "\" and all its topics?")) {
          deleteSubject(subject.id);
        }
      });
    }
    var addTopicBtn = progressWrap.querySelector('[data-action="add-topic"]');
    if (addTopicBtn) {
      addTopicBtn.addEventListener("click", function () {
        openAddTopicModal(subject.id);
      });
    }

    var topics = subject.topics.slice();
    if (state.priorityFilter !== "all") {
      if (state.priorityFilter === "overdue") {
        topics = topics.map(function (t) {
          var sts = t.subtopics.filter(function (st) { return st.nextRevisionDate && App.daysUntil(st.nextRevisionDate) < 0; });
          return Object.assign({}, t, { subtopics: sts });
        }).filter(function (t) { return t.subtopics.length > 0; });
      } else if (state.priorityFilter === "upcoming") {
        topics = topics.map(function (t) {
          var sts = t.subtopics.filter(function (st) { return st.nextRevisionDate && App.daysUntil(st.nextRevisionDate) >= 0; });
          return Object.assign({}, t, { subtopics: sts });
        }).filter(function (t) { return t.subtopics.length > 0; });
      } else {
        topics = topics.filter(function (t) { return t.priority === state.priorityFilter; });
      }
    }
    if (state.search) {
      var q = state.search.toLowerCase();
      topics = topics.map(function (t) {
        var sts = t.subtopics.filter(function (st) { return st.name.toLowerCase().indexOf(q) >= 0 || t.name.toLowerCase().indexOf(q) >= 0; });
        return Object.assign({}, t, { subtopics: sts });
      }).filter(function (t) { return t.subtopics.length > 0 || t.name.toLowerCase().indexOf(q) >= 0; });
    }

    if (topics.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">' + App.icon("empty") + '</div><h4>No topics match</h4><p>Try a different search term or filter.</p></div>';
      return;
    }

    var topicHtml = '';
    for (var ti = 0; ti < topics.length; ti++) {
      topicHtml += renderTopic(subject, topics[ti]);
    }
    container.innerHTML = topicHtml;
  }

  function renderTopic(subject, topic) {
    var totalSubtopics = topic.subtopics.length;
    var doneCount = 0;
    for (var si = 0; si < topic.subtopics.length; si++) {
      if (topic.subtopics[si].completed) doneCount++;
    }
    var pctDone = App.pct(doneCount, totalSubtopics);
    var isExpanded = state.expandedTopics.has(topic.id);
    var stHtml = '';
    for (var si = 0; si < topic.subtopics.length; si++) {
      stHtml += renderSubtopic(subject.id, topic.id, topic.subtopics[si]);
    }
    var h = '';
    h += '<div class="card card-compact" style="margin-bottom:14px" data-topic-id="' + topic.id + '">';
    h += '<div class="topic-header flex items-center justify-between" data-action="toggle-topic" data-topic-id="' + topic.id + '">';
    h += '<div class="flex items-center gap-3">';
    h += '<svg class="chevron ' + (isExpanded ? "open" : "") + '" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>';
    h += '<h3 style="font-size:13.5px;text-transform:none;letter-spacing:0;color:var(--text-primary)">' + topic.name + '</h3>';
    h += '<span class="badge badge-' + topic.priority + '">' + topic.priority + '</span>';
    h += '<button class="btn btn-ghost btn-icon" data-action="delete-topic" data-topic-id="' + topic.id + '" title="Delete topic" style="width:24px;height:24px;color:var(--accent-red)">' + App.icon("trash") + '</button>';
    h += '</div>';
    h += '<span class="mono text-muted" style="font-size:11.5px">' + doneCount + '/' + totalSubtopics + '</span>';
    h += '</div>';
    h += '<div class="progress-track thin" style="margin-bottom:12px">';
    h += '<div class="progress-fill" style="width:' + pctDone + '%;background:' + subject.color + '"></div>';
    h += '</div>';
    h += '<div class="topic-body ' + (isExpanded ? "" : "collapsed") + '">';
    h += '<div class="flex-col gap-2" style="padding-top:4px">' + stHtml + '</div>';
    h += '<div class="add-subtopic-row">';
    h += '<input type="text" data-action="add-subtopic-input" placeholder="Add subtopic..." />';
    h += '<button class="btn btn-sm btn-primary" data-action="add-subtopic-btn">+ Add</button>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  function renderSubtopic(subjectId, topicId, st) {
    var badgeMap = { pending: "badge-neutral", due: "badge-medium", revised: "badge-done" };
    var labelMap = { pending: "Not Started", due: "Due for Revision", revised: "Revised" };
    var revisionBadge = badgeMap[st.revision] || "badge-neutral";
    var revisionLabel = labelMap[st.revision] || "Not Started";
    if (st.nextRevisionDate) {
      var d = new Date(st.nextRevisionDate + "T00:00:00");
      var formatted = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      revisionLabel = st.revision === "due" ? "Due " + formatted : "Next: " + formatted;
    }
    var isOverdue = st.nextRevisionDate && App.daysUntil(st.nextRevisionDate) < 0;
    var overdueClass = isOverdue ? "subtopic-overdue" : "";
    var overdueBadge = isOverdue ? '<span class="badge badge-high" style="font-size:9px;padding:2px 6px">OVERDUE</span>' : "";
    var notesBadge = st.notes ? '<span class="badge badge-neutral" title="Has notes">note</span>' : "";
    var h = '';
    h += '<div class="flex items-center gap-2 ' + overdueClass + '" style="padding:8px 10px;border-radius:8px;background:var(--bg-panel-raised);border:1px solid var(--border);flex-wrap:wrap" data-subtopic-row data-subtopic-id="' + st.id + '">';
    h += '<input type="checkbox" ' + (st.completed ? "checked" : "") + ' data-action="toggle-complete" />';
    h += '<span style="flex:1;font-size:12.5px;min-width:100px;' + (st.completed ? "color:var(--text-muted);text-decoration:line-through" : "") + '">' + st.name + '</span>';
    h += overdueBadge;
    h += notesBadge;
    h += '<button class="badge ' + revisionBadge + '" data-action="cycle-revision" style="border:none;cursor:pointer">' + revisionLabel + '</button>';
    h += '<input type="date" class="revision-date-input" value="' + (st.nextRevisionDate || "") + '" data-action="set-revision-date" title="Set next revision date" style="width:130px;font-size:11px;padding:4px 6px;height:26px" />';
    h += '<button class="btn btn-ghost btn-icon" data-action="clear-revision-date" title="Clear revision date" style="width:22px;height:22px;font-size:12px;padding:0;color:var(--accent-red)">X</button>';
    h += '<button class="btn btn-ghost btn-icon" data-action="open-notes" title="Notes">' + App.icon("notes") + '</button>';
    h += '<button class="btn btn-ghost btn-icon" data-action="delete-subtopic" data-subtopic-id="' + st.id + '" title="Delete subtopic" style="width:24px;height:24px;color:var(--accent-red)">' + App.icon("trash") + '</button>';
    h += '</div>';
    return h;
  }

  var _delegatedWired = false;

  function wireDelegatedEvents() {
    if (_delegatedWired) return;
    _delegatedWired = true;

    var container = document.querySelector("[data-topic-tree]");

    container.addEventListener("click", function (e) {
      var activeSubject = state.subjects.find(function (s) { return s.id === state.activeSubjectId; });
      if (!activeSubject) return;

      var delTopicBtn = e.target.closest('[data-action="delete-topic"]');
      if (delTopicBtn) {
        e.stopPropagation();
        var topicId = delTopicBtn.dataset.topicId;
        var topic = activeSubject.topics.find(function (t) { return t.id === topicId; });
        if (topic && confirm("Delete topic \"" + topic.name + "\" and all its subtopics?")) {
          deleteTopic(activeSubject.id, topicId);
        }
        return;
      }

      var header = e.target.closest('[data-action="toggle-topic"]');
      if (header) {
        var topicId2 = header.dataset.topicId;
        if (state.expandedTopics.has(topicId2)) {
          state.expandedTopics.delete(topicId2);
        } else {
          state.expandedTopics.add(topicId2);
        }
        renderActiveSubject();
        return;
      }

      var toggleCheck = e.target.closest('[data-action="toggle-complete"]');
      if (toggleCheck) {
        var row = toggleCheck.closest("[data-subtopic-row]");
        if (row) {
          updateSubtopic(activeSubject.id, row.dataset.subtopicId, { completed: toggleCheck.checked });
        }
        return;
      }

      var revisionBtn = e.target.closest('[data-action="cycle-revision"]');
      if (revisionBtn) {
        var row2 = revisionBtn.closest("[data-subtopic-row]");
        if (row2) {
          var order = ["pending", "due", "revised"];
          var current = findSubtopic(activeSubject.id, row2.dataset.subtopicId);
          if (current) {
            var next = order[(order.indexOf(current.revision) + 1) % order.length];
            var patch = { revision: next };
            if (next === "revised") {
              patch.nextRevisionDate = "";
            }
            if (next === "due" && !current.nextRevisionDate) {
              var d = new Date();
              d.setDate(d.getDate() + 7);
              patch.nextRevisionDate = d.toISOString().slice(0, 10);
            }
            updateSubtopic(activeSubject.id, row2.dataset.subtopicId, patch);
          }
        }
        return;
      }

      var notesBtn = e.target.closest('[data-action="open-notes"]');
      if (notesBtn) {
        var row3 = notesBtn.closest("[data-subtopic-row]");
        if (row3) {
          openSubtopicNotes(activeSubject.id, row3.dataset.subtopicId);
        }
        return;
      }

      var clearDateBtn = e.target.closest('[data-action="clear-revision-date"]');
      if (clearDateBtn) {
        var row4 = clearDateBtn.closest("[data-subtopic-row]");
        if (row4) {
          updateSubtopic(activeSubject.id, row4.dataset.subtopicId, { nextRevisionDate: "" });
        }
        return;
      }

      var delSubtopicBtn = e.target.closest('[data-action="delete-subtopic"]');
      if (delSubtopicBtn) {
        var row5 = delSubtopicBtn.closest("[data-subtopic-row]");
        if (row5) {
          var st = findSubtopic(activeSubject.id, row5.dataset.subtopicId);
          if (st && confirm("Delete subtopic \"" + st.name + "\"?")) {
            deleteSubtopic(activeSubject.id, row5.dataset.subtopicId);
          }
        }
        return;
      }

      var addBtn = e.target.closest('[data-action="add-subtopic-btn"]');
      if (addBtn) {
        var card = addBtn.closest("[data-topic-id]");
        if (card) {
          var topicId3 = card.dataset.topicId;
          var input = card.querySelector('[data-action="add-subtopic-input"]');
          var name = input.value.trim();
          if (!name) {
            App.toast("Enter a subtopic name", "error");
            return;
          }
          addSubtopic(activeSubject.id, topicId3, name);
          input.value = "";
        }
        return;
      }
    });

    container.addEventListener("change", function (e) {
      var activeSubject = state.subjects.find(function (s) { return s.id === state.activeSubjectId; });
      if (!activeSubject) return;

      var dateInput = e.target.closest('[data-action="set-revision-date"]');
      if (dateInput) {
        var row = dateInput.closest("[data-subtopic-row]");
        if (row) {
          var val = dateInput.value || "";
          var st = findSubtopic(activeSubject.id, row.dataset.subtopicId);
          var patch = { nextRevisionDate: val };
          // If a date is set on a "pending" subtopic, promote it to "due"
          if (st && val && st.revision === "pending") {
            patch.revision = "due";
          }
          updateSubtopic(activeSubject.id, row.dataset.subtopicId, patch);
        }
      }
    });

    container.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var input = e.target.closest('[data-action="add-subtopic-input"]');
        if (input) {
          var activeSubject = state.subjects.find(function (s) { return s.id === state.activeSubjectId; });
          if (!activeSubject) return;
          var card = input.closest("[data-topic-id]");
          if (card) {
            var topicId = card.dataset.topicId;
            var name = input.value.trim();
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
    var subject = state.subjects.find(function (s) { return s.id === subjectId; });
    if (!subject) return null;
    for (var ti = 0; ti < subject.topics.length; ti++) {
      var t = subject.topics[ti];
      for (var si = 0; si < t.subtopics.length; si++) {
        if (t.subtopics[si].id === subtopicId) return t.subtopics[si];
      }
    }
    return null;
  }

  function updateSubtopic(subjectId, subtopicId, patch) {
    var subject = state.subjects.find(function (s) { return s.id === subjectId; });
    if (!subject) return;
    for (var ti = 0; ti < subject.topics.length; ti++) {
      var t = subject.topics[ti];
      for (var si = 0; si < t.subtopics.length; si++) {
        if (t.subtopics[si].id === subtopicId) {
          Object.assign(t.subtopics[si], patch);
        }
      }
    }
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Progress saved");
  }

  var pendingSubtopic = null;

  function openSubtopicNotes(subjectId, subtopicId) {
    var st = findSubtopic(subjectId, subtopicId);
    pendingSubtopic = { subjectId: subjectId, subtopicId: subtopicId };
    document.querySelector("[data-note-modal-title]").textContent = st.name;
    document.querySelector("[data-note-modal-textarea]").value = st.notes || "";
    App.openModal(document.querySelector("[data-note-modal]"));
  }

  function wireSubtopicModal() {
    var overlay = document.querySelector("[data-note-modal]");
    App.wireModalDismiss(overlay);
    document.querySelector("[data-note-modal-save]").addEventListener("click", function () {
      var text = document.querySelector("[data-note-modal-textarea]").value;
      if (pendingSubtopic) {
        updateSubtopic(pendingSubtopic.subjectId, pendingSubtopic.subtopicId, { notes: text });
      }
      App.closeModal(overlay);
    });
  }

  function deleteSubject(subjectId) {
    state.subjects = state.subjects.filter(function (s) { return s.id !== subjectId; });
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    if (state.activeSubjectId === subjectId) {
      state.activeSubjectId = state.subjects[0] ? state.subjects[0].id : null;
      history.replaceState(null, "", "subjects.html?subject=" + (state.activeSubjectId || ""));
    }
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Subject deleted");
  }

  function deleteTopic(subjectId, topicId) {
    var subject = state.subjects.find(function (s) { return s.id === subjectId; });
    if (!subject) return;
    subject.topics = subject.topics.filter(function (t) { return t.id !== topicId; });
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Topic deleted");
  }

  function deleteSubtopic(subjectId, subtopicId) {
    var subject = state.subjects.find(function (s) { return s.id === subjectId; });
    if (!subject) return;
    for (var ti = 0; ti < subject.topics.length; ti++) {
      var t = subject.topics[ti];
      t.subtopics = t.subtopics.filter(function (st) { return st.id !== subtopicId; });
    }
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Subtopic deleted");
  }

  function addSubtopic(subjectId, topicId, name) {
    var subject = null;
    for (var i = 0; i < state.subjects.length; i++) {
      if (state.subjects[i].id === subjectId) {
        subject = state.subjects[i];
        break;
      }
    }
    if (!subject) return;
    var topic = null;
    for (var i = 0; i < subject.topics.length; i++) {
      if (subject.topics[i].id === topicId) {
        topic = subject.topics[i];
        break;
      }
    }
    if (!topic) return;
    topic.subtopics.push({
      id: "subtopic_" + Date.now(),
      name: name,
      completed: false,
      revision: "pending",
      notes: "",
      nextRevisionDate: ""
    });
    state.expandedTopics.add(topicId);
    Storage.saveSubjects(state.subjects);
    Storage.markActiveToday();
    renderTabs();
    renderActiveSubject();
    App.renderStatusbar();
    App.toast("Subtopic \"" + name + "\" added");
  }

  /* ---------------------------------------------------------------- */
  /* Add Topic modal                                                    */
  /* ---------------------------------------------------------------- */
  var pendingAddTopicSubjectId = null;

  function openAddTopicModal(subjectId) {
    pendingAddTopicSubjectId = subjectId;
    var overlay = document.querySelector("[data-add-topic-modal]");
    document.querySelector("[data-add-topic-name]").value = "";
    document.querySelector("[data-add-topic-priority]").value = "medium";
    App.openModal(overlay);
  }

  function wireAddTopicModal() {
    var overlay = document.querySelector("[data-add-topic-modal]");
    if (!overlay) return;
    App.wireModalDismiss(overlay);

    document.querySelector("[data-add-topic-save]").addEventListener("click", function () {
      var nameInput = document.querySelector("[data-add-topic-name]");
      var prioritySelect = document.querySelector("[data-add-topic-priority]");
      var name = nameInput.value.trim();
      if (!name) {
        App.toast("Please enter a topic name", "error");
        return;
      }

      var subject = null;
      for (var i = 0; i < state.subjects.length; i++) {
        if (state.subjects[i].id === pendingAddTopicSubjectId) {
          subject = state.subjects[i];
          break;
        }
      }
      if (!subject) {
        App.toast("No subject selected", "error");
        return;
      }

      subject.topics.push({
        id: "topic_" + Date.now(),
        name: name,
        priority: prioritySelect.value,
        subtopics: []
      });

      Storage.saveSubjects(state.subjects);
      Storage.markActiveToday();
      renderTabs();
      renderActiveSubject();
      App.renderStatusbar();
      App.closeModal(overlay);
      App.toast("Topic \"" + name + "\" added");
    });
  }

  /* ---------------------------------------------------------------- */
  /* Add Subject modal                                                  */
  /* ---------------------------------------------------------------- */
  var SUBJECT_COLORS = ["#6c5ce7", "#0984e3", "#00b894", "#fdcb6e", "#e17055", "#d63031", "#fd79a8", "#00cec9"];

  function wireAddSubjectModal() {
    var overlay = document.querySelector("[data-add-subject-modal]");
    var btn = document.querySelector("[data-add-subject-btn]");
    var nameInput = document.querySelector("[data-add-subject-name]");
    var colorWrap = document.querySelector("[data-add-subject-colors]");
    var saveBtn = document.querySelector("[data-add-subject-save]");

    if (!overlay || !btn) return;

    var selectedColor = SUBJECT_COLORS[0];
    colorWrap.innerHTML = "";
    for (var i = 0; i < SUBJECT_COLORS.length; i++) {
      var c = SUBJECT_COLORS[i];
      var borderStyle = c === selectedColor ? "border-color:#fff" : "border-color:transparent";
      colorWrap.innerHTML += '<button class="color-swatch" data-color="' + c + '" style="background:' + c + ';width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;' + borderStyle + '"></button>';
    }

    colorWrap.querySelectorAll(".color-swatch").forEach(function (swatch) {
      swatch.addEventListener("click", function () {
        colorWrap.querySelectorAll(".color-swatch").forEach(function (s) { s.style.borderColor = "transparent"; });
        swatch.style.borderColor = "#fff";
        selectedColor = swatch.dataset.color;
      });
    });

    btn.addEventListener("click", function () {
      nameInput.value = "";
      selectedColor = SUBJECT_COLORS[0];
      var swatches = colorWrap.querySelectorAll(".color-swatch");
      for (var i = 0; i < swatches.length; i++) {
        swatches[i].style.borderColor = i === 0 ? "#fff" : "transparent";
      }
      App.openModal(overlay);
    });

    App.wireModalDismiss(overlay);

    saveBtn.addEventListener("click", function () {
      var name = nameInput.value.trim();
      if (!name) {
        App.toast("Please enter a subject name", "error");
        return;
      }

      var newSubject = {
        id: "subject_" + Date.now(),
        name: name,
        color: selectedColor,
        topics: []
      };

      state.subjects.push(newSubject);
      Storage.saveSubjects(state.subjects);
      Storage.markActiveToday();

      state.activeSubjectId = newSubject.id;
      history.replaceState(null, "", "subjects.html?subject=" + state.activeSubjectId);
      renderTabs();
      renderActiveSubject();
      App.renderStatusbar();
      App.closeModal(overlay);
      App.toast("Subject \"" + name + "\" created");
    });
  }

  // Extend boot to wire the add-subject and add-topic modals
  var origBoot = boot;
  boot = function () {
    origBoot();
    wireAddSubjectModal();
    wireAddTopicModal();
  };

  document.addEventListener("DOMContentLoaded", boot);
})();

