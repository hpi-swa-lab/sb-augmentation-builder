import { useContext, useEffect } from "../external/preact-hooks.mjs";
import { createContext } from "../external/preact.mjs";
import { WeakArray, exec, last, rangeContains } from "../utils.js";
import { stickyShard } from "../view/widgets.js";
import { AttachOp, DetachOp, LoadOp, RemoveOp, TrueDiff } from "./diff.js";

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

// # Lifecycle of a change
// When a change occurs, the view calls SBEditor.applyChanges().
// The editor then join this change with any pending changes (see below).
// It then computes the diff between the last valid state and the state after
// applying all changes. With that diff, we call the registered extensions
// in the following way:
// * beforeModelChange(modelDiff) --> may reject change (see below)
// * modelChange(diff)
// Now the editor will call the view implementation to apply the change.
// We then proceed calling extensions:
// * viewChange(viewDiff)
// And finally ensure that the cursor is still in a valid position.
//
// ## Rejecting and Pending Changes
// When a change is rejected by an extension, we collect the raw change
// in a pendingChanges list. The editor offers functions to force apply
// the pendingChanges, or to revert them.
//
// # View Implementation
// The view implementation is responsible for:
// * translating a modelDiff into a viewDiff by
//   - creating/updating host editor instances (shards)
//   - creating/updating replacements or widgets next to source code
// * dispatching changes in shards to the editor
// * interfacing with SBSelection to handle cursor movement across
//   selectable elements
//
// On file load, the model diff will contain load and attach operations for
// the entire AST. The view implementation always holds at its root a shard
// that points to the AST root. Each shard may override or inherit a list of
// extensions that are active within that shard. The root shard inherits its
// list from the editor.
//
// ## Replacements
// Replacements are user interface widgets that stand in the place of an AST
// node. They may contain shards to nest host editor instances that, again,
// may contain replacements.
// Replacements are provided by extensions.

// * push root shard to queue
// * pop from queue
//   * match replacements sorted by query depth
//     - match: create replacement and push shards to queue
//     - no match: create/update view nodes for children and push to queue

// ### Query Depth Examples
// (program) -> 1
// (true) -> 1
// (function (body (true))) -> 3
// (function (name ="hello")) -> 2

// how do changes stack across shards? how can we only create html where necessary? how do ranges play into it?
// what is another replacement subsumes a sticky replacement? what if it nests it?
// what about offscreen changes that are rejected?

/*
 * shards contain views/text and replacements
 * when a new shard is created, we need to check if new replacements want to act on those views
 * when a change occurs, we want to do the minimal number of checks, asking
    (a) replacements whether they need to be created/removed/updated/moved
    (b) replacements if their shards now match a different node
    (c) replacements if values they pulled out of the tree need to be updated
 * a change implies that we have to recheck up to [query depth] above and below the change's boundaries
 * we know that a replacement can only match in a useful manner if its root node is *visible*
    -> we need to go top-down to see if a replacement higher up in the tree consumes roots that other replacements would have needed
    -> a shard needs to be able to let us iterate over nodes that are visible

    on change:
    * for each (new) shard
      * iterate over visible nodes and nested replacement roots
        * run replacement queries
          * on existing: update()
          * on new: createAndReplace()
          * on node that was replacement root but no longer matches: uninstall() --> iterate over that part too
    (we can use [shard, node] tuples to uniquely identify view nodes)
 */

export class SBShard {
  stickyNodes = new Set();

  markSticky(node, sticky) {
    if (sticky) this.stickyNodes.add(node);
    else this.stickyNodes.remove(node);
  }

  // *iterateVisible() {
  //   let queue = [this.node];
  //   while (queue.length > 0) {
  //     const node = queue.pop();
  //     const replacement = this.replacementInstances[node];
  //     yield [node, replacement];
  //     if (!replacement) for (const child of node) queue.push(child);
  //   }
  // }

  onTextChange(change) {
    const change = this.extensions.filterChange(change);
    this.editor.applyChanges([change]);
  }

  approveDiff(diff) {
    for (const op of diff) {
      if (op instanceof RemoveOp && this.stickyNodes.includes(op.node))
        return false;
    }
    return true;
  }

  init(node) {
    this.node = node;
  }

