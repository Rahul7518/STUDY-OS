/* ==========================================================================
   UPSI-OS - notes.js
   Controller for notes.html. Uses a contenteditable region with
   document.execCommand for lightweight rich text - no external editor
   library, keeping the app dependency-free and offline-safe.
   ========================================================================== */

(function () {
  var notes = [];
  var activeId = null;
  var subjects = [];

  async function boot() {
    await App.init();
    subjects = Storage.getSubjects() || [];
    notes = Storage.getNotes();
    buildSubjectTagOptions();
    renderList("");
    if (notes.length) { selectNote(notes[0].id); } else { newNote(); }
    wireToolbar();
    wireEditor();
    wireSearch();
    document.querySelector("[data-new-note-btn]").addEventListener("click", newNote);
    document.querySelector("[data-delete-note-btn]").addEventListener("click", deleteActive);
  }

  function buildSubjectTagOptions() {
    var select = document.querySelector("[data-note-subject-tag]");
    var opts = "<option value=\"\">No subject tag</option>";
    subjects.forEach(function (s) {
      opts += "<option value=\"" + s.id + "\">" + s.name + "</option>";
    });
    select.innerHTML = opts;
  }

  function renderList(filter) {
    var list = document.querySelector("[data-notes-list]");
    var filtered = notes.filter(function (n) {
      if (!filter) return true;
      return n.title.toLowerCase().indexOf(filter) !== -1 || stripHtml(n.body).toLowerCase().indexOf(filter) !== -1;
    });
    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">' + App.icon("empty") + '</div><h4>No notes found</h4></div>';
      return;
    }
    list.innerHTML = filtered.map(function (n) {
      var subject = subjects.find(function (s) { return s.id === n.subjectId; });
      var preview = App.escapeHtml(stripHtml(n.body).slice(0, 80)) || "No content yet";
      var tag = subject ? '<span class="badge badge-neutral" style="color:' + subject.color + '">' + subject.name + '</span>' : "<span></span>";
      return '<div class="note-list-item ' + (n.id === activeId ? "active" : "") + '" data-note-id="' + n.id + '">' +
        '<h5>' + App.escapeHtml(n.title || "Untitled note") + '</h5>' +
        '<p>' + preview + '</p>' +
        '<div class="meta">' + tag + '<time>' + new Date(n.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + '</time></div>' +
        '</div>';
    }).join("");
    list.querySelectorAll(".note-list-item").forEach(function (el) {
      el.addEventListener("click", function () { selectNote(el.dataset.noteId); });
    });
  }

  function stripHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || "";
  }

  function selectNote(id) {
    activeId = id;
    var note = notes.find(function (n) { return n.id === id; });
    if (!note) return;
    document.querySelector("[data-note-title-input]").value = note.title;
    document.querySelector("[data-note-body]").innerHTML = note.body;
    document.querySelector("[data-note-subject-tag]").value = note.subjectId || "";
    renderList(currentFilter());
  }

  function newNote() {
    var note = { id: "note_" + Date.now(), title: "", body: "", subjectId: "" };
    notes.unshift(note);
    Storage.saveNotes(notes);
    selectNote(note.id);
    renderList(currentFilter());
    document.querySelector("[data-note-title-input]").focus();
  }

  function deleteActive() {
    if (!activeId) return;
    notes = notes.filter(function (n) { return n.id !== activeId; });
    Storage.saveNotes(notes);
    App.toast("Note deleted");
    if (notes.length) { selectNote(notes[0].id); } else { newNote(); }
    renderList(currentFilter());
  }

  function currentFilter() {
    return document.querySelector("[data-notes-search]").value.trim().toLowerCase();
  }

  var persist = App.debounce(function () {
    var note = notes.find(function (n) { return n.id === activeId; });
    if (!note) return;
    note.title = document.querySelector("[data-note-title-input]").value;
    note.body = document.querySelector("[data-note-body]").innerHTML;
    note.subjectId = document.querySelector("[data-note-subject-tag]").value;
    Storage.upsertNote(note);
    Storage.markActiveToday();
    renderList(currentFilter());
    var indicator = document.querySelector("[data-notes-autosave]");
    indicator.querySelector("span").textContent = "Saved";
  }, 500);

  function wireEditor() {
    ["[data-note-title-input]", "[data-note-body]", "[data-note-subject-tag]"].forEach(function (sel) {
      document.querySelector(sel).addEventListener("input", persist);
    });
    document.querySelector("[data-note-subject-tag]").addEventListener("change", persist);
  }

  function wireSearch() {
    document.querySelector("[data-notes-search]").addEventListener("input", App.debounce(function (e) {
      renderList(e.target.value.trim().toLowerCase());
    }, 200));
  }

  function wireToolbar() {
    document.querySelectorAll("[data-format-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.execCommand(btn.dataset.formatCmd, false, btn.dataset.formatValue || null);
        document.querySelector("[data-note-body]").focus();
        persist();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
