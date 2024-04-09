import {
  clamp,
  orParentThat,
  rangeContains,
  rangeDistance,
  rangeEqual,
} from "../utils.js";
import { AttachOp, DetachOp, EditBuffer, RemoveOp, UpdateOp } from "./diff.js";

export class BaseShard extends HTMLElement {
  // must be set before a node can be set or the shard is used
  editor = null;

  get replacements() {
    throw "subclass responsibility";
  }

  extensions = () => this.parentShard?.extensions() ?? [];

  connectedCallback() {
    this.editor.shards.add(this);
    this.setAttribute("sb-editable", "");

    if (!this.childNodes.length) {
      this.initView();
      this.applyChanges(new EditBuffer(this.node.initOps()), [
        {
          from: this.range[0],
          to: this.range[0],
          insert: this.node.sourceString,
        },
      ]);
    }
  }
  disconnectedCallback() {
    this.editor.shards.delete(this);
  }

  get parentShard() {
    return orParentThat(this.parentElement, (p) => p instanceof BaseShard);
  }

  get range() {
    // FIXME both node and editor are set by Preact as props,
    // we can't guarantee the order in which they are set
    return this.editor
      ? this.editor.adjustRange(this.node.range, false)
      : this.node.range;
  }

  get extensionMarkers() {
    const markers = [];
    for (const extension of this.extensions()) {
      markers.push(...extension.markers);
    }
    markers.sort((a, b) => a.priority - b.priority);
    return markers;
  }

  get extensionReplacements() {
    const replacements = [];
    for (const extension of this.extensions()) {
      replacements.push(...extension.replacements);
    }
    replacements.sort((a, b) => a.priority - b.priority);
    return replacements;
  }

  onTextChanges(changes) {
    if (this.editor.readonly) return;

    for (const extension of this.extensions()) {
      for (const filter of extension.changeFilter) {
        filter(changes, this.editor);
      }
    }

    this.editor.applyChanges(changes);
  }

  onPendingChangesReverted() {
    // may be implemented by subclasses
  }

  onShortcut(event) {
    const selected =
      this.selectedFor([
        this.editor.selection.head.index,
        this.editor.selection.anchor.index,
      ]) ?? this.editor.node;
    for (const action of this.editor.preferences.getShortcutsFor(event)) {
      const handlers = this.extensions()
        .map((e) => e.shortcuts[action])
        .filter(Boolean)
        .sort(([_, __, a], [___, ____, b]) => b - a);
      for (const [callback, filter] of handlers) {
        if (selected.exec(...filter)) {
          callback(selected, this.viewFor(selected), event);
          return true;
        }
      }
    }
    return false;
  }

  selectedFor(range) {
    if (!rangeContains(this.range, range)) return null;

    let candidate = null;
    for (const child of this.node.allNodes()) {
      if (!this.isShowing(child)) continue;
      const [start, end] = child.range;
      if (start <= range[0] && end >= range[1]) {
        if (
          !candidate ||
          ((child.preferForSelection || !candidate.preferForSelection) &&
            candidate.range[1] - candidate.range[0] >= end - start)
        )
          candidate = child;
      }
    }

    return candidate;
  }

  viewFor(node) {
    // subclasses may return specific html elements
    return null;
  }

  set node(n) {
    this._node?.shards.remove(this);
    this._node = n;
    n?.shards.push(this);
  }

  get node() {
    return this._node;
  }

  get hasFocus() {
    return document.activeElement === this;
  }

  initView() {
    throw "subclass responsibility";
  }

  applyChanges(editBuffer, changes) {
    throw "subclass responsibility";
  }

  applyRejectedDiff(editBuffer, changes) {
    throw "subclass responsibility";
  }

  cssClass(node, cls, add) {
    throw "subclass responsibility";
  }

  withDom(node, f) {
    throw "subclass responsibility";
  }

  isShowing(node) {
    throw "subclass responsibility";
  }

  isShowingIndex(index) {
    for (const range of this.iterVisibleRanges()) {
      if (rangeContains(range, index)) return true;
    }
    return false;
  }

  getReplacementFor(node) {
    throw "subclass responsibility";
  }

  getMarkersFor(node) {
    throw "subclass responsibility";
  }

  installReplacement(node, extension) {
    throw "subclass responsibility";
  }

  uninstallReplacement(node) {
    throw "subclass responsibility";
  }

  *allViews() {
    throw "subclass responsibility";
  }

  scrollToShow(range) {
    throw "subclass responsibility";
  }

  buildReplacementFor(node, extension) {
    const view = document.createElement("sb-replacement");
    view.shard = this;
    view.editor = this.editor;
    view.setAttribute("name", extension.name);
    view.node = node;
    for (const key in extension) view[key] = extension[key];
    view.render();
    return view;
  }

