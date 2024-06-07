import {
  AttachOp,
  DetachOp,
  EditBuffer,
  RemoveOp,
  UpdateOp,
} from "../core/diff.js";
import { SBBaseLanguage, SBLanguage, SBNode } from "../core/model.js";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "../external/preact-hooks.mjs";
import { effect, signal } from "../external/preact-signals-core.mjs";
import { createContext, h, render } from "../external/preact.mjs";
import {
  adjustIndex,
  clamp,
  last,
  rangeContains,
  rangeDistance,
  rangeIntersects,
} from "../utils.js";
import {
  adjacentCursorPosition,
  cursorPositionsForIndex,
} from "../view/focus.ts";

// TODO
// marker (and not just replacement) support
// navigating between arbitrary editables
// deletion when the start index of a nested pane changes

(Element.prototype as any).cursorPositions = function* () {
  for (const child of this.children) yield* child.cursorPositions();
};

const VitrailContext = createContext(null);

export interface Replacement<
  Props extends { [field: string]: any } & { nodes: SBNode[] },
> {
  nodes: SBNode[];
  view: HTMLElement;
  augmentation: Augmentation<Props>;
}
export function replacementRange(
  replacement: Replacement<any>,
  vitrail: Vitrail<any>,
) {
  return vitrail.adjustRange([
    replacement.nodes[0].range[0],
    last(replacement.nodes).range[1],
  ]);
}

type JSX = any;

export interface Augmentation<
  Props extends { [field: string]: any } & { nodes: SBNode[] },
> {
  model: Model;
  matcherDepth: number;
  match: (node: SBNode, pane: Pane<any>) => Props | null;
  view: (props: Props) => JSX;
  rerender?: (editBuffer: EditBuffer) => boolean;
}

interface Model {
  parse: <T>(sourceString: string, v: Vitrail<T>) => Promise<SBNode>;
  canBeDefault: boolean;
}

export interface ReversibleChange<T> {
  from: number;
  to: number;
  insert: string;
  inverse: Change<T>;
  sourcePane?: Pane<T>;
  sideAffinity?: -1 | 0 | 1;
  selectionRange?: [number, number];
}
export type Change<T> = Omit<ReversibleChange<T>, "inverse" | "sourcePane">;

type CreatePaneFunc<T> = (
  fetchAugmentations: PaneFetchAugmentationsFunc<T>,
) => Pane<T>;
type PaneGetTextFunc = () => string;
type PaneSetTextFunc = (s: string) => void;
type PaneApplyLocalChangesFunc<T> = (changes: Change<T>[]) => void;
export type PaneFetchAugmentationsFunc<T> = (
  parent: Pane<T> | null,
) => Augmentation<any>[] | null;
type PaneGetLocalSelectionIndicesFunc = () => [number, number];
type PaneFocusRangeFunc = (head: number, anchor: number) => void;
type ValidatorFunc<T> = (
  root: SBNode,
  diff: EditBuffer,
  changes: ReversibleChange<T>[],
) => boolean;

export class Vitrail<T> {
  _panes: Pane<T>[] = [];
  _models: Map<Model, SBNode> = new Map();
  _validators = new Set<[Model, ValidatorFunc<T>]>();

  _rootPane: Pane<T>;
  _sourceString: string;

  createPane: CreatePaneFunc<T>;
  _showValidationPending: (show: boolean) => void;

  get sourceString() {
    return this._sourceString;
  }

  get defaultModel(): Model {
    for (const model of this._models.keys())
      if (model.canBeDefault) return model;
    for (const model of this._models.keys()) return model;
    throw new Error("No default model");
  }

  constructor({
    createPane,
    showValidationPending,
  }: {
    createPane: CreatePaneFunc<T>;
    showValidationPending: (show: boolean) => void;
  }) {
    this.createPane = createPane;
    this._showValidationPending = showValidationPending;

    this._pendingChanges = signal([]);
    effect(() => {
      this._showValidationPending(this._pendingChanges.value.length > 0);
    });
  }

  getModels() {
    return this._models;
  }

  registerPane(pane: Pane<T>) {
    this._panes.push(pane);
  }

  unregisterPane(pane: Pane<T>) {
    const idx = this._panes.indexOf(pane);
    if (idx !== -1) this._panes.splice(idx, 1);
    else throw new Error("pane not found");
  }

  paneForView(view: HTMLElement | null) {
    return this._panes.find((p) => p.view === view) ?? null;
  }

  async registerValidator(model: Model, cb: ValidatorFunc<T>) {
    if (!(model instanceof SBLanguage)) throw new Error("no model given");
    const p: [Model, ValidatorFunc<T>] = [model, cb];
    this._validators.add(p);
    await this._loadModels();
    return () => this._validators.delete(p);
  }

