(function () {
  'use strict';

  if (window.__silkDrapeBooted) return;
  window.__silkDrapeBooted = true;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.requestAnimationFrame) return;

  var THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js';
  var HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

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

  function loadHtml2Canvas(done) {
    if (window.html2canvas) {
      done(true);
      return;
    }
    var script = document.createElement('script');
    script.src = HTML2CANVAS_CDN;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = function () { done(true); };
    script.onerror = function () {
      console.warn('[silk-drape] html2canvas failed to load.');
      done(false);
    };
    document.head.appendChild(script);
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

  function SilkDrape(THREE, withInkCapture) {
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
    this.withInkCapture = !!withInkCapture;
    this.captureBusy = false;
    this.captureTimer = null;
    this.captureReady = false;

    this.layer = document.createElement('div');
    this.layer.className = 'silk-drape-layer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'silk-drape-canvas';
    this.layer.appendChild(this.canvas);
    this.leftNail = document.createElement('span');
    this.leftNail.className = 'silk-nail left';
    this.rightNail = document.createElement('span');
    this.rightNail.className = 'silk-nail right';
    this.layer.appendChild(this.leftNail);
    this.layer.appendChild(this.rightNail);
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
    var compact = window.innerWidth < 900;

    this.cols = compact ? 26 : 34;
    this.rows = compact ? 44 : 58;
    this.clothWidth = 3.0;
    this.clothHeight = 3.8;
    this.topY = 1.5;
    this.gravity = 0.00084;
    this.damping = 0.981;
    this.iterations = compact ? 5 : 6;

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

    this.bottomLeft = this.rows * rowSize;
    this.bottomRight = this.rows * rowSize + this.cols;
    this.pinned[this.bottomLeft] = 1;
    this.pinned[this.bottomRight] = 1;

    this.tethers = [
      { idx: this.bottomLeft + 1, k: 0.09 },
      { idx: this.bottomLeft + 2, k: 0.06 },
      { idx: this.bottomRight - 1, k: 0.09 },
      { idx: this.bottomRight - 2, k: 0.06 },
      { idx: this.bottomLeft - rowSize, k: 0.05 },
      { idx: this.bottomRight - rowSize, k: 0.05 }
    ];

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
      opacity: compact ? 0.33 : 0.36,
      alphaTest: 0.02,
      roughness: 0.9,
      metalness: 0.01,
      transmission: 0.04,
      thickness: 0.34,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = 0.08;
    this.scene.add(this.mesh);
  };

  SilkDrape.prototype.setupInkOverlay = function () {
    if (!this.withInkCapture) return;
    var THREE = this.THREE;
    this.inkCanvas = document.createElement('canvas');
    this.inkCanvas.width = Math.max(2, Math.floor(this.width));
    this.inkCanvas.height = Math.max(2, Math.floor(this.height));
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
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.MultiplyBlending
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
      this.inkCanvas.width = Math.max(2, Math.floor(this.width));
      this.inkCanvas.height = Math.max(2, Math.floor(this.height));
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
    var gust = Math.min(speed * 0.16, 1.1);

    p.targetWindX = dx * 0.00008 * (1 + gust * 0.45);
    p.targetWindY = -dy * 0.00005 * (1 + gust * 0.35);
    p.targetWindZ = gust * 0.00056;

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

  SilkDrape.prototype.captureInk = function () {
    if (!this.withInkCapture || this.captureBusy || !window.html2canvas) return;
    if (!this.pageEl) return;
    this.captureBusy = true;
    var self = this;
    var previousVisibility = this.layer.style.visibility;
    this.layer.style.visibility = 'hidden';
    document.body.classList.remove('silk-ink-mode');
    var rect = this.pageEl.getBoundingClientRect();
    var scale = Math.min(window.devicePixelRatio || 1, 2);

    window.html2canvas(this.pageEl, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: scale,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollX: 0,
      scrollY: 0
    }).then(function (canvas) {
      self.updateInkMask(canvas, rect, scale);
      self.captureReady = true;
      document.body.classList.add('silk-ink-mode');
    }).catch(function () {
      console.warn('[silk-drape] capture failed.');
    }).finally(function () {
      self.captureBusy = false;
      self.layer.style.visibility = previousVisibility || '';
    });
  };

  SilkDrape.prototype.updateInkMask = function (srcCanvas, rect, scale) {
    if (!this.inkCtx || !srcCanvas || !rect) return;
    var w = this.inkCanvas.width;
    var h = this.inkCanvas.height;
    this.inkCtx.clearRect(0, 0, w, h);
    var drawX = Math.round(rect.left * (scale || 1));
    var drawY = Math.round(rect.top * (scale || 1));
    this.inkCtx.drawImage(srcCanvas, drawX, drawY);
    this.inkTexture.needsUpdate = true;
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

  SilkDrape.prototype.applyTethers = function () {
    if (!this.tethers || !this.tethers.length) return;
    var current = this.current;
    var initial = this.initial;
    for (var i = 0; i < this.tethers.length; i++) {
      var t = this.tethers[i];
      var j = t.idx * 3;
      var k = t.k;
      current[j] += (initial[j] - current[j]) * k;
      current[j + 1] += (initial[j + 1] - current[j + 1]) * k;
      current[j + 2] += (initial[j + 2] - current[j + 2]) * k;
    }
  };

  SilkDrape.prototype.simulate = function (dt, time) {
    var p = this.pointer;
    var rows = this.rows;
    var cols = this.cols;
    var rowSize = cols + 1;
    var current = this.current;
    var previous = this.previous;

    p.windX += (p.targetWindX - p.windX) * 0.08;
    p.windY += (p.targetWindY - p.windY) * 0.08;
    p.windZ += (p.targetWindZ - p.windZ) * 0.08;
    p.targetWindX *= 0.94;
    p.targetWindY *= 0.94;
    p.targetWindZ *= 0.92;

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

      var sway = Math.sin(time * 0.5 + v * 4.4 + u * 2.2) * 0.00042;
      var ripple = Math.cos(time * 0.96 + u * 4.9 - v * 5.6) * 0.00018;
      var edge = Math.abs(u - 0.5) * 2;

      current[j] = x + vx + sway * 0.45 + p.windX * 0.16;
      current[j + 1] = y + vy - this.gravity + p.windY * 0.05;
      current[j + 2] = z + vz + sway + ripple + p.windZ * 0.48 + edge * edge * 0.00023 * Math.sin(time + v * 3.2);

      if (p.active) {
        var dx = x - p.x;
        var dy = y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 0.9) {
          var influence = 1 - d2 / 0.9;
          influence *= influence;
          current[j] += p.windX * influence * 0.7;
          current[j + 1] += p.windY * influence * 0.22;
          var curlDir = dx >= 0 ? 1 : -1;
          current[j + 2] += curlDir * (Math.abs(p.windX) + Math.abs(p.windY) + Math.abs(p.windZ)) * influence * 0.25;
        }
      }
    }

    for (var ix = 0; ix <= cols; ix++) {
      var top = ix * 3;
      var uu = ix / cols;
      var hanger = Math.sin(time * 0.42 + uu * 5.5) * 0.008;
      current[top] = this.initial[top] + hanger;
      current[top + 1] = this.initial[top + 1];
      current[top + 2] = this.initial[top + 2] + Math.cos(time * 0.36 + uu * 5.2) * 0.0033;
      previous[top] = current[top];
      previous[top + 1] = current[top + 1];
      previous[top + 2] = current[top + 2];
    }

    for (var it = 0; it < this.iterations; it++) {
      this.relaxConstraints();
      this.applyTethers();
    }

    this.positionAttr.array.set(current);
    this.positionAttr.needsUpdate = true;

    this.normalsFrame++;
    if (this.normalsFrame % 2 === 0) {
      this.geometry.computeVertexNormals();
    }

  };

  SilkDrape.prototype.animate = function () {
    if (!this.hidden) {
      var dt = Math.min(this.clock.getDelta(), 0.033);
      this.simulate(dt, this.clock.elapsedTime);
      this.renderer.render(this.scene, this.camera);
    }
    this._raf = requestAnimationFrame(this.animate);
  };

  function boot() {
    if (!document.body) return;
    if (window.innerWidth < 700) return;
    if (document.body.getAttribute('data-silk-page') !== '1') return;
    loadThree(function (THREE) {
      loadHtml2Canvas(function (withInkCapture) {
        try {
          // eslint-disable-next-line no-new
          new SilkDrape(THREE, withInkCapture);
        } catch (err) {
          console.warn('[silk-drape] init failed:', err);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
