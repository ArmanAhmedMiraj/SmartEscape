(function (global) {
  'use strict';
  var SE = global.SmartEscape = global.SmartEscape || {};
  var NS = 'http://www.w3.org/2000/svg';

  function t(k, p) { return SE.t(k, p); }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function svg(tag, cls, attrs) {
    var e = document.createElementNS(NS, tag);
    if (cls) e.setAttribute('class', cls);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function num(v) { return Math.round(v * 100) / 100; }
  function short(s, max) { s = String(s); return s.length > max ? s.slice(0, max - 1) + '\u2026' : s; }
  function bindActivate(node, fn) {
    node.addEventListener('click', fn);
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }

  var M = { svg: null, routeLayer: null, nodes: new Map(), edges: new Map(), routeKey: '' };
  var P = { select: null, placeholder: null, options: new Map(), nodeRows: new Map(), edgeRows: new Map(), exitRows: new Map() };
  var lastResultKey = null;
  var toastTimer = null;

  // ================= MAP (built once per file, then only classes change) =================
  function buildMap(graph, cb) {
    var host = $('map');
    host.textContent = '';
    M.nodes = new Map(); M.edges = new Map(); M.routeKey = '';
    var nodes = graph.nodes, i, j;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minD = Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d > 0 && d < minD) minD = d;
      }
    }
    var extent = Math.max(maxX - minX, maxY - minY);
    var r;
    if (extent > 0 && isFinite(minD)) r = Math.max(extent * 0.012, Math.min(extent * 0.04, minD * 0.22));
    else r = extent > 0 ? extent * 0.04 : 16;
    var u = r / 18;
    var w = Math.max(maxX - minX, r * 8), hh = Math.max(maxY - minY, r * 6);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var padX = r * 3.4, padT = r * 2.4, padB = r * 3.2;
    var vb = [cx - w / 2 - padX, cy - hh / 2 - padT, w + 2 * padX, hh + padT + padB].map(num).join(' ');

    var s = svg('svg', 'map-svg', { viewBox: vb, preserveAspectRatio: 'xMidYMid meet', role: 'group' });
    s.style.setProperty('--u', String(Math.round(u * 1000) / 1000));
    var gE = svg('g', 'layer-edges'), gR = svg('g', 'route-layer'), gN = svg('g', 'layer-nodes');
    var fs = 12 * u;

    graph.edges.forEach(function (e) {
      var a = graph.nodeMap.get(e.from), b = graph.nodeMap.get(e.to);
      var g = svg('g', 'edge', { tabindex: '0', role: 'button' });
      g.appendChild(svg('line', 'edge-hit', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      g.appendChild(svg('line', 'edge-line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var pill = svg('g', 'edge-pill', { transform: 'translate(' + num(mx) + ',' + num(my) + ')' });
      var str = String(e.cost);
      var pw = str.length * 0.62 * fs + 1.3 * fs, ph = 1.55 * fs;
      pill.appendChild(svg('rect', 'pill-bg', { x: num(-pw / 2), y: num(-ph / 2), width: num(pw), height: num(ph), rx: num(ph / 2) }));
      var tx = svg('text', 'edge-cost');
      tx.textContent = str;
      pill.appendChild(tx);
      g.appendChild(pill);
      var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      var ox = (-dy / len) * fs * 1.9, oy = (dx / len) * fs * 1.9, k = fs * 0.5;
      var xm = svg('g', 'edge-x', { transform: 'translate(' + num(mx + ox) + ',' + num(my + oy) + ')' });
      xm.appendChild(svg('line', null, { x1: num(-k), y1: num(-k), x2: num(k), y2: num(k) }));
      xm.appendChild(svg('line', null, { x1: num(-k), y1: num(k), x2: num(k), y2: num(-k) }));
      g.appendChild(xm);
      bindActivate(g, function () { cb.edge(e.id); });
      M.edges.set(e.id, g);
      gE.appendChild(g);
    });

    nodes.forEach(function (n) {
      var g = svg('g', 'node type-' + n.type, { transform: 'translate(' + num(n.x) + ',' + num(n.y) + ')', tabindex: '0', role: 'button' });
      var ttl = svg('title');
      ttl.textContent = n.id + ' - ' + n.label;
      g.appendChild(ttl);
      g.appendChild(svg('circle', 'start-ring', { r: num(r * 1.35) }));
      g.appendChild(svg('circle', 'start-static', { r: num(r * 1.38) }));
      g.appendChild(svg('circle', 'node-hit', { r: num(r * 1.5) }));
      var shape, p;
      if (n.type === 'room') {
        shape = svg('rect', 'shape', { x: num(-r), y: num(-r), width: num(2 * r), height: num(2 * r), rx: num(r * 0.38) });
      } else if (n.type === 'junction') {
        shape = svg('circle', 'shape', { r: num(r) });
      } else {
        var pts = [];
        for (p = 0; p < 6; p++) {
          var ang = Math.PI / 180 * (60 * p - 30);
          pts.push(num(r * 1.15 * Math.cos(ang)) + ',' + num(r * 1.15 * Math.sin(ang)));
        }
        shape = svg('polygon', 'shape', { points: pts.join(' ') });
      }
      g.appendChild(shape);
      var idStr = short(n.id, 9);
      var idt = svg('text', 'node-id');
      idt.textContent = idStr;
      idt.style.setProperty('--k', String(Math.max(0.42, Math.min(1, 3.6 / idStr.length))));
      g.appendChild(idt);
      var lab = svg('text', 'node-label', { y: num(r * 1.95) });
      lab.textContent = short(n.label, 18);
      g.appendChild(lab);
      var xk = r * 0.5;
      var xg = svg('g', 'node-x');
      xg.appendChild(svg('line', null, { x1: num(-xk), y1: num(-xk), x2: num(xk), y2: num(xk) }));
      xg.appendChild(svg('line', null, { x1: num(-xk), y1: num(xk), x2: num(xk), y2: num(-xk) }));
      g.appendChild(xg);
      g.appendChild(svg('line', 'node-slash', { x1: num(-r * 0.85), y1: num(r * 0.85), x2: num(r * 0.85), y2: num(-r * 0.85) }));
      bindActivate(g, function () { cb.node(n.id); });
      M.nodes.set(n.id, g);
      gN.appendChild(g);
    });

    s.appendChild(gE); s.appendChild(gR); s.appendChild(gN);
    host.appendChild(s);
    M.svg = s; M.routeLayer = gR;
  }

  function updateMap(S) {
    var g = S.graph, h = S.hazards, route = S.route;
    var onN = new Set(), onE = new Set();
    if (route.status === 'OK') {
      route.path.forEach(function (id) { onN.add(id); });
      route.edgeIds.forEach(function (id) { onE.add(id); });
    }
    function dead(id) {
      var n = g.nodeMap.get(id);
      return n.type === 'exit' ? h.closedExits.has(id) : h.blockedNodes.has(id);
    }
    M.svg.setAttribute('data-mode', S.mode);
    M.svg.setAttribute('aria-label', t('map.label'));
    M.nodes.forEach(function (el, id) {
      var n = g.nodeMap.get(id);
      var blocked = n.type !== 'exit' && h.blockedNodes.has(id);
      var closed = n.type === 'exit' && h.closedExits.has(id);
      el.classList.toggle('blocked', blocked);
      el.classList.toggle('closed', closed);
      el.classList.toggle('is-start', S.start === id);
      el.classList.toggle('on-route', onN.has(id));
      el.setAttribute('aria-label', n.id + ', ' + n.label + ', ' + t('legend.' + n.type) +
        (blocked ? ', ' + t('hz.stateBlocked') : closed ? ', ' + t('hz.stateClosed') : ''));
    });
    M.edges.forEach(function (el, id) {
      var e = g.edgeMap.get(id);
      var blocked = h.blockedEdges.has(id);
      el.classList.toggle('blocked', blocked);
      el.classList.toggle('dead', !blocked && (dead(e.from) || dead(e.to)));
      el.classList.toggle('on-route', onE.has(id));
      el.setAttribute('aria-label', id + ': ' + e.from + ' - ' + e.to + ', ' + t('hz.cost', { cost: e.cost }) +
        (blocked ? ', ' + t('hz.stateBlocked') : ''));
    });
    var key = route.status === 'OK' ? route.path.join('>') : '';
    if (key !== M.routeKey) {
      M.routeKey = key;
      M.routeLayer.textContent = '';
      if (key) {
        var d = route.path.map(function (id, i) {
          var n = g.nodeMap.get(id);
          return (i ? 'L' : 'M') + num(n.x) + ' ' + num(n.y);
        }).join(' ');
        M.routeLayer.appendChild(svg('path', 'route-glow', { d: d }));
        M.routeLayer.appendChild(svg('path', 'route-line', { d: d, pathLength: '1' }));
      }
    }
  }

  // ================= SIDE PANELS (built once per file) =================
  function makeRow(ul, idText, onClick) {
    var li = el('li');
    var id = el('span', 'id', idText);
    var meta = el('span', 'meta');
    var badge = el('span', 'badge');
    var btn = el('button', 'btn tiny');
    btn.type = 'button';
    btn.addEventListener('click', onClick);
    li.appendChild(id); li.appendChild(meta); li.appendChild(badge); li.appendChild(btn);
    ul.appendChild(li);
    return { li: li, meta: meta, badge: badge, btn: btn };
  }
  function section(host, titleKey) {
    var sec = el('section', 'hz');
    var h3 = el('h3');
    h3.setAttribute('data-i18n', titleKey);
    var ul = el('ul');
    sec.appendChild(h3); sec.appendChild(ul);
    host.appendChild(sec);
    return ul;
  }

  function buildPanels(graph, H) {
    var sel = $('start-select');
    sel.textContent = '';
    P.select = sel; P.options = new Map();
    P.placeholder = el('option');
    P.placeholder.value = '';
    sel.appendChild(P.placeholder);
    graph.nodes.forEach(function (n) {
      if (n.type === 'exit') return;
      var o = el('option');
      o.value = n.id;
      sel.appendChild(o);
      P.options.set(n.id, o);
    });
    sel.onchange = function () { H.selectStart(sel.value); };

    var host = $('hz-lists');
    host.textContent = '';
    P.nodeRows = new Map(); P.edgeRows = new Map(); P.exitRows = new Map();
    var ulP = section(host, 'hz.places'), ulX = section(host, 'hz.exits'), ulE = section(host, 'hz.corridors');
    graph.nodes.forEach(function (n) {
      if (n.type === 'exit') P.exitRows.set(n.id, makeRow(ulX, n.id, function () { H.toggleNode(n.id); }));
      else P.nodeRows.set(n.id, makeRow(ulP, n.id, function () { H.toggleNode(n.id); }));
    });
    graph.edges.forEach(function (e) {
      P.edgeRows.set(e.id, makeRow(ulE, e.id, function () { H.toggleEdge(e.id); }));
    });
  }

  function setRow(row, off, offBadge, onBadge, offBtn, onBtn) {
    row.li.classList.toggle('is-off', off);
    row.badge.textContent = off ? offBadge : onBadge;
    row.badge.className = 'badge ' + (off ? 'bad' : 'ok');
    row.btn.textContent = off ? offBtn : onBtn;
    row.btn.setAttribute('aria-pressed', off ? 'true' : 'false');
  }

  function updatePanels(S) {
    var g = S.graph, h = S.hazards;
    P.placeholder.textContent = t('start.placeholder');
    P.options.forEach(function (o, id) {
      var n = g.nodeMap.get(id), blocked = h.blockedNodes.has(id);
      o.textContent = id + ' - ' + n.label + (blocked ? ' (' + t('start.blockedTag') + ')' : '');
      o.disabled = blocked;
    });
    P.select.value = S.start || '';
    g.nodes.forEach(function (n) {
      if (n.type === 'exit') {
        var rx = P.exitRows.get(n.id);
        rx.meta.textContent = n.label;
        setRow(rx, h.closedExits.has(n.id), t('hz.stateClosed'), t('hz.stateOpen'), t('hz.reopen'), t('hz.close'));
      } else {
        var rp = P.nodeRows.get(n.id);
        rp.meta.textContent = n.label;
        rp.li.classList.toggle('is-start', S.start === n.id);
        setRow(rp, h.blockedNodes.has(n.id), t('hz.stateBlocked'), t('hz.stateOk'), t('hz.unblock'), t('hz.block'));
      }
    });
    g.edges.forEach(function (e) {
      var re = P.edgeRows.get(e.id);
      re.meta.textContent = e.from + ' - ' + e.to + ', ' + t('hz.cost', { cost: e.cost });
      setRow(re, h.blockedEdges.has(e.id), t('hz.stateBlocked'), t('hz.stateOk'), t('hz.unblock'), t('hz.block'));
    });
  }

  // ================= RESULT CARD / IMPORT INFO =================
  function renderResult(S) {
    var card = $('status-card'), r = S.route, cls, title, hint = '';
    if (!S.graph || r.status === 'EMPTY') { cls = 'st-idle'; title = t('status.empty'); }
    else if (r.status === 'OK') { cls = 'st-ok'; title = t('status.ok'); }
    else if (r.status === 'START_BLOCKED') { cls = 'st-bad'; title = t('status.blocked'); hint = t('status.blockedHint'); }
    else if (r.status === 'NO_ROUTE') { cls = 'st-warn'; title = t('status.noRoute'); hint = t('status.noRouteHint'); }
    else { cls = 'st-idle'; title = t('status.noStart'); hint = t('status.noStartHint'); }
    card.className = 'card result ' + cls;
    $('status-title').textContent = title;
    $('status-hint').textContent = hint;
    $('status-hint').hidden = !hint;
    var det = $('route-details');
    if (r.status === 'OK') {
      det.hidden = false;
      var ex = S.graph.nodeMap.get(r.exit);
      $('route-cost').textContent = String(r.cost);
      $('route-exit').textContent = ex.label + ' (' + r.exit + ')';
      $('route-steps').textContent = String(r.edgeIds.length);
      $('route-path').textContent = r.path.join(' \u2192 ');
      var chips = $('route-chips');
      chips.textContent = '';
      r.path.forEach(function (id, i) {
        var n = S.graph.nodeMap.get(id);
        if (i > 0) {
          var hop = el('span', 'hop');
          hop.appendChild(el('i', null, '\u2192'));
          hop.appendChild(el('b', null, String(r.steps[i - 1].cost)));
          chips.appendChild(hop);
        }
        var chip = el('span', 'chip chip-' + n.type, id);
        chip.title = n.label;
        chip.style.animationDelay = Math.min(i, 14) * 35 + 'ms';
        chips.appendChild(chip);
      });
    } else {
      det.hidden = true;
    }
    var key = S.lang + '|' + r.status + '|' + (r.path ? r.path.join('>') : '') + '|' + (r.cost === undefined ? '' : r.cost);
    if (key !== lastResultKey) {
      lastResultKey = key;
      void card.offsetWidth;
      card.classList.add('swap');
    }
  }

  function renderImport(S) {
    var info = $('import-info');
    if (S.graph) {
      var src = S.source === 'sample' ? t('import.fromSample') : S.source;
      info.textContent = t('import.loaded', { name: S.graph.building }) + ' (' + src + ') - ' +
        t('import.counts', { nodes: S.graph.nodes.length, edges: S.graph.edges.length });
    } else {
      info.textContent = '';
    }
    var box = $('import-errors'), list = $('error-list');
    list.textContent = '';
    if (S.importErrors && S.importErrors.length) {
      box.hidden = false;
      $('error-head').textContent = S.graph ? t('import.failedKept') : t('import.failed');
      S.importErrors.forEach(function (err) { list.appendChild(el('li', null, SE.errorText(err))); });
    } else {
      box.hidden = true;
    }
  }

  function update(S) {
    $('building-name').textContent = S.graph ? S.graph.building : t('map.label');
    $('mode-hint').textContent = t(S.mode === 'start' ? 'mode.hintStart' : 'mode.hintHazard');
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mode') === S.mode ? 'true' : 'false');
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === S.lang ? 'true' : 'false');
    });
    renderImport(S);
    if (S.graph) { updateMap(S); updatePanels(S); }
    renderResult(S);
  }

  function toast(msg) {
    var tt = $('toast');
    tt.textContent = msg;
    tt.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { tt.classList.remove('show'); }, 2400);
  }

  SE.ui = { buildMap: buildMap, buildPanels: buildPanels, update: update, toast: toast };
})(window);