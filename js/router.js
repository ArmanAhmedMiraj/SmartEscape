(function (global) {
  'use strict';
  var SE = global.SmartEscape = global.SmartEscape || {};

  // Plain string comparison on purpose: "C10" < "C2". Never localeCompare.
  function compareIds(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }

  // Fresh copy of the file's original hazards (used at load and by Reset).
  function hazardsFromInitial(graph) {
    return {
      blockedNodes: new Set(graph.initial.blockedNodes),
      blockedEdges: new Set(graph.initial.blockedEdges),
      closedExits: new Set(graph.initial.closedExits)
    };
  }

  // A node can be entered/crossed unless it is a blocked place or a closed exit.
  function usable(graph, h, id) {
    var n = graph.nodeMap.get(id);
    if (!n) return false;
    if (n.type === 'exit') return !h.closedExits.has(id);
    return !h.blockedNodes.has(id);
  }

  // Shortest distance from `source` to every node it can reach (cost = sum of edge costs).
  function distancesFrom(graph, h, source) {
    var dist = new Map();
    var done = new Set();
    if (!usable(graph, h, source)) return dist;
    dist.set(source, 0);
    for (;;) {
      var u = null, best = Infinity;
      dist.forEach(function (d, id) {
        if (!done.has(id) && d < best) { best = d; u = id; }
      });
      if (u === null) break;
      done.add(u);
      graph.adj.get(u).forEach(function (e) {
        if (h.blockedEdges.has(e.edgeId)) return;
        if (!usable(graph, h, e.to)) return;
        var nd = best + e.cost;
        if (!dist.has(e.to) || nd < dist.get(e.to)) dist.set(e.to, nd);
      });
    }
    return dist;
  }

  // status: NO_START | INVALID_START | START_BLOCKED | NO_ROUTE | OK
  function computeRoute(graph, h, start) {
    if (start === null || start === undefined || !graph.nodeMap.has(start)) return { status: 'NO_START' };
    if (graph.nodeMap.get(start).type === 'exit') return { status: 'INVALID_START' };
    if (h.blockedNodes.has(start)) return { status: 'START_BLOCKED' };

    var exitIds = graph.nodes
      .filter(function (n) { return n.type === 'exit' && !h.closedExits.has(n.id); })
      .map(function (n) { return n.id; })
      .sort(compareIds);                       // ascending, so ties keep the smallest ID

    var bestExit = null, bestCost = Infinity, bestDist = null;
    exitIds.forEach(function (ex) {
      var d = distancesFrom(graph, h, ex);
      if (d.has(start) && d.get(start) < bestCost) {   // strict "<" keeps the smaller ID on ties
        bestCost = d.get(start); bestExit = ex; bestDist = d;
      }
    });
    if (bestExit === null) return { status: 'NO_ROUTE' };

    // Walk from start: always step to the smallest-ID neighbour that stays on a shortest path.
    var path = [start], steps = [], cur = start, guard = graph.nodes.length + 1;
    while (cur !== bestExit && guard-- > 0) {
      var next = null;
      graph.adj.get(cur).forEach(function (e) {
        if (h.blockedEdges.has(e.edgeId)) return;
        if (!bestDist.has(e.to)) return;
        if (e.cost + bestDist.get(e.to) !== bestDist.get(cur)) return;
        if (next === null || compareIds(e.to, next.to) < 0) next = e;
      });
      if (next === null) return { status: 'NO_ROUTE' };
      steps.push({ from: cur, to: next.to, edgeId: next.edgeId, cost: next.cost });
      path.push(next.to);
      cur = next.to;
    }
    return {
      status: 'OK', start: start, exit: bestExit, cost: bestCost,
      path: path, edgeIds: steps.map(function (s) { return s.edgeId; }), steps: steps
    };
  }

  SE.compareIds = compareIds;
  SE.hazardsFromInitial = hazardsFromInitial;
  SE.computeRoute = computeRoute;
})(window);