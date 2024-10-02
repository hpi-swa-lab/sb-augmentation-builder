import { exec, rangeShift } from "../utils.js";
import { SBBlock, SBNode } from "./model.js";

export interface EditOptions {
  // Optional list of nodes that the user explicitly requested to be deleted.
  // May be used by validations to determine if a change is valid.
  intentDeleteNodes?: SBNode[];
  // Indicate that editing should continue, relevant if modal editing is used.
  requireContinueInput?: boolean;
  // Indicate that we do not want to move focus after this edit.
  noFocus?: boolean;
  // Indicate that the relative selection ranges should be kept.
  keepSelectionOffset?: boolean;
}

export interface ModelEditor {
  get sourceString(): string;

  insertTextFromCommand(
    position: number,
    text: string,
    editOptions?: EditOptions,
  ): void;

  replaceTextFromCommand(
    range: [number, number],
    text: string,
    editOptions?: EditOptions,
  ): void;

  transaction(cb: () => void): void;
}

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

export class MaybeEditor implements ModelEditor {
  editor: ModelEditor;
  parent: SBBlock;
  template: SBBlock;
  index: number;

  get sourceString() {
    return "";
  }

  constructor(
    editor: ModelEditor,
    parent: SBBlock,
    template: SBBlock,
    index = 0,
  ) {
    this.editor = editor;
    this.parent = parent;
    this.template = template;
    this.index = index;
  }

  // TODO
  transaction(cb: () => void): void {
    throw new Error("Method not implemented.");
  }

  insertTextFromCommand(position: number, text: string) {
    this.parent.insert(
      this.template.sourceString,
      this.template.type,
      this.index,
    );
    this.editor.insertTextFromCommand(
      position -
        this.template.range[0] +
        (this.parent.childBlock(this.index) as any).range[0],
      text,
    );
  }

  replaceTextFromCommand(range: [number, number], text: string, opts: any) {
    this.parent.insert(
      this.template.sourceString,
      this.template.type,
      this.index,
    );
    range = rangeShift(range, -this.template.range[0]) as [number, number];
    range = rangeShift(
      range,
      (this.parent.childBlock(this.index) as any).range[0],
    ) as [number, number];
    this.editor.replaceTextFromCommand(range, text, opts);
  }
}

// FIXME needed?
/*class SBNullNode extends SBBlock {
  template: SBBlock;
  templateRoot: SBBlock;

  get type() {
    return this.template._type;
  }
  get field() {
    return this.template._field;
  }
  get range() {
    return this.template._range;
  }
  get named() {
    return this.template._named;
  }

  constructor(template: SBBlock, templateRoot?: SBBlock) {
    super();
    this.template = template;
    this.templateRoot = templateRoot ?? template;
    this._children = (template._children ?? []).map(
      (it) => new SBNullNode(it, this.templateRoot),
    );
  }
}*/
