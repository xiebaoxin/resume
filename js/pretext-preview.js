import { prepareWithSegments, layoutNextLine } from "https://esm.sh/@chenglou/pretext@0.0.3";

(function () {
  const FOLLOW_STOP_DELAY_MS = 220;
  const FOLLOW_EASE = 14;
  const LAYOUT_TRIGGER_DELTA = 0.6;

  const renderer = {
    pageEl: null,
    mainEl: null,
    overlayEl: null,
    sourceText: "",
    prepared: null,
    font: "",
    fontSize: 0,
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
    direction: 1, // 1: down, -1: up
    mode: "auto", // auto | follow
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

  function createFloatingLayer() {
    const layer = document.createElement("div");
    layer.className = "pretext-floating-layer";
    layer.innerHTML =
      '<div class="pretext-x-icon" aria-hidden="true">' +
      '  <div class="pretext-x-bar pretext-x-bar-a"></div>' +
      '  <div class="pretext-x-bar pretext-x-bar-b"></div>' +
      "</div>";
    document.body.appendChild(layer);
    return {
      layer: layer,
      icon: layer.querySelector(".pretext-x-icon")
    };
  }

  function ensureRenderer() {
    renderer.pageEl = document.querySelector(".page");
    renderer.mainEl = document.querySelector(".main");
    if (!renderer.pageEl || !renderer.mainEl) return false;
    renderer.mainEl.classList.add("pretext-source-mask");

    const overlay = document.createElement("div");
    overlay.className = "pretext-auto-article";
    renderer.pageEl.appendChild(overlay);
    renderer.overlayEl = overlay;
    return true;
  }

  function collectSourceText() {
    const rawText = (renderer.mainEl.innerText || "").replace(/\s+/g, " ").trim();
    return rawText;
  }

  function prepareTextLayout() {
    if (!renderer.mainEl) return;

    const mainWidth = Math.max(240, renderer.mainEl.clientWidth);
    const fontSize = Math.max(16, Math.min(21, mainWidth * 0.024));
    const lineHeight = Math.round(fontSize * 1.55);
    const font = Math.round(fontSize) + 'px "Noto Serif SC", "JetBrains Mono", serif';
    const sourceText = collectSourceText();
    const fontChanged = font !== renderer.font;

    renderer.fontSize = Math.round(fontSize);
    renderer.lineHeight = lineHeight;
    renderer.font = font;

    if (!sourceText) {
      renderer.sourceText = "";
      renderer.prepared = null;
      return;
    }

    if (sourceText !== renderer.sourceText || fontChanged) {
      renderer.sourceText = sourceText;
      renderer.prepared = prepareWithSegments(sourceText, font);
    }
    state.needsLayout = true;
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
    state.needsLayout = true;
  }

  function updateIconStyle(iconEl) {
    iconEl.style.setProperty("--pretext-x-size", state.size.toFixed(2) + "px");
    iconEl.style.transform =
      "translate3d(" + (state.x - state.halfSize).toFixed(2) + "px, " + (state.y - state.halfSize).toFixed(2) + "px, 0)";
  }

  function updateResize(iconEl) {
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
    updateIconStyle(iconEl);
    prepareTextLayout();
    state.needsLayout = true;
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

    if (state.stopTimer) {
      window.clearTimeout(state.stopTimer);
    }
    state.stopTimer = window.setTimeout(function () {
      state.mode = "auto";
      state.direction = 1;
      state.autoAnchorX = state.x;
      state.needsLayout = true;
    }, FOLLOW_STOP_DELAY_MS);
  }

  function renderAutoLayout() {
    if (!renderer.prepared || !renderer.overlayEl || !renderer.mainEl || !renderer.pageEl) return;

    const mainEl = renderer.mainEl;
    const overlayEl = renderer.overlayEl;
    const mainRect = mainEl.getBoundingClientRect();

    const offsetLeft = mainEl.offsetLeft;
    const offsetTop = mainEl.offsetTop;
    const contentWidth = Math.max(220, mainEl.clientWidth);
    const maxHeight = Math.max(mainEl.scrollHeight, window.innerHeight * 1.2);
    const lineHeight = renderer.lineHeight || 30;
    const minWidth = Math.max(110, contentWidth * 0.22);
    const safetyGap = Math.max(10, state.size * 0.08);

    const xInMain = state.x - mainRect.left;
    const yInMain = state.y - mainRect.top;
    const exLeft = xInMain - state.halfSize - safetyGap;
    const exRight = xInMain + state.halfSize + safetyGap;
    const exTop = yInMain - state.halfSize - safetyGap;
    const exBottom = yInMain + state.halfSize + safetyGap;

    let cursor = { segmentIndex: 0, graphemeIndex: 0 };
    let y = 0;
    let guard = 0;
    let html = "";

    while (guard < 5000 && y < maxHeight + lineHeight) {
      guard += 1;
      const lineTop = y;
      const lineBottom = y + lineHeight;
      const intersectsX = lineBottom > exTop && lineTop < exBottom;

      let segments = [{ x: 0, width: contentWidth }];

      if (intersectsX) {
        const leftWidth = exLeft;
        const rightX = exRight;
        const rightWidth = contentWidth - rightX;
        segments = [];

        if (leftWidth >= minWidth) {
          segments.push({ x: 0, width: leftWidth });
        }
        if (rightWidth >= minWidth) {
          segments.push({ x: rightX, width: rightWidth });
        }
        if (segments.length === 0) {
          y += lineHeight;
          continue;
        }
      }

      for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i];
        const nextLine = layoutNextLine(renderer.prepared, cursor, Math.max(minWidth, seg.width));
        if (!nextLine) {
          guard = 5001;
          break;
        }
        html +=
          '<div class="pretext-article-line" style="left:' +
          seg.x.toFixed(2) +
          "px;top:" +
          y.toFixed(2) +
          "px;max-width:" +
          seg.width.toFixed(2) +
          'px;">' +
          escapeHtml(nextLine.text) +
          "</div>";
        cursor = nextLine.end;
      }
      y += lineHeight;
    }

    overlayEl.style.left = offsetLeft.toFixed(2) + "px";
    overlayEl.style.top = offsetTop.toFixed(2) + "px";
    overlayEl.style.width = contentWidth.toFixed(2) + "px";
    overlayEl.style.height = Math.max(maxHeight, y + lineHeight).toFixed(2) + "px";
    overlayEl.style.font = renderer.font;
    overlayEl.style.lineHeight = lineHeight + "px";
    overlayEl.innerHTML = html;

    renderer.lastLayoutX = state.x;
    renderer.lastLayoutY = state.y;
    renderer.lastLayoutSize = state.size;
    state.needsLayout = false;
  }

  function maybeRenderAutoLayout() {
    if (!renderer.overlayEl || !renderer.prepared) return;
    if (state.needsLayout) {
      renderAutoLayout();
      return;
    }
    const moved =
      Math.abs(renderer.lastLayoutX - state.x) > LAYOUT_TRIGGER_DELTA ||
      Math.abs(renderer.lastLayoutY - state.y) > LAYOUT_TRIGGER_DELTA ||
      Math.abs(renderer.lastLayoutSize - state.size) > 0.5;
    if (moved) {
      renderAutoLayout();
    }
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
    maybeRenderAutoLayout();
    window.requestAnimationFrame(function (nextTs) {
      animate(iconEl, nextTs);
    });
  }

  function init() {
    const refs = createFloatingLayer();
    if (!ensureRenderer()) return;

    setInitialPosition();
    prepareTextLayout();
    updateIconStyle(refs.icon);
    renderAutoLayout();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener(
      "resize",
      function () {
        updateResize(refs.icon);
      },
      { passive: true }
    );

    const observer = new MutationObserver(function () {
      if (renderer.mutationDebounce) {
        window.clearTimeout(renderer.mutationDebounce);
      }
      renderer.mutationDebounce = window.setTimeout(function () {
        prepareTextLayout();
        state.needsLayout = true;
      }, 40);
    });
    observer.observe(renderer.mainEl, { subtree: true, childList: true, characterData: true });

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
