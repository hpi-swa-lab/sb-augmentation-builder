import { AttachOp, DetachOp, LoadOp, UpdateOp } from "../core/diff.js";
import { BaseEditor } from "../core/editor.js";
import { followingElementThat, nodeIsEditable } from "../core/focus.js";
import { SBBlock, SBList, SBText } from "../core/model.js";
import { SBReplacement } from "../core/replacement.js";
import { BaseShard } from "../core/shard.js";
import {
  ToggleableMutationObserver,
  findChange,
  lastDeepChild,
  orParentThat,
} from "../utils.js";
import { Block } from "../view/elements.js";

class SandblocksEditor extends BaseEditor {
  static shardTag = "sb-shard";

  onSuccessfulChange() {
    // unlike in the text editor, pending changes are inserted as
    // placeholders and are turned into blocks once valid, so we
    // revert here and the shard will apply the view changes
    this.revertPendingChanges();
  }

  revertPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() =>
      super.revertPendingChanges()
    );
  }
  applyPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() =>
      super.applyPendingChanges()
    );
  }
}

class SandblocksShard extends BaseShard {
  views = new Map();
  actualSourceString = null;

  initView() {
    this.actualSourceString = this.node.sourceString;
  }

  isShowing(node) {
    return !!this.views.get(node);
  }

  getReplacementFor(node) {
    const view = this.views.get(node);
    return view?.isNodeReplacement ? view : null;
  }

  get replacements() {
    return [...this.views.values()].filter((v) => v instanceof SBReplacement);
  }

  getMarkersFor(node) {
    const view = this.views.get(node);
    return view?.markers;
  }

  cssClass(node, cls, add) {
    const view = this.views.get(node);
    for (const c of cls.split(" ")) view.classList.toggle(c, add);
  }

  applyRejectedDiff(_editBuffer, changes) {
    return changes
      .map((change) => this.applyRejectedChange(change))
      .filter((n) => n);
  }

  onPendingChangesReverted() {
    this.actualSourceString = this.node.sourceString;
  }

  applyChanges(editBuffer, changes) {
    for (const change of editBuffer.negBuf) {
      if (change instanceof DetachOp) {
        const view = this.views.get(change.node);
        if (view) {
          view.remove();
          for (const v of view.allViews()) {
            editBuffer.rememberView(v);
            this.views.delete(v.node);
          }
        }
      }
    }

    const sorted = [...editBuffer.posBuf].sort((a, b) => {
      // we want LoadOp first, then AttachOp, then UpdateOp
      // for AttachOp, we want a topological sort
      if (a instanceof LoadOp) return -1;
      if (b instanceof LoadOp) return 1;
      if (a instanceof AttachOp && b instanceof AttachOp)
        // FIXME do we need a proper topological sort?
        return a.node.depth - b.node.depth;

      if (a instanceof AttachOp && b instanceof UpdateOp) return -1;
      if (a instanceof UpdateOp && b instanceof AttachOp) return 1;
      return 0;
    });

    for (const change of sorted) {
      if (change instanceof AttachOp) {
        const parentView = this.views.get(change.parent);
        if (parentView) {
          const view = this.buildOrRecall(change.node, editBuffer);
          parentView.insertNode(view, change.index);
        } else if (this.node.isRoot === change.node.isRoot) {
          this.node = change.node;
          this.appendChild(this.buildOrRecall(change.node, editBuffer));
        } else {
          // not within our shard
        }
      }
      if (change instanceof UpdateOp) {
        this.views.get(change.node)?.setAttribute("text", change.text);
      }
    }

    this.updateReplacements(editBuffer);
    this.updateMarkers(editBuffer);
    this.actualSourceString = this.node.sourceString;
  }

  uninstallReplacement(node, editBuffer) {
    const replacement = this.views.get(node);
    const view = this.buildOrRecall(node, editBuffer, true);
    replacement.replaceWith(view);
    this.views.set(node, view);
  }

  installReplacement(node, extension) {
    const view = this.views.get(node);
    const replacement = this.buildReplacementFor(node, extension);
    for (const v of view.allViews()) this.views.delete(v.node);
    view.replaceWith(replacement);
    this.views.set(node, replacement);
  }

