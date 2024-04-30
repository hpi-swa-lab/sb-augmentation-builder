/***input from type:
 * 
 * {
 *      "NodeA": {"name": "NodeA", "adjacentTo": ["NodeB", "NodeC"]},
 *      "NodeB": {"name": "NodeB", "adjacentTo": ["NodeC", "NodeD"]},
 *      "NodeC": {"name": "NodeC", "adjacentTo": ["NodeA"]},
 *      "NodeD": {"name": "NodeD", "adjacentTo": []}
 * }
}
 * 
 ***/
export function checkIfDAG(graph) {
  return topoSort(graph);
}
/**
 * Implementation of Kahn's algorithm
 */
function topoSort(graph) {
  let graphAsList = [];

  Object.keys(graph).forEach((key) => {
    graphAsList.push({ name: key, node: graph[key] });
  });

  let sortedList = [];
  let nodesWithNoIncomming = [];
  graphAsList.forEach((node) => {
    let found = false;
    graphAsList.forEach((innerNode) => {
      if (innerNode.node.adjacentTo.includes(node.name)) {
        found = true;
      }
    });
    if (!found) {
      nodesWithNoIncomming.push(node);
    }
  });
  while (nodesWithNoIncomming.length != 0) {
    const buff = nodesWithNoIncomming[nodesWithNoIncomming.length - 1];
    nodesWithNoIncomming.splice(nodesWithNoIncomming.length - 1, 1);
    sortedList.push(buff);
    buff.node.adjacentTo.forEach((name) => {
      let conNode = getNodeByName(graph, name);
      buff.node.adjacentTo = buff.node.adjacentTo.filter(
        (node) => node != conNode.name,
      );
      if (getIncommingEdges(graphAsList, name) == 0) {
        nodesWithNoIncomming.push(conNode);
      }
    });
  }
  return graphAsList.every((node) => node.node.adjacentTo.length == 0);
}

function getNodeByName(graph, name) {
  let graphAsList = [];

  Object.keys(graph).forEach((key) => {
    graphAsList.push({ name: key, node: graph[key] });
  });
  return graphAsList.filter((node) => node.name == name)[0];
}

function getIncommingEdges(graphAsList, name) {
  let incommingEdges = [];
  graphAsList.forEach((node) => {
    if (node.node.adjacentTo.includes(name)) {
      incommingEdges.push(node.name);
    }
  });
  return incommingEdges;
}
