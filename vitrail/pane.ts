import { EditBuffer } from "../core/diff.js";
import { SBNode } from "../core/model.js";
import { signal } from "../external/preact-signals-core.mjs";
import { render, h } from "../external/preact.mjs";
import {
  last,
  rangeShift,
  adjustIndex,
  Side,
  clamp,
  rangeIntersects,
  rangeContains,
  withDo,
} from "../utils.js";
import { adjacentCursorPosition } from "../view/focus.ts";
import {
  VitrailReplacementContainer,
  registerReplacementElement,
} from "./replacement-container.ts";
import {
  Vitrail,
  AugmentationInstance,
  PaneFetchAugmentationsFunc,
  replacementRange,
  Change,
  Augmentation,
  VitrailContext,
  Marker,
  AugmentationMatch,
  Model,
} from "./vitrail.ts";

registerReplacementElement();

type PaneGetTextFunc = () => string;
type PaneSetTextFunc = (s: string, undoable: boolean) => void;
type PaneApplyLocalChangesFunc<T> = (changes: Change<T>[]) => void;
type PaneGetLocalSelectionIndicesFunc = () => [number, number];
type PaneEnsureContinueEditing = () => void;
type PaneFocusRangeFunc = (head: number, anchor: number) => void;
type PaneShowRangeFunc = (range: [number, number]) => void;

export class Pane<T> {
  vitrail: Vitrail<T>;
  view: HTMLElement;
  host: T;
  nodes: SBNode[];
  startIndex: number = -1;
  startLineNumber: number = -1;
  rangeOffsets = [0, 0];
  props = signal(null);

  _fetchAugmentations: PaneFetchAugmentationsFunc<T>;
  focusRange: PaneFocusRangeFunc;
  showRange: PaneShowRangeFunc;
  hasFocus: () => boolean;
  _applyLocalChanges: PaneApplyLocalChangesFunc<T>;
  getLocalSelectionIndices: PaneGetLocalSelectionIndicesFunc;
  ensureContinueEditing: PaneEnsureContinueEditing;
  getText: PaneGetTextFunc;
  setText: PaneSetTextFunc;
  syncReplacements: () => void;

  get range(): [number, number] {
    const r = this.vitrail.adjustRange([
      this.nodes[0].range[0],
      last(this.nodes).range[1],
    ]);
    return [r[0] + this.rangeOffsets[0], r[1] - this.rangeOffsets[1]];
  }

  get sourceString() {
    return this.vitrail.sourceString.slice(this.range[0], this.range[1]);
  }

  constructor({
    vitrail,
    view,
    host,
    setText,
    getText,
    showRange,
    focusRange,
    hasFocus,
    syncReplacements,
    getLocalSelectionIndices,
    ensureContinueEditing,
    fetchAugmentations,
    applyLocalChanges,
  }: {
    vitrail: Vitrail<T>;
    view: HTMLElement;
    host: T;
    syncReplacements: () => void;
    hasFocus: () => boolean;
    showRange: (range: [number, number]) => void;
    focusRange: PaneFocusRangeFunc;
    ensureContinueEditing: PaneEnsureContinueEditing;
    getLocalSelectionIndices: PaneGetLocalSelectionIndicesFunc;
    fetchAugmentations: PaneFetchAugmentationsFunc<T>;
    applyLocalChanges: PaneApplyLocalChangesFunc<T>;
    getText: PaneGetTextFunc;
    setText: PaneSetTextFunc;
  }) {
    this.vitrail = vitrail;
    this.view = view;
    this.host = host;
    this.setText = setText;
    this.getText = getText;
    this.hasFocus = hasFocus;
    this.focusRange = focusRange;
    this.showRange = showRange;
    this.ensureContinueEditing = ensureContinueEditing;
    this.syncReplacements = syncReplacements;
    this._applyLocalChanges = applyLocalChanges;
    this.getLocalSelectionIndices = getLocalSelectionIndices;
    this._fetchAugmentations = fetchAugmentations;

    let pane = this;
    (this.view as any)._debugPane = this;
    (this.view as any).handleDelete = (forward: boolean) => {
      const pos = forward ? this.range[0] : this.range[1] - 1;
      this.vitrail.applyChanges([
        {
          from: pos,
          to: pos + 1,
          insert: "",
          selectionRange: [pos, pos],
          inverse: {
            from: pos,
            to: pos,
            insert: this.vitrail.sourceString[pos],
          },
        },
      ]);
    };
    (this.view as any).cursorPositions = function* () {
      yield* pane.paneCursorPositions();
    };
    (this.view as any).focusRange = function (head: number, anchor: number) {
      pane.focusRange(head - pane.startIndex, anchor - pane.startIndex);
    };
    (this.view as any).showRange = function (range: [number, number]) {
      pane.showRange(rangeShift(range, -pane.startIndex));
    };
    (this.view as any).hasFocus = function () {
      return pane.hasFocus();
    };
    (this.view as any).getSelection = function () {
      return rangeShift(pane.getLocalSelectionIndices(), pane.startIndex);
    };
  }