  applyDiff(editBuffer, changes) {
    // for (const [node, instance] of this.iterateVisible) {
    //   for (const replacement of this.extensions.replacements) {
    //     const matches = replacement.query.matches(node);
    //     const isReplaced =
    //       replacement.name === instance.getAttribute("data-sb-replaced");
    //     if (matches && isReplaced) {
    //       this.updateReplacement(instance);
    //     } else if (!matches && isReplaced) {
    //       this.uninstallReplacement(instance, node);
    //     } else if (matches && !isReplaced) {
    //       this.installReplacement(replacement, node);
    //     }
    //   }
    // }

    for (const change of editBuffer.ops) {
      if (!this.isShowing(change.node)) continue;

      for (const dataModifier of this.extensions.dataModifiers.sort(
        (a, b) => a.priority - b.priority
      )) {
        const hash = `${change.node}:${dataModifier.name}`;
        if (change instanceof AttachOp && !this.attachedData[hash]) {
          dataModifier.attach(this, change.node);
          this.attachedData[hash] = true;
        } else if (change instanceof DetachOp && this.attachedData[hash]) {
          dataModifier.detach(this, change.node);
          delete this.attachedData[hash];
        }
      }
    }
  }

  cssClass(node, cls, add) {
    throw "subclass responsibility";
  }

  _renderReplacement(instance, component) {
    render(
      instance,
      h(ShardContext.Provider, { value: this }, h(component, { node }))
    );
  }
  installReplacement(node, { component, sticky }) {
    const instance = document.createElement("span");
    if (sticky) this.markSticky(node, true);
    this._renderReplacement(instance, component);
    return instance;
  }
  uninstallReplacement(node) {
    this.markSticky(node, false);
  }
}

class CodeMirrorShard extends SBShard {
  init(node) {
    // TODO
    this.cm = null;
  }

  isShowing(node) {
    if (!rangeContains(this.node.range, node.range)) return false;
    const marks = this.cm.findMarksAt(node.range[0] - this.node.range[0]);
    return !marks.some((m) => !!m.replacedWith);
  }

  applyChanges(editBuffer, changes) {
    // TODO update text and range according to the changes list

    super.applyChanges(editBuffer, changes);
  }

  cssClass() {
    // noop, we have our own syntax highlighting
  }

  installReplacement() {
    const instance = super.installReplacement(node, args);
    // TODO tag vs element
    this.livelyCM.wrapWidgetSync(instance, ...pos);
  }
}

class SandblocksShard extends SBShard {
  views = {};

  isShowing(node) {
    return !!this.views[node];
  }

  cssClass(node, cls, add) {
    this.views[node].classList.toggle(cls, add);
  }

  installReplacement(node, args) {
    const instance = super.installReplacement(node, args);
    this.views[node].replaceWith(instance);
    this.views[node] = instance;
  }

  uninstallReplacement(node) {
    super.uninstallReplacement(node);
    this.views[node].replaceWith(node.toHTML());
  }

  applyDiff(editBuffer, changes) {
    for (const change of editBuffer.ops) {
      if (change instanceof DetachOp) {
        change.node.allNodesDo((n) => {
          const view = this.views[n];
          if (view) {
            editBuffer.rememberView(view);
            view.remove();
            delete this.views[change.node];
          }
        });
      }
    }

    super.applyDiff(editBuffer, changes);

    for (const change of editBuffer) {
      if (change instanceof AttachOp) {
        if (this.views[change.parent]) {
          const view = editBuffer.recallView(change.node) ?? node.toHTML();
          this.views[change.parent].insertNode(view, change.index);
        } else if (!change.node.isRoot && this.node.isRoot) {
          this.node = change.node;
          this.appendChild(editBuffer.recallView(change.node) ?? node.toHTML());
        }
      }
      if (change instanceof UpdateOp) {
        this.views[change.node]?.setAttribute("text", this.text);
      }
    }
  }
}

const ShardContext = createContext(null);

function stickyShard(node) {
  const owner = useContext(ShardContext);
  useEffect(() => {
    owner.markSticky(node, true);
    return () => owner.markSticky(node, false);
  });
  return shard(node);
}

const PRIORITY_AUGMENT = 100;
const PRIORITY_REPLACE = 200;

const Highlight = {
  query: [(x) => x.type === "number"],
  name: "css:number",
  attach: (shard, node) => shard.cssClass(node, "number", true),
  detach: (shard, node) => shard.cssClass(node, "number", false),
  priority: PRIORITY_AUGMENT,
};

const BrowserReplacementData = {
  query: [(x) => x.type === "program"],
  name: "replacement:number",
  attach: (shard, node) => shard.installReplacement(node),
  detach: (shard, node) => shard.uninstallReplacement(node),
};

const BrowserReplacement = {
  query: [(x) => x.type === "program"],
  component: ({ shard, node }) => {
    const functions = node.childBlocks;
    return functions.map((f) => stickyShard(f));
  },
  name: "sb-browser",
  sticky: true,
  priority: PRIORITY_REPLACE,
};

export class SBEditor {
  pendingChanges = [];

  revertPendingChanges() {
    for (const change of this.pendingChanges.reverse()) {
      change.undo();
    }
    this.pendingChanges = [];
  }