  updateReplacements(editBuffer) {
    // check for replacements that are now gone because their node was removed
    for (const op of editBuffer.negBuf) {
      if (op instanceof RemoveOp) {
        const replacement = this.getReplacementFor(op.node);
        if (replacement) this.uninstallReplacement(op.node, editBuffer);
      }
    }

    // check for replacements that are now gone because a change made them invalid
    const changedNodes = new Set();
    for (const op of editBuffer.posBuf) {
      if (op instanceof UpdateOp || op instanceof AttachOp)
        changedNodes.add(op.node);
    }
    for (const op of editBuffer.negBuf) {
      if (op instanceof DetachOp && op.oldParent?.connected)
        changedNodes.add(op.oldParent);
    }

    for (const root of changedNodes) {
      for (const node of root.andAllParents()) {
        const replacement = this.getReplacementFor(node);
        if (replacement && !node.exec(...replacement.query))
          this.uninstallReplacement(node, editBuffer);
      }
    }

    // re-render remaining replacements (FIXME we're currently re-rendering all)
    for (const replacement of this.replacements) {
      console.assert(replacement.node.connected);
      if (replacement.rerender?.(editBuffer)) replacement.render();
    }

    // check for new replacements
    for (const root of changedNodes) {
      for (const extension of this.extensionReplacements) {
        let node = root;
        for (let i = 0; i <= extension.queryDepth; i++) {
          if (!node || !this.isShowing(node)) continue;
          if (this.mayReplace(node, extension))
            this.installReplacement(node, extension);
          node = node?.parent;
        }
      }
    }
  }

  mayReplace(node, extension) {
    if (this.getReplacementFor(node)) return false;
    if (!node?.exec(...extension.query)) return false;
    if (this.parentShard?.replacements.some((r) => r.node === node))
      return false;
    return true;
  }

  updateMarkers(editBuffer) {
    for (const root of [
      ...editBuffer.posBuf.map((op) => op.node),
      ...editBuffer.changedViews
        .filter((v) => v.node.connected)
        .flatMap((v) => [...v.node.allNodes()]),
    ]) {
      for (const extension of this.extensionMarkers) {
        let node = root;
        for (let i = 0; i <= extension.queryDepth; i++) {
          const markers = this.getMarkersFor(node);
          if (!markers) continue;
          const marker = markers.get(extension.name);
          const match = node?.exec(...extension.query);
          if (!marker && match) {
            markers.set(extension.name, extension);
            extension.attach(this, node);
          } else if (marker && !match) {
            markers.delete(extension.name);
            extension.detach(this, node);
          }
          node = node?.parent;
          if (!node) break;
        }
      }
    }
  }

  iterVisibleRanges() {
    throw "subclass responsibility";
  }

  positionForIndex(index) {
    throw "subclass responsibility";
  }

  select(selection) {
    throw "subclass responsibility";
  }

  handleDeleteAtBoundary(forward) {
    const pos = this.editor.selection.head.index + (forward ? 1 : -1);
    if (pos < 0 || pos >= this.editor.sourceString.length) return false;

    // check if the next index is not visible: in that case, we delete
    // the character via the edit operation, instead of letting the native
    // editor handle the input
    const replacement = this.replacements.find((r) =>
      rangeContains(r.range, [pos, pos]),
    );
    if (replacement) {
      replacement.handleDelete(pos);
      return true;
    }
    return false;
  }

  selectRange([head, anchor]) {
    const s = {
      head: this.positionForIndex(head),
      anchor: this.positionForIndex(anchor),
    };
    this.select(s);
    this.editor.onSelectionChange(s);
  }

  candidatePositionForIndex(index, other) {
    if (!this.node || !this.isConnected)
      return { position: null, distance: Infinity };

    if (index < this.range[0] || index > this.range[1])
      return { position: null, distance: Infinity };

    const replacement = this.replacements.find((r) =>
      rangeEqual([index, other], r.range),
    );
    if (replacement && replacement.selectable)
      return replacement.candidatePositionForIndex(index, other);

    let bestDistance = Infinity;
    let bestIndex = null;
    for (const range of this.iterVisibleRanges()) {
      const distance = rangeDistance(range, [index, index]);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = clamp(index, range[0], range[1]);
        // no need to search further
        if (distance === 0) break;
      }
    }

    return bestIndex === null
      ? { position: null, distance: Infinity }
      : { position: this.positionForIndex(bestIndex), distance: bestDistance };
  }

  *cursorPositions() {
    let last = null;
    const shard = this;
    function* mine(index) {
      for (let i = last; i !== null && i <= index; i++)
        yield shard.positionForIndex(i);
      last = index;
    }
    function* myReplacement(r) {
      last = null;
      yield* r.cursorPositions();
    }

    const replacements = this.replacements.sort(
      (a, b) => a.range[0] - b.range[0],
    );

    yield* mine(this.range[0]);
    for (const replacement of replacements) {
      yield* mine(replacement.range[0]);
      yield* myReplacement(replacement);
      yield* mine(replacement.range[1]);
    }
    yield* mine(this.range[1]);
  }

  simulateKeyStroke(key) {
    const event = new KeyboardEvent("keydown", { key });
    this.dispatchEvent(event);
    return event.defaultPrevented;
  }
}
