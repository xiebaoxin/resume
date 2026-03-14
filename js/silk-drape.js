(function () {
  'use strict';

  if (window.__silkDrapeBooted) return;
  window.__silkDrapeBooted = true;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.requestAnimationFrame) return;

  var THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';

  function loadThree(done) {
    if (window.__silkThreeModule) {
      done(window.__silkThreeModule);
      return;
    }
    import(THREE_CDN).then(function (mod) {
      window.__silkThreeModule = mod;
      done(mod);
    }).catch(function () {
      console.warn('[silk-drape] three.js failed to load.');
    });
  }

  function createClothTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');

    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(0, 0, c.width, c.height);

    for (var x = 0; x < c.width; x += 8) {
      ctx.fillStyle = 'rgba(232,228,220,0.12)';
      ctx.fillRect(x, 0, 1, c.height);
    }
    for (var y = 0; y < c.height; y += 8) {
      ctx.fillStyle = 'rgba(222,218,210,0.1)';
      ctx.fillRect(0, y, c.width, 1);
    }

    for (var i = 0; i < 1200; i++) {
      var a = 0.015 + Math.random() * 0.05;
      var s = 1 + Math.random() * 2;
      ctx.fillStyle = 'rgba(210,206,198,' + a.toFixed(3) + ')';
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, s, s);
    }

    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 12);
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  function SilkDrape(THREE) {
    this.THREE = THREE;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.normalsFrame = 0;
    this.hidden = false;

    this.pointer = {
      active: false,
      x: 0,
      y: 0,
      lastX: 0,
      lastY: 0,
      lastTs: 0,
      windX: 0,
      windY: 0,
      windZ: 0,
      targetWindX: 0,
      targetWindY: 0,
      targetWindZ: 0
    };

    this.pageEl = document.querySelector('.page');
    if (this.pageEl) this.pageEl.style.transform = 'none';
    this.withInkCapture = true;
    this.captureBusy = false;
    this.captureTimer = null;
    this.captureReady = false;
    this.inkMotion = { x: 0, y: 0, rz: 0, rx: 0 };

    this.layer = document.createElement('div');
    this.layer.className = 'silk-drape-layer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'silk-drape-canvas';
    this.layer.appendChild(this.canvas);
    document.body.appendChild(this.layer);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(27, this.width / this.height, 0.1, 20);
    this.camera.position.set(0, 0.08, 4.7);
    this.camera.lookAt(0, -0.15, 0);

    this.setupLights();
    this.setupCloth();
    this.setupInkOverlay();
    this.bindEvents();
    this.onResize();
    if (this.withInkCapture) {
      this.scheduleCapture(420);
      this.scheduleCapture(1200);
      this.scheduleCapture(2300);
    }

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this._raf = requestAnimationFrame(this.animate);
  }

  SilkDrape.prototype.setupLights = function () {
    var THREE = this.THREE;
    var hemi = new THREE.HemisphereLight(0xffffff, 0xe7ddd0, 0.92);
    this.scene.add(hemi);

    var key = new THREE.DirectionalLight(0xffffff, 0.42);
    key.position.set(0.6, 1.2, 2.4);
    this.scene.add(key);

    var fill = new THREE.DirectionalLight(0xfff3df, 0.25);
    fill.position.set(-1.4, 0.3, 2.0);
    this.scene.add(fill);
  };

  SilkDrape.prototype.setupCloth = function () {
    var THREE = this.THREE;
    var compact = window.innerWidth < 960;
    var mobile = window.innerWidth < 700;

    this.cols = mobile ? 18 : (compact ? 24 : 34);
    this.rows = mobile ? 30 : (compact ? 42 : 58);
    this.clothWidth = 3.0;
    this.clothHeight = 3.8;
    this.topY = 1.5;
    this.gravity = mobile ? 0.00118 : 0.00106;
    this.damping = mobile ? 0.968 : 0.973;
    this.iterations = mobile ? 3 : (compact ? 5 : 6);

    this.geometry = new THREE.PlaneGeometry(this.clothWidth, this.clothHeight, this.cols, this.rows);
    this.positionAttr = this.geometry.attributes.position;

    var pointCount = this.positionAttr.count;
    this.initial = new Float32Array(pointCount * 3);
    this.current = new Float32Array(pointCount * 3);
    this.previous = new Float32Array(pointCount * 3);
    this.pinned = new Uint8Array(pointCount);

    this.aIdx = [];
    this.bIdx = [];
    this.rest = [];

    var rowSize = this.cols + 1;
    var i;
    var x;
    var y;
    for (y = 0; y <= this.rows; y++) {
      for (x = 0; x <= this.cols; x++) {
        i = y * rowSize + x;
        var u = x / this.cols;
        var v = y / this.rows;
        var px = (u - 0.5) * this.clothWidth;
        var py = this.topY - v * this.clothHeight;
        var pz = Math.sin(u * Math.PI * 2) * 0.014 * (1 - v);

        var j = i * 3;
        this.initial[j] = px;
        this.initial[j + 1] = py;
        this.initial[j + 2] = pz;
        this.current[j] = px;
        this.current[j + 1] = py;
        this.current[j + 2] = pz;
        this.previous[j] = px;
        this.previous[j + 1] = py;
        this.previous[j + 2] = pz;

        this.positionAttr.array[j] = px;
        this.positionAttr.array[j + 1] = py;
        this.positionAttr.array[j + 2] = pz;

        if (y === 0) this.pinned[i] = 1;
      }
    }

    var self = this;
    function addConstraint(ia, ib) {
      var a3 = ia * 3;
      var b3 = ib * 3;
      var dx = self.initial[b3] - self.initial[a3];
      var dy = self.initial[b3 + 1] - self.initial[a3 + 1];
      var dz = self.initial[b3 + 2] - self.initial[a3 + 2];
      self.aIdx.push(ia);
      self.bIdx.push(ib);
      self.rest.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }

    for (y = 0; y <= this.rows; y++) {
      for (x = 0; x <= this.cols; x++) {
        i = y * rowSize + x;
        if (x < this.cols) addConstraint(i, i + 1);
        if (y < this.rows) addConstraint(i, i + rowSize);
        if (x < this.cols && y < this.rows) addConstraint(i, i + rowSize + 1);
        if (x > 0 && y < this.rows) addConstraint(i, i + rowSize - 1);
      }
    }

    var weaveTex = createClothTexture(THREE);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: weaveTex,
      alphaMap: weaveTex,
      transparent: true,
      opacity: mobile ? 0.34 : (compact ? 0.35 : 0.38),
      alphaTest: 0.02,
      roughness: 0.9,
      metalness: 0.01,
      transmission: 0.025,
      thickness: 0.4,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = 0.08;
    this.scene.add(this.mesh);
  };

  SilkDrape.prototype.setupInkOverlay = function () {
    if (!this.withInkCapture) return;
    var THREE = this.THREE;
    var mobile = this.width < 700;
    this.inkScale = mobile ? Math.min((window.devicePixelRatio || 1) * 1.2, 1.6) : Math.min((window.devicePixelRatio || 1) * 1.4, 2.3);
    this.inkCanvas = document.createElement('canvas');
    this.inkCanvas.width = Math.max(2, Math.floor(this.width * this.inkScale));
    this.inkCanvas.height = Math.max(2, Math.floor(this.height * this.inkScale));
    this.inkCtx = this.inkCanvas.getContext('2d', { willReadFrequently: true });
    this.inkTexture = new THREE.CanvasTexture(this.inkCanvas);
    this.inkTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.inkTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.inkTexture.minFilter = THREE.LinearFilter;
    this.inkTexture.magFilter = THREE.LinearFilter;
    this.inkTexture.needsUpdate = true;

    this.inkMaterial = new THREE.MeshBasicMaterial({
      map: this.inkTexture,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    this.inkGeometry = new THREE.PlaneGeometry(this.clothWidth, this.clothHeight, 1, 1);
    this.inkMesh = new THREE.Mesh(this.inkGeometry, this.inkMaterial);
    this.inkMesh.position.z = this.mesh.position.z + 0.003;
    this.scene.add(this.inkMesh);
  };

  SilkDrape.prototype.bindEvents = function () {
    var self = this;
    this._onResize = function () { self.onResize(); };
    this._onPointerMove = function (e) { self.onPointerMove(e); };
    this._onLeave = function () { self.pointer.active = false; };
    this._onVisibility = function () { self.hidden = document.hidden; };
    this._onScroll = function () { self.scheduleCapture(140); };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerleave', this._onLeave, { passive: true });
    window.addEventListener('blur', this._onLeave);
    document.addEventListener('visibilitychange', this._onVisibility);
    if (this.withInkCapture) {
      window.addEventListener('scroll', this._onScroll, { passive: true });
      if (this.pageEl && window.MutationObserver) {
        this._observer = new MutationObserver(function () {
          self.scheduleCapture(180);
        });
        this._observer.observe(this.pageEl, { subtree: true, childList: true, characterData: true });
      }
    }
  };

  SilkDrape.prototype.onResize = function () {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    if (this.withInkCapture && this.inkCanvas) {
      var mobile = this.width < 700;
      this.inkScale = mobile ? Math.min((window.devicePixelRatio || 1) * 1.2, 1.6) : Math.min((window.devicePixelRatio || 1) * 1.4, 2.3);
      this.inkCanvas.width = Math.max(2, Math.floor(this.width * this.inkScale));
      this.inkCanvas.height = Math.max(2, Math.floor(this.height * this.inkScale));
      this.inkTexture.needsUpdate = true;
      this.scheduleCapture(220);
    }
  };

  SilkDrape.prototype.onPointerMove = function (e) {
    var p = this.pointer;
    var ts = performance.now();
    if (!p.lastTs) {
      p.lastTs = ts;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
    }
    var dt = Math.max(16, ts - p.lastTs);
    var dx = e.clientX - p.lastX;
    var dy = e.clientY - p.lastY;
    var speed = Math.hypot(dx, dy) / dt;
    var gust = Math.min(speed * 0.1, 0.7);

    p.targetWindX = dx * 0.000042 * (1 + gust * 0.28);
    p.targetWindY = -dy * 0.000026 * (1 + gust * 0.2);
    p.targetWindZ = gust * 0.00024;

    p.x = ((e.clientX / this.width) - 0.5) * this.clothWidth * 1.1;
    p.y = (0.5 - e.clientY / this.height) * this.clothHeight * 1.05 + 0.05;
    p.active = true;
    p.lastTs = ts;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
  };

  SilkDrape.prototype.scheduleCapture = function (delayMs) {
    if (!this.withInkCapture || this.hidden) return;
    var self = this;
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
    }
    this.captureTimer = setTimeout(function () {
      self.captureTimer = null;
      self.captureInk();
    }, Math.max(40, delayMs || 120));
  };

  SilkDrape.prototype.parsePx = function (value, fallback) {
    var n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  SilkDrape.prototype.resolveInkColor = function (style) {
    var color = style && style.color ? style.color : 'rgb(28,22,16)';
    if (color.indexOf('rgb') !== 0) return 'rgba(30,24,18,0.98)';
    var m = color.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return 'rgba(30,24,18,0.98)';
    var r = parseFloat(m[0]);
    var g = parseFloat(m[1]);
    var b = parseFloat(m[2]);
    var v = (r + g + b) / 3;
    if (v > 210) return 'rgba(48,40,32,0.92)';
    return 'rgba(' + Math.max(16, r * 0.46).toFixed(0) + ',' + Math.max(14, g * 0.43).toFixed(0) + ',' + Math.max(12, b * 0.4).toFixed(0) + ',0.98)';
  };

  SilkDrape.prototype.drawWrappedText = function (ctx, text, x, y, maxWidth, lineHeight, textAlign) {
    if (!text) return 0;
    var linesDrawn = 0;
    var paragraphs = text.split('\n');
    var drawX = x;
    if (textAlign === 'center') drawX = x + maxWidth * 0.5;
    if (textAlign === 'right' || textAlign === 'end') drawX = x + maxWidth;

    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p].trim();
      if (!para) {
        y += lineHeight;
        linesDrawn++;
        continue;
      }
      var line = '';
      for (var i = 0; i < para.length; i++) {
        var ch = para.charAt(i);
        var test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.strokeText(line, drawX, y);
          ctx.fillText(line, drawX, y);
          y += lineHeight;
          linesDrawn++;
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.strokeText(line, drawX, y);
        ctx.fillText(line, drawX, y);
        y += lineHeight;
        linesDrawn++;
      }
    }
    return linesDrawn;
  };

  SilkDrape.prototype.renderTextInkFromDom = function () {
    if (!this.pageEl || !this.inkCtx) return false;
    var ctx = this.inkCtx;
    var w = this.inkCanvas.width;
    var h = this.inkCanvas.height;
    var s = this.inkScale || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    var selectors = [
      '.header-actions',
      '.name',
      '.basics-line',
      '.target-role',
      '.tagline',
      '.contact',
      '.section-title',
      '.highlight .company',
      '.highlight .period',
      '.highlight .role',
      '.products',
      '.metrics',
      '.chart-caption',
      '.ai-note',
      '.exp-item-company',
      '.exp-item-period',
      '.exp-item-role',
      '.exp-item-summary',
      '.skills-lead',
      '.skills-tech',
      '.skills-domain',
      '.education-content',
      '.attachments-links',
      '.resume-footer .footer-note'
    ].join(',');

    var nodes = this.pageEl.querySelectorAll(selectors);
    var written = 0;
    for (var ni = 0; ni < nodes.length; ni++) {
      var el = nodes[ni];
      if (!el || !el.getBoundingClientRect) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      if (rect.bottom < 0 || rect.top > this.height) continue;

      var style = window.getComputedStyle(el);
      if (!style || style.visibility === 'hidden' || style.display === 'none') continue;

      var text = (el.innerText || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (!text) continue;

      var fontSize = this.parsePx(style.fontSize, 14);
      var lineHeight = this.parsePx(style.lineHeight, fontSize * 1.45);
      var weight = style.fontWeight || '400';
      var family = style.fontFamily || 'Georgia, serif';
      ctx.font = weight + ' ' + fontSize + 'px ' + family;
      ctx.fillStyle = this.resolveInkColor(style);
      ctx.strokeStyle = 'rgba(20,16,12,0.22)';
      ctx.lineWidth = Math.max(0.35, fontSize * 0.035);
      ctx.lineJoin = 'round';
      ctx.textAlign = style.textAlign || 'left';
      ctx.globalAlpha = Math.max(0.72, Math.min(1, this.parsePx(style.opacity, 1)));

      var maxWidth = Math.max(8, rect.width);
      written += this.drawWrappedText(ctx, text, rect.left, rect.top, maxWidth, lineHeight, ctx.textAlign);
    }

    if (written > 10) {
      this.inkTexture.needsUpdate = true;
      return true;
    }
    return false;
  };

  SilkDrape.prototype.captureInk = function () {
    if (!this.withInkCapture || this.captureBusy) return;
    if (!this.pageEl) return;
    this.captureBusy = true;
    var self = this;
    var hadInkMode = document.body.classList.contains('silk-ink-mode');
    if (hadInkMode) {
      document.body.classList.remove('silk-ink-mode');
      void this.pageEl.offsetHeight;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try {
          var ok = self.renderTextInkFromDom();
          if (ok) {
            self.captureReady = true;
            document.body.classList.add('silk-ink-mode');
          } else {
            self.scheduleCapture(520);
            if (hadInkMode) document.body.classList.add('silk-ink-mode');
          }
        } catch (err) {
          console.warn('[silk-drape] text ink render failed:', err);
          self.scheduleCapture(800);
          if (hadInkMode) document.body.classList.add('silk-ink-mode');
        }
        self.captureBusy = false;
      });
    });
  };

  SilkDrape.prototype.relaxConstraints = function () {
    var aIdx = this.aIdx;
    var bIdx = this.bIdx;
    var rest = this.rest;
    var current = this.current;
    var pinned = this.pinned;

    for (var i = 0; i < aIdx.length; i++) {
      var ai = aIdx[i];
      var bi = bIdx[i];
      var a3 = ai * 3;
      var b3 = bi * 3;

      var dx = current[b3] - current[a3];
      var dy = current[b3 + 1] - current[a3 + 1];
      var dz = current[b3 + 2] - current[a3 + 2];
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-7;
      var diff = (dist - rest[i]) / dist;
      var offX = dx * diff * 0.5;
      var offY = dy * diff * 0.5;
      var offZ = dz * diff * 0.5;

      if (!pinned[ai]) {
        current[a3] += offX;
        current[a3 + 1] += offY;
        current[a3 + 2] += offZ;
      }
      if (!pinned[bi]) {
        current[b3] -= offX;
        current[b3 + 1] -= offY;
        current[b3 + 2] -= offZ;
      }
    }
  };


  SilkDrape.prototype.simulate = function (dt, time) {
    var p = this.pointer;
    var rows = this.rows;
    var cols = this.cols;
    var rowSize = cols + 1;
    var current = this.current;
    var previous = this.previous;

    p.windX += (p.targetWindX - p.windX) * 0.055;
    p.windY += (p.targetWindY - p.windY) * 0.055;
    p.windZ += (p.targetWindZ - p.windZ) * 0.055;
    p.targetWindX *= 0.955;
    p.targetWindY *= 0.955;
    p.targetWindZ *= 0.94;

    var i;
    for (i = rowSize; i < rowSize * (rows + 1); i++) {
      if (this.pinned[i]) continue;
      var j = i * 3;

      var x = current[j];
      var y = current[j + 1];
      var z = current[j + 2];
      var px = previous[j];
      var py = previous[j + 1];
      var pz = previous[j + 2];

      var vx = (x - px) * this.damping;
      var vy = (y - py) * this.damping;
      var vz = (z - pz) * this.damping;

      previous[j] = x;
      previous[j + 1] = y;
      previous[j + 2] = z;

      var cx = i % rowSize;
      var cy = (i - cx) / rowSize;
      var u = cx / cols;
      var v = cy / rows;

      var sway = Math.sin(time * 0.42 + v * 4.2 + u * 2.0) * 0.0003;
      var ripple = Math.cos(time * 0.82 + u * 4.6 - v * 5.2) * 0.00011;
      var edge = Math.abs(u - 0.5) * 2;

      current[j] = x + vx + sway * 0.34 + p.windX * 0.1;
      current[j + 1] = y + vy - this.gravity + p.windY * 0.035;
      current[j + 2] = z + vz + sway + ripple + p.windZ * 0.33 + edge * edge * 0.00018 * Math.sin(time + v * 3.1);

      if (p.active) {
        var dx = x - p.x;
        var dy = y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 0.72) {
          var influence = 1 - d2 / 0.72;
          influence *= influence;
          current[j] += p.windX * influence * 0.42;
          current[j + 1] += p.windY * influence * 0.12;
          var curlDir = dx >= 0 ? 1 : -1;
          current[j + 2] += curlDir * (Math.abs(p.windX) + Math.abs(p.windY) + Math.abs(p.windZ)) * influence * 0.12;
        }
      }
    }

    for (var ix = 0; ix <= cols; ix++) {
      var top = ix * 3;
      var uu = ix / cols;
      var hanger = Math.sin(time * 0.34 + uu * 5.2) * 0.0056;
      current[top] = this.initial[top] + hanger;
      current[top + 1] = this.initial[top + 1];
      current[top + 2] = this.initial[top + 2] + Math.cos(time * 0.3 + uu * 5.0) * 0.0023;
      previous[top] = current[top];
      previous[top + 1] = current[top + 1];
      previous[top + 2] = current[top + 2];
    }

    for (var it = 0; it < this.iterations; it++) {
      this.relaxConstraints();
    }

    this.positionAttr.array.set(current);
    this.positionAttr.needsUpdate = true;

    this.normalsFrame++;
    if (this.normalsFrame % 2 === 0) {
      this.geometry.computeVertexNormals();
    }

  };

  SilkDrape.prototype.updateInkPose = function () {
    if (!this.inkMesh) return;
    var p = this.pointer;
    var tx = Math.max(-0.025, Math.min(0.025, p.windX * 8));
    var ty = Math.max(-0.02, Math.min(0.02, p.windY * 8));
    var trz = Math.max(-0.02, Math.min(0.02, p.windX * 0.28));
    var trx = Math.max(-0.016, Math.min(0.016, p.windY * 0.24));

    this.inkMotion.x += (tx - this.inkMotion.x) * 0.08;
    this.inkMotion.y += (ty - this.inkMotion.y) * 0.08;
    this.inkMotion.rz += (trz - this.inkMotion.rz) * 0.08;
    this.inkMotion.rx += (trx - this.inkMotion.rx) * 0.08;

    this.inkMesh.position.x = this.inkMotion.x;
    this.inkMesh.position.y = this.inkMotion.y;
    this.inkMesh.position.z = this.mesh.position.z + 0.003;
    this.inkMesh.rotation.z = this.inkMotion.rz;
    this.inkMesh.rotation.x = this.inkMotion.rx;
  };

  SilkDrape.prototype.animate = function () {
    if (!this.hidden) {
      var dt = Math.min(this.clock.getDelta(), 0.033);
      this.simulate(dt, this.clock.elapsedTime);
      this.updateInkPose();
      this.renderer.render(this.scene, this.camera);
    }
    this._raf = requestAnimationFrame(this.animate);
  };

  function boot() {
    if (!document.body) return;
    if (document.body.getAttribute('data-silk-page') !== '1') return;
    loadThree(function (THREE) {
      try {
        // eslint-disable-next-line no-new
        new SilkDrape(THREE);
      } catch (err) {
        console.warn('[silk-drape] init failed:', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
