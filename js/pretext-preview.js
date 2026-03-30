import { prepareWithSegments, layoutWithLines } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const PREVIEW_TEXT =
    "PRETEXT AUTO LAYOUT · XIE BAOXIN · AI CODING · PRODUCT + ENGINEERING";

  const FOLLOW_STOP_DELAY_MS = 180;
  const FOLLOW_EASE = 14;

  const state = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    autoAnchorX: 0,
    direction: 1, // 1: down, -1: up
    mode: "auto", // auto | follow
    size: 0,
    halfSize: 0,
    followDistance: 0,
    lastTs: 0,
    stopTimer: 0
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

  function createLayer() {
    const layer = document.createElement("div");
    layer.className = "pretext-floating-layer";
    layer.innerHTML =
      '<div class="pretext-x-icon" aria-hidden="true">' +
      '  <div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '  <div class="pretext-x-bar pretext-x-bar-b"></div>' +
      '  <div class="pretext-x-lines"></div>' +
      "</div>";
    document.body.appendChild(layer);
    return {
      layer: layer,
      icon: layer.querySelector(".pretext-x-icon"),
      lines: layer.querySelector(".pretext-x-lines")
    };
  }

  function relayoutText(linesEl, iconSize) {
    const textWidth = iconSize * 0.72;
    const fontSize = Math.max(11, Math.round(iconSize * 0.085));
    const lineHeight = Math.max(14, Math.round(fontSize * 1.28));
    const font = fontSize + 'px "JetBrains Mono", "Noto Serif SC", serif';

    const prepared = prepareWithSegments(PREVIEW_TEXT, font);
    const laidOut = layoutWithLines(prepared, textWidth, lineHeight);

    linesEl.style.maxWidth = textWidth.toFixed(2) + "px";
    linesEl.style.font = font;
    linesEl.style.lineHeight = lineHeight + "px";
    linesEl.style.height = laidOut.height + "px";
    linesEl.innerHTML = laidOut.lines
      .slice(0, 6)
      .map(function (line) {
        return '<div class="pretext-x-line">' + line.text + "</div>";
      })
      .join("");
  }

  function setInitialPosition() {
    const w = viewportWidth();
    const h = viewportHeight();
    state.size = w / 5;
    state.halfSize = state.size / 2;
    state.followDistance = w / 5;
    state.x = w / 2;
    state.y = h / 2;
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;
    state.direction = 1;
    state.mode = "auto";
  }

  function updateIconStyle(iconEl) {
    iconEl.style.setProperty("--pretext-x-size", state.size.toFixed(2) + "px");
    iconEl.style.transform =
      "translate3d(" + (state.x - state.halfSize).toFixed(2) + "px, " + (state.y - state.halfSize).toFixed(2) + "px, 0)";
  }

  function updateResize(iconEl, linesEl) {
    const oldCenterXRatio = state.x / Math.max(1, viewportWidth());
    const oldCenterYRatio = state.y / Math.max(1, viewportHeight());

    const w = viewportWidth();
    const h = viewportHeight();
    state.size = w / 5;
    state.halfSize = state.size / 2;
    state.followDistance = w / 5;

    state.x = clamp(w * oldCenterXRatio, state.halfSize, w - state.halfSize);
    state.y = clamp(h * oldCenterYRatio, state.halfSize, h - state.halfSize);
    state.targetX = state.x;
    state.targetY = state.y;
    state.autoAnchorX = state.x;

    relayoutText(linesEl, state.size);
    updateIconStyle(iconEl);
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

    if (state.stopTimer) {
      window.clearTimeout(state.stopTimer);
    }
    state.stopTimer = window.setTimeout(function () {
      state.mode = "auto";
      state.direction = 1;
      state.autoAnchorX = state.x;
    }, FOLLOW_STOP_DELAY_MS);
  }

  function animate(iconEl, ts) {
    const h = viewportHeight();
    const w = viewportWidth();
    const dt = state.lastTs ? Math.min(0.05, (ts - state.lastTs) / 1000) : 0;
    state.lastTs = ts;

    if (state.mode === "follow") {
      const lerp = 1 - Math.exp(-FOLLOW_EASE * dt);
      state.x += (state.targetX - state.x) * lerp;
      state.y += (state.targetY - state.y) * lerp;
    } else {
      const speed = Math.max(34, h * 0.05);
      state.y += state.direction * speed * dt;
      state.x += (state.autoAnchorX - state.x) * Math.min(1, dt * 2.5);

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
    updateIconStyle(iconEl);
    window.requestAnimationFrame(function (nextTs) {
      animate(iconEl, nextTs);
    });
  }

  function init() {
    const refs = createLayer();
    setInitialPosition();
    relayoutText(refs.lines, state.size);
    updateIconStyle(refs.icon);

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener(
      "resize",
      function () {
        updateResize(refs.icon, refs.lines);
      },
      { passive: true }
    );

    window.requestAnimationFrame(function (ts) {
      animate(refs.icon, ts);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
