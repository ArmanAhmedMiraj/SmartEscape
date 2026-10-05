(function () {
  'use strict';
  var SE = window.SmartEscape;
  var NS = 'http://www.w3.org/2000/svg';
  var TXT = {
    en: { play: 'Play walkthrough', stop: 'Stop', hcOn: 'High contrast: on', hcOff: 'High contrast: off' },
    bn: { play: 'রুট চালিয়ে দেখুন', stop: 'থামান', hcOn: 'হাই কন্ট্রাস্ট: চালু', hcOff: 'হাই কন্ট্রাস্ট: বন্ধ' }
  };
  function tx(k) { return (TXT[SE.getLang()] || TXT.en)[k]; }

  var lastS = null, anim = null, hc = false;
  try { hc = localStorage.getItem('se-hc') === '1'; } catch (e) { /* storage may be blocked */ }

  var hcBtn = document.createElement('button');
  hcBtn.type = 'button'; hcBtn.className = 'btn small';
  var walkBtn = document.createElement('button');
  walkBtn.type = 'button'; walkBtn.className = 'btn walk-btn';

  function labels() {
    document.body.classList.toggle('hc', hc);
    hcBtn.setAttribute('aria-pressed', hc ? 'true' : 'false');
    hcBtn.textContent = tx(hc ? 'hcOn' : 'hcOff');
    walkBtn.textContent = tx(anim ? 'stop' : 'play');
    walkBtn.setAttribute('aria-pressed', anim ? 'true' : 'false');
  }

  hcBtn.addEventListener('click', function () {
    hc = !hc;
    try { localStorage.setItem('se-hc', hc ? '1' : '0'); } catch (e) { /* ignore */ }
    labels();
  });

  var topbar = document.querySelector('.topbar');
  var seg = topbar && topbar.querySelector('.seg');
  if (seg) {
    var tools = document.createElement('div');
    tools.className = 'tools';
    topbar.replaceChild(tools, seg);
    tools.appendChild(hcBtn);
    tools.appendChild(seg);
  }
  var det = document.getElementById('route-details');
  if (det) det.appendChild(walkBtn);

  function stop() {
    if (anim) {
      cancelAnimationFrame(anim.raf);
      if (anim.dot.parentNode) anim.dot.parentNode.removeChild(anim.dot);
      anim = null;
    }
    labels();
  }

  function start() {
    var S = lastS;
    if (!S || !S.graph || S.route.status !== 'OK') return;
    var svg = document.querySelector('.map-svg');
    if (!svg) return;
    var pts = S.route.path.map(function (id) {
      var n = S.graph.nodeMap.get(id);
      return { x: n.x, y: n.y };
    });
    var segs = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      var len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segs.push({ a: pts[i - 1], b: pts[i], len: len, start: total });
      total += len;
    }
    var u = parseFloat(svg.style.getPropertyValue('--u')) || 1;
    var dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', 'walker');
    dot.setAttribute('r', String(9 * u));
    dot.setAttribute('cx', pts[0].x);
    dot.setAttribute('cy', pts[0].y);
    svg.appendChild(dot);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = Math.min(6000, 700 + 650 * segs.length);
    var t0 = performance.now();
    var me = { dot: dot, svg: svg, key: S.route.path.join('>'), raf: 0 };
    anim = me;
    labels();

    function frame(now) {
      if (anim !== me) return;
      if (!svg.isConnected) { stop(); return; }
      var el = Math.max(0, now - t0), x, y, done, k, j, s, f;
      if (reduce) {
        k = Math.min(pts.length - 1, Math.floor(el / 600));
        x = pts[k].x; y = pts[k].y;
        done = el >= 600 * pts.length;
      } else {
        var d = Math.min(1, el / duration) * total;
        s = segs[segs.length - 1];
        for (j = 0; j < segs.length; j++) {
          if (d <= segs[j].start + segs[j].len) { s = segs[j]; break; }
        }
        f = Math.min(1, Math.max(0, (d - s.start) / (s.len || 1)));
        x = s.a.x + (s.b.x - s.a.x) * f;
        y = s.a.y + (s.b.y - s.a.y) * f;
        done = el >= duration + 700;
      }
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      if (done) { stop(); return; }
      me.raf = requestAnimationFrame(frame);
    }
    me.raf = requestAnimationFrame(frame);
  }

  walkBtn.addEventListener('click', function () { if (anim) stop(); else start(); });

  // Hook into the existing render step without touching app.js
  var origUpdate = SE.ui.update;
  SE.ui.update = function (S) {
    origUpdate(S);
    lastS = S;
    var key = S.route.status === 'OK' ? S.route.path.join('>') : '';
    if (anim && (anim.key !== key || anim.svg !== document.querySelector('.map-svg'))) stop();
    else labels();
  };
  labels();
})();