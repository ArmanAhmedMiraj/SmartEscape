/* Smart Escape - click menu. Click any room, junction, corridor or exit (2D or 3D map) and get
   Set-as-start / Block / Unblock / Close / Reopen right where you clicked.
   It calls the same actions as the side panels, so routing and state logic are untouched. */
(function () {
  'use strict';
  var SE = window.SmartEscape;
  if (!SE || !SE.ui) { return; }

  var TXT = {
    en: { mode: 'Click menu', hint: 'Click any room, junction, corridor or exit on the map to open its menu.', setStart: 'Set as start', isStart: 'This is the start', needUnblock: 'Unblock it first to use it as the start', block: 'Block this place', unblock: 'Unblock this place', blockEdge: 'Block corridor', unblockEdge: 'Unblock corridor', closeExit: 'Close exit', reopenExit: 'Reopen exit', dismiss: 'Close menu', menu: 'Options' },
    bn: { mode: '\u0995\u09cd\u09b2\u09bf\u0995 \u09ae\u09c7\u09a8\u09c1', hint: '\u09ae\u09c7\u09a8\u09c1 \u0996\u09c1\u09b2\u09a4\u09c7 \u09ae\u09cd\u09af\u09be\u09aa\u09c7 \u09af\u09c7\u0995\u09cb\u09a8\u09cb \u09b0\u09c1\u09ae, \u099c\u0982\u09b6\u09a8, \u0995\u09b0\u09bf\u09a1\u09cb\u09b0 \u09ac\u09be \u09aa\u09cd\u09b0\u09b8\u09cd\u09a5\u09be\u09a8\u09c7 \u0995\u09cd\u09b2\u09bf\u0995 \u0995\u09b0\u09c1\u09a8\u0964', setStart: '\u09b6\u09c1\u09b0\u09c1\u09b0 \u09b8\u09cd\u09a5\u09be\u09a8 \u0995\u09b0\u09c1\u09a8', isStart: '\u098f\u099f\u09bf\u0987 \u09b6\u09c1\u09b0\u09c1\u09b0 \u09b8\u09cd\u09a5\u09be\u09a8', needUnblock: '\u09b6\u09c1\u09b0\u09c1 \u09b9\u09bf\u09b8\u09c7\u09ac\u09c7 \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0\u09c7\u09b0 \u0986\u0997\u09c7 \u098f\u099f\u09bf \u0996\u09c1\u09b2\u09c7 \u09a6\u09bf\u09a8', block: '\u098f\u0987 \u09b8\u09cd\u09a5\u09be\u09a8 \u0985\u09ac\u09b0\u09c1\u09a6\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8', unblock: '\u098f\u0987 \u09b8\u09cd\u09a5\u09be\u09a8 \u0996\u09c1\u09b2\u09c7 \u09a6\u09bf\u09a8', blockEdge: '\u0995\u09b0\u09bf\u09a1\u09cb\u09b0 \u0985\u09ac\u09b0\u09c1\u09a6\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8', unblockEdge: '\u0995\u09b0\u09bf\u09a1\u09cb\u09b0 \u0996\u09c1\u09b2\u09c7 \u09a6\u09bf\u09a8', closeExit: '\u09aa\u09cd\u09b0\u09b8\u09cd\u09a5\u09be\u09a8 \u09ac\u09a8\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8', reopenExit: '\u09aa\u09cd\u09b0\u09b8\u09cd\u09a5\u09be\u09a8 \u0986\u09ac\u09be\u09b0 \u0996\u09c1\u09b2\u09c1\u09a8', dismiss: '\u09ae\u09c7\u09a8\u09c1 \u09ac\u09a8\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8', menu: '\u0985\u09aa\u09b6\u09a8' }
  };
  function tx(k) { return (TXT[SE.getLang()] || TXT.en)[k]; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  var lastS = null, lastPt = null, menu = null;

  // third mode button, placed before "Set start" (app.js wires every [data-mode] button generically)
  var startBtn = document.querySelector('[data-mode="start"]');
  var modeBtn = null;
  if (startBtn && startBtn.parentNode) {
    modeBtn = el('button');
    modeBtn.type = 'button'; modeBtn.setAttribute('data-mode', 'menu'); modeBtn.setAttribute('aria-pressed', 'true');
    startBtn.parentNode.insertBefore(modeBtn, startBtn);
  }

  // remember where the user last pointed, so the menu opens next to the click
  function remember(e) { lastPt = { x: e.clientX, y: e.clientY, t: Date.now() }; }
  document.addEventListener('pointerup', remember, true);
  document.addEventListener('click', remember, true);

  function mode() { return lastS ? lastS.mode : 'menu'; }

  function closeMenu() {
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    menu = null;
  }

  function anchorPoint() {
    if (lastPt && Date.now() - lastPt.t < 700) return lastPt;
    var a = document.activeElement;
    if (a && a.getBoundingClientRect) {
      var r = a.getBoundingClientRect();
      if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  function place(m) {
    var pt = anchorPoint(), w = m.offsetWidth, h = m.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var x = pt.x + 12, y = pt.y + 12;
    if (x + w > vw - 8) x = Math.max(8, pt.x - w - 12);
    if (y + h > vh - 8) y = Math.max(8, pt.y - h - 12);
    m.style.left = x + 'px'; m.style.top = y + 'px';
  }

  function openMenu(kind, id) {
    var S = lastS;
    if (!S || !S.graph || !SE.actions) return;
    closeMenu();
    var g = S.graph, hz = S.hazards, title = id, sub = '', state = '', bad = false, items = [];
    if (kind === 'edge') {
      var e = g.edgeMap.get(id);
      if (!e) return;
      bad = hz.blockedEdges.has(id);
      sub = e.from + ' \u2013 ' + e.to + ' \u00b7 ' + SE.t('hz.cost', { cost: e.cost });
      state = SE.t(bad ? 'hz.stateBlocked' : 'hz.stateOk');
      items.push({ cls: bad ? 'go' : 'haz', icon: bad ? '\u2713' : '\u2715', label: tx(bad ? 'unblockEdge' : 'blockEdge'), run: function () { SE.actions.toggleEdge(id); } });
    } else {
      var n = g.nodeMap.get(id);
      if (!n) return;
      title = id + ' \u00b7 ' + n.label;
      sub = SE.t('legend.' + n.type);
      if (n.type === 'exit') {
        bad = hz.closedExits.has(id);
        state = SE.t(bad ? 'hz.stateClosed' : 'hz.stateOpen');
        items.push({ cls: bad ? 'go' : 'haz', icon: bad ? '\u2713' : '\u2715', label: tx(bad ? 'reopenExit' : 'closeExit'), run: function () { SE.actions.toggleNode(id); } });
      } else {
        bad = hz.blockedNodes.has(id);
        state = SE.t(bad ? 'hz.stateBlocked' : 'hz.stateOk');
        var isStart = S.start === id;
        items.push({ cls: 'start', icon: isStart ? '\u2605' : '\u25b6', label: tx(isStart ? 'isStart' : 'setStart'), disabled: isStart || bad, hint: bad && !isStart ? tx('needUnblock') : '', run: function () { SE.actions.setStart(id); } });
        items.push({ cls: bad ? 'go' : 'haz', icon: bad ? '\u2713' : '\u2715', label: tx(bad ? 'unblock' : 'block'), run: function () { SE.actions.toggleNode(id); } });
      }
    }

    var m = el('div', 'cmenu');
    m.setAttribute('role', 'menu'); m.setAttribute('aria-label', tx('menu'));
    var head = el('div', 'cm-head');
    var ttl = el('div', 'cm-title', title); ttl.setAttribute('dir', 'auto');
    var x = el('button', 'cm-x', '\u2715');
    x.type = 'button'; x.setAttribute('aria-label', tx('dismiss')); x.addEventListener('click', closeMenu);
    head.appendChild(ttl); head.appendChild(x);
    var info = el('div', 'cm-sub');
    info.appendChild(el('span', 'cm-chip ' + (bad ? 'bad' : 'ok'), state));
    var subEl = el('span', null, sub); subEl.setAttribute('dir', 'auto');
    info.appendChild(subEl);
    m.appendChild(head); m.appendChild(info);
    items.forEach(function (it) {
      var b = el('button', 'cm-btn ' + it.cls);
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.appendChild(el('span', 'cm-ico', it.icon));
      b.appendChild(el('span', 'cm-label', it.label));
      if (it.disabled) { b.disabled = true; if (it.hint) b.title = it.hint; }
      else b.addEventListener('click', function () { closeMenu(); it.run(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    menu = m;
    place(m);
    var first = m.querySelector('button.cm-btn:not([disabled])');
    if (first) { try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); } }
  }

  document.addEventListener('pointerdown', function (e) { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu) closeMenu(); });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);

  function texts(S) {
    if (modeBtn) modeBtn.textContent = tx('mode');
    var hint = document.getElementById('mode-hint');
    if (hint && S && S.mode === 'menu') hint.textContent = tx('hint');
  }

  // ---- hook in front of the existing map callbacks (works for both the 2D and the 3D map) ----
  var origBuild = SE.ui.buildMap, origUpdate = SE.ui.update;
  SE.ui.buildMap = function (graph, cb) {
    closeMenu();
    origBuild(graph, {
      node: function (id) { if (mode() === 'menu') openMenu('node', id); else cb.node(id); },
      edge: function (id) { if (mode() === 'menu') openMenu('edge', id); else cb.edge(id); }
    });
  };
  SE.ui.update = function (S) {
    lastS = S;
    closeMenu();
    origUpdate(S);
    texts(S);
  };
  texts(null);
})();