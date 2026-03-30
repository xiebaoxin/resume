import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 14;
  const SIZE_SCALE = 0.5; // keep half-size
  const FOLLOW_DISTANCE_SCALE = 0.5; // keep half drag offset

  const state = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    autoAnchorX: 0,
    direction: 1,
    mode: "auto",
    size: 0,
    halfSize: 0,
    followDistance: 0,
    lastTs: 0,
    stopTimer: 0,
    prepared: null,
    lineHeight: 0,
    font: "",
    needsLayout: true,
    panel: null,
    sourceEl: null,
    linesEl: null,
    xEl: null
  };

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function viewportWidth() {
    return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function collectResumeText() {
    const selectors = [
      ".tagline",
      ".highlight-card .role",
      ".products .product",
      ".metric",
      ".ai-note",
      ".exp-item-summary",
      ".skills-lead",
      ".skills-domain",
      ".education-content"
    ];
    const chunks = [];
    for (let i = 0; i < selectors.length; i += 1) {
      const nodes = document.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j += 1) {
        const t = (nodes[j].textContent || "").replace(/\s+/g, " ").trim();
        if (t) chunks.push(t);
      }
    }
    return chunks.join(" ");
  }

  function ensurePanel() {
    if (state.panel && state.sourceEl && state.linesEl && state.xEl) return true;
    const main = document.querySelector(".main");
    const hero = document.querySelector(".hero");
    if (!main) return false;

    const section = document.createElement("section");
    section.className = "pretext-playground";
    section.innerHTML =
      '<h2 class="section-title">Pretext Dynamic Reflow</h2>' +
      '<div class="pretext-source"></div>' +
      '<div class="pretext-lines"></div>' +
      '<div class="pretext-x" aria-hidden="true">' +
      '  <div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '  <div class="pretext-x-bar pretext-x-bar-b"></div>' +
      "</div>";

    if (hero && hero.nextSibling) {
      main.insertBefore(section, hero.nextSibling);
    } else {
      main.insertBefore(section, main.firstChild);
    }

    state.panel = section;
    state.sourceEl = section.querySelector(".pretext-source");
    state.linesEl = section.querySelector(".pretext-lines");
    state.xEl = section.querySelector(".pretext-x");
    return !!(state.panel && state.sourceEl && state.linesEl && state.xEl);
  }

  function setupText() {
    const text = collectResumeText();
    if (!text || !state.panel) return;
    const panelWidth = Math.max(260, state.panel.clientWidth);
    const fontSize = Math.max(15, Math.round(panelWidth * 0.026));
    const lineHeight = Math.max(24, Math.round(fontSize * 1.6));
    const font = 'normal 500 ' + fontSize + 'px "Noto Serif SC", serif';

    state.sourceEl.textContent = text;
    state.sourceEl.style.font = font;
    state.sourceEl.style.lineHeight = lineHeight + "px";

    state.font = font;
    state.lineHeight = lineHeight;
    state.prepared = prepareWithSegments(text, font);
    state.needsLayout = true;
  }

  function setInitialState() {
    const w = viewportWidth();
    state.size = (w / 5) * SIZE_SCALE;
    state.halfSize = state.size / 2;
    state.followDistance = (w / 5) * FOLLOW_DISTANCE_SCALE;

    const rect = state.panel.getBoundingClientRect();
    state.x = rect.left + rect.width * 0.5;
    state.y = rect.top + rect.height * 0.5;
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;
    state.direction = 1;
    state.mode = "auto";
    state.needsLayout = true;
  }

  function updateXStyle() {
    const rect = state.panel.getBoundingClientRect();
    state.x = clamp(state.x, rect.left + state.halfSize, rect.right - state.halfSize);
    state.y = clamp(state.y, rect.top + state.halfSize, rect.bottom - state.halfSize);

    state.xEl.style.setProperty("--x-size", state.size.toFixed(2) + "px");
    state.xEl.style.setProperty("--x-left", (state.x - rect.left).toFixed(2) + "px");
    state.xEl.style.setProperty("--x-top", (state.y - rect.top).toFixed(2) + "px");
  }

  function renderReflow() {
    if (!state.prepared) return;
    const rect = state.panel.getBoundingClientRect();
    const panelPad = 12;
    const width = Math.max(220, rect.width - panelPad * 2);
    const height = Math.max(220, rect.height - panelPad * 2);
    const minWidth = Math.max(56, width * 0.14);
    const safety = Math.max(12, state.size * 0.38);

    const localX = state.x - rect.left;
    const localY = state.y - rect.top;
    const exLeft = localX - state.halfSize - safety - panelPad;
    const exRight = localX + state.halfSize + safety - panelPad;
    const exTop = localY - state.halfSize - safety - panelPad;
    const exBottom = localY + state.halfSize + safety - panelPad;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let html = "";
    const maxLines = Math.max(1, Math.floor(height / state.lineHeight));

    for (let i = 0; i < maxLines; i += 1) {
      const lineTop = y;
      const lineBottom = y + state.lineHeight;
      const intersects = lineBottom > exTop && lineTop < exBottom;

      let x = 0;
      let w = width;
      if (intersects) {
        const leftWidth = exLeft;
        const rightWidth = width - exRight;
        if (leftWidth >= minWidth) {
          x = 0;
          w = leftWidth;
        } else if (rightWidth >= minWidth) {
          x = exRight;
          w = rightWidth;
        }
      }

      const line = layoutNextLine(state.prepared, cursor, Math.max(minWidth, w));
      if (line === null) break;
      html +=
        '<div class="pretext-line" style="left:' +
        (panelPad + x).toFixed(2) +
        "px;top:" +
        (panelPad + y).toFixed(2) +
        "px;max-width:" +
        w.toFixed(2) +
        'px;">' +
        escapeHtml(line.text) +
        "</div>";
      cursor = line.end;
      y += state.lineHeight;
    }

    state.linesEl.style.font = state.font;
    state.linesEl.style.lineHeight = state.lineHeight + "px";
    state.linesEl.innerHTML = html;
  }

  function onMouseMove(e) {
    const d = state.followDistance;
    const diag = d / Math.sqrt(2);
    state.mode = "follow";
    state.targetX = e.clientX + diag;
    state.targetY = e.clientY - diag;
    state.autoAnchorX = state.targetX;
    state.needsLayout = true;

    if (state.stopTimer) window.clearTimeout(state.stopTimer);
    state.stopTimer = window.setTimeout(function () {
      state.mode = "auto";
      state.direction = 1;
      state.autoAnchorX = state.x;
      state.needsLayout = true;
    }, FOLLOW_STOP_DELAY_MS);
  }

  function animate(ts) {
    const rect = state.panel.getBoundingClientRect();
    const dt = state.lastTs ? Math.min(0.05, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    if (state.mode === "follow") {
      const lerp = 1 - Math.exp(-FOLLOW_EASE * dt);
      state.x += (state.targetX - state.x) * lerp;
      state.y += (state.targetY - state.y) * lerp;
    } else {
      const speed = Math.max(24, rect.height * 0.18);
      state.y += state.direction * speed * dt;
      state.x += (state.autoAnchorX - state.x) * Math.min(1, dt * 2.2);
      const minY = rect.top + state.halfSize;
      const maxY = rect.bottom - state.halfSize;
      if (state.y >= maxY) {
        state.y = maxY;
        state.direction = -1;
      } else if (state.y <= minY) {
        state.y = minY;
        state.direction = 1;
      }
    }

    updateXStyle();
    if (
      state.needsLayout ||
      Math.abs(state.targetX - state.x) > LAYOUT_TRIGGER_DELTA ||
      Math.abs(state.targetY - state.y) > LAYOUT_TRIGGER_DELTA
    ) {
      renderReflow();
      state.needsLayout = false;
    }
    window.requestAnimationFrame(animate);
  }

  function onResize() {
    setInitialState();
    setupText();
    updateXStyle();
    state.needsLayout = true;
  }

  function init() {
    if (!ensurePanel()) return;
    setupText();
    setInitialState();
    updateXStyle();
    renderReflow();
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
