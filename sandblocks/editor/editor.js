import {
  AttachOp,
  DetachOp,
  LoadOp,
  RemoveOp,
  UpdateOp,
} from "../../core/diff.js";
import { BaseEditor } from "../../core/editor.js";
import { SBBlock, SBList, SBText } from "../../core/model.js";
import { SBReplacement } from "../../core/replacement.js";
import { BaseShard } from "../../core/shard.js";
import {
  ToggleableMutationObserver,
  findChange,
  lastDeepChild,
  lastDeepChildNode,
  orParentThat,
  rangeContains,
  rangeEqual,
  undoableMutation,
} from "../../utils.js";
import { Block, Text, ViewList } from "./elements.js";
import {} from "./suggestions.js";

function parent(node) {
  return node.parentNode ?? node.getRootNode()?.host;
}

function lastChild(node) {
  if (node.shadowRoot) return node.shadowRoot.lastChild;
  else return node.lastChild;
}

function nextNodePreOrder(node) {
  if (node.shadowRoot) return node.shadowRoot.firstChild;
  if (node.firstChild) return node.firstChild;
  if (node.nextSibling) return node.nextSibling;

  let current = node;
  while ((current = parent(current))) {
    if (current.nextSibling) return current.nextSibling;
  }
  return null;
}

function previousNodePreOrder(node) {
  if (node.previousSibling) {
    let current = node.previousSibling;
    while (lastChild(current)) current = lastChild(current);
    return current;
  }
  return parent(node);
}

function followingNodeThat(node, direction, predicate) {
  do {
    node = direction > 0 ? nextNodePreOrder(node) : previousNodePreOrder(node);
    if (node && predicate(node)) return node;
  } while (node);
  return null;
}

function nodeIsEditable(node) {
  return node.hasAttribute("sb-editable");
}

export class SandblocksEditor extends BaseEditor {
  static shardTag = "sb-shard";

  constructor() {
    super();

    this.suggestions = document.createElement("sb-suggestions");
  }

  onSuccessfulChange() {
    // unlike in the text editor, pending changes are inserted as
    // placeholders and are turned into blocks once valid, so we
    // revert here and the shard will apply the view changes
    this.revertPendingChanges();
  }

  revertPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() =>
      super.revertPendingChanges(),
    );
  }
  applyPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() =>
      super.applyPendingChanges(),
    );
  }
  applyChanges(...args) {
    ToggleableMutationObserver.ignoreMutation(() =>
      super.applyChanges(...args),
    );
  }

  clearSuggestions() {
    this.suggestions.clear();
  }

  addSuggestions(node, list) {
    const view = this.selection.head.element.viewFor?.(node);
    if (view) this.suggestions.add(view, list);
  }

  useSuggestion() {
    this.suggestions.use();
  }

  isSuggestionsListVisible() {
    return this.suggestions.isConnected;
  }

  canMoveSuggestion(delta) {
    return this.suggestions.canMove(delta);
  }

  moveSuggestion(delta) {
    return this.suggestions.moveSelected(delta);
  }
}

class SandblocksShard extends BaseShard {
  views = new Map();
  actualSourceString = null;

