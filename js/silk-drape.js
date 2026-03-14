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
    this.bindEvents();
    this.onResize();

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
    this.gravity = 0.00058;
    this.damping = 0.986;
    this.iterations = compact ? 3 : 4;

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
      opacity: compact ? 0.25 : 0.28,
      alphaTest: 0.02,
      roughness: 0.86,
      metalness: 0.01,
      transmission: 0.06,
      thickness: 0.22,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = 0.08;
    this.scene.add(this.mesh);
  };

  SilkDrape.prototype.bindEvents = function () {
    var self = this;
    this._onResize = function () { self.onResize(); };
    this._onPointerMove = function (e) { self.onPointerMove(e); };
    this._onLeave = function () { self.pointer.active = false; };
    this._onVisibility = function () { self.hidden = document.hidden; };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerleave', this._onLeave, { passive: true });
    window.addEventListener('blur', this._onLeave);
    document.addEventListener('visibilitychange', this._onVisibility);
  };

  SilkDrape.prototype.onResize = function () {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
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
    var gust = Math.min(speed * 0.35, 2.6);

    p.targetWindX = dx * 0.00023 * (1 + gust);
    p.targetWindY = -dy * 0.00014 * (1 + gust * 0.6);
    p.targetWindZ = gust * 0.0019;

    p.x = ((e.clientX / this.width) - 0.5) * this.clothWidth * 1.1;
    p.y = (0.5 - e.clientY / this.height) * this.clothHeight * 1.05 + 0.05;
    p.active = true;
    p.lastTs = ts;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
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

    p.windX += (p.targetWindX - p.windX) * 0.12;
    p.windY += (p.targetWindY - p.windY) * 0.12;
    p.windZ += (p.targetWindZ - p.windZ) * 0.12;
    p.targetWindX *= 0.9;
    p.targetWindY *= 0.9;
    p.targetWindZ *= 0.88;

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

      var sway = Math.sin(time * 0.75 + v * 4.8 + u * 2.6) * 0.00072;
      var ripple = Math.cos(time * 1.28 + u * 5.4 - v * 6.2) * 0.0003;
      var edge = Math.abs(u - 0.5) * 2;

      current[j] = x + vx + sway * 0.62 + p.windX * 0.34;
      current[j + 1] = y + vy - this.gravity + p.windY * 0.1;
      current[j + 2] = z + vz + sway + ripple + p.windZ * 0.95 + edge * edge * 0.00034 * Math.sin(time + v * 3.2);

      if (p.active) {
        var dx = x - p.x;
        var dy = y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 1.05) {
          var influence = 1 - d2 / 1.05;
          influence *= influence;
          current[j] += p.windX * influence * 1.7;
          current[j + 1] += p.windY * influence * 0.45;
          var curlDir = dx >= 0 ? 1 : -1;
          current[j + 2] += curlDir * (Math.abs(p.windX) + Math.abs(p.windY) + Math.abs(p.windZ)) * influence * 0.52;
        }
      }
    }

    for (var ix = 0; ix <= cols; ix++) {
      var top = ix * 3;
      var uu = ix / cols;
      var hanger = Math.sin(time * 0.52 + uu * 5.8) * 0.012;
      current[top] = this.initial[top] + hanger;
      current[top + 1] = this.initial[top + 1];
      current[top + 2] = this.initial[top + 2] + Math.cos(time * 0.44 + uu * 5.2) * 0.0048;
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
