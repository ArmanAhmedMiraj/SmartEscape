(function (global) {
  'use strict';
  var SE = global.SmartEscape = global.SmartEscape || {};

  var NODE_TYPES = ['room', 'junction', 'exit'];
  var LIM = { minN: 2, maxN: 60, minE: 1, maxE: 150, maxErrors: 40 };

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isText(v) { return typeof v === 'string' && v.trim().length > 0; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function show(v) { return String(v).slice(0, 30); }

  // Returns { ok, errors:[{code,params}], graph }. Never throws on bad data.
  function validateBuilding(data) {
    var errors = [];
    function err(code, params) {
      if (errors.length < LIM.maxErrors) errors.push({ code: code, params: params || {} });
    }

    if (!isObj(data)) { err('NOT_OBJECT'); return { ok: false, errors: errors }; }
    if (!isText(data.building)) err('BUILDING_NAME');

    // ---- nodes ----
    var nodes = [];
    var nodeMap = new Map();
    if (!Array.isArray(data.nodes)) {
      err('NODES_NOT_ARRAY');
    } else {
      if (data.nodes.length < LIM.minN || data.nodes.length > LIM.maxN) {
        err('NODE_COUNT', { count: data.nodes.length, min: LIM.minN, max: LIM.maxN });
      }
      data.nodes.forEach(function (n, i) {
        if (!isObj(n)) { err('NODE_NOT_OBJECT', { index: i + 1 }); return; }
        var label = isText(n.id) ? n.id : '#' + (i + 1);
        if (!isText(n.id)) err('NODE_ID', { index: i + 1 });
        else if (nodeMap.has(n.id)) { err('NODE_DUP_ID', { id: n.id }); return; }
        if (!isText(n.label)) err('NODE_LABEL', { id: label });
        if (NODE_TYPES.indexOf(n.type) === -1) err('NODE_TYPE', { id: label, type: show(n.type) });
        if (!isNum(n.x) || !isNum(n.y)) err('NODE_COORDS', { id: label });
        if (isText(n.id)) {
          var node = { id: n.id, label: n.label, type: n.type, x: n.x, y: n.y };
          nodeMap.set(n.id, node);
          nodes.push(node);
        }
      });
      var places = 0, exits = 0;
      nodeMap.forEach(function (n) {
        if (n.type === 'exit') exits++;
        else if (n.type === 'room' || n.type === 'junction') places++;
      });
      if (exits < 1) err('NO_EXIT');
      if (places < 1) err('NO_PLACE');
    }

    // ---- edges ----
    var edges = [];
    var edgeMap = new Map();
    var pairs = new Set();
    if (!Array.isArray(data.edges)) {
      err('EDGES_NOT_ARRAY');
    } else {
      if (data.edges.length < LIM.minE || data.edges.length > LIM.maxE) {
        err('EDGE_COUNT', { count: data.edges.length, min: LIM.minE, max: LIM.maxE });
      }
      data.edges.forEach(function (e, i) {
        if (!isObj(e)) { err('EDGE_NOT_OBJECT', { index: i + 1 }); return; }
        var hasId = isText(e.id);
        var label = hasId ? e.id : '#' + (i + 1);
        var dup = false;
        if (!hasId) err('EDGE_ID', { index: i + 1 });
        else if (edgeMap.has(e.id)) { err('EDGE_DUP_ID', { id: e.id }); dup = true; }

        var fromOk = typeof e.from === 'string' && nodeMap.has(e.from);
        var toOk = typeof e.to === 'string' && nodeMap.has(e.to);
        if (!fromOk) err('EDGE_UNKNOWN_NODE', { id: label, ref: show(e.from) });
        if (!toOk) err('EDGE_UNKNOWN_NODE', { id: label, ref: show(e.to) });
        if (!Number.isSafeInteger(e.cost) || e.cost <= 0) err('EDGE_COST', { id: label, cost: show(e.cost) });

        if (fromOk && toOk) {
          if (e.from === e.to) {
            err('EDGE_SELF_LOOP', { id: label });
          } else {
            var key = JSON.stringify([e.from, e.to].sort());
            if (pairs.has(key)) err('EDGE_DUP_PAIR', { id: label, from: e.from, to: e.to });
            else pairs.add(key);
          }
        }
        if (hasId && !dup) {
          var edge = { id: e.id, from: e.from, to: e.to, cost: e.cost };
          edgeMap.set(e.id, edge);
          edges.push(edge);
        }
      });
    }

    // ---- initial_state ----
    var init = { blockedNodes: new Set(), blockedEdges: new Set(), closedExits: new Set() };
    function checkList(field, test, target) {
      var arr = data.initial_state[field];
      if (!Array.isArray(arr)) { err('INIT_FIELD', { field: field }); return; }
      arr.forEach(function (id) {
        if (typeof id !== 'string') { err('INIT_ID_TYPE', { field: field }); return; }
        var code = test(id);
        if (code) err(code, { field: field, id: id });
        else target.add(id);
      });
    }
    if (!isObj(data.initial_state)) {
      err('INIT_MISSING');
    } else {
      checkList('blocked_nodes', function (id) {
        var n = nodeMap.get(id);
        if (!n) return edgeMap.has(id) ? 'INIT_WRONG_CATEGORY' : 'INIT_UNKNOWN_ID';
        return n.type === 'exit' ? 'INIT_WRONG_CATEGORY' : null;
      }, init.blockedNodes);
      checkList('blocked_edges', function (id) {
        if (edgeMap.has(id)) return null;
        return nodeMap.has(id) ? 'INIT_WRONG_CATEGORY' : 'INIT_UNKNOWN_ID';
      }, init.blockedEdges);
      checkList('closed_exits', function (id) {
        var n = nodeMap.get(id);
        if (!n) return edgeMap.has(id) ? 'INIT_WRONG_CATEGORY' : 'INIT_UNKNOWN_ID';
        return n.type === 'exit' ? null : 'INIT_WRONG_CATEGORY';
      }, init.closedExits);
    }

    if (errors.length > 0) return { ok: false, errors: errors };

    // ---- build the clean graph (adjacency lists, undirected) ----
    var adj = new Map();
    nodes.forEach(function (n) { adj.set(n.id, []); });
    edges.forEach(function (e) {
      adj.get(e.from).push({ to: e.to, cost: e.cost, edgeId: e.id });
      adj.get(e.to).push({ to: e.from, cost: e.cost, edgeId: e.id });
    });
    return {
      ok: true,
      errors: [],
      graph: {
        building: data.building,
        nodes: nodes, nodeMap: nodeMap,
        edges: edges, edgeMap: edgeMap,
        adj: adj, initial: init
      }
    };
  }

  SE.validateBuilding = validateBuilding;
})(window);