import { exec } from "../utils.js";

export class SBAbstractMatcher {
  match(node, shard) {
    throw new Error("Not implemented");
  }

  modelFor(editor) {
    throw new Error("Not implemented");
  }

  get requiredModels(): any[] {
    throw new Error("Not implemented");
  }
}

export class SBMatcher extends SBAbstractMatcher {
  steps: (() => any)[];
  model: any;
  queryDepth: number;

  constructor(model, steps, queryDepth = 1) {
    super();
    this.steps = steps;
    this.model = model;
    this.queryDepth = queryDepth;
  }

  match(node, shard) {
    return exec(node, ...this.steps);
  }

  modelFor(editor) {
    return this.model;
  }

  get requiredModels() {
    return [this.model];
  }
}

export class SBDefaultLanguageMatcher extends SBMatcher {
  constructor(steps, queryDepth = 1) {
    super(null, steps, queryDepth);
  }

  modelFor(editor) {
    return editor.defaultModel;
  }

  get requiredModels() {
    return [];
  }
}

export class SBShardLocalMatcher extends SBAbstractMatcher {
  fn: (shard) => (() => any)[];
  model: any;
  queryDepth: number;

  constructor(model, fn, queryDepth = 1) {
    super();
    this.fn = fn;
    this.model = model;
    this.queryDepth = queryDepth;
  }

  match(node, shard) {
    return exec(node, ...this.fn(shard));
  }

  get requiredModels() {
    return [this.model];
  }
}
