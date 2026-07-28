/* ==========================================================================
   UPSI-OS · mock.js
   Controller for mock.html. Renders a dependency-free SVG line chart from
   localStorage data — no chart library is loaded, keeping the app fully
   offline and lightweight.
   ========================================================================== */

(function () {
  let subjects = [];

  async function boot() {
    await App.init();
    subjects = Storage.getSubjects() || [];
    renderSummary();
    renderChart();
    renderHistory();
    buildSubjectMarksForm();
    wireForm();
  }

  /* ---------------------------------------------------------------- */
  function renderSummary() {
    const mocks = Storage.getMocks();
    const wrap = document.querySelector("[data-mock-summary-strip]");
    if (mocks.length === 0) {
      wrap.innerHTML = "";
      return;
    }
    const scores = mocks.map((m) => Number(m.score) || 0);
    const best = Math.max(...scores);
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const accAvg = (mocks.reduce((a, m) => a + (Number(m.accuracy) || 0), 0) / mocks.length).toFixed(1);
    wrap.innerHTML = `
      <div class="card stat-card"><span class="stat-label">Mocks Logged</span><span class="stat-value">${mocks.length}</span></div>
      <div class="card stat-card"><span class="stat-label">Best Score</span><span class="stat-value" style="color:var(--accent-teal)">${best}</span></div>
      <div class="card stat-card"><span class="stat-label">Average Score</span><span class="stat-value">${avg}</span></div>
      <div class="card stat-card"><span class="stat-label">Average Accuracy</span><span class="stat-value" style="color:var(--accent-blue)">${accAvg}%</span></div>
    `;
  }

  /* ---------------------------------------------------------------- */
  function renderChart() {
    const mocks = Storage.getMocks();
    const wrap = document.querySelector("[data-mock-chart]");
    if (mocks.length < 2) {
      wrap.innerHTML = `<div class="empty-state">
        <div class="icon">${App.icon("empty")}</div>
        <h4>Not enough data yet</h4>
        <p>Log at least two mock tests to see your trend line.</p>
      </div>`;
      return;
    }
    const W = 700, H = 200, PAD = 24;
    const scores = mocks.map((m) => Number(m.score) || 0);
    const max = Math.max(...scores, 10);
    const min = Math.min(...scores, 0);
    const range = max - min || 1;
    const stepX = (W - PAD * 2) / (mocks.length - 1);

    const points = mocks.map((m, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - ((Number(m.score) - min) / range) * (H - PAD * 2);
      return { x, y, mock: m };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x},${H - PAD} L${points[0].x},${H - PAD} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const y = PAD + f * (H - PAD * 2);
      return `<line class="chart-gridline" x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}"/>`;
    }).join("");

    wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-gold)" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="var(--accent-gold)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path class="chart-area" d="${areaPath}"/>
        <path class="chart-line" d="${linePath}"/>
        ${points.map((p) => `<circle class="chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" data-x="${p.x}" data-score="${p.mock.score}" data-date="${p.mock.date}"/>`).join("")}
      </svg>
      <div class="chart-tooltip" data-chart-tooltip></div>
    `;

    const tooltip = wrap.querySelector("[data-chart-tooltip]");
    wrap.querySelectorAll(".chart-dot").forEach((dot) => {
      dot.addEventListener("mouseenter", (e) => {
        const rect = wrap.getBoundingClientRect();
        const cx = (parseFloat(dot.dataset.x) / W) * rect.width;
        tooltip.style.left = cx + "px";
        tooltip.style.top = (parseFloat(dot.getAttribute("cy")) / H) * rect.height + "px";
        tooltip.textContent = `${App.formatDateFull(dot.dataset.date)} · ${dot.dataset.score} marks`;
        tooltip.classList.add("show");
      });
      dot.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
    });
  }

  /* ---------------------------------------------------------------- */
  function buildSubjectMarksForm() {
    const grid = document.querySelector("[data-subject-marks-grid]");
    grid.innerHTML = subjects.map((s) => `
      <div class="subject-mark-field">
        <label>${s.name}</label>
        <input type="number" min="0" step="0.5" data-subject-mark="${s.id}" placeholder="0" />
      </div>
    `).join("");
  }

  /* ---------------------------------------------------------------- */
  function renderHistory() {
    const mocks = [...Storage.getMocks()].reverse();
    const tbody = document.querySelector("[data-mock-history-body]");
    const emptyState = document.querySelector("[data-mock-history-empty]");
    const table = document.querySelector("[data-mock-history-table]");

    if (mocks.length === 0) {
      table.style.display = "none";
      emptyState.style.display = "flex";
      return;
    }
    table.style.display = "table";
    emptyState.style.display = "none";

    tbody.innerHTML = mocks.map((m) => `
      <tr>
        <td class="mono">${App.formatDateFull(m.date)}</td>
        <td class="score-cell">${m.score}</td>
        <td class="mono">${m.accuracy || "—"}%</td>
        <td>
          <div class="tag-list">
            ${(m.weakTopics || []).slice(0, 2).map((t) => `<span class="tag-pill tag-weak">${App.escapeHtml(t)}</span>`).join("")}
            ${(m.strongTopics || []).slice(0, 2).map((t) => `<span class="tag-pill tag-strong">${App.escapeHtml(t)}</span>`).join("")}
          </div>
        </td>
        <td style="max-width:220px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${App.escapeHtml(m.remarks || "")}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-icon" data-delete-mock="${m.id}">${App.icon("trash")}</button>
          </div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-delete-mock]").forEach((btn) => {
      btn.addEventListener("click", () => {
        Storage.deleteMock(btn.dataset.deleteMock);
        App.toast("Mock entry deleted");
        renderSummary(); renderChart(); renderHistory();
      });
    });
  }

  /* ---------------------------------------------------------------- */
  function wireForm() {
    const form = document.querySelector("[data-mock-form]");
    document.querySelector("[data-mock-date]").value = App.todayISO();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const subjectWise = {};
      form.querySelectorAll("[data-subject-mark]").forEach((input) => {
        subjectWise[input.dataset.subjectMark] = Number(input.value) || 0;
      });
      const mock = {
        date: document.querySelector("[data-mock-date]").value || App.todayISO(),
        score: Number(document.querySelector("[data-mock-score]").value) || 0,
        accuracy: Number(document.querySelector("[data-mock-accuracy]").value) || 0,
        subjectWise,
        weakTopics: splitTags(document.querySelector("[data-mock-weak]").value),
        strongTopics: splitTags(document.querySelector("[data-mock-strong]").value),
        remarks: document.querySelector("[data-mock-remarks]").value.trim(),
      };
      Storage.addMock(mock);
      Storage.markActiveToday();
      App.renderStatusbar();
      App.toast("Mock result saved");
      form.reset();
      document.querySelector("[data-mock-date]").value = App.todayISO();
      renderSummary(); renderChart(); renderHistory();
    });
  }

  function splitTags(str) {
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
