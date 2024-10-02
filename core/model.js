import {
  WeakArray,
  adjustIndex,
  clamp,
  exec,
  last,
  rangeContains,
  rangeEqual,
} from "../utils.js";
import { AttachOp, LoadOp, TrueDiff } from "./diff.js";
export {
  SBMatcher,
  SBDefaultLanguageMatcher,
  SBShardLocalMatcher,
} from "./matcher.ts";

/*
    https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
    cyrb53 (c) 2018 bryc (github.com/bryc)
    License: Public domain. Attribution appreciated.
    A fast and simple 53-bit string hash function with decent collision resistance.
    Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
*/
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
const hash = (str) => cyrb53(str);
const hashCombine = (a, b) => a ^ (b + 0x9e3779b9 + (a << 6) + (a >> 2));

export const extractType = (type) => (node) => node.firstOfType(type);

export class OffscreenEditor extends EventTarget {
  nodeTags = new Map();
  models = new Map();
  sourceString = "";
  props = { value: {} };

  constructor(root) {
    super();

    if (root) {
      console.assert(root._sourceString, "node must have a source string");
      console.assert(root._language, "node must have a language");

      this.sourceString = root._sourceString;
      root._editor = this;
      this.models.set(root.language, root);
    }
  }

  insertTextFromCommand(position, text) {
    this.replaceTextFromCommand([position, position], text);
  }

  replaceTextFromCommand(range, text) {
    this.applyChanges([{ from: range[0], to: range[1], insert: text }]);
  }

  insertTextChange(position, text) {
    return { from: position, to: position, insert: text };
  }

  applyChanges(changes) {
    if (this.activeTransactionList) {
      const affinity = last(changes).sideAffinity;
      this.activeTransactionList.push(
        ...changes.map((c) => ({
          ...c,
          from: adjustIndex(c.from, this.activeTransactionList, affinity),
          to: adjustIndex(c.to, this.activeTransactionList, affinity),
        })),
      );
      return;
    }

    const oldSource = this.sourceString;
    let newSource = this.sourceString;
    for (const { insert, from, to } of changes) {
      newSource = newSource.slice(0, from) + insert + newSource.slice(to);
    }
    this.sourceString = newSource;

    const update = sortModels([...this.models.values()]).map((n) =>
      n.reParse(newSource),
    );
    // FIXME need validation support for rewrite augmentations?
    for (const { tx } of update) tx.commit();
    this.models = new Map(update.map(({ root }) => [root.language, root]));

    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          changes: changes,
          sourceString: this.sourceString,
          oldSource,
          diff: update,
        },
      }),
    );
  }

  activeTransactionList = null;
  transaction(cb) {
    if (this.activeTransactionList)
      throw new Error("Nested transactions not supported right now");
    this.activeTransactionList = [];
    cb();
    const list = this.activeTransactionList;
    this.activeTransactionList = null;
    this.applyChanges(list);
  }
}

export function sortModels(models) {
  const sorted = [];
  const visited = new Set();
  const visit = (model) => {
    if (visited.has(model)) return;
    visited.add(model);
    for (const dep of model.dependencies ?? []) visit(dep);
    sorted.push(model);
  };
  for (const model of models) visit(model);
  return sorted;
}

export class SBLanguage {
  dependencies = [];
  _dependentRoots = [];

  constructor({ name, extensions, defaultExtensions }) {
    this.name = name;
    this.extensions = extensions;
    this.defaultExtensions = defaultExtensions;
  }

  prepareForParsing(models) {
    this._dependentRoots = this.dependencies.map((model) => models.get(model));
  }

  /** @returns {SBNode[]} */
  getDependencies() {
    return this._dependentRoots;
  }

  async ready() {}
  separatorContextFor(node) {
    return null;
  }
  firstInsertPoint(node, type) {
    return null;
  }
  compatibleType(type, other) {
    return type === other;
  }
  /**
   * @param {string} text
   * @param {SBNode | null} oldRoot
   * @returns {SBNode} */
  _parse(text, oldRoot = null) {
    throw "subclass responsibility";
  }