  constructor() {
    super();

    this.observer = new ToggleableMutationObserver(this, (m) =>
      this.onMutations(m),
    );

    this.addEventListener("keydown", (e) => this.onKeyDown(e));

    this.addEventListener("blur", (e) => this.editor.clearSuggestions());
    this.addEventListener(
      "beforeinput",
      (e) => this.editor.readonly && e.preventDefault(),
    );

    this.addEventListener("paste", function (event) {
      event.preventDefault();
      event.stopPropagation();
      document.execCommand(
        "inserttext",
        false,
        event.clipboardData.getData("text/plain"),
      );
    });

    this.addEventListener("copy", function (e) {
      if (this.editor.selectedText) {
        e.clipboardData.setData("text/plain", this.editor.selectedText);
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  initView() {
    this.actualSourceString = this.node.sourceString;
  }

  viewFor(node) {
    return this.views.get(node);
  }

  *allViews() {
    yield* this.views.values();
  }

  isShowing(node) {
    return !!this.views.get(node);
  }

  scrollToShow([from, to]) {
    let el = this.positionForIndex(from).elementOffset[0];
    if (el.nodeType === Node.TEXT_NODE) el = el.parentNode;
    el.scrollIntoView();
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
    if (!view) return;
    for (const c of cls.split(" ")) view.classList.toggle(c, add);
  }

  withDom(node, f) {
    f(this.views.get(node));
  }

  applyRejectedDiff(_editBuffer, changes) {
    return changes
      .map((change) => this.applyRejectedChange(change))
      .filter((n) => n);
  }

  onPendingChangesReverted() {
    if (this.node.connected) this.actualSourceString = this.node.sourceString;
  }

  applyChanges(editBuffer, changes) {
    ToggleableMutationObserver.ignoreMutation(() =>
      this._applyChanges(editBuffer, changes),
    );
  }

  _applyChanges(editBuffer, changes) {
    const removed = new Set(
      editBuffer.negBuf
        .filter((op) => op instanceof RemoveOp)
        .map((op) => op.node),
    );
    for (const change of editBuffer.negBuf) {
      if (change instanceof DetachOp) {
        const view = this.views.get(change.node);
        if (view) {
          view.remove();
          for (const v of view.allViews()) {
            if (!removed.has(v.node)) {
              if (!(v instanceof SBReplacement)) editBuffer.rememberView(v);
              this.views.delete(v.node);
            }
          }
        }
      }
    }
    for (const r of removed) this.views.delete(r);

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

    const attached = [];

    for (const change of sorted) {
      if (change instanceof AttachOp) {
        const parentView = this.views.get(change.parent);
        if (parentView && !(parentView instanceof SBReplacement)) {
          const view = this.buildOrRecall(change.node, editBuffer);
          parentView.insertNode(view, change.index);
          attached.push(view);
        } else if (
          (this.node.isRoot && change.node.isRoot) ||
          this.node === change.node
        ) {
          this.node = change.node;
          const view = this.buildOrRecall(change.node, editBuffer);
          this.appendChild(view);
          attached.push(view);
        } else {
          // not within our shard
        }
      }
      if (change instanceof UpdateOp) {
        this.views.get(change.node)?.setAttribute("text", change.text);
      }
    }

    for (const view of attached) {
      if (
        !(view instanceof SBReplacement) &&
        view.children.length !== view.node.children.length
      ) {
        for (let i = 0; i < view.node.children.length; i++) {
          const child = view.node.children[i];
          if (![...view.children].some((c) => c.node === child)) {
            view.insertNode(this.buildOrRecall(child, editBuffer, true), i);
          }
        }
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
    editBuffer.changedViews.push(view);
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
      if (this.mayReplace(node, extension)) {
        view = this.buildReplacementFor(node, extension);
      }
    }

    if (!view) {
      view = editBuffer?.recallView(node);
      if (view) {
        for (const v of view.allViews()) this.views.set(v.node, v);
      }
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

    if (recursive && !(view instanceof SBReplacement)) {
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
  }

  onKeyDown(e) {
    if (e.target !== this) return;
    const handle = (cb) => {
      if (cb && !cb?.()) return;
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "ArrowLeft")
      return handle(() => {
        e.stopPropagation();
        return this.editor.moveCursor(false, e.shiftKey, e.metaKey, e.ctrlKey);
      });
    if (e.key === "ArrowRight")
      return handle(() => {
        e.stopPropagation();
        return this.editor.moveCursor(true, e.shiftKey, e.ctrlKey);
      });
    if (e.key === "Backspace" && this.handleDeleteAtBoundary(false))
      return handle();
    if (e.key === "Delete" && this.handleDeleteAtBoundary(true))
      return handle();
    if (this.onShortcut(e)) return handle();
  }

  onMutations(mutations) {
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
        this.editor.selectionRange[1] - this.range[0],
      );
      if (!change) return;

      change.from += this.range[0];
      change.to += this.range[0];
      change.selectionRange = selectionRange;
      change.sideAffinity = this.range[0] === change.from ? 1 : -1;

      this.actualSourceString = sourceString;
      this.onTextChanges([change]);
    });
  }

  handleDeleteAtBoundary(forward) {
    let ret = false;
    ToggleableMutationObserver.ignoreMutation(
      () => (ret = super.handleDeleteAtBoundary(forward)),
    );
    return ret;
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
    if (
      ![...this.iterVisibleRanges()].some((r) => rangeContains(r, [from, from]))
    )
      return null;

    let start = null;
    let offset = this.range[0];
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
        followingNodeThat(start ? lastDeepChildNode(start) : this, 1, (n) => {
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
      // insert position is in nested --> we don't need to display it
      if (offset > from) return null;
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
    insideBlocks = true,
  ) {
    for (const child of parent.childNodes) {
      if (cursorElements.includes(child) || (insideBlocks && !child.isNodeView))
        list.push(child);
      this._getNestedContentElements(
        cursorElements,
        child,
        list,
        insideBlocks && (child instanceof Block || child instanceof ViewList),
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
      : followingNodeThat(ref, -1, (n) => !!n.range);
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
      index: from,
    },
    anchor: {
      elementOffset: [anchorNode, anchorOffset],
      index: to,
    },
  }) {
    ShardSelection.change((s) =>
      s.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset),
    );
  }

  deselect() {
    if (this.hasFocus) ShardSelection.deselect();
  }

  positionForIndex(index) {
    const state = { index: this.range[0] };
    for (const pos of this.shardCursorPositions(state)) {
      if (state.index >= index) {
        console.assert(state.index === index);
        return {
          element: this,
          elementOffset: pos,
          index,
        };
      }
    }
    console.assert(false, "position not found");
  }

  *shardCursorPositions(state) {
    yield [this, 0];
    state.index++;
    yield* this.viewFor(this.node).shardCursorPositions(state);
    yield [this, 1];
    state.index++;
  }

  debugShardCursorPositions() {
    const state = { index: this.range[0] };
    const out = [];
    for (const pos of this.shardCursorPositions(state)) {
      out.push([...pos, state.index]);
    }
    return out;
  }

  simulateKeyStroke(key) {
    if (key === "Backspace" || key === "Delete") {
      const e = new KeyboardEvent("keydown", { key, cancelable: true });
      this.dispatchEvent(e);
      if (!e.defaultPrevented)
        document.execCommand(
          key === "Backspace" ? "delete" : "forwardDelete",
          false,
          null,
        );
    } else document.execCommand("inserttext", false, key);
    this.onMutations(this.observer.takeRecords());
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
      this.onSelectionChange(),
    );
  }

  _deselect() {
    this.selection = null;
    this.shard = null;
  }

  noteModification() {
    this._ignoreCounter++;
  }

  // since we will later try and find that cursor position again by
  // comparing the elementOffset field, we need to make sure that we
  // chose a position as it appears in our cursorPositions list.
  snapPosition(node, offset, shard) {
    const index = shard.indexForRange(node, offset);
    return shard.positionForIndex(index);
  }

  reset() {
    this._ignoreCounter = 0;
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
      head: this.snapPosition(sel.focusNode, sel.focusOffset, e),
      anchor: this.snapPosition(sel.anchorNode, sel.anchorOffset, e),
    };
    this.shard.editor.onSelectionChange(this.selection);
  }

  deselect() {
    this._ignoreCounter++;
    getSelection().removeAllRanges();
  }

  change(cb) {
    const s = getSelection();
    this._ignoreCounter += 2;
    s.removeAllRanges();
    cb(s);
  }
}

export const ShardSelection = new _ShardSelection();

customElements.define("sb-editor", SandblocksEditor);
customElements.define("sb-shard", SandblocksShard);