  async connectHost(pane: Pane<T>) {
    this._rootPane = pane;
    (this._rootPane.view as any).isFocusHost = true;
    this.registerPane(pane);
    this._sourceString = this._rootPane.getText();
    await this._loadModels();
    this._rootPane.connectNodes(this, [this._models.get(this.defaultModel)!]);
  }

  async _loadModel(model: Model) {
    if (!this._models.has(model)) {
      this._models.set(model, await model.parse(this.sourceString, this));
    }
  }

  async _loadModels() {
    await this._loadModel(SBBaseLanguage);
    for (const validator of this._validators) {
      await this._loadModel(validator[0]);
    }
    for (const pane of this._panes) {
      await pane.loadModels(this);
    }
  }

  activeTransactionList: ReversibleChange<T>[] | null = null;
  _pendingChanges: ReturnType<typeof signal>;
  _revertChanges: Change<T>[] = [];

  applyChanges(changes: ReversibleChange<T>[], forceApply = false) {
    if (this.activeTransactionList) {
      this.activeTransactionList.push(
        ...changes.map((c) => ({
          ...c,
          from: adjustIndex(c.from, this.activeTransactionList!),
          to: adjustIndex(c.to, this.activeTransactionList!),
        })),
      );
      return;
    }

    const oldSource = this._sourceString;
    let newSource = oldSource;
    const allChanges = [...this._pendingChanges.value, ...changes];
    for (const { from, to, insert } of allChanges) {
      newSource =
        newSource.slice(0, from) + (insert ?? "") + newSource.slice(to);
    }

    const update = [...this._models.values()].map((n) => n.reParse(newSource));
    if (!forceApply) {
      for (const { diff, root } of update) {
        for (const [validateModel, validator] of this._validators) {
          if (
            root.language === validateModel &&
            !validator(root, diff, allChanges)
          ) {
            this._determineSideAffinity(root, allChanges);

            for (const { tx } of update) tx.rollback();
            this._pendingChanges.value = [
              ...this._pendingChanges.value,
              ...changes,
            ];
            for (const pane of this._panes) {
              pane.applyChanges(changes.filter((c) => c.sourcePane !== pane));
              pane.syncReplacements();
            }
            this._revertChanges.push(...changes.map((c) => c.inverse));
            // TODO still needed?
            // this.selectRange( last(allChanges).selectionRange ?? this.selectionRange,);
            return false;
          }
        }
      }
    }

    for (const { tx } of update) tx.commit();
    this._models = new Map(update.map(({ root }) => [root.language, root]));
    this._sourceString = newSource;
    this._pendingChanges.value = [];
    this._revertChanges = [];

    // first, apply changes
    // may create or delete panes while iterating, so iterate over a copy
    for (const pane of [...this._panes]) {
      // if we are deleted while iterating, don't process diff
      if (pane.nodes[0]?.connected && pane.view.isConnected) {
        pane.applyChanges(changes.filter((c) => c.sourcePane !== pane));
      }
    }

    // then, update replacements
    // may create or delete panes while iterating, so iterate over a copy
    for (const pane of [...this._panes]) {
      // if we are deleted while iterating, don't process diff
      if (pane.nodes[0]?.connected) {
        for (const buffer of update.map((u) => u.diff))
          pane.updateReplacements(buffer);
      }
    }

    const target = last(allChanges).selectionRange;
    const candidates = cursorPositionsForIndex(this._rootPane.view, target[0]);
    const focused = candidates.find((p) => (p.element as any).hasFocus());
    if (!focused) {
      (candidates[0].element as any).focusRange(
        candidates[0].index,
        candidates[0].index,
      );
    }
  }

  adjustRange(range: [number, number]) {
    return [
      adjustIndex(range[0], this._pendingChanges.value, 1),
      adjustIndex(range[1], this._pendingChanges.value, -1),
    ];
  }

  get hasPendingChanges() {
    return this._pendingChanges.value.length > 0;
  }

  // if we have a pending change, we need to figure out to which node it contributed to.
  // For example, if we have an expression like `1+3` and an insertion of `2` at index 1,
  // we want the side affinity to be -1 to indicate that the `2` is part of the `1` node.
  // This is relevant for panes to include or exclude pending changes.
  //
  // Note that a text inserted in a pane will automatically set its affinity based on the
  // pane boundaries, so this function will only be used to set the affinity for changes
  // that are caused independent of views.
  _determineSideAffinity(root: SBNode, changes: ReversibleChange<T>[]) {
    for (const change of changes) {
      if (change.sideAffinity !== undefined) continue;
      const leaf = root.leafForPosition(change.from, true);
      change.sideAffinity =
        leaf.range[0] === change.from
          ? 1
          : leaf.range[1] - change.insert.length === change.from
            ? -1
            : 0;
    }
  }

