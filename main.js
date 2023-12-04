"use strict";

let language;
let queries;

(async () => {
  await TreeSitter.init();
  language = await TreeSitter.Language.load("tree-sitter-smalltalk.wasm");

  const snippet = document.createElement("sb-snippet");
  snippet.setAttribute("text", "a 23 sbWatch");
  document.body.appendChild(snippet);
})();

registerQuery("always", [
  (x) => false,
  (x) => x.type === "unary_message",
  (x) => nodeText(nodeChildNode(x, 1)) === "sbWatch",
  (x) => installReplacement(x, "sb-watch"),
]);

customElements.define(
  "sb-shard",
  class Shard extends HTMLElement {
    source = null;
    update(node) {
      this.innerHTML = "";
      this.appendChild(nodeToHTML(node));
      this.source = node;
    }
  }
);

class Replacement extends HTMLElement {
  shards = [];

  update(source) {
    for (const [locator, shard] of this.shards) {
      const node = locator(source);
      if (node !== shard.source) {
        shard.update(node);
      }
    }
  }

  init(source) {}

  createShard(locator) {
    const shard = document.createElement("sb-shard");
    this.shards.push([locator, shard]);
    return shard;
  }
}

customElements.define(
  "sb-watch",
  class Watch extends Replacement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<span>WATCH</span>`;
    }

    init(source) {
      super.init(source);
      this.shadowRoot.appendChild(
        this.createShard((source) => nodeChildNode(source, 0))
      );
    }
  }
);

function runQuery(query, arg) {
  let current = arg;
  for (const predicate of query) {
    if (Array.isArray(predicate)) {
      current = runQuery(predicate, current);
      if (!current) return null;
    } else {
      let next = predicate(current);
      if (!next) return null;
      if (Array.isArray(next) && next.length < 1) return null;
      if (next !== true) current = next;
    }
  }
}

function installReplacement(node, tag) {
  nodeViewsDo(node, (view) => {
    if (view.tagName === tag) {
      view.update(node);
    } else {
      const replacement = document.createElement(tag);
      replacement.init(node);
      replacement.update(node);
      view.replaceWith(replacement);
    }
  });
}

// get parent that is an sb-snippet, across shadow roots
function getSnippet(block) {
  let parent =
    block.getRootNode() === document ? block : block.getRootNode().host;
  while (parent && parent.tagName !== "SB-SNIPPET") {
    parent = parent.parentElement;
  }
  return parent;
}

function registerQuery(trigger, query) {
  if (!queries) queries = new Map();
  if (!queries.has(trigger)) queries.set(trigger, []);
  queries.get(trigger).push(query);
}

function getGlobalCursorPosition(root) {
  const selection = root.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      const parentElement = container.getRootNode().host;
      if (parentElement?.tagName === "SB-TEXT") {
        return parentElement.getRange()[0] + range.startOffset;
      }
    }
  }
  return null;
}

customElements.define(
  "sb-snippet",
  class Snippet extends HTMLElement {
    static observedAttributes = ["text"];

    currentTree = null;
    currentRoot = null;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<slot></slot>`;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "text") {
        const parser = new TreeSitter();
        parser.setLanguage(language);

        const text = newValue;
        // TODO reuse currentTree (breaks indices?)
        const newTree = parser.parse(text);
        if (this.currentTree) this.currentTree.delete();
        let newRoot = nodeFromCursor(newTree.walk(), text);

        if (this.currentRoot) {
          newRoot = new TrueDiff().compare(this.currentRoot, newRoot);
        } else {
          this.appendChild(nodeToHTML(newRoot));
        }

        this.currentTree = newTree;
        this.currentRoot = newRoot;

        this.reRunQueries("always", "open");
      }
    }

    restoreCursor(cursor) {
      let node = this.currentRoot;
      let index = 0;
      while (node.kind === "node") {
        for (const child of node.children) {
          if (child.range[0] <= cursor && child.range[1] >= cursor) {
            node = child;
            break;
          }
          index++;
        }
      }

      nodeViewsDo((textNode) => {
        if (getSnippet(textNode) !== self) return;
        const root = textNode.input().getRootNode();

        const range = document.createRange();
        range.setStart(textNode.input(), cursor - node.range[0]);
        range.setEnd(textNode.input(), cursor - node.range[0]);

        const selection = root.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
    }

    reRunQueries(...triggers) {
      for (const trigger of triggers) {
        if (queries.has(trigger)) {
          nodeAllDo(this.currentRoot, (node) => {
            for (const query of queries.get(trigger)) {
              runQuery(query, node);
            }
          });
        }
      }
    }

    edit(input, cursor) {
      const currentText = this.getAttribute("text");
      const newText =
        currentText.slice(0, cursor) + input + currentText.slice(cursor);
      this.setAttribute("text", newText);
      this.restoreCursor(cursor + input.length);
    }
  }
);

