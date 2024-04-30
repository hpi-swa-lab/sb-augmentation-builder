import { randomId } from "../../utils.js";

export class PipelineNode {
  constructor(name, task = {}, connections = []) {
    this.id = randomId();
    this.name = name;
    this.task = task;
    this.connections = connections;
  }

  addConnection(node) {
    this.connections.push(node);
  }

  removeConnection(node) {
    this.connections = this.connections.filter((it) => it.id != node.id);
  }

  execute() {
    this.task();
  }
}

export class Pipeline {
  constructor() {
    this.nodes = new Map();
  }

  addNode(node) {
    if (this.nodes.has(node.id)) {
      console.error("Node allready exists in graph");
    } else {
      this.nodes.set(node.id, node);
    }
  }

  removeNode(node) {
    this.nodes.delete(node.id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getNodeById(id) {
    return this.nodes[id];
  }

  getIncommingEdges(node) {
    let edges = [];
    this.nodes.forEach((n, k, m) => {
      if (n.connections.map((it) => it.id).includes(node.id)) {
        edges.push(n);
      }
    });
  }

  getAllNodesId() {
    return Array.from(this.nodes.values()).map((node) => node.id);
  }

  getAllEdgesId() {
    let edges = [];
    Array.from(this.nodes.values()).forEach((node) => {
      node.connections.forEach((connectedNode) => {
        edges.push({ from: node.id, to: connectedNode.id });
      });
    });
    return edges;
  }
}