  applyPendingChanges() {
    this.applyChanges([], true);
  }

  revertPendingChanges() {
    if (this._pendingChanges.value.length == 0) return;
    const changes = [...this._revertChanges].reverse();
    this._revertChanges = [];
    this._pendingChanges.value = [];
    for (const pane of this._panes) {
      pane.applyChanges(changes);
      pane.syncReplacements();
    }
  }

  replaceTextFromCommand(range: [number, number], text: string) {
    const previousText = this._rootPane.getText().slice(range[0], range[1]);
    this.applyChanges([
      {
        from: range[0],
        to: range[1],
        insert: text,
        selectionRange: [range[0] + text.length, range[0] + text.length],
        inverse: {
          from: range[0],
          to: range[0] + text.length,
          insert: previousText,
        },
      },
    ]);
  }

  insertTextFromCommand(position: number, text: string) {
    this.applyChanges([
      {
        from: position,
        to: position,
        insert: text,
        selectionRange: [position + text.length, position + text.length],
        inverse: {
          from: position,
          to: position + text.length,
          insert: "",
        },
      },
    ]);
  }
}

export class Pane<T> {
  vitrail: Vitrail<T>;
  view: HTMLElement;
  host: T;
  nodes: SBNode[];
  replacements: Replacement<any>[] = [];
  markers: { nodes: SBNode[] }[] = [];
  startIndex: number = -1;

  _fetchAugmentations: PaneFetchAugmentationsFunc<T>;
  focusRange: PaneFocusRangeFunc;
  hasFocus: () => boolean;
  _applyLocalChanges: PaneApplyLocalChangesFunc<T>;
  getLocalSelectionIndices: PaneGetLocalSelectionIndicesFunc;
  getText: PaneGetTextFunc;
  setText: PaneSetTextFunc;
  syncReplacements: () => void;

  get range() {
    return this.vitrail.adjustRange([
      this.nodes[0].range[0],
      last(this.nodes).range[1],
    ]);
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
    fetchAugmentations,
    applyLocalChanges,
  }: {
    vitrail: Vitrail<T>;
    view: HTMLElement;
    host: T;
    syncReplacements: () => void;
    hasFocus: () => boolean;
    focusRange: PaneFocusRangeFunc;
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
    this.syncReplacements = syncReplacements;
    this._applyLocalChanges = applyLocalChanges;
    this.getLocalSelectionIndices = getLocalSelectionIndices;
    this._fetchAugmentations = fetchAugmentations;

    let pane = this;
    (this.view as any).cursorPositions = function* () {
      yield* pane.paneCursorPositions();
    };
    (this.view as any).focusRange = function (head: number, anchor: number) {
      pane.focusRange(head - pane.range[0], anchor - pane.range[0]);
    };
    (this.view as any).hasFocus = function () {
      pane.hasFocus();
    };
  }

  get parentPane() {
    if (!this.view.isConnected)
      // FIXME I think this may not return the closest parent
      return this.vitrail._panes.find((p) =>
        p.replacements.some((r) => r.view.contains(this.view)),
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
    const myRange = this.range;
    let last: number | null = null;
    const pane = this;
    function* mine(index: number) {
      for (let i = last; i !== null && i <= index; i++)
        yield { index: i, element: pane.view };
      last = index;
    }
    function* myReplacement(r) {
      last = null;
      yield* r.view.cursorPositions();
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
    this.nodes = nodes;

    this.setText(v._sourceString.slice(this.range[0], this.range[1]));

    const buffers = this.getInitEditBuffersForRoots([...v._models.values()]);
    for (const buffer of buffers) this.updateReplacements(buffer);
  }

  applyChanges(changes: Change<T>[]) {
    const range = this.range;
    const length = range[1] - range[0];
    const translated: Change<T>[] = [];
    for (const change of changes) {
      const from = change.from - this.startIndex;
      const to = change.to - this.startIndex;
      if (from >= length && to <= 0) continue;

      translated.push({
        from: clamp(from, 0, length),
        to: clamp(to, 0, length),
        insert: from > 0 ? change.insert : "",
      });
      this.startIndex = adjustIndex(this.startIndex, [change], -1);
    }
    this._applyLocalChanges(translated);

    if (!this.vitrail.hasPendingChanges) {
      // depending on how the AST shifted, we may be off; if we have
      // pendingChanges, the AST won't update.
      const targetText = this.nodes.map((n) => n.sourceString).join("");
      if (this.getText() !== targetText) {
        this.setText(targetText);
      }
      this.startIndex = this.nodes[0].range[0];
    }
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
        const match = replacement?.augmentation.match(node, this);
        // check for replacements that are now gone because a change made them invalid
        if (replacement && !match) {
          this.uninstallReplacement(replacement);
        } else if (replacement) {
          this.renderAugmentation(
            replacement.augmentation,
            match,
            replacement.view,
          );
        }
      }
    }

    // check for new replacements
    for (const root of changedNodes) {
      for (const augmentation of this.fetchAugmentations()) {
        if (augmentation.model !== root.language) continue;
        let node: SBNode | null = root;
        for (let i = 0; i <= augmentation.matcherDepth; i++) {
          if (!node || !this.isShowing(node)) continue;

          const match = this.mayReplace(node, augmentation);
          if (match) this.installReplacement(augmentation, match);
          node = node?.parent;
        }
      }
    }

    this.syncReplacements();
  }