function nodeToHTML(node) {
  if (node.kind === "text") {
    const text = document.createElement("sb-text");
    text.setAttribute("text", node.text);
    text.node = node;
    (node.views ??= []).push(new WeakRef(text));
    return text;
  } else {
    const block = document.createElement("sb-block");
    for (const child of node.children) {
      block.appendChild(nodeToHTML(child));
    }
    block.node = node;
    (node.views ??= []).push(new WeakRef(block));
    return block;
  }
}

customElements.define(
  "sb-block",
  class Block extends HTMLElement {
    _node = null;
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: inline-block;
                padding: 2px 0;
                display: flex;
                border: 1px solid #ccc;
                align-items: center;
            }
        </style>
        <slot></slot>
        `;
    }
    set node(v) {
      this._node = v;
      this.setAttribute("type", v.type);
    }
    get node() {
      return this._node;
    }
    getRange() {
      return this.node.range;
    }
  }
);

customElements.define(
  "sb-text",
  class Text extends HTMLElement {
    static observedAttributes = ["text"];

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
            :host {
                display: inline-block;
                font-family: monospace;
            }
            span {
                outline: none;
            }
        </style>
        <span contenteditable></span>`;
      this.addEventListener("input", (event) => {
        const input = event.data;
        const cursor = getGlobalCursorPosition(this.shadowRoot) - input.length;

        // undo effect, the diffing will apply it
        this.shadowRoot.querySelector("span").textContent =
          this.getAttribute("text");

        if (input && cursor !== null) {
          getSnippet(this).edit(input, cursor);
        }
      });
    }

    input() {
      return this.shadowRoot.querySelector("span").childNodes[0];
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "text")
        this.shadowRoot.querySelector("span").textContent = newValue;
    }
    getRange() {
      return this.node.range;
    }
  }
);

/* converting cursor to blocks */
function addTextFromCursor(cursor, node, isLeaf, text) {
  const gap = text.slice(lastLeafIndex, cursor.startIndex);
  if (gap) {
    nodeAddChild(node, {
      kind: "text",
      children: [],
      text: gap.replace(/\s/g, "\u00A0"),
      range: [lastLeafIndex, cursor.startIndex],
    });
  }

  lastLeafIndex = cursor.endIndex;

  if (isLeaf) {
    nodeAddChild(node, {
      kind: "text",
      children: [],
      text: cursor.nodeText,
      range: [cursor.startIndex, cursor.endIndex],
    });
  }
}

let lastLeafIndex;
function nodeFromCursor(cursor, text) {
  lastLeafIndex = 0;
  return _nodeFromCursor(cursor, text);
}

function _nodeFromCursor(cursor, text) {
  const node = {
    kind: "node",
    children: [],
    type: cursor.nodeType,
    field: cursor.nodeField,
    range: [cursor.startIndex, cursor.endIndex],
  };

  if (cursor.gotoFirstChild()) {
    do {
      addTextFromCursor(cursor, node, false, text);
      nodeAddChild(node, _nodeFromCursor(cursor, text));
    } while (cursor.gotoNextSibling());
    addTextFromCursor(cursor, node, false, text);
    cursor.gotoParent();
  } else {
    addTextFromCursor(cursor, node, true, text);
  }

  return node;
}

