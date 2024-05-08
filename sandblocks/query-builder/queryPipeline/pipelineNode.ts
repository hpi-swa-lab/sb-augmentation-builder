import { SBBlock } from "../../../core/model.js";
import { randomId } from "../../../utils.js";
import { getExecutionOrder } from "./dag.js";

export abstract class PipelineNode {
  id: number;
  name: string;
  task: (input: SBBlock, captures: any) => Object;
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

  abstract execute(input, captures);
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
    let allMatch = true;
    if (executionOrder) {
      executionOrder.forEach((node: PipelineNode) => {
        if (node instanceof Query) {
          if (allMatch) {
            currentResult = node.execute(input, captures);
            if (
              currentResult != null &&
              Object.keys(currentResult).length != 0
            ) {
              Object.keys(currentResult).forEach((res) => {
                captures.set(res, currentResult!![res]);
              });
            } else {
              if (!node.optional) {
                allMatch = false;
              }
            }
          }
        }
      });
      if (allMatch && captures.size > 0) {
        return [true, new Replacement(new SBBlock(), captures)];
      } else {
        return [false, new Replacement()];
      }
    }
  }
}

export class Query extends PipelineNode {
  searchType: SearchType;
  optional: boolean;

  constructor(
    name,
    task,
    searchType: SearchType = SearchType.THIS_NODE,
    optional: boolean,
    connections = [],
  ) {
    super(name, task, connections);
    this.searchType = searchType;
    this.optional = optional;
  }

  execute(input: SBBlock, captures) {
    switch (this.searchType) {
      case SearchType.THIS_NODE:
        return this.task(input, captures);
      case SearchType.UPWARDS:
        this.searchUpwards(input, captures);
      case SearchType.DOWNWARDS:
        return this.searchDownwards(input, captures);
      case SearchType.PROGRAM:
        const res = this.searchDownwards(input.root, captures);
        return res;
    }
  }

  private searchUpwards(
    input: SBBlock,
    captures,
    alreadyChecked: number[] = [],
  ) {
    const res = this.task(input, captures);
    console.error("Upward Search not yet implemented");
  }

  private searchDownwards(input: SBBlock, captures, matches: Object[] = []) {
    const res = this.task(input, captures);
    if (res != null && Object.keys(res).length != 0) {
      matches.push(res);
    } else {
      input.children.forEach((child) => {
        this.searchDownwards(child, captures, matches);
      });
    }
    return matches.length > 0 ? matches[0] : {};
  }
}

export class AstGrepQuery extends Query {
  constructor(
    name: string,
    query: string,
    optional = true,
    searchType: SearchType = SearchType.THIS_NODE,
    connections = [],
  ) {
    super(
      name,
      (root: SBBlock, captures) => {
        let query_copy = query;
        const match = query.match(/€(\S)*€/gm);
        if (match) {
          const replacements = match
            .map((it) => it.substring(1, it.length - 1))
            .map((it) => eval(it));
          replacements.forEach((rep, index) => {
            query_copy = query_copy.replace(match[index], rep.toString());
          });
        }
        const res = root.query(query_copy);
        return res;
      },
      searchType,
      optional,
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

  //execute(input: SBBlock[], first = false) {
  //  const res = input.filter((it) => this.task(it));
  //  return first ? (res.length > 0 ? res[0] : []) : res;
  //}
}

export class Replacement {
  root: SBBlock;
  captures: Map<string, SBBlock>;
  constructor(root: SBBlock = new SBBlock(), captures = new Map()) {
    this.root = root;
    this.captures = captures;
  }
}

export enum SearchType {
  THIS_NODE,
  UPWARDS,
  DOWNWARDS,
  PROGRAM,
}
