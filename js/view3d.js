/* Smart Escape - optional real 3D view (Three.js r128, bundled in js/vendor).
   Reads the same state as the 2D map. Never touches routing or validation. */
(function () {
  'use strict';
  var SE = window.SmartEscape, THREE = window.THREE;
  if (!SE || !SE.ui || !THREE) { return; }

  var TXT = {
    en: { view: 'View mode', hint: 'Drag to rotate \u00b7 scroll or pinch to zoom \u00b7 double-click empty space to reset', reset: 'Reset view', exit: 'EXIT', closed: 'CLOSED', noGl: '3D view is not available on this device. Showing the 2D map.', canvas: '3D building map' },
    bn: { view: '\u09ad\u09bf\u0989 \u09ae\u09cb\u09a1', hint: '\u0998\u09cb\u09b0\u09be\u09a4\u09c7 \u099f\u09c7\u09a8\u09c7 \u0986\u09a8\u09c1\u09a8 \u00b7 \u099c\u09c1\u09ae \u0995\u09b0\u09a4\u09c7 \u09b8\u09cd\u0995\u09cd\u09b0\u09b2 \u09ac\u09be \u09aa\u09bf\u099e\u09cd\u099a \u0995\u09b0\u09c1\u09a8 \u00b7 \u09b0\u09bf\u09b8\u09c7\u099f \u0995\u09b0\u09a4\u09c7 \u0996\u09be\u09b2\u09bf \u099c\u09be\u09df\u0997\u09be\u09df \u09a1\u09be\u09ac\u09b2-\u0995\u09cd\u09b2\u09bf\u0995 \u0995\u09b0\u09c1\u09a8', reset: '\u09ad\u09bf\u0989 \u09b0\u09bf\u09b8\u09c7\u099f', exit: '\u09ac\u09be\u09b9\u09bf\u09b0', closed: '\u09ac\u09a8\u09cd\u09a7', noGl: '\u098f\u0987 \u09a1\u09bf\u09ad\u09be\u0987\u09b8\u09c7 \u09e9\u09a1\u09bf \u09ad\u09bf\u0989 \u09aa\u09be\u0993\u09df\u09be \u09af\u09be\u099a\u09cd\u099b\u09c7 \u09a8\u09be\u0964 \u09e8\u09a1\u09bf \u09ae\u09cd\u09af\u09be\u09aa \u09a6\u09c7\u0996\u09be\u09a8\u09cb \u09b9\u099a\u09cd\u099b\u09c7\u0964', canvas: '\u09e9\u09a1\u09bf \u09ac\u09bf\u09b2\u09cd\u09a1\u09bf\u0982 \u09ae\u09cd\u09af\u09be\u09aa' }
  };
  function tx(k) { return (TXT[SE.getLang()] || TXT.en)[k]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function short(s, m) { s = String(s); return s.length > m ? s.slice(0, m - 1) + '\u2026' : s; }
  function palName() { return document.body.classList.contains('hc') ? 'hc' : 'normal'; }

  var PAL = {
    normal: {
      top: '#f1f4fc', grid: 'rgba(61,99,255,0.16)', slab: 0xc3cbe2, room: 0x3d63ff, wall: 0xf7f9ff,
      junction: 0xffb020, junctionAccent: 0xfff3d1, exitBase: 0x13b886, exitFrame: 0xf7f9ff, closedBase: 0x9aa3bd,
      strip: 0xcdd4e8, stripDead: 0xe3e7f1, route: 0x13b886, routeEm: 0x0a7d5c, haz: 0xff5a4f, flame: 0xffa63d,
      barrier: 0xff5a4f, post: 0xf7f9ff, gate: 0x6b7390, walker: 0x3d63ff, pin: 0x1b2236,
      hemiSky: 0xffffff, hemiGround: 0xb8c4e0, hemiI: 0.55, dirI: 0.6,
      ink: '#1b2236', mutedInk: '#667090', pillBg: '#ffffff', pillStroke: '#c1c9de',
      routeCol: '#0a7d5c', hazCol: '#bf3128', hazBg: '#fff0ef', signExit: '#13b886', signClosed: '#7d86a3', signInk: '#ffffff'
    },
    hc: {
      top: '#000000', grid: 'rgba(255,230,0,0.35)', slab: 0xffe600, room: 0x00e5ff, wall: 0xffffff,
      junction: 0xffe600, junctionAccent: 0x000000, exitBase: 0x47ff9c, exitFrame: 0xffffff, closedBase: 0x777777,
      strip: 0x6b6b6b, stripDead: 0x2b2b2b, route: 0x47ff9c, routeEm: 0x00a85a, haz: 0xff6a4a, flame: 0xffb347,
      barrier: 0xff6a4a, post: 0xffffff, gate: 0xff6a4a, walker: 0xffe600, pin: 0xffe600,
      hemiSky: 0xffffff, hemiGround: 0x555555, hemiI: 0.8, dirI: 0.55,
      ink: '#ffffff', mutedInk: '#e8e8e8', pillBg: '#000000', pillStroke: '#ffffff',
      routeCol: '#47ff9c', hazCol: '#ff6a4a', hazBg: '#2a0905', signExit: '#47ff9c', signClosed: '#777777', signInk: '#000000'
    }
  };

  // ---------- DOM: view toggle + container ----------
  var mapEl = document.getElementById('map');
  var card = document.querySelector('.map-card');
  var head = card && card.querySelector('.card-head');
  if (!mapEl || !card || !head) { return; }

  var box = document.createElement('div');
  box.className = 'map3d'; box.id = 'map3d'; box.hidden = true;
  mapEl.parentNode.insertBefore(box, mapEl.nextSibling);
  var hintEl = document.createElement('p'); hintEl.className = 'hint3d';
  var resetBtn = document.createElement('button'); resetBtn.type = 'button'; resetBtn.className = 'btn tiny view-reset';
  box.appendChild(hintEl); box.appendChild(resetBtn);

  var seg = document.createElement('div'); seg.className = 'seg view-seg'; seg.setAttribute('role', 'group');
  var b2 = document.createElement('button'); b2.type = 'button'; b2.textContent = '2D'; b2.setAttribute('data-view', '2d');
  var b3 = document.createElement('button'); b3.type = 'button'; b3.textContent = '3D'; b3.setAttribute('data-view', '3d');
  seg.appendChild(b2); seg.appendChild(b3);
  var modeSeg = head.querySelector('.seg');
  if (modeSeg) head.insertBefore(seg, modeSeg); else head.appendChild(seg);

  // ---------- state ----------
  var view = '3d';
  try { if (localStorage.getItem('se-view') === '2d') view = '2d'; } catch (e) { /* storage may be blocked */ }
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }

  var lastError = '', R = null, failed = false, scene = null, camera = null, hemi = null, dir = null, mats = null;
  var built = null, pickables = [], texCache = new Map();
  var lastS = null, lastGraph = null, lastCb = null;
  var curPal = '', time = 0, dirty = true, raf = 0, last = 0, userMoved = false, fit = 30;
  var cam = { theta: 0.3, phi: 0.9, radius: 30, target: new THREE.Vector3(0, 0.3, 0) };

  // ---------- textures (drawn on canvas, cached per build) ----------
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function canvasTex(key, w, h, draw) {
    var t = texCache.get(key);
    if (t) return t;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    texCache.set(key, t);
    return t;
  }
  var MONO = '"DM Mono", Consolas, "Courier New", monospace';
  var SANS = '"DM Sans", "Noto Sans Bengali", "Nirmala UI", "Segoe UI", Arial, sans-serif';
  function pillColors(P, style) {
    var o = { bg: P.pillBg, st: P.pillStroke, ink: P.ink, sub: P.mutedInk };
    if (style === 'route') { o.st = P.routeCol; o.ink = P.routeCol; }
    else if (style === 'blocked') { o.bg = P.hazBg; o.st = P.hazCol; o.ink = P.hazCol; o.sub = P.hazCol; }
    else if (style === 'closed') { o.ink = P.mutedInk; }
    return o;
  }
  function labelTex(pn, style, id, label) {
    return canvasTex(['n', pn, style, id, label].join('|'), 320, 120, function (c, w, h) {
      var P = PAL[pn], k = pillColors(P, style);
      rr(c, 6, 6, w - 12, h - 12, 24); c.fillStyle = k.bg; c.fill(); c.lineWidth = 5; c.strokeStyle = k.st; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = k.ink; c.font = '600 46px ' + MONO; c.fillText(short(id, 10), w / 2, 44);
      c.fillStyle = k.sub; c.font = '500 26px ' + SANS; c.fillText(short(label, 22), w / 2, 88);
    });
  }
  function costTex(pn, style, cost) {
    return canvasTex(['c', pn, style, cost].join('|'), 128, 72, function (c, w, h) {
      var P = PAL[pn], k = pillColors(P, style);
      rr(c, 4, 4, w - 8, h - 8, 30); c.fillStyle = k.bg; c.fill(); c.lineWidth = 5; c.strokeStyle = k.st; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = k.ink; c.font = '600 40px ' + MONO;
      c.fillText(short(cost, 6), w / 2, h / 2 + 2);
    });
  }
  function signTex(pn, closed, lang) {
    return canvasTex(['s', pn, closed ? 1 : 0, lang].join('|'), 256, 96, function (c, w, h) {
      var P = PAL[pn];
      rr(c, 4, 4, w - 8, h - 8, 18); c.fillStyle = closed ? P.signClosed : P.signExit; c.fill();
      c.lineWidth = 4; c.strokeStyle = P.signInk; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.signInk;
      c.font = '700 54px "Noto Sans Bengali", "Nirmala UI", "DM Sans", Arial, sans-serif';
      c.fillText(closed ? tx('closed') : tx('exit'), w / 2, h / 2 + 3);
    });
  }
  function gridTex(pn, B) {
    var t = canvasTex('g|' + pn, 128, 128, function (c, w, h) {
      var P = PAL[pn];
      c.fillStyle = P.top; c.fillRect(0, 0, w, h);
      c.strokeStyle = P.grid; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 1); c.lineTo(w, 1); c.moveTo(1, 0); c.lineTo(1, h); c.stroke();
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(B.slabW / (B.rw * 2.2), B.slabD / (B.rw * 2.2));
    return t;
  }

  // ---------- renderer, lights, shared materials ----------
  function makeMats() {
    var std = function (o) { return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.62, metalness: 0.04 }, o || {})); };
    return {
      slabTop: std({ color: 0xffffff }), slabSide: std(),
      room: std(), wall: std(), junction: std(), junctionAccent: std(),
      exitBase: std(), exitFrame: std(), closedBase: std(),
      strip: std({ roughness: 0.9 }), stripDead: std({ roughness: 0.9 }),
      route: std({ emissiveIntensity: 0.3 }),
      routeGlow: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }),
      haz: new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.5, emissiveIntensity: 0.35 }),
      flame: new THREE.MeshBasicMaterial(), barrier: std(), post: std(),
      gate: new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6, roughness: 0.6 }),
      walker: std(), pin: new THREE.MeshBasicMaterial(),
      hit: new THREE.MeshBasicMaterial({ visible: false })
    };
  }

  function makeRenderer() { try { return new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e1) { return new THREE.WebGLRenderer({ antialias: false, alpha: true }); } } function ensureRenderer() {
    if (R) return true;
    if (failed) return false;
    try {
      var rd = makeRenderer();
      rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      rd.shadowMap.enabled = true;
      rd.shadowMap.type = THREE.PCFSoftShadowMap;
      rd.setClearColor(0x000000, 0);
      var el = rd.domElement;
      el.setAttribute('role', 'img');
      box.insertBefore(el, box.firstChild);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 400);
      hemi = new THREE.HemisphereLight(0xffffff, 0xb8c4e0, 0.9);
      dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      dir.shadow.bias = -0.0005;
      scene.add(hemi); scene.add(dir); scene.add(dir.target);
      mats = makeMats();
      bindEvents(el);
      R = rd;
      return true;
    } catch (err) {
      failed = true; R = null; lastError = String((err && err.message) || err); console.error('3D renderer could not start:', err);
      return false;
    }
  }

  // ---------- scene ----------
  function teardown() {
    if (!built) { pickables = []; return; }
    scene.remove(built.root);
    built.root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.isSprite && o.material) o.material.dispose();
    });
    texCache.forEach(function (t) { t.dispose(); });
    texCache.clear();
    built = null; pickables = []; curPal = '';
  }

  function addMesh(parent, geo, mat, x, y, z, shadow) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    parent.add(m);
    return m;
  }
  function addSprite(parent, x, y, z, w, h) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    sp.position.set(x, y, z); sp.scale.set(w, h, 1); sp.renderOrder = 10;
    parent.add(sp);
    return sp;
  }
  function cone(r, h, seg) { var g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; }

  function buildScene(graph) {
    teardown();
    var nodes = graph.nodes, i, j;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minD = Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var dd = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (dd > 0 && dd < minD) minD = dd;
      }
    }
    var extent = Math.max(maxX - minX, maxY - minY);
    var r = extent > 0 && isFinite(minD) ? Math.max(extent * 0.012, Math.min(extent * 0.04, minD * 0.22)) : (extent > 0 ? extent * 0.04 : 16);
    var s = extent > 0 ? 24 / extent : 1;
    var rw = r * s, cw = rw * 0.9, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var W = (maxX - minX) * s, D = (maxY - minY) * s, pad = rw * 2.6;
    var slabW = Math.max(W + 2 * pad, rw * 10), slabD = Math.max(D + 2 * pad, rw * 10);

    var B = {
      graph: graph, root: new THREE.Group(), rw: rw, cw: cw, slabW: slabW, slabD: slabD,
      nodes: new Map(), edges: new Map(), routeKey: '\u0000', walk: null
    };
    pickables = [];

    addMesh(B.root, new THREE.BoxGeometry(slabW, rw * 0.5, slabD),
      [mats.slabSide, mats.slabSide, mats.slabTop, mats.slabSide, mats.slabSide, mats.slabSide], 0, -rw * 0.25, 0).castShadow = false;

    var wallH = rw * 0.75, wallT = rw * 0.12, gap = cw * 1.2;
    var segLen = Math.max(rw - gap / 2, rw * 0.2), segC = gap / 2 + segLen / 2;
    var G = {
      wallA: new THREE.BoxGeometry(segLen, wallH, wallT), wallB: new THREE.BoxGeometry(wallT, wallH, segLen),
      roomBase: new THREE.BoxGeometry(rw * 2, rw * 0.14, rw * 2),
      jPad: new THREE.CylinderGeometry(rw * 0.95, rw * 0.95, rw * 0.14, 32),
      jTop: new THREE.CylinderGeometry(rw * 0.42, rw * 0.42, rw * 0.2, 24),
      exitBase: new THREE.BoxGeometry(rw * 2, rw * 0.14, rw * 2),
      post: new THREE.BoxGeometry(rw * 0.16, rw * 1.3, rw * 0.16), lintel: new THREE.BoxGeometry(rw * 1.56, rw * 0.16, rw * 0.16),
      gate: new THREE.BoxGeometry(rw * 1.24, rw * 1.2, rw * 0.08),
      hit: new THREE.CylinderGeometry(rw * 1.3, rw * 1.3, rw * 1.6, 12),
      overlayBox: new THREE.BoxGeometry(rw * 2.1, rw * 1.0, rw * 2.1), overlayCyl: new THREE.CylinderGeometry(rw, rw, rw, 24),
      flame: cone(rw * 0.22, rw * 0.75, 12)
    };

    nodes.forEach(function (n) {
      var grp = new THREE.Group();
      grp.position.set((n.x - cx) * s, 0, (n.y - cy) * s);
      var o = { id: n.id, type: n.type, nodeLabel: n.label, group: grp, labelKey: '', signKey: '', dead: false };
      var hit = new THREE.Mesh(G.hit, mats.hit);
      hit.position.y = rw * 0.8; hit.userData = { kind: 'node', id: n.id };
      grp.add(hit); pickables.push(hit);
      var labelY;
      if (n.type === 'room') {
        addMesh(grp, G.roomBase, mats.room, 0, rw * 0.07, 0);
        var wy = rw * 0.14 + wallH / 2, sx, sz;
        for (sx = -1; sx <= 1; sx += 2) {
          for (sz = -1; sz <= 1; sz += 2) {
            addMesh(grp, G.wallA, mats.wall, sx * segC, wy, sz * (rw - wallT / 2));
            addMesh(grp, G.wallB, mats.wall, sx * (rw - wallT / 2), wy, sz * segC);
          }
        }
        labelY = rw * 0.14 + wallH + rw * 0.75;
      } else if (n.type === 'junction') {
        addMesh(grp, G.jPad, mats.junction, 0, rw * 0.07, 0);
        addMesh(grp, G.jTop, mats.junctionAccent, 0, rw * 0.2, 0);
        labelY = rw * 1.25;
      } else {
        o.base = addMesh(grp, G.exitBase, mats.exitBase, 0, rw * 0.07, 0);
        addMesh(grp, G.post, mats.exitFrame, -rw * 0.7, rw * 0.14 + rw * 0.65, 0);
        addMesh(grp, G.post, mats.exitFrame, rw * 0.7, rw * 0.14 + rw * 0.65, 0);
        addMesh(grp, G.lintel, mats.exitFrame, 0, rw * 0.14 + rw * 1.38, 0);
        o.gate = addMesh(grp, G.gate, mats.gate, 0, rw * 0.14 + rw * 0.6, 0, false);
        o.gate.visible = false;
        o.sign = addSprite(grp, 0, rw * 0.14 + rw * 1.95, 0, rw * 1.5, rw * 0.56);
        labelY = rw * 2.95;
      }
      if (n.type !== 'exit') {
        var hz = new THREE.Group(); hz.visible = false;
        addMesh(hz, n.type === 'room' ? G.overlayBox : G.overlayCyl, mats.haz, 0, rw * 0.5, 0, false);
        o.flames = [[-0.45, 0.2], [0.4, -0.3], [0.05, 0.45]].map(function (p) {
          var f = new THREE.Mesh(G.flame, mats.flame);
          f.position.set(p[0] * rw, rw * 0.14, p[1] * rw);
          hz.add(f);
          return f;
        });
        grp.add(hz); o.hazard = hz;
      }
      o.labelY = labelY;
      o.label = addSprite(grp, 0, labelY, 0, rw * 3.0, rw * 1.125);
      B.root.add(grp);
      B.nodes.set(n.id, o);
    });

    graph.edges.forEach(function (e) {
      var a = B.nodes.get(e.from).group.position, b = B.nodes.get(e.to).group.position;
      var dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 0.001;
      var g = new THREE.Group();
      g.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      g.rotation.y = -Math.atan2(dz, dx);
      var strip = addMesh(g, new THREE.BoxGeometry(len, rw * 0.1, cw), mats.strip, 0, rw * 0.05, 0);
      strip.castShadow = false;
      var hit = new THREE.Mesh(new THREE.BoxGeometry(len, rw * 0.9, cw * 1.7), mats.hit);
      hit.position.y = rw * 0.45; hit.userData = { kind: 'edge', id: e.id };
      g.add(hit); pickables.push(hit);
      var barrier = new THREE.Group(); barrier.visible = false;
      addMesh(barrier, new THREE.BoxGeometry(rw * 0.14, rw * 0.16, cw * 1.5), mats.barrier, 0, rw * 0.5, 0);
      addMesh(barrier, new THREE.BoxGeometry(rw * 0.1, rw * 0.5, rw * 0.1), mats.post, 0, rw * 0.25, -cw * 0.7);
      addMesh(barrier, new THREE.BoxGeometry(rw * 0.1, rw * 0.5, rw * 0.1), mats.post, 0, rw * 0.25, cw * 0.7);
      g.add(barrier);
      var cs = addSprite(g, 0, rw * 1.0, 0, rw * 1.3, rw * 0.73);
      B.root.add(g);
      B.edges.set(e.id, { id: e.id, from: e.from, to: e.to, cost: e.cost, strip: strip, barrier: barrier, cost3: cs, labelKey: '' });
    });

    B.routeGroup = new THREE.Group(); B.root.add(B.routeGroup);
    B.walker = new THREE.Group(); B.walker.visible = false;
    addMesh(B.walker, new THREE.CylinderGeometry(rw * 0.2, rw * 0.24, rw * 0.55, 16), mats.walker, 0, rw * 0.275, 0);
    addMesh(B.walker, new THREE.SphereGeometry(rw * 0.19, 16, 12), mats.walker, 0, rw * 0.72, 0);
    B.root.add(B.walker);

    B.marker = new THREE.Group(); B.marker.visible = false;
    B.ring = new THREE.Mesh(new THREE.TorusGeometry(rw * 1.45, rw * 0.07, 8, 48), mats.pin);
    B.ring.rotation.x = Math.PI / 2; B.ring.position.y = rw * 0.08;
    B.pinG = new THREE.Group();
    var pc = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.28, rw * 0.6, 16), mats.pin);
    pc.rotation.x = Math.PI;
    var pb = new THREE.Mesh(new THREE.SphereGeometry(rw * 0.24, 16, 12), mats.pin);
    pb.position.y = rw * 0.5;
    B.pinG.add(pc); B.pinG.add(pb);
    B.marker.add(B.ring); B.marker.add(B.pinG); B.root.add(B.marker);
    B.pinBase = rw * 2;

    // light + shadow volume sized to this building
    var span = Math.max(slabW, slabD);
    dir.position.set(slabW * 0.3, span * 0.9, slabD * 0.5);
    dir.target.position.set(0, 0, 0);
    dir.shadow.camera.left = -span * 0.7; dir.shadow.camera.right = span * 0.7;
    dir.shadow.camera.top = span * 0.7; dir.shadow.camera.bottom = -span * 0.7;
    dir.shadow.camera.near = 0.5; dir.shadow.camera.far = span * 3;
    dir.shadow.camera.updateProjectionMatrix();

    scene.add(B.root);
    built = B;
    curPal = '';
    applyPalette(palName());
    resetCamera();
    resize();
  }

  function applyPalette(pn) {
    if (!R || !built || curPal === pn) return;
    var P = PAL[pn];
    mats.slabSide.color.setHex(P.slab); mats.room.color.setHex(P.room); mats.wall.color.setHex(P.wall);
    mats.junction.color.setHex(P.junction); mats.junctionAccent.color.setHex(P.junctionAccent);
    mats.exitBase.color.setHex(P.exitBase); mats.exitFrame.color.setHex(P.exitFrame); mats.closedBase.color.setHex(P.closedBase);
    mats.strip.color.setHex(P.strip); mats.stripDead.color.setHex(P.stripDead);
    mats.route.color.setHex(P.route); mats.route.emissive.setHex(P.routeEm); mats.routeGlow.color.setHex(P.route);
    mats.haz.color.setHex(P.haz); mats.haz.emissive.setHex(P.haz);
    mats.flame.color.setHex(P.flame); mats.barrier.color.setHex(P.barrier); mats.post.color.setHex(P.post);
    mats.gate.color.setHex(P.gate); mats.walker.color.setHex(P.walker); mats.pin.color.setHex(P.pin);
    hemi.color.setHex(P.hemiSky); hemi.groundColor.setHex(P.hemiGround); hemi.intensity = P.hemiI; dir.intensity = P.dirI;
    mats.slabTop.map = gridTex(pn, built); mats.slabTop.needsUpdate = true;
    built.nodes.forEach(function (o) { o.labelKey = ''; o.signKey = ''; });
    built.edges.forEach(function (o) { o.labelKey = ''; });
    curPal = pn; dirty = true;
  }

  function buildRoute(route) {
    var B = built, rg = B.routeGroup, i;
    for (i = rg.children.length - 1; i >= 0; i--) {
      var c = rg.children[i]; rg.remove(c); if (c.geometry) c.geometry.dispose();
    }
    B.walk = null; B.walker.visible = false;
    if (route.status !== 'OK') return;
    var y = B.rw * 0.2, rw = B.rw, cw = B.cw;
    var pts = route.path.map(function (id) { var p = B.nodes.get(id).group.position; return new THREE.Vector3(p.x, y, p.z); });
    var cum = [0], k;
    for (k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 0.001;
      cum.push(cum[k - 1] + len);
      var rot = -Math.atan2(dz, dx), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      var sg = new THREE.Mesh(new THREE.BoxGeometry(len, rw * 0.1, cw * 0.5), mats.route);
      sg.position.set(mx, y, mz); sg.rotation.y = rot; sg.castShadow = true; rg.add(sg);
      var gl = new THREE.Mesh(new THREE.BoxGeometry(len, rw * 0.04, cw * 1.15), mats.routeGlow);
      gl.position.set(mx, y - rw * 0.05, mz); gl.rotation.y = rot; rg.add(gl);
    }
    pts.forEach(function (p) {
      var jn = new THREE.Mesh(new THREE.CylinderGeometry(cw * 0.3, cw * 0.3, rw * 0.1, 16), mats.route);
      jn.position.set(p.x, y, p.z); rg.add(jn);
    });
    var total = cum[cum.length - 1];
    B.walk = { pts: pts, cum: cum, len: total, dur: clamp(1.4 + total / 6, 2.4, 9) };
    B.walker.visible = true;
    B.walker.position.copy(pts[0]);
  }

  function sync(S) {
    if (!R || !built || built.graph !== S.graph) return;
    applyPalette(palName());
    var pn = curPal, lang = SE.getLang(), h = S.hazards, route = S.route, B = built;
    var ok = route.status === 'OK';
    var onN = new Set(ok ? route.path : []), onE = new Set(ok ? route.edgeIds : []);

    B.nodes.forEach(function (o, id) {
      var blocked = o.type !== 'exit' && h.blockedNodes.has(id);
      var closed = o.type === 'exit' && h.closedExits.has(id);
      o.dead = blocked || closed;
      if (o.hazard) o.hazard.visible = blocked;
      if (o.gate) o.gate.visible = closed;
      if (o.base) o.base.material = closed ? mats.closedBase : mats.exitBase;
      var style = blocked ? 'blocked' : closed ? 'closed' : onN.has(id) ? 'route' : 'normal';
      var key = pn + '|' + style;
      if (o.labelKey !== key) {
        o.labelKey = key;
        o.label.material.map = labelTex(pn, style, id, o.nodeLabel);
        o.label.material.needsUpdate = true;
      }
      if (o.sign) {
        var sk = pn + '|' + closed + '|' + lang;
        if (o.signKey !== sk) {
          o.signKey = sk;
          o.sign.material.map = signTex(pn, closed, lang);
          o.sign.material.needsUpdate = true;
        }
      }
    });

    B.edges.forEach(function (o, id) {
      var blocked = h.blockedEdges.has(id);
      var dead = !blocked && (B.nodes.get(o.from).dead || B.nodes.get(o.to).dead);
      o.strip.material = dead ? mats.stripDead : mats.strip;
      o.barrier.visible = blocked;
      var style = blocked ? 'blocked' : onE.has(id) ? 'route' : 'normal';
      var key = pn + '|' + style;
      if (o.labelKey !== key) {
        o.labelKey = key;
        o.cost3.material.map = costTex(pn, style, o.cost);
        o.cost3.material.needsUpdate = true;
      }
    });

    var sn = S.start ? B.nodes.get(S.start) : null;
    if (sn) {
      B.marker.visible = true;
      B.marker.position.set(sn.group.position.x, 0, sn.group.position.z);
      B.pinBase = sn.labelY + B.rw * 0.9;
      B.pinG.position.y = B.pinBase;
    } else {
      B.marker.visible = false;
    }

    var rk = ok ? route.path.join('>') : '';
    if (rk !== B.routeKey) { B.routeKey = rk; buildRoute(route); }
    dirty = true;
  }

  // ---------- camera ----------
  function computeFit() {
    var t = Math.tan((camera.fov / 2) * Math.PI / 180);
    var hw = built.slabW / 2, hd = built.slabD / 2;
    fit = Math.max(hw / (t * Math.min(camera.aspect, 1.9)), hd / t) * 1.12 + built.rw * 2.5;
  }
  function resetCamera() {
    if (!built) return;
    computeFit();
    cam.theta = 0.3; cam.phi = 0.9; cam.radius = fit; userMoved = false; dirty = true;
  }
  function updateCamera() {
    var sp = Math.sin(cam.phi);
    camera.position.set(cam.target.x + cam.radius * sp * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi), cam.target.z + cam.radius * sp * Math.cos(cam.theta));
    camera.lookAt(cam.target);
  }
  function resize() {
    if (!R) return;
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (built) { computeFit(); if (!userMoved) cam.radius = fit; }
    dirty = true;
  }

  // ---------- picking + input ----------
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    if (!R || !built) return null;
    var rect = R.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    updateCamera(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    return hits.length ? hits[0].object.userData : null;
  }
  function handleClick(cx, cy) {
    var hit = pickAt(cx, cy);
    if (!hit || !lastCb) return;
    if (hit.kind === 'node') lastCb.node(hit.id); else lastCb.edge(hit.id);
  }
  function bindEvents(el) {
    var ptrs = new Map(), downPos = null, moved = false, pinch = 0, hoverBusy = false;
    function pinchDist() {
      var a = Array.from(ptrs.values());
      return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
    function hover(e) {
      if (hoverBusy) return;
      hoverBusy = true;
      requestAnimationFrame(function () {
        hoverBusy = false;
        var hit = pickAt(e.clientX, e.clientY), can = false;
        if (hit && lastS && lastS.graph) {
          if (hit.kind === 'edge') can = lastS.mode !== 'start';
          else can = lastS.mode !== 'start' || lastS.graph.nodeMap.get(hit.id).type !== 'exit';
        }
        el.classList.toggle('pick', can);
      });
    }
    el.addEventListener('pointerdown', function (e) {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      if (ptrs.size === 1) { downPos = { x: e.clientX, y: e.clientY }; moved = false; }
      if (ptrs.size === 2) { pinch = pinchDist(); moved = true; }
      el.classList.add('grabbing');
    });
    el.addEventListener('pointermove', function (e) {
      var p = ptrs.get(e.pointerId);
      if (!p) { hover(e); return; }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) moved = true;
        if (moved) { cam.theta -= dx * 0.008; cam.phi = clamp(cam.phi - dy * 0.006, 0.2, 1.5); userMoved = true; dirty = true; }
      } else if (ptrs.size === 2) {
        var d = pinchDist();
        if (pinch > 0 && d > 0) { cam.radius = clamp(cam.radius * pinch / d, fit * 0.35, fit * 2.4); userMoved = true; dirty = true; }
        pinch = d;
      }
    });
    function end(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0) {
        el.classList.remove('grabbing');
        if (e.type === 'pointerup' && !moved) { try { handleClick(e.clientX, e.clientY); } catch (x) { console.error(x); } }
      }
      pinch = 0;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.radius = clamp(cam.radius * Math.exp(e.deltaY * 0.0012), fit * 0.35, fit * 2.4);
      userMoved = true; dirty = true;
    }, { passive: false });
    el.addEventListener('dblclick', function (e) { if (!pickAt(e.clientX, e.clientY)) resetCamera(); });
  }

  // ---------- animation loop ----------
  function tick() {
    var B = built;
    if (!B) return;
    B.nodes.forEach(function (o) {
      if (o.flames && o.hazard.visible) {
        o.flames.forEach(function (f, i) {
          var k = 0.85 + 0.22 * Math.sin(time * 3.1 + i * 2.1), w = 1 + 0.06 * Math.sin(time * 4 + i);
          f.scale.set(w, k, w);
        });
      }
    });
    if (B.marker.visible) {
      B.pinG.position.y = B.pinBase + B.rw * 0.1 * Math.sin(time * 2.2);
      B.ring.scale.setScalar(1 + 0.07 * Math.sin(time * 2));
    }
    var wk = B.walk;
    if (wk && wk.pts.length > 1) {
      var local = time % (wk.dur + 1.0), d = Math.min(local / wk.dur, 1) * wk.len, k = 1;
      while (k < wk.cum.length - 1 && wk.cum[k] < d) k++;
      var a = wk.pts[k - 1], b = wk.pts[k], seg = (wk.cum[k] - wk.cum[k - 1]) || 1;
      var f = clamp((d - wk.cum[k - 1]) / seg, 0, 1);
      B.walker.position.set(a.x + (b.x - a.x) * f, a.y + Math.abs(Math.sin(time * 9)) * B.rw * 0.05, a.z + (b.z - a.z) * f);
    }
  }
  function step(now) {
    if (!R || !built || document.hidden || box.hidden) return;
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    var animating = !reduce;
    if (animating) { time += dt; tick(); }
    if (animating || dirty) { updateCamera(); R.render(scene, camera); dirty = false; }
  }
  function loop(now) { raf = requestAnimationFrame(loop); step(now); }
  function startLoop() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  // ---------- view switching ----------
  function texts() {
    seg.setAttribute('aria-label', tx('view'));
    hintEl.textContent = tx('hint');
    resetBtn.textContent = tx('reset');
    if (R) R.domElement.setAttribute('aria-label', tx('canvas'));
  }
  function why() { return tx('noGl') + (lastError ? ' (' + lastError.slice(0, 90) + ')' : ''); } function setView(v, silent) {
    if (v === '3d' && !ensureRenderer()) {
      v = '2d';
      b3.title = tx('noGl') + (lastError ? ' [' + lastError + ']' : '');
      if (!silent) SE.ui.toast(why());
    }
    view = v;
    try { localStorage.setItem('se-view', v); } catch (e) { /* ignore */ }
    var on = v === '3d';
    mapEl.hidden = on; box.hidden = !on;
    document.body.classList.toggle('view-3d', on);
    b2.setAttribute('aria-pressed', on ? 'false' : 'true');
    b3.setAttribute('aria-pressed', on ? 'true' : 'false');
    texts();
    if (on) {
      safe(function () {
        if (lastGraph && (!built || built.graph !== lastGraph)) buildScene(lastGraph);
        resize();
        if (lastS) sync(lastS);
        startLoop();
      });
    } else {
      stopLoop();
    }
  }
  function safe(fn) {
    try { fn(); } catch (err) {
      lastError = String((err && err.message) || err); console.error('3D view failed, using 2D:', err);
      failed = true;
      stopLoop();
      b3.title = tx('noGl') + (lastError ? ' [' + lastError + ']' : '');
      view = '2d';
      mapEl.hidden = false; box.hidden = true;
      document.body.classList.remove('view-3d');
      b2.setAttribute('aria-pressed', 'true'); b3.setAttribute('aria-pressed', 'false');
      SE.ui.toast(why());
    }
  }

  b2.addEventListener('click', function () { setView('2d'); });
  b3.addEventListener('click', function () { failed = false; setView('3d'); });
  resetBtn.addEventListener('click', resetCamera);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) dirty = true; });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box); else window.addEventListener('resize', resize);
  try {
    new MutationObserver(function () { if (view === '3d' && lastS) safe(function () { sync(lastS); }); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (e) { /* ignore */ }

  // ---------- hook into the existing render pipeline (2D code stays untouched) ----------
  var origBuild = SE.ui.buildMap, origUpdate = SE.ui.update;
  SE.ui.buildMap = function (graph, cb) {
    origBuild(graph, cb);
    lastGraph = graph; lastCb = cb;
    if (view === '3d' && graph) safe(function () { buildScene(graph); });
  };
  SE.ui.update = function (S) {
    origUpdate(S);
    lastS = S; texts();
    if (view === '3d' && S.graph) safe(function () { if (!built || built.graph !== S.graph) buildScene(S.graph); sync(S); });
  };

  SE.view3d = { _debug: { step: step, pickAt: pickAt, get: function () { return { built: built, scene: scene, camera: camera, cam: cam, mats: mats, pickables: pickables, texCache: texCache, view: view, curPal: curPal }; } } };

  texts();
  setView(view, true);
})();