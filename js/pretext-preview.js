import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 14;
  const LAYOUT_TRIGGER_DELTA = 0.6;
  const SIZE_SCALE = 0.5;
  const FOLLOW_DISTANCE_SCALE = 0.5;
  const ACTIVE_MARGIN_FACTOR = 0.24;
  const TARGET_SELECTOR = [
    ".contact span",
    ".tagline",
    ".highlight-card .role",
    ".products .product",
    ".metric",
    ".ai-note",
    ".exp-item-role",
    ".exp-item-summary",
    ".skills-lead",
    ".skills-domain",
    ".education-content",
    ".attachments-links",
    ".footer-note"
  ].join(", ");

  const blocks = [];
  let overlayEl = null;
  let xEl = null;
  let mutationObserver = null;
  let mutationTimer = 0;

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

  function isTextOnlyNode(node) {
    if (!node) return false;
    if (node.querySelector("img, figure, canvas, svg, video, table, iframe")) return false;
    return true;
  }

  function createLayers() {
    overlayEl = document.createElement("div");
    overlayEl.className = "pretext-viewport-layer";
    document.body.appendChild(overlayEl);

    xEl = document.createElement("div");
    xEl.className = "pretext-viewport-x";
    xEl.setAttribute("aria-hidden", "true");
    xEl.innerHTML =
      '<div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '<div class="pretext-x-bar pretext-x-bar-b"></div>';
    document.body.appendChild(xEl);
  }

  function collectText(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function measureBlock(node) {
    if (!isTextOnlyNode(node)) return null;

    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const fontSize = Math.max(12, Math.round(parseFloat(style.fontSize) || 16));
    const lineHeightRaw = parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : fontSize * 1.6;
    const fontFamily = style.fontFamily || "Noto Serif SC, serif";
    const fontWeight = style.fontWeight || "400";
    const fontStyle = style.fontStyle || "normal";
    const font = fontStyle + " " + fontWeight + " " + fontSize + "px " + fontFamily;
    const sourceText = collectText(node);
    if (!sourceText || rect.width < 80 || rect.height < lineHeight * 0.8) return null;

    return {
      node: node,
      rect: rect,
      font: font,
      lineHeight: Math.max(16, lineHeight),
      originalText: sourceText,
      prepared: prepareWithSegments(sourceText, font),
      originalLineCount: Math.max(1, Math.floor(rect.height / Math.max(16, lineHeight))),
      originalOpacity: node.style.opacity || "",
      activeSide: null,
      proxy: null,
      sourceEl: null,
      textEl: null,
      wasActive: false
    };
  }

  function createProxy(block) {
    const proxy = document.createElement("div");
    proxy.className = "pretext-viewport-block";
    proxy.style.left = block.rect.left.toFixed(2) + "px";
    proxy.style.top = block.rect.top.toFixed(2) + "px";
    proxy.style.width = block.rect.width.toFixed(2) + "px";
    proxy.style.height = block.rect.height.toFixed(2) + "px";
    proxy.style.font = block.font;
    proxy.style.lineHeight = block.lineHeight + "px";
    proxy.innerHTML = '<div class="pretext-viewport-source"></div><div class="pretext-viewport-text"></div>';
    overlayEl.appendChild(proxy);
    block.proxy = proxy;
    block.sourceEl = proxy.querySelector(".pretext-viewport-source");
    block.textEl = proxy.querySelector(".pretext-viewport-text");
    block.sourceEl.textContent = block.originalText;
    block.sourceEl.style.font = block.font;
    block.sourceEl.style.lineHeight = block.lineHeight + "px";
  }

  function collectBlocks() {
    for (let i = 0; i < blocks.length; i += 1) {
      blocks[i].node.style.opacity = blocks[i].originalOpacity;
    }
    blocks.length = 0;
    if (overlayEl) overlayEl.innerHTML = "";

    const nodes = document.querySelectorAll(TARGET_SELECTOR);
    for (let i = 0; i < nodes.length; i += 1) {
      const block = measureBlock(nodes[i]);
      if (!block) continue;
      createProxy(block);
      blocks.push(block);
    }
  }

  function syncBlockRect(block) {
    const rect = block.node.getBoundingClientRect();
    block.rect = rect;
    block.originalLineCount = Math.max(1, Math.floor(rect.height / Math.max(16, block.lineHeight)));
    if (!block.proxy) return;
    block.proxy.style.left = rect.left.toFixed(2) + "px";
    block.proxy.style.top = rect.top.toFixed(2) + "px";
    block.proxy.style.width = rect.width.toFixed(2) + "px";
    block.proxy.style.height = rect.height.toFixed(2) + "px";
  }

  function isBlockHitByX(block) {
    const margin = Math.max(16, state.size * ACTIVE_MARGIN_FACTOR);
    const xLeft = state.x - state.halfSize - margin;
    const xRight = state.x + state.halfSize + margin;
    const xTop = state.y - state.halfSize - margin;
    const xBottom = state.y + state.halfSize + margin;
    const bLeft = block.rect.left;
    const bRight = block.rect.left + block.rect.width;
    const bTop = block.rect.top;
    const bBottom = block.rect.top + block.rect.height;
    return xRight > bLeft && xLeft < bRight && xBottom > bTop && xTop < bBottom;
  }

  function setInitialState() {
    const w = viewportWidth();
    const h = viewportHeight();
    state.size = (w / 5) * SIZE_SCALE;
    state.halfSize = state.size / 2;
    state.followDistance = (w / 5) * FOLLOW_DISTANCE_SCALE;
    state.x = w / 2;
    state.y = h / 2;
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;
    state.direction = 1;
    state.mode = "auto";
    state.needsLayout = true;
  }

  function updateXStyle() {
    const w = viewportWidth();
    const h = viewportHeight();
    state.x = clamp(state.x, state.halfSize, w - state.halfSize);
    state.y = clamp(state.y, state.halfSize, h - state.halfSize);
    xEl.style.setProperty("--x-size", state.size.toFixed(2) + "px");
    xEl.style.transform =
      "translate3d(" + (state.x - state.halfSize).toFixed(2) + "px, " + (state.y - state.halfSize).toFixed(2) + "px, 0)";
  }

  function pickRange(width, exLeft, exRight, minWidth, side) {
    const clampedLeft = clamp(exLeft, 0, width);
    const clampedRight = clamp(exRight, 0, width);
    if (clampedRight <= clampedLeft) return { x: 0, width: width };

    const leftWidth = clampedLeft;
    const rightWidth = width - clampedRight;
    const leftOk = leftWidth >= minWidth;
    const rightOk = rightWidth >= minWidth;
    if (!leftOk && !rightOk) return { x: 0, width: width };
    if (side === "left") {
      if (leftOk) return { x: 0, width: leftWidth };
      return { x: clampedRight, width: rightWidth };
    }
    if (rightOk) return { x: clampedRight, width: rightWidth };
    return { x: 0, width: leftWidth };
  }

  function renderBlock(block) {
    if (!block.proxy || !block.prepared || !block.textEl) return;
    const width = Math.max(80, block.rect.width);
    const minWidth = Math.max(42, width * 0.14);
    const safetyGap = Math.max(14, state.size * 0.45);
    const exLeft = state.x - state.halfSize - safetyGap - block.rect.left;
    const exRight = state.x + state.halfSize + safetyGap - block.rect.left;
    const exTop = state.y - state.halfSize - safetyGap - block.rect.top;
    const exBottom = state.y + state.halfSize + safetyGap - block.rect.top;
    if (!block.activeSide) {
      const centerX = block.rect.left + block.rect.width / 2;
      block.activeSide = state.x <= centerX ? "right" : "left";
    }

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let html = "";
    const maxLines = Math.max(1, block.originalLineCount);
    for (let i = 0; i < maxLines; i += 1) {
      const lineTop = y;
      const lineBottom = y + block.lineHeight;
      const intersects = lineBottom > exTop && lineTop < exBottom;
      const range = intersects ? pickRange(width, exLeft, exRight, minWidth, block.activeSide) : { x: 0, width: width };
      const line = layoutNextLine(block.prepared, cursor, Math.max(minWidth, range.width));
      if (line === null) break;
      html +=
        '<div class="pretext-viewport-line" style="left:' +
        range.x.toFixed(2) +
        "px;top:" +
        y.toFixed(2) +
        "px;max-width:" +
        range.width.toFixed(2) +
        'px;">' +
        escapeHtml(line.text) +
        "</div>";
      cursor = line.end;
      y += block.lineHeight;
    }

    block.node.style.opacity = "0";
    block.textEl.style.font = block.font;
    block.textEl.style.lineHeight = block.lineHeight + "px";
    block.textEl.innerHTML = html;
    block.wasActive = true;
  }

  function clearBlock(block) {
    block.node.style.opacity = block.originalOpacity;
    if (block.textEl) block.textEl.innerHTML = "";
    block.activeSide = null;
    block.wasActive = false;
  }

  function renderAll() {
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      syncBlockRect(block);
      if (isBlockHitByX(block)) {
        renderBlock(block);
      } else if (block.wasActive) {
        clearBlock(block);
      }
    }
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

  function onResize() {
    setInitialState();
    collectBlocks();
    updateXStyle();
    state.needsLayout = true;
  }

  function scheduleRebuild() {
    if (mutationTimer) window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(function () {
      collectBlocks();
      state.needsLayout = true;
    }, 80);
  }

  function animate(ts) {
    const w = viewportWidth();
    const h = viewportHeight();
    const dt = state.lastTs ? Math.min(0.05, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    if (state.mode === "follow") {
      const lerp = 1 - Math.exp(-FOLLOW_EASE * dt);
      state.x += (state.targetX - state.x) * lerp;
      state.y += (state.targetY - state.y) * lerp;
    } else {
      const speed = Math.max(28, h * 0.05);
      state.y += state.direction * speed * dt;
      state.x += (state.autoAnchorX - state.x) * Math.min(1, dt * 2.3);
      const minY = state.halfSize;
      const maxY = h - state.halfSize;
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
      renderAll();
      state.needsLayout = false;
    }
    window.requestAnimationFrame(animate);
  }

  function init() {
    createLayers();
    setInitialState();
    collectBlocks();
    updateXStyle();
    renderAll();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    const main = document.querySelector(".main");
    if (main) {
      mutationObserver = new MutationObserver(function () {
        scheduleRebuild();
      });
      mutationObserver.observe(main, { subtree: true, childList: true, characterData: true });
    }
    window.requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
