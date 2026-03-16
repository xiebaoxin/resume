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
    document.body.classList.add('silk-preparing');
    this.withInkCapture = true;
    this.captureBusy = false;
    this.captureTimer = null;
    this.captureReady = false;
    this.modeEnabled = false;
    this.revealProgress = 0;
    this.revealActive = false;
    this.revealStart = 0;
    this.revealDuration = this.width < 700 ? 1400 : 1200;

    this.layer = document.createElement('div');
    this.layer.className = 'silk-drape-layer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'silk-drape-canvas';
    this.layer.appendChild(this.canvas);
    this.nailLeft = document.createElement('span');
    this.nailLeft.className = 'silk-nail silk-nail-left';
    this.nailRight = document.createElement('span');
    this.nailRight.className = 'silk-nail silk-nail-right';
    this.layer.appendChild(this.nailLeft);
    this.layer.appendChild(this.nailRight);
    document.body.appendChild(this.layer);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.width >= 700,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.width < 700 ? 1.2 : 1.65));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, this.width / this.height, 0.1, 20);
    this.camera.position.set(0, 0.03, 4.95);
    this.camera.lookAt(0, -0.2, 0);
    this._nailVecL = new THREE.Vector3();
    this._nailVecR = new THREE.Vector3();

    this.setupLights();
    this.setupCloth();
    this.setupInkOverlay();
    this.bindEvents();
    this.onResize();
    if (this.withInkCapture) {
      this.scheduleCapture(520);
      this.scheduleCapture(1500);
      this.scheduleCapture(2800);
    }

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this._raf = requestAnimationFrame(this.animate);
  }

  SilkDrape.prototype.setupLights = function () {
    var THREE = this.THREE;
    var hemi = new THREE.HemisphereLight(0xffffff, 0xefe4d3, 1.04);
    this.scene.add(hemi);

    var key = new THREE.DirectionalLight(0xffffff, 0.58);
    key.position.set(0.45, 1.35, 2.7);
    this.scene.add(key);

    var fill = new THREE.DirectionalLight(0xfff3df, 0.34);
    fill.position.set(-1.45, 0.36, 2.1);
    this.scene.add(fill);

    var rim = new THREE.DirectionalLight(0xfff0d8, 0.2);
    rim.position.set(0.1, -0.6, 2.35);
    this.scene.add(rim);
  };

  SilkDrape.prototype.setupCloth = function () {
    var THREE = this.THREE;
    var compact = window.innerWidth < 960;
    var mobile = window.innerWidth < 700;

    this.cols = mobile ? 16 : (compact ? 20 : 28);
    this.rows = mobile ? 24 : (compact ? 34 : 46);
    this.clothWidth = mobile ? 2.02 : (compact ? 2.16 : 2.28);
    this.clothHeight = mobile ? 2.45 : (compact ? 2.62 : 2.78);
    this.topY = mobile ? 0.84 : 0.92;
    this.gravity = mobile ? 0.00078 : 0.00068;
    this.damping = mobile ? 0.973 : 0.978;
    this.iterations = mobile ? 3 : (compact ? 4 : 4);

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
      opacity: mobile ? 0.34 : (compact ? 0.36 : 0.38),
      alphaTest: 0.02,
      roughness: 0.48,
      metalness: 0.02,
      transmission: 0.2,
      thickness: 0.16,
      clearcoat: 0.6,
      clearcoatRoughness: 0.14,
      sheen: 0.42,
      sheenColor: new THREE.Color(0xf7f2e8),
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
    this.inkScale = mobile ? Math.min((window.devicePixelRatio || 1) * 1.9, 2.6) : Math.min((window.devicePixelRatio || 1) * 2.45, 4.2);
    this.inkCanvas = document.createElement('canvas');
    this.inkCanvas.width = Math.max(2, Math.floor(this.width * this.inkScale));
    this.inkCanvas.height = Math.max(2, Math.floor(this.height * this.inkScale));
    this.inkCtx = this.inkCanvas.getContext('2d', { willReadFrequently: true });
    this.inkSourceCanvas = document.createElement('canvas');
    this.inkSourceCanvas.width = this.inkCanvas.width;
    this.inkSourceCanvas.height = this.inkCanvas.height;
    this.inkSourceCtx = this.inkSourceCanvas.getContext('2d', { willReadFrequently: true });
    this.inkTexture = new THREE.CanvasTexture(this.inkCanvas);
    this.inkTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.inkTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.inkTexture.minFilter = THREE.LinearFilter;
    this.inkTexture.magFilter = THREE.LinearFilter;
    if (this.renderer && this.renderer.capabilities && this.renderer.capabilities.getMaxAnisotropy) {
      this.inkTexture.anisotropy = Math.min(12, this.renderer.capabilities.getMaxAnisotropy());
    }
    this.inkTexture.needsUpdate = true;

    this.inkMaterial = new THREE.MeshBasicMaterial({
      map: this.inkTexture,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    this.inkMesh = new THREE.Mesh(this.geometry, this.inkMaterial);
    this.inkMesh.position.z = this.mesh.position.z + 0.003;
    this.scene.add(this.inkMesh);
  };

  SilkDrape.prototype.bindEvents = function () {
    var self = this;
    this._onResize = function () { self.onResize(); };
    this._onPointerMove = function (e) { self.onPointerMove(e); };
    this._onLeave = function () { self.pointer.active = false; };
    this._onVisibility = function () { self.hidden = document.hidden; };
    this._onLangSwitch = function () {
      self.scheduleCapture(200);
      self.scheduleCapture(900);
    };
    this._onContentReady = function () {
      self.scheduleCapture(80);
      self.scheduleCapture(420);
    };
    this._onScroll = function () {
      self.scheduleCapture(120);
    };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerleave', this._onLeave, { passive: true });
    window.addEventListener('blur', this._onLeave);
    document.addEventListener('visibilitychange', this._onVisibility);
    if (this.withInkCapture) {
      var switchBtn = document.getElementById('langSwitch');
      if (switchBtn) switchBtn.addEventListener('click', this._onLangSwitch);
      document.addEventListener('silk-content-ready', this._onContentReady);
      window.addEventListener('scroll', this._onScroll, { passive: true });
    }
  };

  SilkDrape.prototype.onResize = function () {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.revealDuration = this.width < 700 ? 1400 : 1200;
    this.camera.fov = this.width < 700 ? 34 : 32;
    this.camera.position.set(0, this.width < 700 ? 0.02 : 0.03, this.width < 700 ? 5.08 : 4.95);
    this.camera.lookAt(0, this.width < 700 ? -0.18 : -0.2, 0);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.width < 700 ? 1.2 : 1.65));
    this.renderer.setSize(this.width, this.height, false);
    if (this.withInkCapture && this.inkCanvas && this.inkSourceCanvas) {
      var mobile = this.width < 700;
      this.inkScale = mobile ? Math.min((window.devicePixelRatio || 1) * 1.9, 2.6) : Math.min((window.devicePixelRatio || 1) * 2.45, 4.2);
      this.inkCanvas.width = Math.max(2, Math.floor(this.width * this.inkScale));
      this.inkCanvas.height = Math.max(2, Math.floor(this.height * this.inkScale));
      this.inkSourceCanvas.width = this.inkCanvas.width;
      this.inkSourceCanvas.height = this.inkCanvas.height;
      this.inkTexture.needsUpdate = true;
      this.scheduleCapture(220);
    }
    this.updateNails();
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
    var gust = Math.min(speed * 0.16, 1.05);

    p.targetWindX = dx * 0.000062 * (1 + gust * 0.35);
    p.targetWindY = -dy * 0.000036 * (1 + gust * 0.26);
    p.targetWindZ = gust * 0.00035;

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
    var color = style && style.color ? style.color : 'rgb(50,36,24)';
    if (color.indexOf('rgb') !== 0) return 'rgba(58,40,24,0.98)';
    var m = color.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return 'rgba(58,40,24,0.98)';
    var r = parseFloat(m[0]);
    var g = parseFloat(m[1]);
    var b = parseFloat(m[2]);
    var v = (r + g + b) / 3;
    if (v > 210) return 'rgba(72,52,34,0.96)';
    return 'rgba(' + Math.max(28, r * 0.66).toFixed(0) + ',' + Math.max(20, g * 0.61).toFixed(0) + ',' + Math.max(14, b * 0.56).toFixed(0) + ',0.98)';
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
          ctx.save();
          ctx.lineWidth = Math.max(0.34, ctx.lineWidth * 1.7);
          ctx.strokeStyle = 'rgba(255,248,236,0.34)';
          ctx.strokeText(line, drawX - 0.12, y - 0.12);
          ctx.restore();
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
        ctx.save();
        ctx.lineWidth = Math.max(0.34, ctx.lineWidth * 1.7);
        ctx.strokeStyle = 'rgba(255,248,236,0.34)';
        ctx.strokeText(line, drawX - 0.12, y - 0.12);
        ctx.restore();
        ctx.strokeText(line, drawX, y);
        ctx.fillText(line, drawX, y);
        y += lineHeight;
        linesDrawn++;
      }
    }
    return linesDrawn;
  };

  SilkDrape.prototype.blitRevealedInk = function () {
    if (!this.inkCtx || !this.inkCanvas || !this.inkSourceCanvas) return;
    var ctx = this.inkCtx;
    var source = this.inkSourceCanvas;
    var w = this.inkCanvas.width;
    var h = this.inkCanvas.height;
    var revealHeight = Math.max(0, Math.min(h, Math.round(h * this.revealProgress)));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (revealHeight <= 0) {
      this.inkTexture.needsUpdate = true;
      return;
    }

    ctx.drawImage(source, 0, 0, w, revealHeight, 0, 0, w, revealHeight);
    if (revealHeight < h) {
      var feather = Math.min(64, revealHeight);
      if (feather > 8) {
        var y0 = revealHeight - feather;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        var g = ctx.createLinearGradient(0, y0, 0, revealHeight);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y0, w, feather);
        ctx.restore();
      }
    }
    this.inkTexture.needsUpdate = true;
  };

  SilkDrape.prototype.renderTextInkFromDom = function () {
    if (!this.pageEl || !this.inkSourceCtx || !this.inkSourceCanvas) return false;
    var ctx = this.inkSourceCtx;
    var w = this.inkSourceCanvas.width;
    var h = this.inkSourceCanvas.height;
    var s = this.inkScale || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    var selectors = [
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

    var topOffset = this.height < 700 ? 8 : 12;
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
      lineHeight = Math.max(fontSize * 1.12, Math.min(lineHeight, fontSize * 1.24));
      var weight = style.fontWeight || '400';
      var family = style.fontFamily || 'Georgia, serif';
      ctx.font = weight + ' ' + fontSize + 'px ' + family;
      ctx.fillStyle = this.resolveInkColor(style);
      ctx.strokeStyle = 'rgba(82,58,36,0.38)';
      ctx.lineWidth = Math.max(0.32, fontSize * 0.03);
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,248,236,0.24)';
      ctx.shadowBlur = Math.max(0.2, fontSize * 0.018);
      ctx.shadowOffsetX = 0.06;
      ctx.shadowOffsetY = 0.1;
      ctx.textAlign = style.textAlign || 'left';
      var sourceAlpha = this.parsePx(style.opacity, 1);
      if ((document.body.classList.contains('silk-ink-mode') || document.body.classList.contains('silk-preparing')) && sourceAlpha < 0.2) {
        sourceAlpha = 1;
      }
      ctx.globalAlpha = Math.max(0.8, Math.min(1, sourceAlpha));

      var maxWidth = Math.max(8, rect.width);
      written += this.drawWrappedText(ctx, text, rect.left, rect.top + topOffset, maxWidth, lineHeight, ctx.textAlign);
    }

    if (written > 10) return true;
    return false;
  };

  SilkDrape.prototype.captureInk = function () {
    if (!this.withInkCapture || this.captureBusy) return;
    if (!this.pageEl) return;
    this.captureBusy = true;
    var self = this;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try {
          var ok = self.renderTextInkFromDom();
          if (ok) {
            self.captureReady = true;
            if (!self.modeEnabled) {
              self.modeEnabled = true;
              self.revealProgress = 0;
              self.revealStart = performance.now();
              self.revealActive = true;
              document.body.classList.add('silk-ink-mode');
              document.body.classList.add('silk-preparing');
            } else {
              if (!self.revealActive) {
                self.revealProgress = 1;
                document.body.classList.remove('silk-preparing');
              }
            }
            self.blitRevealedInk();
          } else {
            self.scheduleCapture(520);
          }
        } catch (err) {
          console.warn('[silk-drape] text ink render failed:', err);
          self.scheduleCapture(800);
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

    p.windX += (p.targetWindX - p.windX) * 0.068;
    p.windY += (p.targetWindY - p.windY) * 0.068;
    p.windZ += (p.targetWindZ - p.windZ) * 0.066;
    p.targetWindX *= 0.946;
    p.targetWindY *= 0.946;
    p.targetWindZ *= 0.93;

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

      var sway = Math.sin(time * 0.4 + v * 3.2 + u * 1.9) * 0.00028;
      var ripple = Math.cos(time * 0.76 + u * 3.7 - v * 4.1) * 0.00011;
      var edge = Math.abs(u - 0.5) * 2;

      current[j] = x + vx + sway * 0.36 + p.windX * 0.09;
      current[j + 1] = y + vy - this.gravity + p.windY * 0.034;
      current[j + 2] = z + vz + sway + ripple + p.windZ * 0.29 + edge * edge * 0.00015 * Math.sin(time + v * 2.7);

      if (p.active) {
        var dx = x - p.x;
        var dy = y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 0.6) {
          var influence = 1 - d2 / 0.6;
          influence *= influence;
          current[j] += p.windX * influence * 0.28;
          current[j + 1] += p.windY * influence * 0.084;
          var curlDir = dx >= 0 ? 1 : -1;
          current[j + 2] += curlDir * (Math.abs(p.windX) + Math.abs(p.windY) + Math.abs(p.windZ)) * influence * 0.068;
        }
      }
    }

    for (var ix = 0; ix <= cols; ix++) {
      var top = ix * 3;
      var uu = ix / cols;
      var hanger = Math.sin(time * 0.4 + uu * 5.2) * 0.0042;
      current[top] = this.initial[top] + hanger;
      current[top + 1] = this.initial[top + 1];
      current[top + 2] = this.initial[top + 2] + Math.cos(time * 0.34 + uu * 5.0) * 0.0022;
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

  SilkDrape.prototype.updateNails = function () {
    if (!this.nailLeft || !this.nailRight || !this.current || !this.mesh || !this.camera) return;
    var left = 0;
    var right = this.cols;
    var l3 = left * 3;
    var r3 = right * 3;

    this.mesh.updateMatrixWorld(true);
    this._nailVecL.set(this.current[l3], this.current[l3 + 1], this.current[l3 + 2]);
    this._nailVecR.set(this.current[r3], this.current[r3 + 1], this.current[r3 + 2]);
    this.mesh.localToWorld(this._nailVecL);
    this.mesh.localToWorld(this._nailVecR);
    this._nailVecL.project(this.camera);
    this._nailVecR.project(this.camera);

    var lx = (this._nailVecL.x * 0.5 + 0.5) * this.width;
    var ly = (-this._nailVecL.y * 0.5 + 0.5) * this.height;
    var rx = (this._nailVecR.x * 0.5 + 0.5) * this.width;
    var ry = (-this._nailVecR.y * 0.5 + 0.5) * this.height;

    this.nailLeft.style.left = lx.toFixed(2) + 'px';
    this.nailLeft.style.top = ly.toFixed(2) + 'px';
    this.nailRight.style.left = rx.toFixed(2) + 'px';
    this.nailRight.style.top = ry.toFixed(2) + 'px';
    this.nailLeft.style.opacity = '1';
    this.nailRight.style.opacity = '1';
  };

  SilkDrape.prototype.updateReveal = function () {
    if (!this.revealActive) return;
    var elapsed = performance.now() - this.revealStart;
    var next = Math.max(0, Math.min(1, elapsed / this.revealDuration));
    if (next > this.revealProgress + 0.004 || next >= 1) {
      this.revealProgress = next;
      this.blitRevealedInk();
    }
    if (next >= 1) {
      this.revealActive = false;
      document.body.classList.remove('silk-preparing');
    }
  };

  SilkDrape.prototype.animate = function () {
    if (!this.hidden) {
      var dt = Math.min(this.clock.getDelta(), 0.033);
      this.simulate(dt, this.clock.elapsedTime);
      this.updateNails();
      this.updateReveal();
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
        document.body.classList.remove('silk-preparing');
        document.body.classList.remove('silk-ink-mode');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