  buildOrRecall(node, editBuffer, recursive = false) {
    let view;

    for (const extension of this.extensionReplacements) {
      if (node.exec(...extension.query)) {
        view = this.buildReplacementFor(node, extension);
      }
    }

    if (!view) {
      view = editBuffer?.recallView(node);
      if (view) for (const v of view.allViews()) this.views.set(v.node, v);
    }

    if (!view) {
      if (node instanceof SBText) {
        view = document.createElement("sb-text");
        view.setAttribute("text", node.text);
      } else if (node instanceof SBBlock) {
        view = document.createElement("sb-block");
      } else if (node instanceof SBList) {
        view = document.createElement("sb-view-list");
      } else {
        throw new Error("unknown model node type");
      }
      view.node = node;
    }

    if (recursive) {
      for (const child of node.children) {
        view.appendChild(this.buildOrRecall(child, editBuffer, true));
      }
    }

    this.views.set(node, view);

    return view;
  }

  connectedCallback() {
    super.connectedCallback();
    for (const [key, value] of Object.entries({
      spellcheck: "false",
      autocorrect: "off",
      autocapitalize: "off",
      translate: "no",
      contenteditable: "true",
      "data-gramm": "false",
      "data-gramm_editor": "false",
      "data-enable-grammarly": "false",
      role: "textbox",
      "aria-multiline": "true",
      focusable: "true",
    }))
      this.setAttribute(key, value);

    this.addEventListener(
      "keydown",
      (this._keyDownListener = this.onKeyDown.bind(this))
    );

    this.observer = new ToggleableMutationObserver(this, (mutations) => {
      mutations = [...mutations, ...this.observer.takeRecords()];
      if (mutations.some((m) => m.type === "attributes")) return;
      if (!mutations.some((m) => this.isMyMutation(m))) return;

      ToggleableMutationObserver.ignoreMutation(() => {
        const { selectionRange, sourceString } =
          this._extractSourceStringAndSelectionRangeAfterMutation();
        ToggleableMutationObserver.undoMutations(mutations);

        const change = findChange(
          this.actualSourceString,
          sourceString,
          this.editor.selectionRange[1] - this.range[0]
        );
        if (!change) return;

        change.from += this.range[0];
        change.to += this.range[0];
        change.selectionRange = selectionRange;

        this.actualSourceString = sourceString;
        this.editor.applyChanges([change]);
      });
    });
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this._keyDownListener);
  }

  onKeyDown(e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      this.editor.moveCursor(false, e.shiftKey);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      this.editor.moveCursor(true, e.shiftKey);
    }
  }

  isMyMutation(mutation) {
    if (!mutation.target.isConnected) {
      for (const view of this.views.values()) {
        if (view === mutation.target) return true;
      }
      return false;
    }
    let current = mutation.target;
    while (current) {
      if (current === this) return true;
      // in another shard
      if (current.tagName === this.tagName) return false;
      // in a replacement
      if (current.isNodeReplacement) return false;
      current = current.parentElement;
    }
    throw new Error("Mutation is not in shard");
  }

  applyRejectedChange({ from, to, insert }) {
    if (!rangeContains(this.range, [from, from])) return null;

    let start = null;
    let offset = 0;
    const nestedElements = this._getNestedContentElements();
    for (const nested of [...nestedElements, null]) {
      const range = document.createRange();

      if (start) range.setStartAfter(start);
      else range.setStart(this, 0);
      if (nested) range.setEndBefore(nested);
      else range.setEndAfter(lastDeepChild(this));

      const length = range.toString().length;
      offset += length;
      if (offset >= from) {
        console.assert(offset >= to, "change outside visible range");

        offset -= length;

        const range = document.createRange();
        nextNodePreOrderThat(start ? lastDeepChildNode(start) : this, (n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            offset += n.textContent.length;
            if (range.startContainer === document && offset >= from)
              range.setStart(n, from - (offset - n.textContent.length));
            if (offset >= to) {
              range.setEnd(n, to - (offset - n.textContent.length));
              return true;
            }
          }
          return false;
        });

        const undo = undoableMutation(this, () => {
          range.deleteContents();
          if (insert) {
            const placeholder = document.createElement("sb-placeholder");
            placeholder.textContent = insert;
            range.insertNode(placeholder);
          }
        });
        return undo;
      }

      if (nested) offset += nested.sourceString?.length ?? 0;
      console.assert(offset <= from, "insert position was found in nested");
      start = nested;
    }
    console.assert(false, "insert position was not found");
  }

  // combined operation to find the source string and cursor range
  // in the dom. to be used after a DOM mutation has happened that
  // we have not yet undone and reconciled with the model.
  _extractSourceStringAndSelectionRangeAfterMutation() {
    const selection = getSelection();
    const hasSelection = selection.anchorNode && selection.focusNode;
    const cursorElements = hasSelection
      ? [selection.focusNode, selection.anchorNode]
      : [];

    let start = null;
    let string = "";
    const nestedElements = this._getNestedContentElements(cursorElements);
    let focusOffset = null;
    let anchorOffset = null;
    for (const nested of [...nestedElements, null]) {
      const range = document.createRange();

      if (start) range.setStartAfter(start);
      else range.setStart(this, 0);

      if (hasSelection && nested === selection.focusNode) {
        range.setEnd(selection.focusNode, selection.focusOffset);
        focusOffset = string.length + range.toString().length;
      }
      if (hasSelection && nested === selection.anchorNode) {
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        anchorOffset = string.length + range.toString().length;
      }
      if (cursorElements.includes(nested)) continue;

      if (nested) range.setEndBefore(nested);
      else range.setEndAfter(lastDeepChild(this));

      start = nested;
      string += range.toString();

      if (nested) {
        string += nested.sourceString ?? "";
      }
    }

    return {
      sourceString: string,
      selectionRange: [
        this.range[0] + focusOffset,
        this.range[0] + anchorOffset,
      ].sort((a, b) => a - b),
    };
  }

  // Recursively iterate over all elements within this shard.
  // when encountering an element that is neither a Block nor a Text,
  // we note it.
  // Additionally, we need to insert the two elements that our cursor
  // is located in this list, in the right position, so that we can
  // later grab the string from the previous element to the cursor.
  _getNestedContentElements(
    cursorElements = [],
    parent = this,
    list = [],
    insideBlocks = true
  ) {
    for (const child of parent.childNodes) {
      if (cursorElements.includes(child) || (insideBlocks && !child.isNodeView))
        list.push(child);
      this._getNestedContentElements(
        cursorElements,
        child,
        list,
        insideBlocks && child instanceof Block
      );
    }
    return list;
  }

  indexForRange(node, offset) {
    const ref =
      node instanceof window.Text
        ? node
        : node.childNodes[Math.min(offset, node.childNodes.length - 1)];

    const parent = ref.range
      ? ref
      : followingElementThat(ref, -1, (n) => !!n.range);
    if (node.parentElement === parent && node instanceof window.Text)
      return parent.range[0] + offset;
    else return parent.range[offset >= node.childNodes.length ? 1 : 0];
  }

  *iterVisibleRanges() {
    const replacedRanges = this.replacements.map((v) => v.range);

    let current = this.range[0];
    for (const range of replacedRanges) {
      yield [current, range[0]];
      current = range[1];
    }
    yield [current, this.range[1]];
  }

  select({
    head: {
      elementOffset: [focusNode, focusOffset],
    },
    anchor: {
      elementOffset: [anchorNode, anchorOffset],
    },
  }) {
    const r = document.createRange();
    r.setStart(focusNode, focusOffset);
    r.setEnd(anchorNode, anchorOffset);
    ShardSelection.change(r);
  }

  positionForIndex(index) {
    const elementOffset =
      index === this.range[0]
        ? [this, 0]
        : this.views.get(this.node).findTextForCursor(index).rangeParams(index);
    return {
      element: this,
      elementOffset,
      index,
    };
  }
}