  mayReplace(node: SBNode, augmentation: Augmentation<any>) {
    if (this.getReplacementFor(node)) return null;
    // TODO prevent recursion
    // if (this.parentPane?.replacements.some((r) => r.node === node)) return false;
    return augmentation.match(node, this);
  }

  renderAugmentation<
    Props extends { [field: string]: any } & { nodes: SBNode[] },
  >(augmentation: Augmentation<Props>, match: Props, parent: HTMLElement) {
    console.assert(!!this.vitrail);
    render(
      h(
        VitrailContext.Provider,
        { value: this.vitrail },
        h(augmentation.view, match),
      ),
      parent,
    );
  }

  installReplacement<
    Props extends { [field: string]: any } & { nodes: SBNode[] },
  >(augmentation: Augmentation<Props>, match: Props) {
    const view = document.createElement("span");

    this.replacements.push({
      nodes: Array.isArray(match.nodes) ? match.nodes : [match.nodes],
      view,
      augmentation,
    });

    this.renderAugmentation(augmentation, match, view);
  }

  uninstallReplacement(replacement: Replacement<any>) {
    for (const pane of [...this.vitrail._panes]) {
      if (replacement.view.contains(pane.view))
        this.vitrail.unregisterPane(pane);
    }
    this.replacements.splice(this.replacements.indexOf(replacement), 1);
  }

  getReplacementFor(node: SBNode) {
    return this.replacements.find((r) => r.nodes.includes(node));
  }

  getInitEditBuffersForRoots(roots: SBNode[]) {
    return [...roots].map(
      (root) =>
        new EditBuffer([
          ...[...this.allVisibleNodesOf(root)].flatMap((n) => n.initOps()),
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

  adjacentCursorPosition(forward: boolean) {
    const [head, _anchor] = this.getLocalSelectionIndices();
    return adjacentCursorPosition(
      {
        root: this.vitrail._rootPane.view,
        element: this.view,
        index: head + this.range[0],
      },
      forward,
    );
  }

  moveCursor(forward: boolean) {
    const pos = this.adjacentCursorPosition(forward);
    if (pos && pos.element !== this.view)
      (pos.element as any).focusRange(pos.index, pos.index);
  }

  handleDeleteAtBoundary(forward: boolean) {
    const [head, _anchor] = this.getLocalSelectionIndices();
    const offset = forward ? 0 : -1;
    const adjusted = head + this.range[0] + offset;
    const pos = this.adjacentCursorPosition(forward);
    if (pos && pos.element !== this.view) {
      const deletedChar = this.getText().slice(
        head + (forward ? 0 : -1),
        head + (forward ? 1 : 0),
      );
      this.vitrail.applyChanges([
        {
          from: adjusted,
          to: adjusted + 1,
          insert: "",
          sideAffinity: forward ? 1 : -1,
          selectionRange: [adjusted, adjusted],
          inverse: {
            from: adjusted,
            to: adjusted,
            insert: deletedChar,
          },
        },
      ]);
    }
  }
}

export function VitrailPane({ fetchAugmentations, nodes }) {
  const vitrail: Vitrail<any> = useContext(VitrailContext);
  const pane: Pane<any> = useMemo(
    // fetchAugmentations may not change (or rather: we ignore any changes)
    () => {
      const pane = vitrail.createPane(fetchAugmentations);
      return pane;
    },
    [vitrail],
  );

  // trigger this as early as possible, such that the pane is synchronously
  // available as a target during cursor enumeration after a change
  useLayoutEffect(() => {
    vitrail.registerPane(pane);
    pane.connectNodes(vitrail, nodes);
    return () => vitrail.unregisterPane(pane);
  }, [vitrail, ...nodes]);

  return h("span", {
    key: "stable",
    ref: (el: HTMLElement) => {
      if (!pane.view.isConnected) el.appendChild(pane.view);
    },
  });
}
