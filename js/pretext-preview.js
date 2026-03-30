import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 14;
  const SIZE_SCALE = 0.5; // keep the user-approved half size
  const FOLLOW_DISTANCE_SCALE = 0.5; // keep the user-approved half drag distance

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
    root: null,
    textLayer: null,
    sourceNode: null
  };

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function viewportWidth() {
    return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  }

  function viewportHeight() {
    return Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function collectSimpleResumeText() {
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

  function ensureSimpleArea() {
    if (state.root && state.textLayer && state.sourceNode) return true;
    const main = document.querySelector(".main");
    const hero = document.querySelector(".hero");
    if (!main) return false;

    const section = document.createElement("section");
    section.className = "pretext-simple-area";
    section.innerHTML =
      '<h2 class="section-title">Pretext Dynamic Reflow</h2>' +
      '<div class="pretext-simple-box">' +
      '  <div class="pretext-simple-source"></div>' +
      '  <div class="pretext-simple-text"></div>' +
      '  <div class="pretext-simple-x" aria-hidden="true">' +
      '    <div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '    <div class="pretext-x-bar pretext-x-bar-b"></div>' +
      "  </div>" +
      "</div>";

    if (hero && hero.nextSibling) {
      main.insertBefore(section, hero.nextSibling);
    } else {
      main.insertBefore(section, main.firstChild);
    }

    state.root = section.querySelector(".pretext-simple-box");
    state.textLayer = section.querySelector(".pretext-simple-text");
    state.sourceNode = section.querySelector(".pretext-simple-source");
    return !!(state.root && state.textLayer && state.sourceNode);
  }

  function setupPreparedText() {
    const text = collectSimpleResumeText();
    if (!text || !state.root) return;
    const boxWidth = Math.max(260, state.root.clientWidth);
    const fontSize = Math.max(15, Math.round(boxWidth * 0.028));
    const lineHeight = Math.max(24, Math.round(fontSize * 1.6));
    const font = 'normal 500 ' + fontSize + 'px "Noto Serif SC", serif';

    state.sourceNode.textContent = text;
    state.sourceNode.style.font = font;
    state.sourceNode.style.lineHeight = lineHeight + "px";

    state.font = font;
    state.lineHeight = lineHeight;
    state.prepared = prepareWithSegments(text, font);
    state.needsLayout = true;
  }

  function setInitialState() {
    const w = viewportWidth();
    const h = viewportHeight();
    state.size = (w / 5) * SIZE_SCALE;
    state.halfSize = state.size / 2;
    state.followDistance = (w / 5) * FOLLOW_DISTANCE_SCALE;

    if (state.root) {
      const rect = state.root.getBoundingClientRect();
      state.x = rect.left + rect.width * 0.5;
      state.y = rect.top + rect.height * 0.5;
    } else {
      state.x = w / 2;
      state.y = h / 2;
    }

    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;
    state.direction = 1;
    state.mode = "auto";
    state.needsLayout = true;
  }

  function renderReflow() {
    if (!state.prepared || !state.root || !state.textLayer) return;
    const rect = state.root.getBoundingClientRect();
    const width = Math.max(200, rect.width - 24);
    const height = Math.max(200, rect.height - 24);
    const pad = 12;
    const minWidth = Math.max(56, width * 0.12);
    const safety = Math.max(12, state.size * 0.4);

    const localX = state.x - rect.left;
    const localY = state.y - rect.top;
    const exLeft = localX - state.halfSize - safety - pad;
    const exRight = localX + state.halfSize + safety - pad;
    const exTop = localY - state.halfSize - safety - pad;
    const exBottom = localY + state.halfSize + safety - pad;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let html = "";
    let guard = 0;
    const maxLines = Math.max(1, Math.floor(height / state.lineHeight));

    while (guard < 3000 && guard < maxLines) {
      guard += 1;
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
      if (!line) break;
      html +=
        '<div class="pretext-simple-line" style="left:' +
        (pad + x).toFixed(2) +
        "px;top:" +
        (pad + y).toFixed(2) +
        "px;max-width:" +
        w.toFixed(2) +
        'px;">' +
        escapeHtml(line.text) +
        "</div>";
      cursor = line.end;
      y += state.lineHeight;
    }

    state.textLayer.style.font = state.font;
    state.textLayer.style.lineHeight = state.lineHeight + "px";
    state.textLayer.innerHTML = html;
  }

  function updateXStyle() {
    if (!state.root) return;
    const rect = state.root.getBoundingClientRect();
    const x = clamp(state.x, rect.left + state.halfSize, rect.right - state.halfSize);
    const y = clamp(state.y, rect.top + state.halfSize, rect.bottom - state.halfSize);
    state.x = x;
    state.y = y;

    state.root.style.setProperty("--pretext-simple-x-size", state.size.toFixed(2) + "px");
    state.root.style.setProperty("--pretext-simple-x-left", (x - rect.left).toFixed(2) + "px");
    state.root.style.setProperty("--pretext-simple-x-top", (y - rect.top).toFixed(2) + "px");
  }

  function onMouseMove(e) {
    if (!state.root) return;
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
    if (!state.root) return;
    const rect = state.root.getBoundingClientRect();
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
    if (state.needsLayout || Math.abs(state.targetX - state.x) > LAYOUT_TRIGGER_DELTA || Math.abs(state.targetY - state.y) > LAYOUT_TRIGGER_DELTA) {
      renderReflow();
      state.needsLayout = false;
    }
    window.requestAnimationFrame(animate);
  }

  function onResize() {
    setInitialState();
    setupPreparedText();
    updateXStyle();
    state.needsLayout = true;
  }

  function init() {
    if (!ensureSimpleArea()) return;
    createOverlayAndIcon(); // no-op visual container; keeps consistency
    setupPreparedText();
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