/* diffing two ts trees */
function nodeStructureHash(node) {
  return (node.structureHash ??= md5(
    node.kind === "text"
      ? "text" // hard-coded, arbitrary constant value
      : node.type + node.children.map(nodeStructureHash).join("")
  ));
}
function nodeLiteralHash(node) {
  return (node.literalHash ??= md5(
    node.kind === "text"
      ? node.text
      : node.children.map(nodeLiteralHash).join("")
  ));
}
function nodeViewsDo(node, cb) {
  if (!node.views) return;
  let anyRemoved = false;
  for (const view of node.views) {
    const v = view.deref();
    if (v) cb(v);
    else anyRemoved = true;
  }
  if (anyRemoved) node.views = node.views.filter((view) => view.deref());
}
function nodeUri(node) {
  return node;
}
function nodeField(node, field) {
  return node.children.find((child) => child.field === field);
}
function nodePrint(node, level = 0) {
  let out = "";
  for (let i = 0; i < level; i++) out += "  ";
  out += node.type ?? `"${node.text}"`;
  out += "\n";
  for (const child of node.children) {
    out += nodePrint(child, level + 1);
  }
  return out;
}
function nodeChildNode(node, index) {
  for (let i = 0; i < node.children.length; i++) {
    if (!isWhitespace(node.children[i])) {
      if (index === 0) return node.children[i];
      index--;
    }
  }
  return null;
}
function nodeText(node) {
  if (node.kind === "text") {
    return node.text;
  } else {
    return node.children.length === 1 && node.children[0].kind === "text"
      ? node.children[0].text
      : "";
  }
}
function isWhitespace(node) {
  return node.kind === "text" && node.text.trim() === "";
}
function nodeAllDo(node, cb) {
  cb(node);
  for (const child of node.children) {
    nodeAllDo(child, cb);
  }
}
function nodeAddChild(node, child, index) {
  node.children.splice(
    index === undefined ? node.children.length : index,
    0,
    child
  );
  child.parent = node;
}
function nodeRemoveChild(node, child) {
  node.children.splice(node.children.indexOf(child), 1);
  child.parent = null;
}
function nodeAllChildrenDo(node, cb) {
  for (const child of node.children) {
    nodeAllDo(child, cb);
  }
}
function zipOrNullDo(a, b, cb) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    cb(a[i], b[i]);
  }
}
function nodeTreeHeight(node) {
  let height = 0;
  for (const child of node.children) {
    height = Math.max(height, nodeTreeHeight(child));
  }
  return height + 1;
}

class SubtreeShare {
  constructor() {
    this.availableTrees = new Map();
    this.preferredTrees = null;
  }
  registerAvailableTree(node) {
    this.availableTrees.set(nodeUri(node), node);
  }
  deregisterAvailableTree(node, registry) {
    if (node.share) {
      node.share.availableTrees.delete(nodeUri(node));
      node.share = null;
      for (const child of node.children) {
        this.deregisterAvailableTree(child, registry);
      }
    } else {
      if (node.assigned) {
        const b = node.assigned;
        this.unassignTree(node);
        nodeAllDo(b, (n) => {
          registry.assignShare(n);
        });
      }
    }
  }
  unassignTree(node) {
    node.assigned.assigned = null;
    node.assigned = null;
  }
  getPreferredTrees() {
    if (this.preferredTrees) {
      return this.preferredTrees;
    }
    this.preferredTrees = new Map();
    for (const tree of this.availableTrees.values()) {
      this.preferredTrees.set(nodeLiteralHash(tree), tree);
    }
    return this.preferredTrees;
  }
  hasPreferredTrees() {
    return !!this.preferredTrees;
  }
  takeAvailableTree(b, takePreferred, registry) {
    let a;
    if (takePreferred) {
      a = this.getPreferredTrees().get(nodeLiteralHash(b));
    } else {
      // pick any
      a = [...this.availableTrees.values()][0];
    }
    if (a) this.takeTree(a, b, registry);
    return a;
  }
  takeTree(a, b, registry) {
    a.share.availableTrees.delete(nodeUri(a));
    if (a.share.hasPreferredTrees()) {
      a.share.preferredTrees.delete(nodeLiteralHash(b));
    }
    a.share = null;
    for (const child of a.children) {
      this.deregisterAvailableTree(child, registry);
    }
    nodeAllChildrenDo(b, (n) => {
      if (n.assigned) {
        registry.assignShareAndRegisterTree(n.assigned);
      }
    });
    return a;
  }
}

function assert(condition) {
  if (!condition) {
    throw new Error("Assertion failed");
  }
}

class SubtreeRegistry {
  constructor() {
    this.subtrees = new Map();
  }
  assignShare(node) {
    node.assigned = null;
    if (this.subtrees.has(nodeStructureHash(node))) {
      return (node.share = this.subtrees.get(nodeStructureHash(node)));
    } else {
      node.share = new SubtreeShare();
      this.subtrees.set(nodeStructureHash(node), node.share);
      return node.share;
    }
  }
  assignShareAndRegisterTree(node) {
    const share = this.assignShare(node);
    share.registerAvailableTree(node);
    return share;
  }
}