  get parentPane(): Pane<T> | null {
    if (!this.view.isConnected)
      // FIXME I think this may not return the closest parent
      return (
        this.vitrail._panes.find((p) =>
          p.replacements.some(
            (r) =>
              r.augmentation.type === "replace" &&
              (r.view as HTMLElement).contains(this.view),
          ),
        ) ?? null
      );

    let current = this.view.parentElement;

    while (current) {
      const pane = this.vitrail.paneForView(current as HTMLElement);
      if (pane) return pane;
      current = current.parentElement;
    }

    return null;
  }

  unmount() {
    for (const a of this.augmentations)
      if (a.view instanceof HTMLElement) render(null, a.view);
    this._augmentationInstances.clear();
  }

  fetchAugmentations() {
    if (!this._fetchAugmentations)
      return this.parentPane?.fetchAugmentations() ?? [];
    else return this._fetchAugmentations(this.parentPane) ?? [];
  }

  async loadModels(v: Vitrail<T>) {
    for (const model of this.getRequiredModels()) {
      await v._loadModel(model);
    }
  }

  getRequiredModels(): Set<Model> {
    return new Set(this.fetchAugmentations().map((a) => a.model));
  }

  *paneCursorPositions() {
    const myRange = [this.startIndex, this.startIndex + this.getText().length];
    let last: number | null = null;
    const pane = this;
    function* mine(index: number) {
      for (let i = last; i !== null && i <= index; i++)
        yield { index: i, element: pane.view };
      last = index;
    }
    function* myReplacement(r) {
      last = null;
      if (r.view instanceof HTMLElement) yield* r.view.cursorPositions();
    }

    const replacements = this.replacements.sort(
      (a, b) =>
        a.match.props.nodes[0].range[0] - b.match.props.nodes[0].range[0],
    );

    yield* mine(myRange[0]);
    for (const replacement of replacements) {
      const range = replacementRange(replacement, this.vitrail);
      yield* mine(range[0]);
      yield* myReplacement(replacement);
      yield* mine(range[1]);
    }
    yield* mine(myRange[1]);
  }

  connectNodes(v: Vitrail<T>, nodes: SBNode[]) {
    this.startIndex = nodes[0].range[0];
    this._computeLineNumber();
    this.nodes = nodes;

    this.setText(v._sourceString.slice(this.range[0], this.range[1]), false);

    // FIXME need this extra loop?
    // for (const b of this._getInitEditBuffersForRoots([...v._models.values()]))
    //   this.vitrail.updateAugmentations(b, [this]);
    this.updateAugmentations();

    // asynchronous update
    this.loadMissingModels(v);
  }

  async loadMissingModels(v: Vitrail<T>) {
    const missingModels = this.getRequiredModels();
    for (const model of v._models.keys()) missingModels.delete(model);

    for (const model of missingModels) await v._loadModel(model);

    for (const b of this._getInitEditBuffersForRoots(
      [...missingModels].map((m) => v._models.get(m)!),
    ))
      this.vitrail.updateAugmentations(b, [this]);
  }

