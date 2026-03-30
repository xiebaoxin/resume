import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 14;
  const LAYOUT_TRIGGER_DELTA = 0.6;

  const moduleState = {
    mainEl: null,
    cardEl: null,
    textLayerEl: null,
    iconEl: null,
    sourceText: "",
    prepared: null,
    font: "",
    lineHeight: 0,
    lastLayoutX: NaN,
    lastLayoutY: NaN,
    lastLayoutSize: NaN,
    mutationDebounce: 0
  };

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
    needsLayout: true
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function viewportWidth() {
    return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function collectSourceText() {
    const selectors = [
      "#tagline",
      "#highlightRole",
      ".exp-item-summary",
      "#skillsLead",
      "#skillsDomain"
    ];
    const chunks = [];
    for (let i = 0; i < selectors.length; i += 1) {
      const nodes = document.querySelectorAll(selectors[i]);
      for (let j = 0; j < nodes.length; j += 1) {
        const t = (nodes[j].textContent || "").trim();
        if (t) chunks.push(t);
      }
    }
    if (!chunks.length) {
      return "Pretext 文字自动排版预览：X 图标移动时，旁边文本将实时绕排与换行，整体简历布局保持不变。";
    }
    return chunks.join(" ");
  }

  function ensureModule() {
    const main = document.querySelector(".main");
    if (!main) return false;
    moduleState.mainEl = main;

    if (main.querySelector(".pretext-module-preview")) {
      const card = main.querySelector(".pretext-module-card");
      if (!card) return false;
      moduleState.cardEl = card;
      moduleState.textLayerEl = card.querySelector(".pretext-module-text");
      moduleState.iconEl = card.querySelector(".pretext-x-icon");
      return !!(moduleState.textLayerEl && moduleState.iconEl);
    }

    const section = document.createElement("section");
    section.className = "pretext-module-preview";
    section.innerHTML =
      '<h2 class="section-title">Pretext X Flow Preview</h2>' +
      '<div class="pretext-module-card">' +
      '  <div class="pretext-module-text" aria-live="off"></div>' +
      '  <div class="pretext-module-layer" aria-hidden="true">' +
      '    <div class="pretext-x-icon">' +
      '      <div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '      <div class="pretext-x-bar pretext-x-bar-b"></div>' +
      "    </div>" +
      "  </div>" +
      "</div>";

    const hero = main.querySelector(".hero");
    if (hero && hero.nextSibling) {
      main.insertBefore(section, hero.nextSibling);
    } else {
      main.insertBefore(section, main.firstChild);
    }

    moduleState.cardEl = section.querySelector(".pretext-module-card");
    moduleState.textLayerEl = section.querySelector(".pretext-module-text");
    moduleState.iconEl = section.querySelector(".pretext-x-icon");
    return !!(moduleState.cardEl && moduleState.textLayerEl && moduleState.iconEl);
  }

  function prepareTextLayout() {
    const card = moduleState.cardEl;
    if (!card) return;

    const contentWidth = Math.max(260, card.clientWidth - 30);
    const fontSize = Math.max(15, Math.min(19, contentWidth * 0.03));
    const lineHeight = Math.round(fontSize * 1.6);
    const font = Math.round(fontSize) + 'px "Noto Serif SC", "JetBrains Mono", serif';
    const sourceText = collectSourceText();

    moduleState.lineHeight = lineHeight;
    if (sourceText !== moduleState.sourceText || font !== moduleState.font) {
      moduleState.sourceText = sourceText;
      moduleState.font = font;
      moduleState.prepared = prepareWithSegments(sourceText, font);
    }
    state.needsLayout = true;
  }

  function setInitialPosition() {
    const card = moduleState.cardEl;
    if (!card) return;
    const cardW = Math.max(260, card.clientWidth);
    const cardH = Math.max(260, card.clientHeight);
    const docW = viewportWidth();
    const baseSize = docW / 5;
    const maxSize = Math.min(cardW * 0.46, cardH * 0.55, 220);
    const minSize = Math.min(120, cardW * 0.34);

    state.size = clamp(baseSize, minSize, maxSize);
    state.halfSize = state.size / 2;
    state.followDistance = docW / 5;
    state.x = cardW / 2;
    state.y = cardH / 2;
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;
    state.direction = 1;
    state.mode = "auto";
    state.needsLayout = true;
  }

  function updateIconStyle() {
    if (!moduleState.iconEl) return;
    moduleState.iconEl.style.setProperty("--pretext-x-size", state.size.toFixed(2) + "px");
    moduleState.iconEl.style.transform =
      "translate3d(" + (state.x - state.halfSize).toFixed(2) + "px, " + (state.y - state.halfSize).toFixed(2) + "px, 0)";
  }

  function updateResize() {
    const card = moduleState.cardEl;
    if (!card) return;
    const oldW = Math.max(1, card.clientWidth);
    const oldH = Math.max(1, card.clientHeight);
    const xr = state.x / oldW;
    const yr = state.y / oldH;

    setInitialPosition();

    const cardW = Math.max(260, card.clientWidth);
    const cardH = Math.max(260, card.clientHeight);
    state.x = clamp(cardW * xr, state.halfSize, cardW - state.halfSize);
    state.y = clamp(cardH * yr, state.halfSize, cardH - state.halfSize);
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;

    prepareTextLayout();
    updateIconStyle();
    state.needsLayout = true;
  }

  function onMouseMove(e) {
    const card = moduleState.cardEl;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }
    const d = state.followDistance;
    const diag = d / Math.sqrt(2);

    state.mode = "follow";
    state.targetX = clamp(e.clientX - rect.left + diag, state.halfSize, rect.width - state.halfSize);
    state.targetY = clamp(e.clientY - rect.top - diag, state.halfSize, rect.height - state.halfSize);
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

  function renderModuleText() {
    const card = moduleState.cardEl;
    const textLayer = moduleState.textLayerEl;
    const prepared = moduleState.prepared;
    if (!card || !textLayer || !prepared) return;

    const padX = 16;
    const padY = 16;
    const width = Math.max(220, card.clientWidth - padX * 2);
    const height = Math.max(220, card.clientHeight - padY * 2);
    const lineHeight = moduleState.lineHeight || 28;
    const minWidth = Math.max(100, width * 0.23);
    const safetyGap = Math.max(8, state.size * 0.08);

    const exLeft = state.x - state.halfSize - safetyGap - padX;
    const exRight = state.x + state.halfSize + safetyGap - padX;
    const exTop = state.y - state.halfSize - safetyGap - padY;
    const exBottom = state.y + state.halfSize + safetyGap - padY;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let html = "";
    let guard = 0;

    while (guard < 5000 && y <= height - lineHeight) {
      guard += 1;
      const lineTop = y;
      const lineBottom = y + lineHeight;
      const intersects = lineBottom > exTop && lineTop < exBottom;

      let segments = [{ x: 0, width: width }];
      if (intersects) {
        segments = [];
        const leftWidth = exLeft;
        const rightWidth = width - exRight;
        if (leftWidth >= minWidth) segments.push({ x: 0, width: leftWidth });
        if (rightWidth >= minWidth) segments.push({ x: exRight, width: rightWidth });
        if (!segments.length) {
          y += lineHeight;
          continue;
        }
      }

      for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i];
        const line = layoutNextLine(prepared, cursor, Math.max(minWidth, seg.width));
        if (!line) {
          guard = 5001;
          break;
        }
        html +=
          '<div class="pretext-module-line" style="left:' +
          (padX + seg.x).toFixed(2) +
          "px;top:" +
          (padY + y).toFixed(2) +
          "px;max-width:" +
          seg.width.toFixed(2) +
          'px;">' +
          escapeHtml(line.text) +
          "</div>";
        cursor = line.end;
      }

      y += lineHeight;
    }

    textLayer.style.font = moduleState.font;
    textLayer.style.lineHeight = lineHeight + "px";
    textLayer.innerHTML = html;
    moduleState.lastLayoutX = state.x;
    moduleState.lastLayoutY = state.y;
    moduleState.lastLayoutSize = state.size;
    state.needsLayout = false;
  }

  function maybeRender() {
    if (!moduleState.prepared) return;
    if (state.needsLayout) {
      renderModuleText();
      return;
    }
    const moved =
      Math.abs(moduleState.lastLayoutX - state.x) > LAYOUT_TRIGGER_DELTA ||
      Math.abs(moduleState.lastLayoutY - state.y) > LAYOUT_TRIGGER_DELTA ||
      Math.abs(moduleState.lastLayoutSize - state.size) > 0.5;
    if (moved) renderModuleText();
  }

  function animate(ts) {
    const card = moduleState.cardEl;
    if (!card) return;
    const dt = state.lastTs ? Math.min(0.05, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    if (state.mode === "follow") {
      const lerp = 1 - Math.exp(-FOLLOW_EASE * dt);
      state.x += (state.targetX - state.x) * lerp;
      state.y += (state.targetY - state.y) * lerp;
    } else {
      const speed = Math.max(26, card.clientHeight * 0.15);
      state.y += state.direction * speed * dt;
      state.x += (state.autoAnchorX - state.x) * Math.min(1, dt * 2.2);
      const minY = state.halfSize;
      const maxY = card.clientHeight - state.halfSize;
      if (state.y >= maxY) {
        state.y = maxY;
        state.direction = -1;
      } else if (state.y <= minY) {
        state.y = minY;
        state.direction = 1;
      }
    }

    state.x = clamp(state.x, state.halfSize, card.clientWidth - state.halfSize);
    state.y = clamp(state.y, state.halfSize, card.clientHeight - state.halfSize);
    updateIconStyle();
    maybeRender();
    window.requestAnimationFrame(animate);
  }

  function init() {
    if (!ensureModule()) return;
    setInitialPosition();
    prepareTextLayout();
    updateIconStyle();
    renderModuleText();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", updateResize, { passive: true });

    const observer = new MutationObserver(function () {
      const moduleRoot = moduleState.mainEl ? moduleState.mainEl.querySelector(".pretext-module-preview") : null;
      if (moduleRoot && moduleRoot.contains(document.activeElement)) {
        // noop: keep lint tools calm for older browsers
      }
      let hasRealResumeMutation = false;
      for (let i = 0; i < arguments[0].length; i += 1) {
        const m = arguments[0][i];
        const target = m && m.target ? m.target : null;
        if (!moduleRoot || !target || !moduleRoot.contains(target)) {
          hasRealResumeMutation = true;
          break;
        }
      }
      if (!hasRealResumeMutation) return;
      if (moduleState.mutationDebounce) window.clearTimeout(moduleState.mutationDebounce);
      moduleState.mutationDebounce = window.setTimeout(function () {
        prepareTextLayout();
        state.needsLayout = true;
      }, 60);
    });
    observer.observe(moduleState.mainEl, { subtree: true, childList: true, characterData: true });

    window.requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