class FakeWeakRef {
  constructor(value) {
    this.value = value;
  }
  deref() {
    return this.value;
  }
}

class TrueDiff {
  compare(a, b) {
    const registry = new SubtreeRegistry();

    this.assignShares(a, b, registry);
    this.assignSubtrees(a, b, registry);

    const buffer = new EditBuffer();
    const root = this.computeEditScript(a, b, null, 0, buffer);
    buffer.apply();
    // console.log(nodePrint(b));
    // console.log(nodePrint(a));
    this.cleanData(root);

    return root;
  }

  cleanData(node) {
    node.structureHash = null;
    node.literalHash = null;
    node.share = null;
    node.assigned = null;
    node.literalMatch = null;
    for (const child of node.children) {
      this.cleanData(child);
    }
  }

  // SHARES
  assignShares(a, b, registry) {
    const aShare = registry.assignShare(a);
    const bShare = registry.assignShare(b);
    if (aShare === bShare && nodeLiteralHash(a) === nodeLiteralHash(b)) {
      this.assignTree(a, b, true);
    } else {
      this.assignSharesRecurse(a, b, registry);
    }
  }
  assignTree(a, b, literalMatch) {
    a.share = null;
    a.literalMatch = literalMatch;
    if (literalMatch) {
      a.assigned = b;
      b.assigned = a;
    } else {
      this.assignTreeRecurse(a, b);
    }
  }
  assignTreeRecurse(a, b) {
    a.assigned = b;
    b.assigned = a;
    // iterate over both children arrays
    for (let i = 0; i < a.children.length; i++) {
      this.assignTreeRecurse(a.children[i], b.children[i]);
    }
  }
  assignSharesRecurse(a, b, registry) {
    if (a.nodeType === b.nodeType) {
      const aList = [...a.children];
      const bList = [...b.children];
      this.assignSharesList(aList, bList, registry);
      this.assignSharesList(aList.reverse(), bList.reverse(), registry);
      zipOrNullDo(aList, bList, (a, b) => {
        if (a) {
          if (b) {
            registry.assignShareAndRegisterTree(a);
            registry.assignShare(b);
            this.assignSharesRecurse(a, b, registry);
          } else {
            nodeAllDo(a, (n) => registry.assignShareAndRegisterTree(n));
          }
        } else {
          nodeAllDo(b, (n) => registry.assignShare(n));
        }
      });
    } else {
      nodeAllChildrenDo(a, (n) => registry.assignShareAndRegisterTree(n));
      nodeAllChildrenDo(b, (n) => registry.assignShare(n));
    }
  }
  assignSharesList(aList, bList, registry) {
    while (aList.length > 0 && bList.length > 0) {
      const aShare = registry.assignShare(aList[0]);
      const bShare = registry.assignShare(bList[0]);
      if (aShare === bShare) {
        this.assignTree(aList.shift(), bList.shift(), false);
      } else {
        break;
      }
    }
  }

  // SUBTREES
  assignSubtrees(a, b, registry) {
    const queue = new SortedArray((a, b) => {
      return nodeTreeHeight(b) - nodeTreeHeight(a);
    });
    queue.insert(b);

    while (queue.array.length > 0) {
      const level = nodeTreeHeight(queue.array[0]);
      const nextNodes = [];
      while (
        queue.array.length > 0 &&
        nodeTreeHeight(queue.array[0]) === level
      ) {
        const next = queue.array.shift();
        if (!next.assigned) nextNodes.push(next);
      }

      let unassigned = nextNodes;
      unassigned = this.selectAvailableTree(unassigned, true, registry);
      unassigned = this.selectAvailableTree(unassigned, false, registry);
      for (const node of unassigned) {
        for (const child of node.children) {
          queue.insert(child);
        }
      }
    }
  }
  selectAvailableTree(unassigned, literalMatch, registry) {
    return unassigned.filter((b) => {
      if (b.assigned) {
        return false;
      } else {
        const a = b.share.takeAvailableTree(b, literalMatch, registry);
        if (a) {
          this.assignTree(a, b, literalMatch);
          return false;
        } else {
          return true;
        }
      }
    });
  }