  _getInitEditBuffersForRoots(roots: SBNode[]) {
    return [...roots].map(
      (root) =>
        new EditBuffer([
          ...withDo([...this.allVisibleNodesOf(root)], (l) =>
            l.length < 1 ? [root] : l,
          ).flatMap((n) => n.initOps()),
        ]),
    );
  }

  applyChanges(changes: Change<T>[]) {
    const length = this.getText().length;
    const translated: Change<T>[] = [];
    for (const change of changes) {
      const from = change.from - this.startIndex;
      const to = change.to - this.startIndex;
      this.startIndex = adjustIndex(this.startIndex, [change], Side.Left);

      // FIXME need to adjust length?
      if (from > length || to < 0) continue;

      translated.push({
        from: clamp(from, 0, length),
        to: clamp(to, 0, length),
        insert: from >= 0 ? change.insert : "",
        intentDeleteNodes: change.intentDeleteNodes,
      });
    }
    if (translated.length > 0) this._applyLocalChanges(translated);

    if (
      this.nodes.every((n) => n.connected) &&
      !this.vitrail.hasPendingChanges
    ) {
      // depending on how the AST shifted, we may be off; if we have
      // pendingChanges, the AST won't update.
      this.startIndex = this.nodes[0].range[0];
      const targetText = this.sourceString;
      if (this.getText() !== targetText) {
        this.setText(targetText, true);
      }
    }

    this._computeLineNumber();
  }

  _augmentationInstances: Set<AugmentationInstance<any>> = new Set();

  get replacements() {
    return [...this._augmentationInstances].filter(
      (i) => i.augmentation.type === "replace",
    );
  }

  get augmentations() {
    return [...this._augmentationInstances];
  }

  updateAugmentations() {
    const active: [AugmentationMatch, Augmentation<any>][] = [];
    const myAugmentations = this.fetchAugmentations();
    const replacedNodes: SBNode[] = [];
    for (const [match, augmentation] of [
      ...this.vitrail._matchedAugmentations.entries(),
    ]
      .filter(([_, a]) => myAugmentations.includes(a) && a.type !== "rewrite")
      .sort(
        (a, b) =>
          b[0].matchedNode.sourceString.length -
          a[0].matchedNode.sourceString.length,
      )) {
      if (
        this.containsNode(match.matchedNode, augmentation.type === "mark") &&
        !replacedNodes.some((n) => match.matchedNode.orHasParent(n)) &&
        // prevent recursion
        !(
          this.nodes[0] === match.props.nodes[0] &&
          this.parentPane?.replacements.some(
            (r) => r.match.props.nodes[0] === this.nodes[0],
          )
        )
      ) {
        active.push([match, augmentation]);
        if (augmentation.type === "replace")
          replacedNodes.push(...match.props.nodes);
      }
    }

    const current = [...this._augmentationInstances];
    for (const instance of current) {
      if (!active.find((match) => match[0] === instance.match)) {
        if (instance.view instanceof HTMLElement) render(null, instance.view);
        this._augmentationInstances.delete(instance);
      }
    }

    for (const [match, augmentation] of active) {
      if (current.some((i) => i.match === match)) continue;

      let view: VitrailReplacementContainer | Marker[];
      if (augmentation.type === "replace" || augmentation.type === "insert") {
        view = document.createElement(
          "vitrail-replacement-container",
        ) as VitrailReplacementContainer;
      } else {
        view = [];
      }

      const instance: AugmentationInstance<any> = {
        view,
        augmentation,
        match,
      };

      if (view instanceof HTMLElement) {
        view.vitrail = this.vitrail;
        view.augmentationInstance = instance;
      }

      this._augmentationInstances.add(instance);
      this.renderAugmentation(instance);
    }

    this.syncReplacements();
  }