  parseSync(text, editor) {
    return this._assignState(this._parse(text), text, editor);
  }
  parseOffscreen(text) {
    const editor = new OffscreenEditor();
    const root = this.parseSync(text, editor);
    editor.root = root;
    return root;
  }

  async parse(text, editor) {
    await this.ready();
    return this.parseSync(text, editor);
  }
  reParse(text, oldRoot) {
    console.assert(oldRoot);

    const { tx, root, diff } = new TrueDiff().applyEdits(
      oldRoot,
      this._parse(text, oldRoot),
    );
    if (root !== oldRoot) tx.set(oldRoot, "_sourceString", null);
    root._language = this;
    root._editor = oldRoot._editor;
    tx.set(root, "_sourceString", text);
    return { tx, root, diff };
  }

  /** @returns {string} */
  get rootRuleName() {
    return "document";
  }

  get canBeDefault() {
    return false;
  }

  destroyRoot(root) {}

  _assignState(root, text, editor) {
    root._language = this;
    root._sourceString = text;
    root._editor = editor;
    return root;
  }

  isExpression(node) {
    return false;
  }
}

class _SBBaseLanguage extends SBLanguage {
  constructor() {
    super({ name: "sb-base-lang", extensions: [], defaultExtensions: [] });
  }

  _parse(text, _oldRoot) {
    const root = new SBBlock("document", null, 0, text.length, true);
    root._language = this;
    root._sourceString = text;

    const content = new SBText(text, 0, text.length);
    root.appendChild(content);

    return root;
  }

  get rootRuleName() {
    return "document";
  }
}

export const SBBaseLanguage = new _SBBaseLanguage();

let _nodeId = 0;
function _nextNodeId() {
  return _nodeId++;
}

export class SBNode {
  _parent = null;
  _range = [0, 0];
  _language = undefined;
  shards = new WeakArray();

  constructor() {
    this._id = _nextNodeId().toString();
  }

  equals(node) {
    return this === node;
  }

  exec(...script) {
    return exec(this, ...script);
  }

  cloneOffscreen() {
    const root = this.language.parseOffscreen(this.root.sourceString);
    const node = root.childForRange(this.range);
    return node;
  }

  internalClone() {
    const c = this.shallowClone();
    c._id = this._id;
    for (const child of this.children) {
      c.appendChild(child.internalClone());
    }
    return c;
  }

  findInClone(root) {
    return this.recoverNodeAtSamePosition(() => {}, root);
  }

  get type() {
    return "";
  }

  get text() {
    return "";
  }

  get language() {
    return this._language ?? this.parent?.language;
  }

  get id() {
    return this._id;
  }

  /** @returns {SBNode[]} */
  get children() {
    return [];
  }
  /** @returns {SBNode | null} */
  get parent() {
    return this._parent;
  }
  get range() {
    return this._range;
  }

  get root() {
    let r = this;
    while (r.parent) r = r.parent;
    return r;
  }

  get isRoot() {
    return !this.parent && this.language?.rootRuleName === this.type;
  }

  get sourceString() {
    return this.root._sourceString.slice(...this.range);
  }

  get preferForSelection() {
    // named or likely a keyword
    return this.named || this.text?.match(/^[A-Za-z]+$/);
  }

  get depth() {
    return this.parent ? this.parent.depth + 1 : 0;
  }

  get connected() {
    return this.root.isRoot;
  }

  hasTag(tag) {
    return this.editor.nodeTags.get(this)?.some(([t]) => t === tag) ?? false;
  }

  getTagData(tag) {
    return this.editor.nodeTags.get(this)?.find(([t]) => t === tag)?.[1];
  }

  initOps() {
    return [
      new LoadOp(this),
      new AttachOp(this, this.parent, this.siblingIndex),

      ...this.children.flatMap((child) => child.initOps()),
    ];
  }

  reParse(text) {
    return this.language.reParse(text, this);
  }

  destroy() {
    this._language.destroyRoot(this);
  }

  createShard() {
    return this.editor.createShardFor(this);
  }

