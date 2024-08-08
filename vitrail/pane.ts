import {
  EditBuffer,
  RemoveOp,
  UpdateOp,
  AttachOp,
  DetachOp,
} from "../core/diff";
import { SBNode } from "../core/model";
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
} from "../utils";
import { adjacentCursorPosition } from "../view/focus";
import { VitrailReplacementContainer } from "./replacement-container";
import {
  Vitrail,
  AugmentationInstance,
  PaneFetchAugmentationsFunc,
  replacementRange,
  Change,
  Augmentation,
  VitrailContext,
  Marker,
  ReplacementProps,
} from "./vitrail";

type PaneGetTextFunc = () => string;
type PaneSetTextFunc = (s: string, undoable: boolean) => void;
type PaneApplyLocalChangesFunc<T> = (changes: Change<T>[]) => void;
type PaneGetLocalSelectionIndicesFunc = () => [number, number];
type PaneEnsureContinueEditing = () => void;
type PaneFocusRangeFunc = (head: number, anchor: number) => void;

function compareReplacementProps(a: any, b: any, editBuffer: EditBuffer) {
  if (a instanceof SBNode) {
    if (a.id !== b?.id) return false;
    if (editBuffer.hasChangeIn(a)) return false;
    return true;
  }
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (a.length !== b?.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (typeof a === "object") {
    for (const key in a) {
      if (!compareReplacementProps(a[key], b[key], editBuffer)) return false;
    }
    return true;
  }
  return false;
}

export class Pane<T> {
  vitrail: Vitrail<T>;
  view: HTMLElement;
  host: T;
  nodes: SBNode[];
  replacements: AugmentationInstance<any>[] = [];
  markers: { nodes: SBNode[] }[] = [];
  startIndex: number = -1;
  startLineNumber: number = -1;
  props = signal(null);

  _fetchAugmentations: PaneFetchAugmentationsFunc<T>;
  focusRange: PaneFocusRangeFunc;
  hasFocus: () => boolean;
  _applyLocalChanges: PaneApplyLocalChangesFunc<T>;
  getLocalSelectionIndices: PaneGetLocalSelectionIndicesFunc;
  ensureContinueEditing: PaneEnsureContinueEditing;
  getText: PaneGetTextFunc;
  setText: PaneSetTextFunc;
  syncReplacements: () => void;

  get range() {
    return this.vitrail.adjustRange([
      this.nodes[0].range[0],
      last(this.nodes).range[1],
    ]);
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
    this.ensureContinueEditing = ensureContinueEditing;
    this.syncReplacements = syncReplacements;
    this._applyLocalChanges = applyLocalChanges;
    this.getLocalSelectionIndices = getLocalSelectionIndices;
    this._fetchAugmentations = fetchAugmentations;

    let pane = this;
    (this.view as any)._debugPane = this;
    (this.view as any).cursorPositions = function* () {
      yield* pane.paneCursorPositions();
    };
    (this.view as any).focusRange = function (head: number, anchor: number) {
      pane.focusRange(head - pane.startIndex, anchor - pane.startIndex);
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

  fetchAugmentations() {
    if (!this._fetchAugmentations)
      return this.parentPane?.fetchAugmentations() ?? [];
    else return this._fetchAugmentations(this.parentPane) ?? [];
  }

  async loadModels(v: Vitrail<T>) {
    for (const augmentation of this.fetchAugmentations()) {
      await v._loadModel(augmentation.model);
    }
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
      (a, b) => a.nodes[0].range[0] - b.nodes[0].range[0],
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

    this.updateAllReplacements(v);
  }

  updateAllReplacements(v: Vitrail<T>) {
    const buffers = this.getInitEditBuffersForRoots([...v._models.values()]);
    for (const buffer of buffers) this.updateReplacements(buffer);
  }

  applyChanges(changes: Change<T>[]) {
    const length = this.getText().length;
    const translated: Change<T>[] = [];
    for (const change of changes) {
      const from = change.from - this.startIndex;
      const to = change.to - this.startIndex;
      this.startIndex = adjustIndex(this.startIndex, [change], Side.Left);

      if (from >= length || to <= 0) continue;

      translated.push({
        from: clamp(from, 0, length),
        to: clamp(to, 0, length),
        insert: from > 0 ? change.insert : "",
        intentDeleteNodes: change.intentDeleteNodes,
      });
    }
    this._applyLocalChanges(translated);

    if (
      this.nodes.every((n) => n.connected) &&
      !this.vitrail.hasPendingChanges
    ) {
      // depending on how the AST shifted, we may be off; if we have
      // pendingChanges, the AST won't update.
      const targetText = this.sourceString;
      if (this.getText() !== targetText) {
        this.setText(targetText, true);
      }
      this.startIndex = this.nodes[0].range[0];
    }

    this._computeLineNumber();
  }

  updateReplacements(editBuffer: EditBuffer) {
    if (editBuffer.empty) return;

    // check for replacements that are now gone because their node was removed
    for (const op of editBuffer.negBuf) {
      if (op instanceof RemoveOp) {
        const replacement = this.getReplacementFor(op.node);
        if (replacement) this.uninstallReplacement(replacement);
      }
    }

    const changedNodes = new Set<SBNode>();
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
        const match = replacement
          ? this.matchAugmentation(node, replacement.augmentation)
          : null;
        // check for replacements that are now gone because a change made them invalid
        if (replacement && !match) {
          this.uninstallReplacement(replacement);
        }
      }
    }

    for (const replacement of this.replacements) {
      const match = this.reRenderReplacement(replacement, editBuffer);
      if (match) {
        replacement.nodes = match.nodes;
        replacement.lastMatch = match;
        this.renderAugmentation(replacement, match);
      }
    }

    // check for new replacements
    for (const root of changedNodes) {
      for (const augmentation of this.fetchAugmentations()) {
        if (augmentation.model !== root.language) continue;
        let node: SBNode | null = root;
        for (let i = 0; i <= augmentation.matcherDepth; i++) {
          if (!node) break;
          if (!this.containsNode(node, augmentation.type === "mark")) break;

          const match = this.mayReplace(node, augmentation);
          if (match) this.installReplacement(node, augmentation, match);
          node = node.parent;
          // if we check this node later anyways, no need to ascend from here
          if (node && changedNodes.has(node)) break;
        }
      }
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

  reRenderReplacement(
    replacement: AugmentationInstance<any>,
    editBuffer: EditBuffer,
  ) {
    if (!replacement.augmentation.rerender?.(editBuffer)) return null;

    const match = this.matchAugmentation(
      replacement.matchedNode,
      replacement.augmentation,
    );
    if (compareReplacementProps(match, replacement.lastMatch, editBuffer))
      return null;
    return match;
  }

  matchAugmentation(node: SBNode, augmentation: Augmentation<any>) {
    const match = augmentation.match(node, this);
    if (!match) return null;
    match.nodes = [node];
    return match;
  }

  mayReplace(node: SBNode, augmentation: Augmentation<any>) {
    if (this.getReplacementFor(node)) return null;
    // prevent recursion
    if (
      this.nodes[0] === node &&
      this.parentPane?.replacements.some((r) => r.matchedNode === this.nodes[0])
    )
      return false;
    const match = this.matchAugmentation(node, augmentation);
    if (!match) return false;
    if (!match.nodes) match.nodes = [node];
    if (
      augmentation.type === "replace" &&
      this.replacements.some(
        (r) =>
          r.augmentation.type === "replace" &&
          rangeContains(
            [r.nodes[0].range[0], last(r.nodes).range[1]],
            [match.nodes[0].range[0], last(match.nodes).range[1]],
          ),
      )
    )
      return false;
    return match;
  }

  renderAugmentation<Props extends Omit<ReplacementProps, "replacement">>(
    replacement: AugmentationInstance<
      Props & { nodes: SBNode[]; replacement: AugmentationInstance<any> }
    >,
    match: Props & { nodes: SBNode[] },
  ) {
    console.assert(!!this.vitrail);
    if (replacement.augmentation.type === "replace") {
      render(
        h(
          VitrailContext.Provider,
          { value: { vitrail: this.vitrail, pane: this } },
          h(replacement.augmentation.view, { ...match, replacement }),
        ),
        replacement.view,
      );
    } else {
      replacement.view = replacement.augmentation.view({
        ...match,
        replacement,
      });
    }
  }

  installReplacement<
    Props extends { [field: string]: any } & { nodes: SBNode[] },
  >(
    matchedNode: SBNode,
    augmentation: Augmentation<ReplacementProps>,
    match: Props,
  ) {
    let view: VitrailReplacementContainer | Marker[];
    if (augmentation.type === "replace") {
      view = document.createElement(
        "vitrail-replacement-container",
      ) as VitrailReplacementContainer;
    } else {
      view = [];
    }

    const replacement: AugmentationInstance<any> = {
      matchedNode,
      nodes: Array.isArray(match.nodes) ? match.nodes : [match.nodes],
      view,
      augmentation,
      lastMatch: match,
    };

    if (view instanceof HTMLElement) {
      view.vitrail = this.vitrail;
      view.replacement = replacement;
    }

    this.replacements.push(replacement);

    this.renderAugmentation(replacement, match);
  }

  uninstallReplacement(replacement: AugmentationInstance<any>) {
    // FIXME still needed?
    // for (const pane of [...this.vitrail._panes]) {
    //   if (replacement.view.contains(pane.view))
    //     this.vitrail.unregisterPane(pane);
    // }
    if (replacement.view instanceof HTMLElement) render(null, replacement.view);
    this.replacements.splice(this.replacements.indexOf(replacement), 1);
  }

  getReplacementFor(node: SBNode) {
    return this.replacements.find((r) => r.matchedNode === node);
  }

  getInitEditBuffersForRoots(roots: SBNode[]) {
    return [...roots].map(
      (root) =>
        new EditBuffer([
          ...withDo([...this.allVisibleNodesOf(root)], (l) =>
            l.length < 1 ? [root] : l,
          ).flatMap((n) => n.initOps()),
        ]),
    );
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
