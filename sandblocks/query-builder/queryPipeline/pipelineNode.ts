import { SBBlock } from "../../../core/model.js";
import { allViewsDo, randomId } from "../../../utils.js";
import { getExecutionOrder } from "./dag.js";

export abstract class Node {
  id: number;
  name: string;
  connections: Node[];

  constructor(name: string, connections: Node[] = []) {
    this.id = randomId();
    this.name = name;
    this.connections = connections;
  }

  addConnection(node: Node) {
    this.connections.push(node);
  }

  removeConnection(node: Node) {
    this.connections = this.connections.filter((it) => it.id != node.id);
  }
}

export class PipelineNode extends Node {
  task: (input: SBBlock, captures: any) => boolean;

  constructor(
    name: string,
    task: (input: SBBlock, captures: Map<string, SBBlock[]>) => boolean,
    connections: PipelineNode[] = [],
  ) {
    super(name, connections);
    this.task = task;
  }

  execute(input: SBBlock, captures: any): boolean {
    return true;
  }
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

  removeNode(node: PipelineNode): void {
    this.nodes.delete(node.id);
  }

  getAllNodes(): PipelineNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeById(id: number): PipelineNode | undefined {
    return this.nodes.get(id);
  }

  getIncommingEdges(node: PipelineNode): PipelineNode[] {
    let edges: PipelineNode[] = [];
    this.nodes.forEach((n, k, m) => {
      if (n.connections.map((it) => it.id).includes(node.id)) {
        edges.push(n);
      }
    });
    return edges;
  }

  getAllNodesId(): number[] {
    return Array.from(this.nodes.values()).map((node) => node.id);
  }

  getAllEdgesId(): { from: number; to: number }[] {
    const edges: { from: number; to: number }[] = [];
    Array.from(this.nodes.values()).forEach((node) => {
      node.connections.forEach((connectedNode) => {
        edges.push({ from: node.id, to: connectedNode.id });
      });
    });
    return edges;
  }

  execute(input: SBBlock) {
    //let currentResult: Object | null = null;
    const captures = new Map<string, SBBlock>();
    const executionOrder = getExecutionOrder(this);
    let allMatch = true;
    if (executionOrder) {
      executionOrder.forEach((node: PipelineNode) => {
        if (
          allMatch &&
          (node instanceof Query || node instanceof OptionalQuery)
        ) {
          allMatch = node.execute(input, captures);
        }
      });

      return captures.size != 0 && allMatch
        ? [true, new Replacement(new SBBlock(), captures)]
        : [false, new Replacement(new SBBlock(), new Map())];
    }
  }
}

export class OptionalQuery extends PipelineNode {
  query: Query;

  constructor(query: Query) {
    super(query.name, query.task);
    this.query = query;
  }

  execute(input: SBBlock, captures) {
    this.query.execute(input, captures);
    return true;
  }
}

export class Query extends PipelineNode {
  scope: AbstractSearchScope;

  constructor(
    name: string,
    task,
    scope: AbstractSearchScope,
    connections: PipelineNode[] = [],
  ) {
    super(name, task, connections);
    this.scope = scope;
  }

  execute(input: SBBlock, captures: any): boolean {
    let anyMatch = false;
    for (let node of this.scope.nodes(input)) {
      const res = this.task(node, captures);
      if (res != null) {
        Object.keys(res).forEach((key) => {
          captures.set(key, res[key]);
        });
        anyMatch = true;
      }
    }
    return anyMatch;
  }
}

export class AstGrepQuery extends Query {
  constructor(
    name: string,
    query: string,
    scope: AbstractSearchScope,
    connections = [],
  ) {
    super(
      name,
      (root: SBBlock, captures) => {
        let evalPreable = "";
        for (const [key, _] of captures) {
          evalPreable += `const ${key} = captures.get("${key}");\n`;
        }
        let query_copy = query;
        const match = query.match(/€(\S)*€/gm);
        if (match) {
          const replacements = match
            .map((it) => it.substring(1, it.length - 1))
            .map((it) => eval(evalPreable + it));
          replacements.forEach((rep, index) => {
            query_copy = query_copy.replace(match[index], rep.toString());
          });
        }
        const res = root.query(query_copy);
        return res;
      },
      scope,
      connections,
    );
  }
}

/*
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

  //execute(input: SBBlock[], first = false) {
  //  const res = input.filter((it) => this.task(it));
  //  return first ? (res.length > 0 ? res[0] : []) : res;
  //}
}
*/

export class Replacement {
  root: SBBlock;
  captures: Map<string, SBBlock>;
  constructor(root: SBBlock = new SBBlock(), captures = new Map()) {
    this.root = root;
    this.captures = captures;
  }
}

abstract class AbstractSearchScope {
  node: SBBlock;
  *nodes(node: SBBlock): IterableIterator<SBBlock> {
    throw "subclass responsibility";
  }
}

export class SingleNode extends AbstractSearchScope {
  constructor(node: SBBlock) {
    super();
  }
  *nodes(node: SBBlock) {
    yield node;
  }
}

export class SubNodes extends AbstractSearchScope {
  constructor() {
    super();
  }
  *nodes(node: SBBlock) {
    yield* node.allNodes();
  }
}

export class AllNodes extends AbstractSearchScope {
  constructor() {
    super();
  }
  *nodes(node: SBBlock) {
    yield* node.root.allNodes();
  }
}
