import { SBBlock } from "../../../core/model.js";
import { randomId } from "../../../utils.js";
import { getExecutionOrder } from "./dag.js";

export abstract class PipelineNode {
  id: number;
  name: string;
  task: (input: SBBlock) => Object;
  connections: PipelineNode[];

  constructor(
    name: string,
    task: (input: SBBlock) => SBBlock,
    connections: PipelineNode[] = [],
  ) {
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

  abstract execute(SBBlock);
}

export class Pipeline {
  nodes = new Map<number, PipelineNode>();

  addNode(node: PipelineNode): void {
    if (this.nodes.has(node.id)) {
      console.error("Node allready exists in graph");
    } else {
      this.nodes.set(node.id, node);
    }
  }

  removeNode(node: PipelineNode) {
    this.nodes.delete(node.id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getNodeById(id: number): PipelineNode | undefined {
    return this.nodes.get(id);
  }

  getIncommingEdges(node: PipelineNode) {
    let edges: PipelineNode[] = [];
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
    const edges: { from: number; to: number }[] = [];
    Array.from(this.nodes.values()).forEach((node) => {
      node.connections.forEach((connectedNode) => {
        edges.push({ from: node.id, to: connectedNode.id });
      });
    });
    return edges;
  }

  execute(input: SBBlock) {
    let currentResult: Object | null = null;
    const captures = new Map<string, SBBlock>();
    const executionOrder = getExecutionOrder(this);
    //debugger;
    if (executionOrder) {
      executionOrder.forEach((node: PipelineNode) => {
        currentResult = node.execute(input);
      });
      if (currentResult != null && Object.keys(currentResult).length != 0) {
        Object.keys(currentResult).forEach((res) => {
          captures.set(res, currentResult!![res]);
        });
        return [true, new Replacement(new SBBlock(), captures)];
      } else {
        return [false, new Replacement()];
      }
    } else {
      return [false, new Replacement()];
    }
  }
}

export class Query extends PipelineNode {
  constructor(name, task, root, connections = []) {
    super(name, task, connections);
  }

  execute(input: SBBlock) {
    //return input.map((it) => this.task(it));
    return this.task(input);
  }
}

export class AstGrepQuery extends Query {
  constructor(name: string, query: string, connections = []) {
    super(
      name,
      (root: SBBlock) => {
        const res = root.query(query);
        return res;
      },
      connections,
    );
  }
}

export class Filter extends PipelineNode {
  constructor(name: string, filter: string, connections = []) {
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

  execute(input: SBBlock[], first = false) {
    const res = input.filter((it) => this.task(it));
    return first ? (res.length > 0 ? res[0] : []) : res;
  }
}

export class Replacement {
  root: SBBlock;
  captures: Map<string, SBBlock>;
  constructor(root: SBBlock = new SBBlock(), captures = new Map()) {
    this.root = root;
    this.captures = captures;
  }
}