  forceApplyPendingChanges() {
    this.applyChanges([], true);
  }

  // changes: {shard, from: number, to: number, insert: number, undo: () => {}}[]
  // undo reverts any eager changes to the view
  applyChanges(changes, force = false) {
    this.pendingChanges.push(...changes);

    let newSource = this.sourceString;
    for (const change of this.pendingChanges)
      newSource = applyChange(newSource, change);

    const [diff, tx] = this.diff(this.sourceString, newSource);

    for (const shard of this.shards) {
      // do not short-circuit as approveDiff may prepare data
      if (!shard.approveDiff(diff) || force) {
        tx.rollback();
        return;
      }
    }

    tx.commit();
    this.pendingChanges = [];

    for (const shard of this.shards) {
      shard.applyDiff(diff);
    }
  }
}

class OffscreenEditor extends SBEditor {
  root = null;

  constructor(root) {
    super();
    this.root = root;
  }

  replaceTextFromCommand([from, to], text) {
    const s = this.root.sourceString;
    this.root.updateModelAndView(s.slice(0, from) + text + s.slice(to));
  }
}

export class SBLanguage {
  constructor({ name, extensions, defaultExtensions }) {
    this.name = name;
    this.extensions = extensions;
    this.defaultExtensions = defaultExtensions;
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
  parse(text, oldRoot = null) {}

  destroyRoot(root) {}

  async initModelAndView(text) {
    await this.ready();

    text = this._ensureTrailingLineBreak(text);
    return this._assignState(this.parse(text), text);
  }

  async parseOffscreen(text) {
    await this.ready();
    const root = this.parse(text);
    root._language = this;
    root._sourceString = text;
    root._editor = new OffscreenEditor(root);
    return root;
  }

  updateModelAndView(text, oldRoot) {
    console.assert(oldRoot);
    text = this._ensureTrailingLineBreak(text);

    const { tx, root, diff } = new TrueDiff().applyEdits(
      oldRoot,
      this.parse(text, oldRoot)
    );
    root._language = this;
    tx.set(root, "_sourceString", text);
    return { tx, root, diff };
  }

  _ensureTrailingLineBreak(text) {
    return last(text) === "\n" ? text : text + "\n";
  }

  _assignState(root, text) {
    root._language = this;
    root._sourceString = text;
    return root;
  }
}

let _nodeId = 0;
function _nextNodeId() {
  return _nodeId++;
}

class SBNode {
  _parent = null;

  constructor() {
    this._id = _nextNodeId().toString();
  }

  equals(node) {
    return this === node;
  }

  exec(...script) {
    return exec(this, ...script);
  }

  internalClone() {
    const c = this.shallowClone();
    c._id = this._id;
    for (const child of this.children) {
      c.appendChild(child.internalClone());
    }
    return c;
  }

  get language() {
    return this.isRoot ? this._language : this.root.language;
  }

  get id() {
    return this._id;
  }

  get children() {
    return [];
  }
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
    return !!this._language;
  }

  get sourceString() {
    return this.root._sourceString.slice(...this.range);
  }

  get preferForSelection() {
    // named or likely a keyword
    return this.named || this.text.match(/^[A-Za-z]+$/);
  }

  get depth() {
    return this.parent ? this.parent.depth + 1 : 0;
  }

  get connected() {
    return this.root.isRoot;
  }

  toHTMLExpanded() {
    // return this.toHTML(this.depth + 2);
    return this.toHTML();
  }

  updateModelAndView(text) {
    return this.language.updateModelAndView(text, this);
  }

  destroy() {
    this._language.destroyRoot(this);
  }

  createShard() {
    return this.editor.createShardFor(this);
  }

  viewsDo(cb) {
    if (this._views) this._views.forEach(cb);
  }

  get views() {
    const out = [];
    this._views.forEach((v) => out.push(v));
    return out;
  }

  // quick way to obtain a view to the element, should only be used for debugging
  get debugView() {
    return last(this._views?._array).deref();
  }

  get editor() {
    if (this.root._editor) return this.root._editor;
    let editor = null;
    this.root.viewsDo((view) => !editor && (editor = view.editor));
    return editor;
  }

  get context() {
    return this.editor?.context;
  }

  get field() {
    return this._field;
  }

  atField(field) {
    return this.children.find((child) => child.field === field);
  }

  atType(type) {
    return this.children.find((child) => child.type === type);
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

  get childBlocks() {
    return this.children.filter((child) => !!child.named);
  }

  get nextSiblingBlock() {
    if (this.isRoot) return null;
    let pickNext = false;
    for (const sibling of this.parent.children) {
      if (pickNext && sibling.named) return sibling;
      if (sibling === this) pickNext = true;
    }
    return null;
  }

  get nextSiblingNode() {
    if (this.isRoot) return null;
    let pickNext = false;
    for (const sibling of this.parent.children) {
      if (pickNext && !sibling.isWhitespace()) return sibling;
      if (sibling === this) pickNext = true;
    }
    return null;
  }

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
    return this.parent.children.indexOf(this);
  }

