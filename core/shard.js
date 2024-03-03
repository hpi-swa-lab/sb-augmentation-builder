import { clamp, rangeDistance } from "../utils.js";
import { EditBuffer } from "./diff.js";

export class BaseShard extends HTMLElement {
  // must be set before a node can be set or the shard is used
  editor = null;

  extensions = [];

  connectedCallback() {
    this.editor.shards.add(this);
    this.setAttribute("sb-editable", "");
  }
  disconnectedCallback() {
    this.editor.shards.delete(this);
    this.node = null;
  }

  get range() {
    // FIXME both node and editor are set by Preact as props,
    // we can't guarantee the order in which they are set
    return this.editor
      ? this.editor.adjustRange(this.node.range, true)
      : this.node.range;
  }

  get extensionMarkers() {
    const markers = [];
    for (const extension of this.extensions) {
      markers.push(...extension.markers);
    }
    markers.sort((a, b) => a.priority - b.priority);
    return markers;
  }

  get extensionReplacements() {
    const replacements = [];
    for (const extension of this.extensions) {
      replacements.push(...extension.replacements);
    }
    replacements.sort((a, b) => a.priority - b.priority);
    return replacements;
  }

  extensionsDo(fn) {}

  onTextChanges(changes) {
    // TODO this.extensionsDo((e) => e.filterChanges(changes));
    this.editor.applyChanges(changes);
  }

  onPendingChangesReverted() {
    // may be implemented by subclasses
  }

  set node(n) {
    const init = !this._node;

    this._node?.shards.remove(this);
    this._node = n;
    n?.shards.push(this);

    if (init) {
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

  get node() {
    return this._node;
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

  isShowing(node) {
    throw "subclass responsibility";
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

  buildReplacementFor(node, extension) {
    const view = document.createElement("sb-replacement");
    view.editor = this.editor;
    view.query = extension.query;
    view.component = extension.component;
    view.selectable = extension.selectable;
    view.node = node;
    return view;
  }

  updateReplacements(editBuffer) {
    // check for replacements that are now gone
    for (const { node: root } of editBuffer.posBuf) {
      for (const node of root.andAllParents()) {
        const replacement = this.getReplacementFor(node);
        if (replacement && !node.exec(...replacement.query))
          this.uninstallReplacement(node, editBuffer);
      }
    }

    // re-render remaining replacements (FIXME we're currently re-rendering all)
    for (const replacement of this.replacements) {
      replacement.render();
    }

    // check for new replacements
    for (const op of editBuffer.posBuf) {
      const root = op.node;
      for (const extension of this.extensionReplacements) {
        let node = root;
        for (let i = 0; i <= extension.queryDepth; i++) {
          if (!node || !this.isShowing(node)) continue;
          if (!this.getReplacementFor(node) && node?.exec(...extension.query))
            this.installReplacement(node, extension);
          node = node?.parent;
        }
      }
    }
  }

  updateMarkers(editBuffer) {
    for (const op of editBuffer.posBuf) {
      const root = op.node;
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

  candidatePositionForIndex(index) {
    if (!this.node || !this.isConnected)
      return { position: null, distance: Infinity };

    if (index < this.range[0] || index > this.range[1])
      return { position: null, distance: Infinity };

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

  get replacements() {
    throw "subclass responsibility";
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
}
