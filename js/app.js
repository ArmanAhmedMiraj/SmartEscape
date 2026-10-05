(function () {
  'use strict';
  var SE = window.SmartEscape;
  var t = SE.t;
  function $(id) { return document.getElementById(id); }

  // The single source of truth. Every action changes S, then calls render().
  var S = {
    graph: null, hazards: null, start: null, mode: 'menu', lang: 'en',
    source: '', route: { status: 'EMPTY' }, importErrors: []
  };

  function render() {
    S.route = S.graph ? SE.computeRoute(S.graph, S.hazards, S.start) : { status: 'EMPTY' };
    SE.ui.update(S);
  }

  function toggleSet(set, id) { if (set.has(id)) set.delete(id); else set.add(id); }

  function toggleNode(id) {
    var n = S.graph.nodeMap.get(id);
    if (!n) return;
    toggleSet(n.type === 'exit' ? S.hazards.closedExits : S.hazards.blockedNodes, id);
    render();
  }
  function toggleEdge(id) {
    if (!S.graph.edgeMap.has(id)) return;
    toggleSet(S.hazards.blockedEdges, id);
    render();
  }
  function setStart(id) {
    var n = S.graph.nodeMap.get(id);
    if (!n) { render(); return; }
    if (n.type === 'exit') SE.ui.toast(t('toast.exitStart'));
    else if (S.hazards.blockedNodes.has(id)) SE.ui.toast(t('toast.blockedStart'));
    else S.start = id;
    render();
  }
  function onNodeClick(id) { if (S.mode === 'start') setStart(id); else toggleNode(id); }
  function onEdgeClick(id) { if (S.mode === 'hazard') toggleEdge(id); }

  function loadGraph(graph, source) {
    S.graph = graph;
    S.hazards = SE.hazardsFromInitial(graph);
    S.start = null;
    S.mode = 'menu';
    S.source = source;
    S.importErrors = [];
    SE.ui.buildMap(graph, { node: onNodeClick, edge: onEdgeClick });
    SE.ui.buildPanels(graph, {
      selectStart: function (v) { if (!v) { S.start = null; render(); } else setStart(v); },
      toggleNode: toggleNode,
      toggleEdge: toggleEdge
    });
    SE.applyStaticText(document);
    render();
  }

  function showErrors(errs) { S.importErrors = errs; render(); }

  function handleFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showErrors([{ code: 'FILE_TOO_BIG', params: {} }]); return; }
    file.text().then(function (text) {
      text = text.replace(/^\uFEFF/, '');
      if (!text.trim()) { showErrors([{ code: 'FILE_EMPTY', params: {} }]); return; }
      var data;
      try { data = JSON.parse(text); } catch (e) { showErrors([{ code: 'FILE_NOT_JSON', params: {} }]); return; }
      var v = SE.validateBuilding(data);
      if (!v.ok) { showErrors(v.errors); return; }
      loadGraph(v.graph, file.name);
      SE.ui.toast(t('toast.imported', { name: v.graph.building }));
    }).catch(function () { showErrors([{ code: 'FILE_READ', params: {} }]); });
  }

  function loadSample() {
    var v = SE.validateBuilding(JSON.parse(JSON.stringify(SE.SAMPLE)));
    if (v.ok) loadGraph(v.graph, 'sample');
  }

  function setLang(l) {
    S.lang = l === 'bn' ? 'bn' : 'en';
    SE.setLang(S.lang);
    document.documentElement.lang = S.lang;
    try { localStorage.setItem('se-lang', S.lang); } catch (e) { /* storage may be blocked */ }
    SE.applyStaticText(document);
    render();
  }

  SE.actions = { setStart: setStart, toggleNode: toggleNode, toggleEdge: toggleEdge }; // ---------- wiring ----------
  $('drop').addEventListener('click', function () { $('file').click(); });
  $('file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';           // lets the same file be imported twice in a row
    handleFile(f);
  });
  $('btn-sample').addEventListener('click', loadSample);
  $('btn-reset').addEventListener('click', function () {
    if (!S.graph) return;
    S.hazards = SE.hazardsFromInitial(S.graph);
    SE.ui.toast(t('reset.done'));
    render();
  });
  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { S.mode = b.getAttribute('data-mode'); render(); });
  });
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });

  var dragDepth = 0;
  window.addEventListener('dragenter', function (e) { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  // ---------- boot ----------
  var saved = null;
  try { saved = localStorage.getItem('se-lang'); } catch (e) { /* ignore */ }
  setLang(saved === 'bn' ? 'bn' : 'en');
  loadSample();
})();