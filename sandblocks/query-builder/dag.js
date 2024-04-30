export function checkIfDAG(graph) {
  return topoSort(graph)[0];
}

export function getExecutionOrder(graph) {
  const [isDag, executionOrder] = topoSort(graph);
  if (isDag) {
    return executionOrder;
  }
}
/**
 * Implementation of Kahn's algorithm
 */
function topoSort(graph) {
  let sortedList = [];
  let nodesWithNoIncomming = graph.getAllNodes().filter((node) => {
    let incomming = graph.getIncommingEdges(node);
    return incomming.length == 0;
  });
  while (nodesWithNoIncomming.length != 0) {
    const buff = nodesWithNoIncomming.pop();
    sortedList.push(buff);
    buff.connections.forEach((node) => {
      buff.removeConnection(node);
      if (graph.getIncommingEdges(node).length == 0) {
        nodesWithNoIncomming.push(node);
      }
    });
  }
  if (graph.getAllNodes().every((node) => node.connections.length == 0)) {
    return [true, sortedList];
  } else {
    return [false, []];
  }
}
