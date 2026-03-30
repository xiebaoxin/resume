import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 15;
  const LAYOUT_TRIGGER_DELTA = 0.6;
  const SIZE_SCALE = 0.5;
  const FOLLOW_DISTANCE_SCALE = 0.5;
  const ACTIVE_RADIUS_FACTOR = 2.4;
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
  let iconEl = null;
  let overlayEl = null;
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function viewportWidth() {
    return Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  }

  function viewportHeight() {
    return Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createOverlayAndIcon() {
    overlayEl = document.createElement("div");
    overlayEl.className = "pretext-global-flow-layer";
    document.body.appendChild(overlayEl);

    iconEl = document.createElement("div");
    iconEl.className = "pretext-x-icon pretext-global-x-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.innerHTML =
      '<div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '<div class="pretext-x-bar pretext-x-bar-b"></div>';
    document.body.appendChild(iconEl);
  }

  function collectSourceText(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isTextOnlyNode(node) {
    if (!node) return false;
    if (node.querySelector("img, figure, canvas, svg, video, table, iframe")) return false;
    return true;
  }

  function measureBlock(node) {
    if (!isTextOnlyNode(node)) return null;

    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const lineHeightRaw = parseFloat(style.lineHeight);
    const fontSizeRaw = parseFloat(style.fontSize);
    const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : fontSizeRaw * 1.6;
    const fontFamily = style.fontFamily || "Noto Serif SC, serif";
    const fontWeight = style.fontWeight || "400";
    const fontStyle = style.fontStyle || "normal";
    const fontSize = Math.max(12, Math.round(fontSizeRaw || 16));
    const font = fontStyle + " " + fontWeight + " " + fontSize + "px " + fontFamily;
    const sourceText = collectSourceText(node);

    if (!sourceText || rect.width < 90 || rect.height < lineHeight * 0.8) return null;

    return {
      node: node,
      sourceText: sourceText,
      rect: rect,
      font: font,
      lineHeight: Math.max(16, lineHeight),
      prepared: prepareWithSegments(sourceText, font),
      originalLineCount: Math.max(1, Math.floor(rect.height / Math.max(16, lineHeight))),
      originalPointerEvents: node.style.pointerEvents || "",
      proxy: null,
      lastLayoutX: NaN,
      lastLayoutY: NaN,
      lastLayoutSize: NaN
    };
  }

  function createBlockProxy(block) {
    const proxy = document.createElement("div");
    proxy.className = "pretext-flow-block";
    proxy.style.left = block.rect.left.toFixed(2) + "px";
    proxy.style.top = block.rect.top.toFixed(2) + "px";
    proxy.style.width = block.rect.width.toFixed(2) + "px";
    proxy.style.height = block.rect.height.toFixed(2) + "px";
    proxy.style.font = block.font;
    proxy.style.lineHeight = block.lineHeight + "px";
    overlayEl.appendChild(proxy);
    block.proxy = proxy;
  }

  function restoreSourceNode(block) {
    block.node.style.pointerEvents = block.originalPointerEvents;
  }

  function collectBlocks() {
    for (let i = 0; i < blocks.length; i += 1) {
      restoreSourceNode(blocks[i]);
    }
    blocks.length = 0;
    if (overlayEl) overlayEl.innerHTML = "";

    const nodes = document.querySelectorAll(TARGET_SELECTOR);
    for (let i = 0; i < nodes.length; i += 1) {
      const block = measureBlock(nodes[i]);
      if (!block) continue;
      createBlockProxy(block);
      blocks.push(block);
    }
  }

  function distancePointToRect(px, py, rect) {
    const dx = Math.max(rect.left - px, 0, px - (rect.left + rect.width));
    const dy = Math.max(rect.top - py, 0, py - (rect.top + rect.height));
    return Math.hypot(dx, dy);
  }

  function isBlockNearX(block) {
    const threshold = Math.max(42, state.size * ACTIVE_RADIUS_FACTOR);
    return distancePointToRect(state.x, state.y, block.rect) <= threshold;
  }

  function setInitialPosition() {
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

  function updateIconStyle() {
    if (!iconEl) return;
    iconEl.style.setProperty("--pretext-x-size", state.size.toFixed(2) + "px");
    iconEl.style.transform =
      "translate3d(" + (state.x - state.halfSize).toFixed(2) + "px, " + (state.y - state.halfSize).toFixed(2) + "px, 0)";
  }

  function pickRangeForLine(width, exLeft, exRight, minWidth) {
    const leftWidth = exLeft;
    const rightWidth = width - exRight;
    const leftOk = leftWidth >= minWidth;
    const rightOk = rightWidth >= minWidth;

    if (!leftOk && !rightOk) return { x: 0, width: width };
    if (leftOk && !rightOk) return { x: 0, width: leftWidth };
    if (!leftOk && rightOk) return { x: exRight, width: rightWidth };
    return { x: 0, width: leftWidth };
  }

  function layoutBlock(block) {
    if (!block.proxy || !block.prepared) return;

    const width = Math.max(100, block.rect.width);
    const minWidth = Math.max(52, width * 0.16);
    const safetyGap = Math.max(18, state.size * 0.52);

    const exLeft = state.x - state.halfSize - safetyGap - block.rect.left;
    const exRight = state.x + state.halfSize + safetyGap - block.rect.left;
    const exTop = state.y - state.halfSize - safetyGap - block.rect.top;
    const exBottom = state.y + state.halfSize + safetyGap - block.rect.top;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let guard = 0;
    let html = "";
    let lineNum = 0;
    const maxLines = Math.max(1, block.originalLineCount);

    while (guard < 2000 && lineNum < maxLines) {
      guard += 1;
      const lineTop = y;
      const lineBottom = y + block.lineHeight;
      const intersects = lineBottom > exTop && lineTop < exBottom;
      const range = intersects
        ? pickRangeForLine(width, exLeft, exRight, minWidth)
        : { x: 0, width: width };
      const line = layoutNextLine(block.prepared, cursor, Math.max(minWidth, range.width));
      if (line === null) break;

      html +=
        '<div class="pretext-flow-line" style="left:' +
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
      lineNum += 1;
    }

    block.node.style.pointerEvents = "none";
    block.proxy.innerHTML = html;
    block.lastLayoutX = state.x;
    block.lastLayoutY = state.y;
    block.lastLayoutSize = state.size;
  }

  function renderBlocksIfNeeded() {
    if (state.needsLayout) {
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        if (isBlockNearX(block)) {
          layoutBlock(block);
        } else if (block.proxy) {
          block.proxy.innerHTML = "";
          restoreSourceNode(block);
        }
      }
      state.needsLayout = false;
      return;
    }

    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (!isBlockNearX(b)) {
        if (b.proxy) b.proxy.innerHTML = "";
        restoreSourceNode(b);
        continue;
      }
      const moved =
        Math.abs(b.lastLayoutX - state.x) > LAYOUT_TRIGGER_DELTA ||
        Math.abs(b.lastLayoutY - state.y) > LAYOUT_TRIGGER_DELTA ||
        Math.abs(b.lastLayoutSize - state.size) > 0.5;
      if (moved) layoutBlock(b);
    }
  }

  function onMouseMove(e) {
    const w = viewportWidth();
    const h = viewportHeight();
    const d = state.followDistance;
    const diag = d / Math.sqrt(2);

    state.mode = "follow";
    state.targetX = clamp(e.clientX + diag, state.halfSize, w - state.halfSize);
    state.targetY = clamp(e.clientY - diag, state.halfSize, h - state.halfSize);
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
    setInitialPosition();
    collectBlocks();
    updateIconStyle();
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
      const speed = Math.max(30, h * 0.05);
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

    state.x = clamp(state.x, state.halfSize, w - state.halfSize);
    state.y = clamp(state.y, state.halfSize, h - state.halfSize);
    updateIconStyle();
    renderBlocksIfNeeded();
    window.requestAnimationFrame(animate);
  }

  function init() {
    createOverlayAndIcon();
    setInitialPosition();
    collectBlocks();
    updateIconStyle();
    renderBlocksIfNeeded();

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
