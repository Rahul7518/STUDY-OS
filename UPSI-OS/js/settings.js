/* ==========================================================================
   UPSI-OS · settings.js
   Controller for settings.html — profile, theme, targets, and the
   export / import / reset data-management tools.
   ========================================================================== */

(function () {
  async function boot() {
    await App.init();
    wireSettingsNav();
    loadProfileForm();
    loadTargetsForm();
    loadThemeToggle();
    renderStorageInfo();
    wireExportImportReset();
  }

  /* ---------------------------------------------------------------- */
  function wireSettingsNav() {
    const buttons = document.querySelectorAll("[data-settings-nav]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".settings-panel").forEach((p) => p.classList.remove("active"));
        document.querySelector(`[data-settings-panel="${btn.dataset.settingsNav}"]`).classList.add("active");
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function loadProfileForm() {
    const profile = Storage.getProfile();
    document.querySelector("[data-profile-name]").value = profile.name || "";
    document.querySelector("[data-profile-exam-date]").value = profile.examDate || "";

    document.querySelector("[data-profile-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      Storage.saveProfile({
        ...profile,
        name: document.querySelector("[data-profile-name]").value.trim() || "Aspirant",
        examDate: document.querySelector("[data-profile-exam-date]").value,
      });
      App.toast("Profile updated");
      App.renderStatusbar();
    });
  }

  function loadTargetsForm() {
    const settings = Storage.getSettings();
    document.querySelector("[data-target-questions]").value = settings.dailyQuestionTarget;
    document.querySelector("[data-target-hours]").value = settings.dailyHourTarget;

    document.querySelector("[data-targets-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      Storage.saveSettings({
        ...settings,
        dailyQuestionTarget: Number(document.querySelector("[data-target-questions]").value) || 100,
        dailyHourTarget: Number(document.querySelector("[data-target-hours]").value) || 6,
      });
      App.toast("Daily targets updated");
    });
  }

  /* ---------------------------------------------------------------- */
  function loadThemeToggle() {
    const settings = Storage.getSettings();
    const options = document.querySelectorAll("[data-theme-option]");
    function refresh() {
      options.forEach((o) => o.classList.toggle("active", o.dataset.themeOption === settings.theme));
    }
    refresh();
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        settings.theme = opt.dataset.themeOption;
        Storage.saveSettings(settings);
        App.applyTheme(settings.theme);
        refresh();
        App.toast(`Switched to ${settings.theme} theme`);
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function renderStorageInfo() {
    const usage = Storage.getStorageUsage();
    const kb = (usage / 1024).toFixed(2);
    const limitKb = 5120; // typical 5MB localStorage budget, conservative estimate
    const percent = App.pct(usage / 1024, limitKb);
    document.querySelector("[data-storage-total]").textContent = `${kb} KB used`;
    document.querySelector("[data-storage-bar]").style.width = `${percent}%`;

    const breakdown = [
      { label: "Subjects & Progress", key: Storage.KEYS.subjects, color: "var(--accent-gold)" },
      { label: "Planner", key: Storage.KEYS.planner, color: "var(--accent-teal)" },
      { label: "Mock Tests", key: Storage.KEYS.mocks, color: "var(--accent-blue)" },
      { label: "Notes", key: Storage.KEYS.notes, color: "var(--accent-purple)" },
      { label: "Profile & Settings", key: Storage.KEYS.profile, color: "var(--text-muted)" },
    ];
    const rows = breakdown.map((b) => {
      const raw = localStorage.getItem(b.key) || "";
      const sizeKb = ((raw.length * 2) / 1024).toFixed(2);
      return `<div class="storage-breakdown-row">
        <span><span class="key-dot" style="background:${b.color}"></span>${b.label}</span>
        <span class="mono">${sizeKb} KB</span>
      </div>`;
    }).join("");
    document.querySelector("[data-storage-breakdown]").innerHTML = rows;

    const profile = Storage.getProfile();
    document.querySelector("[data-storage-since]").textContent = profile.createdAt
      ? App.formatDateFull(profile.createdAt.slice(0, 10))
      : "—";
  }

  /* ---------------------------------------------------------------- */
  function wireExportImportReset() {
    document.querySelector("[data-export-btn]").addEventListener("click", () => {
      const payload = Storage.exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `upsi-os-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      App.toast("Backup downloaded");
    });

    const fileInput = document.querySelector("[data-import-input]");
    document.querySelector("[data-import-btn]").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          Storage.importAll(payload);
          App.toast("Data imported successfully — reloading");
          setTimeout(() => location.reload(), 900);
        } catch (err) {
          App.toast("Import failed — invalid backup file", "error");
        }
      };
      reader.readAsText(file);
      fileInput.value = "";
    });

    const resetOverlay = document.querySelector("[data-reset-modal]");
    App.wireModalDismiss(resetOverlay);
    document.querySelector("[data-reset-open-btn]").addEventListener("click", () => App.openModal(resetOverlay));
    document.querySelector("[data-reset-confirm-btn]").addEventListener("click", () => {
      Storage.resetAll();
      App.toast("Application reset");
      setTimeout(() => location.reload(), 700);
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