// singleton listening to selection changes and associating them
// with shards
class _ShardSelection {
  selection = null;
  shard = null;

  _ignoreCounter = 0;

  constructor() {
    document.addEventListener("selectionchange", () =>
      this.onSelectionChange()
    );
  }

  _deselect() {
    this.selection = null;
    this.shard = null;
  }

  noteModification() {
    this._ignoreCounter++;
  }

  onSelectionChange() {
    if (this._ignoreCounter > 0) {
      this._ignoreCounter--;
      return;
    }

    const sel = getSelection();
    if (sel.type === "None" || sel.rangeCount === 0) return this._deselect();

    if (document.activeElement?.tagName !== "SB-SHARD") return this._deselect();

    const e = orParentThat(sel.anchorNode, (x) => nodeIsEditable(x));
    if (!e || e.tagName !== "SB-SHARD") return this._deselect();

    this.shard = e;
    this.selection = {
      head: {
        element: e,
        elementOffset: [sel.focusNode, sel.focusOffset],
        index: e.indexForRange(sel.focusNode, sel.focusOffset),
      },
      anchor: {
        element: e,
        elementOffset: [sel.anchorNode, sel.anchorOffset],
        index: e.indexForRange(sel.anchorNode, sel.anchorOffset),
      },
    };
    this.shard.editor.selection = this.selection;
  }

  change(newRange) {
    const s = getSelection();
    this._ignoreCounter += 2;
    s.removeAllRanges();
    s.addRange(newRange);
  }
}

const ShardSelection = new _ShardSelection();

customElements.define("sb-editor", SandblocksEditor);
customElements.define("sb-shard", SandblocksShard);