  get editor() {
    if (this._editor) return this._editor;
    return this.parent?.editor;
    // return this.orParentThat((p) => p.shards.any?.editor)?.shards.any.editor;
  }

  get context() {
    return this.editor?.context;
  }

  get field() {
    return this._field;
  }

  get isExpression() {
    return false;
  }

  atField(field) {
    return this.children.find((child) => child.field === field);
  }

  atType(type) {
    return this.children.find((child) => child.type === type);
  }

  firstOfType(type) {
    for (const child of this.allNodes()) {
      if (child.type === type) return child;
    }
    return null;
  }

  blockThat(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const match = child.blockThat(predicate);
      if (match) return match;
    }
    return null;
  }

  allBlocksThat(predicate) {
    const ret = [];
    if (predicate(this)) ret.push(this);
    for (const child of this.children) {
      ret.push(...child.allBlocksThat(predicate));
    }
    return ret;
  }

  print(level = 0, namedOnly = false) {
    let out = "";
    for (let i = 0; i < level; i++) out += "  ";
    out += this.type ?? `"${this.text.replace(/\n/g, "\\n")}"`;
    out += ` (${this.range[0]}, ${this.range[1]})`;
    out += "\n";
    for (const child of this.children) {
      if (!namedOnly || child.named) out += child.print(level + 1, namedOnly);
    }
    return out;
  }

  shiftRange(offset) {
    this._range = [this.range[0] + offset, this.range[1] + offset];
  }

  replaceNode(node) {
    const parent = this.parent;
    const index = parent.children.indexOf(this);
    parent.removeChild(this);
    parent.insertChild(node, index);
  }

  childNode(index) {
    for (let i = 0; i < this.children.length; i++) {
      if (!this.children[i].isWhitespace()) {
        if (index === 0) return this.children[i];
        index--;
      }
    }
    return null;
  }

  get childNodes() {
    return this.children.filter((child) => !child.isWhitespace());
  }

  childBlock(index) {
    for (let i = 0; i < this.children.length; i++) {
      if (!!this.children[i].named) {
        if (index === 0) return this.children[i];
        index--;
      }
    }
    return null;
  }

  /** @returns {SBNode[]} */
  get childBlocks() {
    return this.children.filter((child) => !!child.named);
  }

  /** @return {SBBlock | null} */
  get nextSiblingBlock() {
    if (this.isRoot) return null;
    let pickNext = false;
    for (const sibling of this.parent.children) {
      if (pickNext && sibling.named) return sibling;
      if (sibling === this) pickNext = true;
    }
    return null;
  }

  /** @return {SBNode | null} */
  get nextSiblingNode() {
    if (this.isRoot) return null;
    let pickNext = false;
    for (const sibling of this.parent.children) {
      if (pickNext && !sibling.isWhitespace()) return sibling;
      if (sibling === this) pickNext = true;
    }
    return null;
  }

  /** @return {SBNode | null} */
  get previousSiblingNode() {
    if (this.isRoot) return null;
    let last = null;
    for (const sibling of this.parent.children) {
      if (sibling === this) return last;
      if (!sibling.isWhitespace()) last = sibling;
    }
    return null;
  }

  get siblingIndex() {
    return this.parent ? this.parent.children.indexOf(this) : 0;
  }

  get previousSiblingChild() {
    return this.parent?.children[this.siblingIndex - 1];
  }

  /** @returns {SBNode | undefined} */
  get nextSiblingChild() {
    return this.parent?.children[this.siblingIndex + 1];
  }

  get childBlocks() {
    return this.children.filter((child) => !!child.named);
  }

  // finds a child for an exact match
  childForRange(range) {
    if (this.range[0] === range[0] && this.range[1] === range[1]) return this;
    for (const child of this.children) {
      const match = child.childForRange(range);
      if (match) return match;
    }
    return null;
  }

  // finds a child that best encompasses the range
  childEncompassingRange(range) {
    if (this.range[0] <= range[0] && this.range[1] >= range[1]) {
      for (const child of this.children) {
        const match = child.childEncompassingRange(range);
        if (match) return match;
      }
      return this;
    }
    return null;
  }

  *leafsInRange(range) {
    if (this.children.length === 0 && rangeContains(range, this.range))
      yield this;
    for (const child of this.children) {
      yield* child.leafsInRange(range);
    }
  }

  leafForPosition(pos, excludeEnd) {
    if (
      this.range[0] <= pos &&
      (excludeEnd ? this.range[1] > pos : this.range[1] >= pos)
    ) {
      for (const child of this.children) {
        const match = child.leafForPosition(pos, excludeEnd);
        if (match) return match;
      }
      return this;
    }
    return null;
  }

  compatibleWith(type) {
    return this.language.compatibleType(this.type, type);
  }

  orParentCompatibleWith(type) {
    return this.orParentThat((x) => x.compatibleWith(type));
  }

  /**
   * @param {(node: SBNode) => boolean} predicate
   * @returns {SBNode | undefined}
   */
  orParentThat(predicate) {
    if (predicate(this)) return this;
    else return this.parent?.orParentThat(predicate);
  }

  orHasParent(node) {
    let n = this;
    while (n) {
      if (n === node) return true;
      n = n.parent;
    }
    return false;
  }

  prependString(string) {
    this.editor.insertTextFromCommand(this.range[0], string);
  }

  _childrenForInsert(type) {
    return this.childBlocks.filter(
      (child) =>
        child.compatibleWith(type) && this.language.separatorContextFor(child),
    );
  }

  _insertedChildAt(type, index) {
    const list = this._childrenForInsert(type);
    return list[clamp(index, 0, list.length - 1)];
  }

  insert(string, type, index, editOptions) {
    const list = this._childrenForInsert(type);
    // handle empty list by finding any slot that takes the type
    if (list.length === 0) {
      const position = this.language.firstInsertPoint(this, type);
      if (position !== null)
        this.editor.insertTextFromCommand(position, string);
      else throw new Error("no insert point found");
      return this._insertedChildAt(type, index);
    }

    const ref = list[Math.min(index, list.length - 1)];
    const sep = this.language.separatorContextFor(ref);

    if (index < list.length)
      this.editor.insertTextFromCommand(
        ref.range[0],
        string + sep,
        editOptions,
      );
    else
      this.editor.insertTextFromCommand(
        ref.range[1],
        sep + string,
        editOptions,
      );
    return this._insertedChildAt(type, index);
  }

  insertBefore(string, type) {
    this.parent.insert(string, type, this.parent.childBlocks.indexOf(this));
  }

  insertAfter(string, type) {
    this.parent.insert(string, type, this.parent.childBlocks.indexOf(this) + 1);
  }

  get hasError() {
    return (
      this.type === "ERROR" || this.children.some((child) => child.hasError)
    );
  }

  // The nodes that should be deleted, when a delete action is invoked
  // on this node. the concept and wording originates from cursorless'
  // `removalRange`.
  get removalNodes() {
    if (!this.parent) return [this];

    let ret = [this];

    const pending = this.parent.childNodes;
    if (
      this.isText ||
      this.type === "ERROR" ||
      this.parent.type === "ERROR" ||
      pending.some((node) => node.type === "ERROR")
    ) {
      return [this];
    }

    const separator = this.language.separatorContextFor(this);
    if (separator && this.nextSiblingNode?.text === separator) {
      ret.push(this.nextSiblingNode);
      if (this.nextSiblingNode.nextSiblingChild.isWhitespace()) {
        ret.push(this.nextSiblingNode.nextSiblingChild);
      }
    } else if (separator && this.previousSiblingNode?.text === separator) {
      ret.push(this.previousSiblingNode);
      if (this.previousSiblingNode.previousSiblingChild.isWhitespace()) {
        ret.push(this.previousSiblingNode.previousSiblingChild);
      }
      if (this.previousSiblingChild.isWhitespace()) {
        ret.push(this.previousSiblingChild);
      }
    }
    return ret.sort((a, b) => a.range[0] - b.range[0]);
  }

  removeFull(editOptions) {
    const remove = this.removalNodes;
    this.editor.replaceTextFromCommand(
      [remove[0].range[0], last(remove).range[1]],
      "",
      editOptions ?? { intentDeleteNodes: [this] },
    );
  }

  removeSelf() {
    this.editor.replaceTextFromCommand(this.range, "");
  }

  isWhitespace() {
    return false;
  }

  orAnyParent(predicate) {
    let current = this;
    while (current) {
      if (predicate(current)) return current;
      current = current.parent;
    }
    return null;
  }

  nodeAndParentsDo(cb) {
    cb(this);
    if (this.parent) this.parent.nodeAndParentsDo(cb);
  }

  *andAllParents() {
    let current = this;
    while (current) {
      yield current;
      current = current.parent;
    }
  }

  *allNodes() {
    yield this;
    for (const child of this.children) yield* child.allNodes();
  }

  allNodesDo(cb) {
    // FIXME still gotta do proper measurements on iterative vs recursive
    let stack = [this];
    while (stack.length > 0) {
      const node = stack.pop();
      cb(node);
      for (let i = node.children.length - 1; i >= 0; i--)
        stack.push(node.children[i]);
    }

    // cb(this);
    // for (const child of this.children) {
    //   child.allNodesDo(cb);
    // }
  }

  allChildrenDo(cb) {
    for (const child of this.children) {
      child.allNodesDo(cb);
    }
  }

  allLeafsDo(cb) {
    if (this.isText) cb(this);
    else for (const child of this.children) child.allLeafsDo(cb);
  }

  allLeafs() {
    const leafs = [];
    this.allLeafsDo((leaf) => leafs.push(leaf));
    return leafs;
  }

  contains(aNode) {
    return aNode.orParentThat((p) => p === this);
  }

  get isText() {
    return false;
  }

  get treeHeight() {
    if (this._treeHeight) return this._treeHeight;

    let height = 0;
    for (const child of this.children) {
      height = Math.max(height, child.treeHeight);
    }
    return (this._treeHeight = height + 1);
  }

  // edit operations
  replaceWith(str, editOptions) {
    if (typeof str === "number") str = str.toString();
    this.editor.replaceTextFromCommand(this.range, str, editOptions);
  }

  /**
   * Apply an operation, then find the node at the same position.
   * Optionally look up the node in the same position in a different root.
   *
   * @param {() => void} cb
   * @param {SBNode | null} otherRoot
   */
  recoverNodeAtSamePosition(cb, otherRoot = null) {
    const indices = [];
    let node = this;
    while (node.parent) {
      indices.unshift(node.siblingIndex);
      node = node.parent;
    }
    cb();
    console.assert(node.connected);
    if (otherRoot) node = otherRoot;
    for (const index of indices) node = node.children[index];
    return node;
  }

  wrapWith(start, end, editOptions = {}) {
    return this.recoverNodeAtSamePosition(() =>
      this.editor.applyChanges([
        this.editor.insertTextChange(this.range[0], start),
        this.editor.insertTextChange(this.range[1] + start.length, end, {
          ...editOptions,
          keepSelectionOffset: true,
        }),
      ]),
    );
  }

  select(adjacentView) {
    // TODO consider view
    this.editor.selectRange(this.range);
  }

  get isSelected() {
    return this.editor.selected?.node === this;
  }

  get isFullySelected() {
    return rangeEqual(this.range, this.editor.selectionRange);
  }

  cleanDiffData() {
    this._structureHash = null;
    this._literalHash = null;
    this._treeHeight = null;
    this.share = null;
    this.assigned = null;
    this.literalMatch = null;
    for (const child of this.children) {
      child.cleanDiffData();
    }
  }

  // queries
  query(string, extract = null) {
    if (!this.connected) return false;
    const res = this.language.query(this, string, extract);
    return res ? Object.fromEntries(res) : null;
  }

  matches(string, extract = null) {
    return this.query(string, extract) !== null;
  }

  // query that returns the node and the result of the query,
  // convenient for exec scripts.
  extract(string, extract = null) {
    const res = this.query(string, extract);
    return res ? [this, res] : null;
  }

  findQuery(string, extract = null) {
    const res = this.query(string, extract);
    if (res) return { ...res, root: this };
    for (const child of this.children) {
      const res = child.findQuery(string, extract);
      if (res) return res;
    }
    return null;
  }

  findQueryAll(string, extract = null, out = []) {
    const res = this.query(string, extract);
    if (res) out.push({ ...res, root: this });

    for (const child of this.children) {
      child.findQueryAll(string, extract, out);
    }
    return out;
  }
}

