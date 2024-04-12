import { SortedArray, zipOrNullDo } from "../utils.js";

class SubtreeShare {
  constructor() {
    this.availableTrees = new Map();
    this.preferredTrees = null;
  }
  registerAvailableTree(node) {
    this.availableTrees.set(node, node);
  }
  deregisterAvailableTree(node, registry) {
    if (node.share) {
      node.share.availableTrees.delete(node);
      node.share = null;
      for (const child of node.children) {
        this.deregisterAvailableTree(child, registry);
      }
    } else {
      if (node.assigned) {
        const b = node.assigned;
        this.unassignTree(node);
        b.allNodesDo((n) => {
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
      this.preferredTrees.set(tree.literalHash, tree);
    }
    return this.preferredTrees;
  }
  hasPreferredTrees() {
    return !!this.preferredTrees;
  }
  takeAvailableTree(b, takePreferred, registry) {
    let a;
    if (takePreferred) {
      a = this.getPreferredTrees().get(b.literalHash);
    } else {
      // pick any
      a = [...this.availableTrees.values()][0];
    }
    if (a) this.takeTree(a, b, registry);
    return a;
  }
  takeTree(a, b, registry) {
    a.share.availableTrees.delete(a);
    if (a.share.hasPreferredTrees()) {
      a.share.preferredTrees.delete(b.literalHash);
    }
    a.share = null;
    for (const child of a.children) {
      this.deregisterAvailableTree(child, registry);
    }
    b.allChildrenDo((n) => {
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
    if (this.subtrees.has(node.structureHash)) {
      return (node.share = this.subtrees.get(node.structureHash));
    } else {
      node.share = new SubtreeShare();
      this.subtrees.set(node.structureHash, node.share);
      return node.share;
    }
  }
  assignShareAndRegisterTree(node) {
    const share = this.assignShare(node);
    share.registerAvailableTree(node);
    return share;
  }
}

export class TrueDiff {
  detectEdits(a, b) {
    if (false) {
      console.log(a.print(0, true), b.print(0, true));
    }
    const registry = new SubtreeRegistry();

    this.assignShares(a, b, registry);
    this.assignSubtrees(a, b, registry);

    const buffer = new EditBuffer();
    const root = this.computeEditScript(a, b, null, 0, buffer);
    return { root, diff: buffer };
  }

  applyEdits(a, b, leaveInfoForDebug = false) {
    const { root, diff } = this.detectEdits(a, b);

    const tx = new Transaction();
    diff.apply(tx);
    this.recurseParallel(b, root, (b, a) => {
      tx.set(a, "_range", b.range);
      if (a._field !== b._field) tx.set(a, "_field", b._field);
    });

    if (!leaveInfoForDebug) root.cleanDiffData();

    return { root, tx, diff };
  }

  recurseParallel(a, b, cb) {
    cb(a, b);
    for (let i = 0; i < a.children.length; i++) {
      this.recurseParallel(a.children[i], b.children[i], cb);
    }
  }

  // SHARES
  assignShares(a, b, registry) {
    const aShare = registry.assignShare(a);
    const bShare = registry.assignShare(b);
    if (aShare === bShare && a.literalHash === b.literalHash) {
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
    if (a.type === b.type) {
      const aList = [...a.children];
      const bList = [...b.children];
      this.assignSharesList(aList, bList, registry);
      this.assignSharesList(aList.reverse(), bList.reverse(), registry);
      zipOrNullDo(aList.reverse(), bList.reverse(), (a, b) => {
        if (a) {
          if (b) {
            registry.assignShareAndRegisterTree(a);
            registry.assignShare(b);
            this.assignSharesRecurse(a, b, registry);
          } else {
            a.allNodesDo((n) => registry.assignShareAndRegisterTree(n));
          }
        } else {
          b.allNodesDo((n) => registry.assignShare(n));
        }
      });
    } else {
      a.allChildrenDo((n) => registry.assignShareAndRegisterTree(n));
      b.allChildrenDo((n) => registry.assignShare(n));
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
      return b.treeHeight - a.treeHeight;
    });
    queue.insert(b);

    while (queue.array.length > 0) {
      const level = queue.array[0].treeHeight;
      const nextNodes = [];
      while (queue.array.length > 0 && queue.array[0].treeHeight === level) {
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
    if (a.assigned && a.assigned === b) {
      const newTree = a.literalMatch
        ? a
        : this.updateLiterals(a, b, editBuffer);
      a.assigned = null;
      return newTree;
    }

    if (!a.assigned && !b.assigned) {
      const newTree = this.computeEditScriptRecurse(a, b, editBuffer);
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
    return newTree;
  }
  computeEditScriptRecurse(a, b, editBuffer) {
    if (a.type === b.type) {
      const aList = [...a.children];
      const bList = [...b.children];
      this.computeEditScriptList(aList, bList, a, editBuffer);
      this.computeEditScriptList(
        aList.reverse(),
        bList.reverse(),
        a,
        editBuffer,
      );
      zipOrNullDo(aList.reverse(), bList.reverse(), (aChild, bChild) => {
        if (aChild?.assigned && aChild.assigned === bChild) {
          this.updateLiterals(aChild, bChild, editBuffer);
        } else {
          if (
            aChild &&
            bChild &&
            aChild.type === bChild.type &&
            !aChild.assigned &&
            !bChild.assigned
          ) {
            this.computeEditScriptRecurse(aChild, bChild, editBuffer);
          } else {
            if (aChild) {
              editBuffer.detach(aChild);
              this.unloadUnassigned(aChild, editBuffer);
            }
            if (bChild) {
              const newTree = this.loadUnassigned(bChild, editBuffer);
              editBuffer.attach(newTree, a, bChild.siblingIndex);
            }
          }
        }
      });
      return a;
    } else {
      return null;
    }
  }
  computeEditScriptList(aList, bList, parent, editBuffer) {
    while (aList.length > 0 && bList.length > 0) {
      const a = aList[0];
      const b = bList[0];
      if (a.assigned === b) {
        aList.shift();
        bList.shift();
        this.computeEditScript(a, b, parent, b.siblingIndex, editBuffer);
      } else {
        break;
      }
    }
  }
  updateLiterals(a, b, editBuffer) {
    if (a.isText && b.isText && a.text !== b.text) editBuffer.update(a, b.text);
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
      // FIXME recently enabled -- double check semantics
      for (const child of a.children) {
        this.unloadUnassigned(child, editBuffer);
      }
    }
  }
  loadUnassigned(b, editBuffer) {
    if (b.assigned) {
      const tree = this.updateLiterals(b.assigned, b, editBuffer);
      return tree;
    } else {
      const newTree = b.shallowClone();
      editBuffer.load(newTree);
      b.children.forEach((child, index) => {
        const newChild = this.loadUnassigned(child, editBuffer);
        editBuffer.attach(newChild, newTree, index);
      });
      return newTree;
    }
  }
}

class DiffOp {
  debugString() {
    let nodeString = "";
    if (this.node) {
      if (this.node.type) {
        nodeString = this.node.type;
      } else {
        nodeString = '"' + this.node.text + '"';
      }
      nodeString += " [" + this.node.id + "]";
    }

    if (this.parent) {
      nodeString += " parent " + this.parent.id + "";
    }
    return this.constructor.name + " " + nodeString;
  }
}

export class DetachOp extends DiffOp {
  constructor(node) {
    super();
    this.node = node;
    this.oldParent = node.parent;
  }
  get detachingFromRoot() {
    return !this.oldParent;
  }
  apply(buffer, tx) {
    buffer.notePendingDetached(this.node);
    if (!this.detachingFromRoot) tx.removeNodeChild(this.oldParent, this.node);
  }
}

export class AttachOp extends DiffOp {
  constructor(node, parent, index) {
    super();
    this.node = node;
    this.parent = parent;
    this.index = index;
  }
  get attachingToRoot() {
    return !this.parent;
  }
  apply(buffer, tx) {
    buffer.forgetPendingDetached(this.node);
    if (this.parent) tx.insertNodeChild(this.parent, this.node, this.index);
  }
}

export class UpdateOp extends DiffOp {
  constructor(node, text) {
    super();
    this.node = node;
    this.text = text;
    this.oldText = node.text;
  }
  apply(_buffer, tx) {
    tx.updateNodeText(this.node, this.text);
  }
}

export class RemoveOp extends DiffOp {
  constructor(node) {
    super();
    this.node = node;
  }
  apply(buffer) {
    buffer.forgetPendingDetached(this.node);
  }
}

export class LoadOp extends DiffOp {
  constructor(node) {
    super();
    this.node = node;
  }
  apply(buffer) {
    buffer.notePendingLoaded(this.node);
  }
}

export class EditBuffer {
  constructor(posBuf = []) {
    this.posBuf = posBuf;
    this.negBuf = [];
    this.shardBuffer = new Map();
    this.detachedRootShards = new Set();
    this.rememberViews = new Map();
    this.changedViews = [];

    this.pendingDetached = [];
    this.pendingLoaded = [];
  }
  notePendingDetached(node) {
    this.pendingDetached.push(node);
  }
  notePendingLoaded(node) {
    this.pendingLoaded.push(node);
  }
  forgetPendingDetached(node) {
    let index = this.pendingDetached.indexOf(node);
    if (index !== -1) this.pendingDetached.splice(index, 1);
    else {
      index = this.pendingLoaded.indexOf(node);
      if (index !== -1) this.pendingLoaded.splice(index, 1);
      // else console.log("forgetPendingDetached: node not detached", node);
    }
  }
  rememberView(view) {
    this.rememberViews.set(view.node, view);
  }
  recallView(node) {
    const view = this.rememberViews.get(node);
    if (view) this.rememberViews.delete(node);
    return view;
  }
  assertNoPendingDetached() {
    if (this.pendingDetached.length > 0) throw new Error("detached nodes left");
  }
  attach(node, parent, link) {
    assert(node !== parent);
    assert(link >= 0);
    assert(node);

    this.log(
      "attach",
      this.printLabel(node),
      parent?.type ?? "root",
      link,
      node.id,
    );
    this.posBuf.push(new AttachOp(node, parent, link));
  }
  get ops() {
    return [...this.negBuf, ...this.posBuf];
  }
  detach(node) {
    this.log("detach", this.printLabel(node), node.id);
    this.negBuf.push(new DetachOp(node));
  }
  remove(node) {
    this.log("remove", this.printLabel(node), node.id);
    this.negBuf.push(new RemoveOp(node));
  }
  load(node) {
    this.log("load", this.printLabel(node), node.id);
    this.posBuf.push(new LoadOp(node));
  }
  update(node, text) {
    this.log(
      "update",
      this.printLabel(node),
      `"${text.replace(/\n/g, "\\n")}"`,
    );
    this.posBuf.push(new UpdateOp(node, text));
  }
  printLabel(node) {
    return node.type ?? `"${node.text.replace(/\n/g, "\\n")}"`;
  }
  apply(tx) {
    this.negBuf.forEach((f) => f.apply(this, tx));
    this.posBuf.forEach((f) => f.apply(this, tx));
    this.assertNoPendingDetached();
  }
  getDetachedOrConstruct(node, shard) {
    return (
      this.shardBuffer.get(shard)?.find((view) => view.node === node) ??
      node.toHTML()
    );
  }
  rememberDetached(view, shard) {
    if (!shard) return;
    if (!this.shardBuffer.has(shard)) this.shardBuffer.set(shard, []);
    this.shardBuffer.get(shard).push(view);
  }
  rememberDetachedRootShard(shard) {
    this.detachedRootShards.add(shard);
  }
  opsDo(cb) {
    this.negBuf.forEach(cb);
    this.posBuf.forEach(cb);
  }
  log(...op) {
    if (false) console.log(...op);
  }
}

class Transaction {
  undo = [];

  commit() {
    this.undo = null;
  }
  rollback() {
    this.undo.reverse().forEach((f) => f());
    this.undo = null;
  }

  updateNodeText(node, text) {
    this.log("updateNodeText", node, text);
    this.set(node, "_text", text);
  }

  insertNodeChild(parent, child, index) {
    this.log("insertNodeChild", parent, child, index);
    const oldParent = child.parent;
    const oldIndex = oldParent?.children.indexOf(child);

    this.undo.push(() =>
      oldParent
        ? oldParent.insertChild(child, oldIndex)
        : parent.removeChild(child),
    );
    parent.insertChild(child, index);
  }

  removeNodeChild(parent, child) {
    this.log("removeNodeChild", parent, child);
    const index = parent.children.indexOf(child);
    this.undo.push(() => parent.insertChild(child, index));
    parent.removeChild(child);
  }

  set(object, field, value) {
    this.log("set", object, field, value);
    const oldValue = object[field];
    this.undo.push(() => (object[field] = oldValue));
    object[field] = value;
  }
  log(...op) {
    if (false) console.log(...op);
  }
}
