export function checkIfDAG(graph) {
  let nodes = graph.getAllNodesId();
  let edges = graph.getAllEdgesId();
  return topoSort(nodes, edges)[0];
}

export function getExecutionOrder(graph) {
  let nodes = graph.getAllNodesId();
  let edges = graph.getAllEdgesId();
  const [isDag, executionOrder] = topoSort(nodes, edges);
  if (isDag) {
    return executionOrder.map((id) => graph.getNodeById(id));
  }
}
/**
 * Implementation of Kahn's algorithm
 * Based on pseudo code from: https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm
 */
function topoSort(nodes, edges) {
  let l = [];
  let s = nodes.filter((node) => !edges.map((edge) => edge.to).includes(node));

  while (s.length != 0) {
    const n = s.pop();
    l.push(n);
    edges
      .filter((edge) => edge.from == n)
      .map((edge) => edge.to)
      .forEach((m) => {
        edges = edges.filter((edge) => !(edge.from == n && edge.to == m));
        if (edges.filter((edge) => edge.to == m).length == 0) {
          s.push(m);
        }
      });
  }

  if (edges.length == 0) {
    return [true, l];
  } else {
    return [false, []];
  }
}