  containsNode(node: SBNode, allowPartial: boolean) {
    if (node.language === this.nodes[0]?.language)
      return this.nodes.some((n) => n.contains(node));
    return allowPartial
      ? rangeIntersects(this.range, node.range)
      : rangeContains(this.range, node.range);
  }

  reRenderAugmentation(match: AugmentationMatch) {
    const instance = [...this._augmentationInstances].find(
      (i) => i.match === match,
    );
    if (instance) this.renderAugmentation(instance);
  }

  renderAugmentation(instance: AugmentationInstance<any>) {
    console.assert(!!this.vitrail);
    if (
      instance.augmentation.type === "replace" ||
      instance.augmentation.type === "insert"
    ) {
      render(
        h(
          VitrailContext.Provider,
          {
            value: { vitrail: this.vitrail, pane: this, view: instance.view },
          },
          h(instance.augmentation.view, {
            ...instance.match.props,
            replacement: instance,
          }),
        ),
        instance.view,
      );
    } else {
      instance.view = instance.augmentation.view({
        ...instance.match.props,
        replacement: instance,
      });
    }
  }

  isShowing(node: SBNode) {
    if (!rangeContains(this.range, node.range)) return false;

    for (const replacement of this.replacements) {
      if (
        rangeIntersects(replacementRange(replacement, this.vitrail), node.range)
      )
        return false;
    }

    return true;
  }

  *allVisibleNodesOf(root: SBNode) {
    for (const node of this.firstChildrenInRangeOf(root)) {
      yield* this.visibleNodesOf(node);
    }
  }

  *visibleNodesOf(root: SBNode) {
    if (this.isShowing(root)) {
      for (const child of root.children) {
        yield* this.visibleNodesOf(child);
      }
      yield root;
    }
  }

  *firstChildrenInRangeOf(root: SBNode) {
    if (rangeContains(this.range, root.range)) {
      yield root;
    } else {
      for (const node of root.children) {
        yield* this.firstChildrenInRangeOf(node);
      }
    }
  }

  _cursorRoot() {
    return this.vitrail._cursorRoots().find((r) => r.contains(this.view));
  }

  adjacentCursorPosition(forward: boolean) {
    const [head, _anchor] = this.getLocalSelectionIndices();
    return adjacentCursorPosition(
      {
        root: this._cursorRoot(),
        element: this.view,
        index: head + this.startIndex,
      },
      forward,
    );
  }

  moveCursor(forward: boolean) {
    const pos = this.adjacentCursorPosition(forward);
    if (pos && pos.element !== this.view) {
      queueMicrotask(() =>
        (pos.element as any).focusRange(pos.index, pos.index),
      );
      return true;
    }
    return false;
  }

  handleDeleteAtBoundary(forward: boolean) {
    const [head, _anchor] = this.getLocalSelectionIndices();
    const offset = forward ? 0 : -1;
    const adjusted = head + this.range[0] + offset;
    const pos = this.adjacentCursorPosition(forward);
    if (pos && pos.element !== this.view) {
      pos.element.handleDelete(forward);
      // const deletedChar = this.getText().slice(
      //   head + (forward ? 0 : -1),
      //   head + (forward ? 1 : 0),
      // );
      // this.vitrail.applyChanges([
      //   {
      //     from: adjusted,
      //     to: adjusted + 1,
      //     insert: "",
      //     sideAffinity: forward ? 1 : -1,
      //     selectionRange: [adjusted, adjusted],
      //     inverse: {
      //       from: adjusted,
      //       to: adjusted,
      //       insert: deletedChar,
      //     },
      //   },
      // ]);
      return true;
    } else if (adjusted !== pos?.index) {
      // FIXME not sure what to best do here, delete the next valid character?
    }
    return false;
  }

  _computeLineNumber() {
    const source = this.vitrail.sourceString;
    this.startLineNumber = 1;
    for (let i = 0; i < this.startIndex; i++) {
      if (source[i] === "\n") this.startLineNumber++;
    }
    return this.startLineNumber;
  }
}