const structureHashText = hash("text");

export class SBText extends SBNode {
  constructor(text, start, end) {
    super();
    this._text = text;
    this._range = [start, end];
  }

  shallowClone() {
    return new SBText(this.text, this.range[0], this.range[1]);
  }

  get structureHash() {
    // hard-coded, arbitrary constant value
    return structureHashText;
  }

  get literalHash() {
    return (this._literalHash ??= hash(this.text));
  }

  get text() {
    return this._text;
  }

  get treeHeight() {
    return 1;
  }

  get isText() {
    return true;
  }

  get preferForSelection() {
    return this.parent?.named && this.parent.children.length === 1;
  }

  isWhitespace() {
    return this.text.trim() === "";
  }
}

export class SBBlock extends SBNode {
  _children = [];

  static named(type, range) {
    return new SBBlock(type, null, range[0], range[1], true);
  }

  static root(text, type = "document") {
    return new SBBlock(type, null, 0, text.length, true);
  }

  constructor(type, field, start, end, named) {
    super();
    this._type = type;
    this._field = field;
    this._range = [start, end];
    this._named = named;
  }

  get children() {
    return this._children;
  }

  get type() {
    return this._type;
  }

  get named() {
    return this._named;
  }

  shallowClone() {
    const b = new SBBlock(
      this.type,
      this.field,
      this.range[0],
      this.range[1],
      this.named,
    );
    if (this.isRoot) {
      b._sourceString = this._sourceString;
      b._language = this._language;
    }
    return b;
  }

