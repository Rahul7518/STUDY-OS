# UPSI-OS

A fully offline, desktop-style preparation console for a serious  aspirant. STUDY-OS is not a course platform
and not a mock-test platform — it is a personal command center for
organizing and tracking your own preparation: syllabus progress, daily
planning, mock-test history, and notes, all in one place.

## Why it's offline-only

- No backend, no database, no API, no login.
- All data lives in your browser's `localStorage`, on your device only.
- The only network-shaped call the app makes is a same-origin `fetch()`
  of `data/subjects.json` on first run, to seed the syllabus tree — after
  that, everything is read from and written to `localStorage`.

## Running it

Because `subjects.json` is loaded with `fetch()`, most browsers block that
call on a bare `file://` page for security reasons. Serve the folder with
any static file server and open it — for example:

```bash
cd UPSI-OS
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

Any static server works (VS Code "Live Server", `npx serve`, etc.). No
build step, no dependencies to install.

## Folder structure

```
UPSI-OS/
  index.html         Dashboard
  subjects.html       Syllabus tracker (topics, subtopics, priority, revision)
  planner.html        Daily planner (goals, tasks, revision tasks)
  mock.html           Mock test tracker (entries, trend chart, history)
  notes.html           Rich-text notes with subject tags
  settings.html        Profile, theme, targets, export/import/reset
  css/
    style.css          Design tokens, shell layout, shared components
    dashboard.css       Dashboard-only styles
    planner.css         Planner-only styles
    mock.css            Mock tracker-only styles
  js/
    storage.js          The only module that touches localStorage
    app.js              Shared shell logic: sidebar, toasts, modals, icons, utils
    dashboard.js         Dashboard page controller
    subjects.js          Subjects page controller
    planner.js           Planner page controller
    mock.js              Mock tracker page controller
    notes.js             Notes page controller
    settings.js           Settings page controller
  assets/
    icons/               Reserved for custom icon assets
    images/               Reserved for custom image assets
  data/
    subjects.json         Seed data for the UP SI syllabus tree
```

## Architecture notes

- **`storage.js` is the single source of truth.** Every read/write to
  `localStorage` goes through it, under namespaced keys (`upsios:*`).
  Swapping the persistence layer later (e.g. to IndexedDB) means editing
  one file, not six pages.
- **Each page is self-contained.** `subjects.html` only loads
  `storage.js`, `app.js`, and `subjects.js` — no page pays for code it
  doesn't use.
- **No frameworks, no build step.** Vanilla HTML/CSS/JS throughout, so
  there is nothing to compile and nothing that can go stale.
- **System fonts only.** Type is set with system font stacks (no Google
  Fonts / CDN), so the app never makes an external network request.

## Extending it later

The codebase is intentionally left room to grow without a rewrite:

- **Analytics** — `storage.js` already exposes `getMocks()`,
  `getPlanner()`, and `getSubjects()`; a new `analytics.js` can read from
  these without touching existing pages.
- **Revision engine** — subtopics already carry a `revision` state
  (`pending` / `due` / `revised`); a spaced-repetition scheduler can be
  layered on top of that field.
- **Gamification** — `getStreak()` / `markActiveToday()` already track
  daily activity; badges or XP can be derived from the same data.
- **PDF / CSV export** — `Storage.exportAll()` already returns a plain
  JSON snapshot of everything; a new export format is a new function that
  consumes the same payload.

## Data safety

Use **Settings → Data & Backup** to export a JSON backup regularly,
especially before clearing your browser's site data. Import restores from
that same file. Resetting the app is permanent and cannot be undone from
inside the app.