  get previousSiblingChild() {
    return this.parent.children[this.siblingIndex - 1];
  }

  get nextSiblingChild() {
    return this.parent.children[this.siblingIndex + 1];
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

  leafForPosition(pos) {
    if (this.range[0] <= pos && this.range[1] >= pos) {
      for (const child of this.children) {
        const match = child.leafForPosition(pos);
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

  orParentThat(predicate) {
    if (predicate(this)) return this;
    else return this.parent?.orParentThat(predicate);
  }

  insert(string, type, index) {
    const list = this.childBlocks.filter(
      (child) =>
        child.compatibleWith(type) && this.language.separatorContextFor(child)
    );
    // handle empty list by finding any slot that takes the type
    if (list.length === 0) {
      const position = this.language.firstInsertPoint(this, type);
      if (position !== null)
        this.editor.insertTextFromCommand(position, string);
      else throw new Error("no insert point found");
      return;
    }

    const ref = list[Math.min(index, list.length - 1)];
    const sep = this.language.separatorContextFor(ref);

    if (index < list.length)
      this.editor.insertTextFromCommand(ref.range[0], string + sep);
    else this.editor.insertTextFromCommand(ref.range[1], sep + string);
  }

  insertBefore(string, type) {
    this.parent.insert(string, type, this.parent.childBlocks.indexOf(this));
  }

  insertAfter(string, type) {
    this.parent.insert(string, type, this.parent.childBlocks.indexOf(this) + 1);
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

  removeFull() {
    const remove = this.removalNodes;
    this.editor.replaceTextFromCommand(
      [remove[0].range[0], last(remove).range[1]],
      ""
    );
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

  get isText() {
    return false;
  }

  get treeHeight() {
    if (this._treeHeight) return this._treeHeight;

    let height = 0;
    for (const child of this.children) {
      height = Math.max(height, child.treeHeight);
    }
    return height + 1;
  }

  // edit operations
  replaceWith(str) {
    if (typeof str === "number") str = str.toString();
    this.editor.replaceTextFromCommand(this.range, str);
  }

  wrapWith(start, end) {
    this.editor.replaceTextFromCommand(
      this.range,
      `${start}${this.sourceString}${end}`
    );
  }

  select(adjacentView) {
    adjacentView.editor.findNode(this).select();
  }

  get isSelected() {
    return this.editor.selected?.node === this;
  }

  cleanDiffData() {
    this._structureHash = null;
    this._literalHash = null;
    this.share = null;
    this.assigned = null;
    this.literalMatch = null;
    for (const child of this.children) {
      child.cleanDiffData();
    }
  }

  // queries
  query(string, extract = null) {
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

  toHTML() {
    const text = document.createElement("sb-text");
    text.setAttribute("text", this.text);
    text.node = this;
    (this._views ??= new WeakArray()).push(text);
    return text;
  }
}

export class SBBlock extends SBNode {
  _children = [];

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
    return new SBBlock(
      this.type,
      this.field,
      this.range[0],
      this.range[1],
      this.named
    );
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

  get text() {
    return this.children.length === 1 && this.children[0].isText
      ? this.children[0].text
      : "";
  }

  get structureHash() {
    return (this._structureHash ??= hashCombine(
      hash(this.type),
      this.children.reduce((a, node) => hashCombine(a, node.structureHash), 0)
    ));
  }
  get literalHash() {
    return (this._literalHash ??= hashCombine(
      this.children.reduce((a, node) => hashCombine(a, node.literalHash), 0)
    ));
  }

  toHTML(maxDepth = Infinity) {
    let block;
    if (
      this.depth >= maxDepth &&
      this.sourceString.length > 200 &&
      this.children.length > 1
    ) {
      block = document.createElement("sb-collapse");
    } else {
      block = document.createElement("sb-block");
      for (const child of this.children) {
        block.appendChild(child.toHTML(maxDepth));
      }
    }
    block.node = this;
    (this._views ??= new WeakArray()).push(block);
    return block;
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
    throw new Error("FIXME: SBList has no type");
  }

  get parent() {
    return this.list[0].parent;
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

  toHTML() {
    if (false) {
      return this.list.map((ea) => ea.toHTML());
    } else {
      const list = document.createElement("sb-view-list");
      for (const child of this.list) {
        list.appendChild(child.toHTML());
      }
      list.node = this;
      (this._views ??= new WeakArray()).push(list);
      return list;
    }
  }
}