  addChild(child) {
    this._children.push(child);
    child._parent = this;
  }

  removeChild(child) {
    this._children.splice(this._children.indexOf(child), 1);
    child._parent = null;
  }

  insertChild(child, index) {
    if (child._parent) child._parent.removeChild(child);
    this._children.splice(index, 0, child);
    child._parent = this;
  }

  appendChild(child) {
    this.insertChild(child, this.children.length);
  }

  appendAll(children) {
    for (const child of children) this.insertChild(child, this.children.length);
  }

  get text() {
    if (this.children.length === 0) return this.sourceString;
    if (this.children.length === 1) return this.children[0].text;
    return "";
  }

  get structureHash() {
    return (this._structureHash ??= hashCombine(
      hash(this.type),
      this.children.reduce((a, node) => hashCombine(a, node.structureHash), 0),
    ));
  }
  get literalHash() {
    return (this._literalHash ??= hashCombine(
      this.children.reduce((a, node) => hashCombine(a, node.literalHash), 0),
    ));
  }

  get isExpression() {
    return this.language.isExpression(this);
  }
}

// a fake root for a list of nodes, for use in e.g. a shard
export class SBList extends SBNode {
  constructor(list) {
    super();
    this.list = list;
    console.assert(list.length > 0);
  }

  get children() {
    return this.list;
  }

  get type() {
    return "__SB_LIST";
  }

  get parent() {
    const p = this.list[0].parent;
    console.assert(p !== this);
    return p;
  }

  get id() {
    return this.list.map((a) => a.id).join(":");
  }

  get range() {
    return [this.list[0].range[0], this.list[this.list.length - 1].range[1]];
  }

  equals(node) {
    if (!(node instanceof SBList)) return false;
    if (this.list.length !== node.list.length) return false;
    for (let i = 0; i < this.list.length; i++) {
      if (!this.list[i].equals(node.list[i])) return false;
    }
    return true;
  }
}
