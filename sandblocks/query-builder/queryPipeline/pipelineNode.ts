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
  task: (input: SBBlock, captures: Map<string, SBBlock>) => Object | null;

  constructor(
    name: string,
    task: (input: SBBlock, captures: Map<string, SBBlock>) => Object | null,
    connections: PipelineNode[] = [],
  ) {
    super(name, connections);
    this.task = task;
  }

  execute(input: SBBlock, captures: Map<string, SBBlock>): boolean {
    //check if execution was successfull i.e. at at least one match found
    return false;
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

  execute(input: SBBlock): { success: boolean; replacement: Replacement } {
    const captures = new Map<string, SBBlock>();
    const executionOrder = getExecutionOrder(this);
    let allMatch = true;
    if (executionOrder) {
      executionOrder.forEach((node: PipelineNode) => {
        if (allMatch) {
          allMatch = node.execute(input, captures);
        }
      });
    } else {
      allMatch = false;
    }

    console.log(`captures.size: ${captures.size}, allMatch: ${allMatch}`);

    return captures.size != 0 && allMatch
      ? { success: true, replacement: new Replacement(captures) }
      : {
          success: false,
          replacement: new Replacement(new Map()),
        };
  }
}

export class OptionalQuery extends PipelineNode {
  query: Query;

  constructor(query: Query) {
    super(query.name, query.task);
    this.query = query;
  }

  execute(input: SBBlock, captures: Map<string, SBBlock>) {
    this.query.execute(input, captures);
    return true;
  }
}

export class RootQuery extends PipelineNode {
  query: Query;

  constructor(query: Query) {
    super(query.name, query.task);
    this.query = query;
  }

  execute(input: SBBlock, captures: Map<string, SBBlock>) {
    let fakeCaptures = new Map<string, SBBlock>();
    this.query.execute(input, fakeCaptures);
    if (fakeCaptures.size == 1) {
      const key = Array.from(fakeCaptures.keys())[0];
      captures.set("root", fakeCaptures.get(key)!!);
      return true;
    } else {
      return false;
    }
  }
}

export class Query extends PipelineNode {
  scope: AbstractSearchScope;

  constructor(
    name: string,
    task: (input: SBBlock, captures: Map<string, SBBlock>) => Object | null,
    scope: AbstractSearchScope,
    connections: PipelineNode[] = [],
  ) {
    super(name, task, connections);
    this.scope = scope;
  }

  execute(input: SBBlock, captures: Map<string, SBBlock>): boolean {
    let anyMatch = false;
    captures.set("self", input);
    for (let node of this.scope.nodes(captures)) {
      const res = this.task(node, captures);
      if (res != null) {
        Object.keys(res).forEach((key) => {
          captures.set(key, res[key]);
        });
        anyMatch = true;
      }
    }
    captures.delete("self");
    console.log(`anyMatch: ${anyMatch}`);
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
      (root: SBBlock, captures: Map<string, SBBlock>) => {
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
        const res = root.query(query_copy) as Object;
        return res;
      },
      scope,
      connections,
    );
  }
}

export class CodeMatchQuery extends Query {
  constructor(
    name: string,
    query: string,
    scope: AbstractSearchScope,
    connections = [],
  ) {
    super(
      name,
      (root: SBBlock, captures: Map<string, SBBlock>) => {
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
        return root.matches(query_copy) ? { node: root } : null;
      },
      scope,
      connections,
    );
  }
}

export class TypeQuery extends Query {
  constructor(
    name: string,
    query: string,
    matchName: string,
    scope: AbstractSearchScope,
    connections = [],
  ) {
    super(
      name,
      (root: SBBlock, captures: Map<string, SBBlock>) => {
        return root.type == query ? { matchName: root } : null;
      },
      scope,
      connections,
    );
  }
}

export class MapNode extends PipelineNode {
  constructor(name: string, map: string, connections: PipelineNode[] = []) {
    super(
      name,
      (root: SBBlock, captures: Map<string, SBBlock>) => {
        return null;
      },
      connections,
    );
  }
}

export class Filter extends PipelineNode {
  constructor(name: string, filter: string, connections: PipelineNode[] = []) {
    super(
      name,
      (input: SBBlock, captures: Map<string, SBBlock>): any => {
        let evalPreable = "";
        for (const [key, _] of captures) {
          evalPreable += `const ${key} = captures.get("${key}");\n`;
        }
        const res = eval(evalPreable + filter);
        console.log(res);
        console.log(input);
        console.log(`named: ${input.named}`);
        return res;
      },
      connections,
    );
  }
  execute(input: SBBlock, captures: Map<string, SBBlock>): boolean {
    return this.task(input, captures) == true;
  }
}

export class Replacement {
  captures: Map<string, SBBlock>;
  constructor(captures = new Map()) {
    this.captures = captures;
  }
}

abstract class AbstractSearchScope {
  *nodes(captures: Map<string, SBBlock>): IterableIterator<SBBlock> {
    throw "subclass responsibility";
  }
}

export class SingleNode extends AbstractSearchScope {
  nodeName: string;
  constructor(nodeName: string = "self") {
    super();
    this.nodeName = nodeName;
  }
  *nodes(captures: Map<string, SBBlock>) {
    const node = captures.get(this.nodeName);
    if (node) yield node;
  }
}

export class SubNodes extends AbstractSearchScope {
  nodeName: string;
  constructor(nodeName: string = "self") {
    super();
    this.nodeName = nodeName;
  }
  *nodes(captures: Map<string, SBBlock>) {
    const node = captures.get(this.nodeName);
    if (node) yield* node.allNodes();
  }
}

export class Children extends AbstractSearchScope {
  nodeName: string;
  constructor(nodeName: string = "self") {
    super();
    this.nodeName = nodeName;
  }

  *nodes(captures: Map<string, SBBlock>) {
    const node = captures.get(this.nodeName);
    if (node) yield* node.children;
  }
}

export class AllNodes extends AbstractSearchScope {
  constructor() {
    super();
  }
  *nodes(captures: Map<string, SBBlock>) {
    const node = Array.from(captures.values())[0];
    if (node) yield* node.root.allNodes();
  }
}
