/* ==========================================================================
   UPSI-OS · storage.js
   Single source of truth for persistence. Every other module reads and
   writes state through this file only — nothing touches localStorage
   directly outside of here. This keeps the storage schema swappable
   (e.g. to IndexedDB later) without rewriting feature code.
   ========================================================================== */

const Storage = (() => {
  const NS = "upsios";
  const SCHEMA_VERSION = 1;

  /* Keys are namespaced so this app never collides with other localStorage
     data on the same origin, and so a future migration can target them. */
  const KEYS = {
    meta: `${NS}:meta`,
    profile: `${NS}:profile`,
    subjects: `${NS}:subjects`,        // subject/topic tree + completion state
    planner: `${NS}:planner`,          // { "YYYY-MM-DD": dayPlan }
    mocks: `${NS}:mocks`,              // array of mock test records
    notes: `${NS}:notes`,              // array of note records
    settings: `${NS}:settings`,
    streak: `${NS}:streak`,
  };

  /* ---------------------------------------------------------------- */
  /* Low level read / write with JSON + error safety                   */
  /* ---------------------------------------------------------------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[Storage] Failed to read ${key}`, err);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to write ${key}`, err);
      // Most likely QuotaExceededError — surface to the UI layer.
      document.dispatchEvent(new CustomEvent("upsios:storage-error", { detail: { key, err } }));
      return false;
    }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  /* ---------------------------------------------------------------- */
  /* Meta / bootstrap                                                   */
  /* ---------------------------------------------------------------- */
  function getMeta() {
    return read(KEYS.meta, { schemaVersion: SCHEMA_VERSION, installedAt: null });
  }

  function ensureBootstrapped() {
    let meta = getMeta();
    if (!meta.installedAt) {
      meta = { schemaVersion: SCHEMA_VERSION, installedAt: new Date().toISOString() };
      write(KEYS.meta, meta);
    }
    if (read(KEYS.profile, null) === null) {
      write(KEYS.profile, { name: "Aspirant", examDate: "", createdAt: new Date().toISOString() });
    }
    if (read(KEYS.settings, null) === null) {
      write(KEYS.settings, { theme: "dark", dailyQuestionTarget: 100, dailyHourTarget: 6 });
    }
    if (read(KEYS.planner, null) === null) write(KEYS.planner, {});
    if (read(KEYS.mocks, null) === null) write(KEYS.mocks, []);
    if (read(KEYS.notes, null) === null) write(KEYS.notes, []);
    if (read(KEYS.streak, null) === null) write(KEYS.streak, { current: 0, longest: 0, lastActiveDate: null, history: [] });
    return meta;
  }

  /* ---------------------------------------------------------------- */
  /* Profile                                                            */
  /* ---------------------------------------------------------------- */
  function getProfile() { return read(KEYS.profile, { name: "Aspirant", examDate: "" }); }
  function saveProfile(profile) { return write(KEYS.profile, profile); }

  /* ---------------------------------------------------------------- */
  /* Settings                                                           */
  /* ---------------------------------------------------------------- */
  function getSettings() { return read(KEYS.settings, { theme: "dark", dailyQuestionTarget: 100, dailyHourTarget: 6 }); }
  function saveSettings(settings) { return write(KEYS.settings, settings); }

  /* ---------------------------------------------------------------- */
  /* Subjects — seeded from data/subjects.json on first run, then       */
  /* fully owned by localStorage (checkbox/revision state lives here). */
  /* ---------------------------------------------------------------- */
  function getSubjects() { return read(KEYS.subjects, null); }
  function saveSubjects(subjectState) { return write(KEYS.subjects, subjectState); }

  async function seedSubjectsIfEmpty() {
    const existing = getSubjects();
    if (existing) return existing;
    try {
      const res = await fetch("data/subjects.json");
      const json = await res.json();
      const seeded = json.subjects.map((subject) => ({
        ...subject,
        topics: subject.topics.map((topic) => ({
          ...topic,
          subtopics: topic.subtopics.map((sub) => ({
            ...sub,
            completed: false,
            revision: "pending", // pending | due | revised
            notes: "",
            nextRevisionDate: "", // ISO date string (YYYY-MM-DD) or empty
          })),
        })),
      }));
      write(KEYS.subjects, seeded);
      return seeded;
    } catch (err) {
      console.error("[Storage] Could not seed subjects.json", err);
      write(KEYS.subjects, []);
      return [];
    }
  }

  /* ---------------------------------------------------------------- */
  /* Planner — keyed by ISO date string                                */
  /* ---------------------------------------------------------------- */
  function getPlanner() { return read(KEYS.planner, {}); }
  function getDayPlan(dateStr) {
    const planner = getPlanner();
    return planner[dateStr] || {
      date: dateStr,
      questionTarget: getSettings().dailyQuestionTarget || 100,
      questionsCompleted: 0,
      hourTarget: getSettings().dailyHourTarget || 6,
      hoursStudied: 0,
      tasks: [],
      revisionTasks: [],
    };
  }
  function saveDayPlan(dateStr, dayPlan) {
    const planner = getPlanner();
    planner[dateStr] = dayPlan;
    return write(KEYS.planner, planner);
  }

  /* ---------------------------------------------------------------- */
  /* Mock tests                                                         */
  /* ---------------------------------------------------------------- */
  function getMocks() { return read(KEYS.mocks, []); }
  function saveMocks(mocks) { return write(KEYS.mocks, mocks); }
  function addMock(mock) {
    const mocks = getMocks();
    mock.id = mock.id || `mock_${Date.now()}`;
    mocks.push(mock);
    mocks.sort((a, b) => new Date(a.date) - new Date(b.date));
    write(KEYS.mocks, mocks);
    return mock;
  }
  function deleteMock(id) {
    const mocks = getMocks().filter((m) => m.id !== id);
    return write(KEYS.mocks, mocks);
  }

  /* ---------------------------------------------------------------- */
  /* Notes                                                              */
  /* ---------------------------------------------------------------- */
  function getNotes() { return read(KEYS.notes, []); }
  function saveNotes(notes) { return write(KEYS.notes, notes); }
  function upsertNote(note) {
    const notes = getNotes();
    const idx = notes.findIndex((n) => n.id === note.id);
    note.updatedAt = new Date().toISOString();
    if (idx >= 0) notes[idx] = note; else { note.id = note.id || `note_${Date.now()}`; note.createdAt = note.updatedAt; notes.unshift(note); }
    write(KEYS.notes, notes);
    return note;
  }
  function deleteNote(id) {
    const notes = getNotes().filter((n) => n.id !== id);
    return write(KEYS.notes, notes);
  }

  /* ---------------------------------------------------------------- */
  /* Streak                                                             */
  /* ---------------------------------------------------------------- */
  function getStreak() { return read(KEYS.streak, { current: 0, longest: 0, lastActiveDate: null, history: [] }); }
  function saveStreak(streak) { return write(KEYS.streak, streak); }

  /** Call whenever the user logs meaningful activity (task done, mock added, etc). */
  function markActiveToday() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const streak = getStreak();
    if (streak.lastActiveDate === todayStr) return streak; // already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streak.lastActiveDate === yesterdayStr) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }
    streak.longest = Math.max(streak.longest, streak.current);
    streak.lastActiveDate = todayStr;
    streak.history = [...new Set([...(streak.history || []), todayStr])].slice(-90);
    saveStreak(streak);
    return streak;
  }

  /* ---------------------------------------------------------------- */
  /* Export / Import / Reset                                            */
  /* ---------------------------------------------------------------- */
  function exportAll() {
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      data: {},
    };
    Object.entries(KEYS).forEach(([name, key]) => {
      payload.data[name] = read(key, null);
    });
    return payload;
  }

  function importAll(payload) {
    if (!payload || !payload.data) throw new Error("Invalid backup file");
    Object.entries(KEYS).forEach(([name, key]) => {
      if (payload.data[name] !== undefined && payload.data[name] !== null) {
        write(key, payload.data[name]);
      }
    });
    return true;
  }

  function resetAll() {
    Object.values(KEYS).forEach((key) => remove(key));
    ensureBootstrapped();
  }

  /** Approximate bytes used by this app's localStorage footprint. */
  function getStorageUsage() {
    let bytes = 0;
    Object.values(KEYS).forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) bytes += raw.length * 2; // UTF-16 ~2 bytes/char
    });
    return bytes;
  }

  return {
    KEYS,
    ensureBootstrapped,
    getProfile, saveProfile,
    getSettings, saveSettings,
    getSubjects, saveSubjects, seedSubjectsIfEmpty,
    getPlanner, getDayPlan, saveDayPlan,
    getMocks, saveMocks, addMock, deleteMock,
    getNotes, saveNotes, upsertNote, deleteNote,
    getStreak, saveStreak, markActiveToday,
    exportAll, importAll, resetAll,
    getStorageUsage,
  };
})();