  // edit script
  computeEditScript(a, b, parent, link, editBuffer) {
    if (a.assigned && nodeUri(a.assigned) === nodeUri(b)) {
      const newTree = a.literalMatch
        ? a
        : this.updateLiterals(a, b, editBuffer);
      a.assigned = null;
      return newTree;
    }

    if (!a.assigned && !b.assigned) {
      const newTree = this.computeEditScriptRecurse(
        a,
        b,
        parent,
        link,
        editBuffer
      );
      if (newTree) return newTree;
    }

    if (a.type === b.type && !a.assigned && !b.assigned) {
      for (const child of a.children) {
        editBuffer.detach(child);
        this.unloadUnassigned(child, editBuffer);
      }
      let index = 0;
      for (const child of b.children) {
        const newTree = this.loadUnassigned(child, editBuffer);
        editBuffer.attach(newTree, a, index);
        index++;
      }
      return a;
    }

    editBuffer.detach(a);
    this.unloadUnassigned(a, editBuffer);
    const newTree = this.loadUnassigned(b, editBuffer);
    editBuffer.attach(newTree, parent, link);
  }
  computeEditScriptRecurse(a, b, parent, link, editBuffer) {
    if (a.type === b.type && a.children.length === b.children.length) {
      a.range = b.range;
      for (let i = 0; i < a.children.length; i++) {
        this.computeEditScript(a.children[i], b.children[i], a, i, editBuffer);
      }
      return a;
    } else {
      return null;
    }
  }
  updateLiterals(a, b, editBuffer) {
    a.range = b.range;
    if (a.text !== b.text) editBuffer.update(a, b.text);
    for (let i = 0; i < a.children.length; i++) {
      this.updateLiterals(a.children[i], b.children[i], editBuffer);
    }
    return a;
  }
  unloadUnassigned(a, editBuffer) {
    if (a.assigned) {
      a.assigned = null;
    } else {
      editBuffer.remove(a);
      for (const child of a.children) {
        this.unloadUnassigned(child, editBuffer);
      }
    }
  }
  loadUnassigned(b, editBuffer) {
    if (b.assigned) {
      return this.updateLiterals(b.assigned, b, editBuffer);
    } else {
      const newTree = { ...b, children: [] };
      b.children.forEach((child, index) => {
        const newChild = this.loadUnassigned(child, editBuffer);
        editBuffer.attach(newChild, newTree, index);
      });
      return newTree;
    }
  }
}

class DetachOp {
  constructor(node) {
    this.node = node;
  }
  apply() {
    nodeRemoveChild(this.node.parent, this.node);
    nodeViewsDo(this.node, (view) => {
      view.parentElement.removeChild(view);
    });
  }
}
class AttachOp {
  constructor(node, parent, index) {
    this.node = node;
    this.parent = parent;
    this.index = index;
  }
  apply() {
    nodeAddChild(this.parent, this.node, this.index);
    nodeViewsDo(this.parent, (parentView) => {
      parentView.insertBefore(
        nodeToHTML(this.node),
        parentView.childNodes[this.index]
      );
    });
  }
}
class UpdateOp {
  constructor(node, text) {
    this.node = node;
    this.text = text;
  }
  apply() {
    this.node.text = this.text;
    nodeViewsDo(this.node, (view) => {
      console.log(this.text);
      view.setAttribute("text", this.text);
    });
  }
}
class RemoveOp {
  constructor(node) {
    this.node = node;
  }
  apply() {}
}

class EditBuffer {
  constructor() {
    this.posBuf = [];
    this.negBuf = [];
  }
  attach(node, parent, link) {
    assert(node !== parent);
    assert(link >= 0);
    assert(node);

    this.log("attach", node.type ?? node.text, parent?.type, link);
    this.posBuf.push(new AttachOp(node, parent, link));
  }
  detach(node) {
    this.log("detach", node.type ?? node.text);
    this.negBuf.push(new DetachOp(node));
  }
  remove(node) {
    this.log("remove", node.type ?? node.text);
    this.negBuf.push(new RemoveOp(node));
  }
  update(node, text) {
    assert(node.views.length > 0);
    this.log("update", node.type ?? node.text, text);
    this.posBuf.push(new UpdateOp(node, text));
  }
  apply() {
    this.negBuf.forEach((f) => f.apply());
    this.posBuf.forEach((f) => f.apply());
  }
  log(...op) {
    console.log(...op);
  }
}

class SortedArray {
  constructor(compare) {
    this.array = [];
    this.compare = compare;
  }

  insert(value) {
    const index = this.array.findIndex((v) => this.compare(v, value) > 0);
    if (index === -1) {
      this.array.push(value);
    } else {
      this.array.splice(index, 0, value);
    }
  }
}
