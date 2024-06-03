import { randomId } from "../../../utils.js";
import { getExecutionOrder } from "./dag.js";

export class PipelineNode {
  constructor(name, task = () => {}, connections = []) {
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

  execute(input) {
    //return input.map((it) => this.task(it));
    return this.task(input);
  }
}

export class Pipeline {
  constructor() {
    this.nodes = new Map();
    this.captures = new Map();
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
    return this.nodes.get(id);
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

  execute(input) {
    let currentResult = input;
    //debugger;
    getExecutionOrder(this).forEach((node) => {
      currentResult = node.execute(currentResult);
    });
    debugger;
    Object.keys(currentResult).forEach((res) => {
      debugger;
      this.captures.set(res, this.captures[res]);
    });
    return this.captures;
  }
}

export class AstGrepQuery extends PipelineNode {
  constructor(name, query, rec, connections = []) {
    super(
      name,
      (root) => {
        if (rec) {
          function queryRec(query, node, matches) {
            const res = node.query(query);
            if (res) {
              matches.push(res);
            }
            node.children.forEach((child) => {
              queryRec(query, child, matches);
            });
          }
          let matches = [];
          queryRec(query, root, matches);
          return matches;
          //debugger;
        } else {
          return root.query(query);
        }
      },
      connections,
    );
  }
}

export class Filter extends PipelineNode {
  constructor(name, filter, connections = []) {
    super(
      name,
      (input) => {
        //debugger;
        const evalString = filter;
        const res = eval(evalString);
        return res;
      },
      connections,
    );
  }

  execute(input, first = false) {
    const res = input.filter((it) => this.task(it));
    return first ? (res.length > 0 ? res[0] : []) : res;
  }
}
