import { EditBuffer } from "../core/diff.js";
import { EditOptions, ModelEditor } from "../core/matcher.ts";
import {
  SBBaseLanguage,
  SBLanguage,
  SBNode,
  sortModels,
} from "../core/model.js";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "../external/preact-hooks.mjs";
import { computed, effect, signal } from "../external/preact-signals-core.mjs";
import { createContext, h } from "../external/preact.mjs";
import {
  Side,
  adjustIndex,
  allChildren,
  last,
  rangeContains,
  rangeEqual,
  rangeShift,
  takeWhile,
} from "../utils.js";
import { cursorPositionsForIndex, getFocusHost } from "../view/focus.ts";
import { forwardRef } from "../view/widgets.js";
import { Pane } from "./pane.ts";

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

export function applyStringChange(source, { from, to, insert }: Change<any>) {
  return source.slice(0, from) + (insert ?? "") + source.slice(to);
}

// TODO
// redo needs to be aware of intentToDeleteNodes
// process replacements in two phases: remove all and buffer, then add all
// change text just after spawn (while models are still loading)

(Element.prototype as any).cursorPositions = function* () {
  for (const child of this.children) yield* child.cursorPositions();
};
(Element.prototype as any).hasFocus = function () {
  return document.activeElement === this;
};

export const VitrailContext = createContext(null);
export const useVitrailProps = () =>
  useContext(VitrailContext).vitrail.props.value;
export const usePaneProps = () =>
  useContext(VitrailContext).pane.props.value ?? {};
export const useReplacementView = () => useContext(VitrailContext).view;
export const useOnSelectReplacement = (cb) => {
  const view = useReplacementView();
  useEffect(() => {
    view.addEventListener("focus", cb);
    return () => view.removeEventListener("focus", cb);
  }, [view, cb]);
};
export const useOnChange = (cb) => {
  const vitrail = useContext(VitrailContext).vitrail;
  useEffect(() => {
    vitrail.addEventListener("change", cb);
    return () => vitrail.removeEventListener("change", cb);
  }, [vitrail, cb]);
};

export type ReplacementProps = {
  nodes: SBNode[];
  replacement: AugmentationInstance<any>;
  [field: string]: any;
};

export interface Marker {
  offset?: number;
  length?: number;
  attributes: { [key: string]: any };
  eventHandlers: { [key: string]: any };
}

export interface AugmentationInstance<Props extends ReplacementProps> {
  match: AugmentationMatch;
  view: HTMLElement | Marker[];
  augmentation: Augmentation<Props>;
}
export function replacementRange(
  a: AugmentationInstance<any>,
  vitrail: Vitrail<any>,
) {
  const nodes = a.match.props.nodes;
  const start = nodes[0].range[0];
  const end = last(nodes).range[1];
  return vitrail.adjustRange(
    a.augmentation.type === "insert"
      ? (a.augmentation.insertPosition ?? "start") === "start"
        ? [start, start]
        : [end, end]
      : [start, end],
    true,
  );
}

export function markerRange(a: Marker, base: [number, number]) {
  return [
    base[0] + (a.offset ?? 0),
    a.length === undefined ? base[1] : base[0] + (a.offset ?? 0) + a.length,
  ];
}

type JSX = any;

export enum SelectionInteraction {
  Skip = "skip",
  Start = "start",
  StartAndEnd = "startAndEnd",
}

export enum DeletionInteraction {
  Character = "character",
  Full = "full",
  SelectThenFull = "selectThenFull",
}

export interface Augmentation<Props extends ReplacementProps> {
  name?: string;
  type: "replace" | "mark" | "insert";
  model: Model;
  matcherDepth?: number;
  match: (node: SBNode) => Props | null;
  view: (props: Props) => JSX | Marker;
  checkOnEdit?: (editBuffer: EditBuffer, check: (node: SBNode) => void) => void;
  selectionInteraction?: SelectionInteraction;
  deletionInteraction?: DeletionInteraction;
  insertPosition?: "start" | "end";
  // deprecated and no longer used -- only comparing the input props now
  rerender?: (editBuffer: EditBuffer) => boolean;
}

export interface Model {
  dependencies?: Model[];
  prepareForParsing: (models: Map<Model, SBNode>) => void;
  parse: <T>(sourceString: string, v: Vitrail<T>) => Promise<SBNode>;
  canBeDefault: boolean;
}

export type AugmentationMatch = {
  props: { nodes: SBNode[]; [field: string]: any };
  matchedNode: SBNode;
};

export type ReversibleChange<T> = {
  from: number;
  to: number;
  insert: string;
  inverse: Change<T>;
  sourcePane?: Pane<T>;
  sideAffinity?: -1 | 0 | 1;
  selectionRange?: [number, number];
} & EditOptions;
export type Change<T> = Omit<ReversibleChange<T>, "inverse" | "sourcePane">;
export type PaneFetchAugmentationsFunc<T> = (
  parent: Pane<T> | null,
) => Augmentation<any>[] | null;

type CreatePaneFunc<T> = (
  fetchAugmentations: PaneFetchAugmentationsFunc<T>,
  hostOptions?: any,
) => Pane<T>;
type ValidatorFunc<T> = (
  root: SBNode,
  diff: EditBuffer,
  changes: ReversibleChange<T>[],
) => boolean;

export class Vitrail<T> extends EventTarget implements ModelEditor {
  _sourceString: string;
  _panes: Pane<T>[] = [];
  _rootPane: Pane<T>;
  _models: Map<Model, SBNode> = new Map();
  _validators = new Set<[Model, ValidatorFunc<T>]>();
  _props = signal({});

  // Augmentations
  _matchedAugmentations: Map<AugmentationMatch, Augmentation<any>> = new Map();
  _augmentationsCheckedTrees: Map<Augmentation<any>, Set<SBNode>> = new Map();

  // Editing
  _activeTransactionList: ReversibleChange<T>[] | null = null;
  _pendingChanges: { value: ReversibleChange<T>[] };
  _revertChanges: Change<T>[] = [];

  createPane: CreatePaneFunc<T>;
  _showValidationPending: (show: boolean, sourcePane?: Pane<T>) => void;

  // general-purpose way for the outside world to set values
  get props() {
    return this._props;
  }

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
    showValidationPending: (show: boolean, sourcePane?: Pane<T>) => void;
  }) {
    super();

    this.createPane = createPane;
    this._showValidationPending = showValidationPending;

    this._pendingChanges = signal([]);
    const hasPending = computed(() => this._pendingChanges.value.length > 0);
    effect(() => {
      this._showValidationPending(
        hasPending.value,
        last(this._pendingChanges.value)?.sourcePane ?? this._rootPane,
      );
    });
  }

  // Panes and Models

  getModels() {
    return this._models;
  }

  modelForNode(node: SBNode) {
    return this._models.get(node.language as unknown as Model);
  }

  registerPane(pane: Pane<T>) {
    this._panes.push(pane);
  }

  unregisterPane(pane: Pane<T>) {
    const idx = this._panes.indexOf(pane);
    if (idx !== -1) {
      const [pane] = this._panes.splice(idx, 1);
      pane.unmount();
    } else throw new Error("pane not found");
  }

  paneForView(view: HTMLElement | null) {
    return this._panes.find((p) => p.view === view) ?? null;
  }

  async ensureModel(model: Model) {
    await this._loadModel(model);
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
      for (const d of model.dependencies ?? []) await this._loadModel(d);
      model.prepareForParsing(this._models);
      this._models.set(model, await model.parse(this.sourceString, this));
      this.dispatchEvent(
        new CustomEvent("newModelLoaded", { detail: { model } }),
      );
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

  // Editing

  transaction(cb: () => void) {
    if (this._activeTransactionList)
      throw new Error("Nested transactions not supported right now");
    this._activeTransactionList = [];
    cb();
    const list = this._activeTransactionList;
    this._activeTransactionList = null;
    this.applyChanges(list);
  }

  applyChanges(changes: ReversibleChange<T>[], forceApply = false) {
    if (
      changes.length > 0 &&
      !last(changes).sideAffinity &&
      last(changes).sourcePane
    ) {
      let atStart = last(changes).sourcePane!.startIndex === last(changes).from;
      last(changes).sideAffinity = atStart ? Side.Left : (Side.Right as any);
    }

    // make sure all the intent-to-delete nodes have a language set, so we still know
    // which model to consult after they are unmounted
    for (const change of changes)
      for (const n of change.intentDeleteNodes ?? []) n._language = n.language;

    if (this._activeTransactionList) {
      const affinity = last(changes).sideAffinity;
      this._activeTransactionList.push(
        ...changes.map((c) => ({
          ...c,
          from: adjustIndex(c.from, this._activeTransactionList!, affinity),
          to: adjustIndex(c.to, this._activeTransactionList!, affinity),
        })),
      );
      return;
    }

    const oldSource = this._sourceString;
    let newSource = oldSource;
    const allChanges: ReversibleChange<T>[] = [
      ...this._pendingChanges.value,
      ...changes,
    ];
    for (const change of allChanges)
      newSource = applyStringChange(newSource, change);

    if (!last(allChanges).selectionRange && last(allChanges).sourcePane) {
      const pane = last(allChanges).sourcePane!;
      last(allChanges).selectionRange = rangeShift(
        pane.getLocalSelectionIndices(),
        pane.startIndex,
      );
    }

    const update = sortModels([...this._models.values()]).map((n) =>
      n.reParse(newSource),
    );
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
    const oldSelection = this.getSelection();

    // first, apply changes
    // may create or delete panes while iterating, so iterate over a copy
    for (const pane of [...this._panes]) {
      // if we are deleted while iterating, don't process diff
      if (pane.nodes[0]?.connected) {
        pane.applyChanges(allChanges.filter((c) => c.sourcePane !== pane));
      }
    }

    // then, update replacements
    this._augmentationsCheckedTrees.clear();
    for (const buffer of update.map((u) => u.diff))
      this.updateAugmentations(buffer, this._panes);

    // finally, find a good place for the cursor
    const newSelection = this.getSelection();
    let targetSelectionRange: [number, number] | undefined = undefined;

    if (allChanges.some((c) => c.keepSelectionOffset) && oldSelection) {
      targetSelectionRange = [
        adjustIndex(oldSelection.range[0], allChanges, Side.Left),
        adjustIndex(oldSelection.range[1], allChanges, Side.Right),
      ];
    } else if (!allChanges.some((c) => c.noFocus))
      targetSelectionRange = last(allChanges).selectionRange;
    // selection has moved as side-effect of changes, but user had requested
    // no change to selection via noFocus
    else if (
      oldSelection &&
      (!newSelection || !rangeEqual(newSelection.range, oldSelection.range))
    )
      targetSelectionRange = oldSelection.range;

    if (targetSelectionRange) {
      const position = this.selectRange(targetSelectionRange);
      if (allChanges.some((c) => c.requireContinueInput))
        this.paneForView(position?.element)?.ensureContinueEditing();
    }

    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          changes: allChanges,
          sourceString: this.sourceString,
          oldSource,
          diff: update,
        },
      }),
    );
  }

  adjustRange(range: [number, number], noGrow = false): [number, number] {
    return [
      adjustIndex(range[0], this._pendingChanges.value, Side.Left, noGrow),
      adjustIndex(range[1], this._pendingChanges.value, Side.Right, noGrow),
    ];
  }

  nodeTextWithPendingChanges(nodes: SBNode[] | SBNode) {
    if (!Array.isArray(nodes)) nodes = [nodes];
    const range = this.adjustRange([nodes[0].range[0], last(nodes).range[1]]);
    return [this._rootPane.getText().slice(...range), range];
  }

  get hasPendingChanges() {
    return this._pendingChanges.value.length > 0;
  }

  // if we have a pending change, we need to figure out to which node it contributed to.
  // For example, if we have an expression like `1+3` and an insertion of `2` at index 1,
  // we want the side affinity to be -1 to indicate that the `2` is part of the `1` node.
  // This is relevant for panes to include or exclude pending changes.
  //
  // -1: grow end, 1: grow start, 0: indeterminate
  //
  // Note that a text inserted in a pane will automatically set its affinity based on the
  // pane boundaries, so this function will only be used to set the affinity for changes
  // that are caused independent of views.
  _determineSideAffinity(root: SBNode, changes: ReversibleChange<T>[]) {
    for (const change of changes) {
      if (change.sideAffinity !== undefined) continue;
      const leaf = root.leafForPosition(change.from, true);
      if (!leaf) change.sideAffinity = 0;
      else
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

  replaceTextFromCommand(
    range: [number, number],
    text: string,
    editOptions: EditOptions,
  ) {
    range = this.adjustRange(range, true);
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
        ...editOptions,
      },
    ]);
  }

  insertTextChange(
    position: number,
    text: string,
    editOptions: Partial<ReversibleChange<T>> = {},
  ): ReversibleChange<T> {
    position = this.adjustRange([position, position], true)[0];
    return {
      from: position,
      to: position,
      insert: text,
      selectionRange: [position + text.length, position + text.length],
      inverse: {
        from: position,
        to: position + text.length,
        insert: "",
      },
      ...editOptions,
    };
  }

  insertTextFromCommand(
    position: number,
    text: string,
    editOptions: EditOptions,
  ) {
    position = this.adjustRange([position, position], true)[0];
    this.applyChanges([this.insertTextChange(position, text, editOptions)]);
  }

  // Selection

  _cursorPositionForRange(target: [number, number]) {
    let current = this.getSelection();
    if (current?.range && rangeContains(current.range, target)) {
      return { element: current.element, index: current.range[0] };
    }
    const candidates = this._cursorRoots().flatMap((r) =>
      cursorPositionsForIndex(r, target[0]),
    );
    return (
      candidates.find((p) => (p.element as any).hasFocus()) ?? candidates[0]
    );
  }

  selectRange(target: [number, number]) {
    const current = this.getSelection();
    if (current?.range && rangeEqual(current?.range, target)) return current;

    const head = this._cursorPositionForRange(target);
    const anchor = cursorPositionsForIndex(head.element, target[1])[0]?.index;
    (head.element as any).focusRange(head.index, anchor ?? head.index);
    return { element: head.element, range: [head.index, anchor] };
  }

  showRange(target: [number, number]) {
    this._cursorPositionForRange(target)?.element.showRange?.(target);
  }

  _cursorRoots() {
    const myRoot = getFocusHost(this._rootPane.view) ?? this._rootPane.view;
    return [
      myRoot,
      ...this._panes
        .filter((p) => p.view.isConnected && !myRoot.contains(p.view))
        .map((p) => p.view),
    ];
  }

  getSelection() {
    for (const root of this._cursorRoots()) {
      for (const node of allChildren(root)) {
        if (node.hasFocus?.() && node.getSelection) {
          let selection = node.getSelection();
          return { range: selection, element: node };
        }
      }
    }
    return null;
  }

  selectedNode(model?: Model) {
    const selection = this.getSelection();
    if (!selection) return null;

    const { range } = selection;
    return this._models
      .get(model ?? this.defaultModel)
      ?.childEncompassingRange(range);
  }

  selectedString() {
    const selection = this.getSelection();
    if (!selection) return null;
    const range = selection.range.sort((a, b) => a - b);
    return this.sourceString.slice(range[0], range[1]);
  }

  // Augmentations

  getInitEditBuffersForRoots(roots: SBNode[]) {
    return [...roots].map((root) => new EditBuffer(root.initOps()));
  }

  getAllAugmentations(): Set<Augmentation<any>> {
    return new Set(this._panes.flatMap((p) => p.fetchAugmentations()));
  }

  async updateAugmentationList() {
    let updatedAny = false;
    const allAugmentations = this.getAllAugmentations();

    for (const [match, augmentation] of [...this._matchedAugmentations]) {
      if (!allAugmentations.has(augmentation)) {
        this._matchedAugmentations.delete(match);
        updatedAny = true;
      }
    }

    // see if anything was added and then do a full update
    for (const augmentation of allAugmentations) {
      if (!this._augmentationsCheckedTrees.has(augmentation)) {
        if (!this._models.has(augmentation.model)) await this._loadModels();

        this.checkForNewAugmentations(
          augmentation,
          this.getInitEditBuffersForRoots([
            this._models.get(augmentation.model)!,
          ])[0],
        );
        updatedAny = true;
      }
    }

    if (updatedAny) this.displayAugmentations(this._panes);
  }

  updateAllAugmentations() {
    const buffers = this.getInitEditBuffersForRoots([...this._models.values()]);
    this._augmentationsCheckedTrees.clear();
    for (const buffer of buffers) this.updateAugmentations(buffer, this._panes);
  }

  updateExistingAugmentations(editBuffer: EditBuffer, panes: Pane<T>[]) {
    // update or remove existing augmentations
    for (const [match, augmentation] of this._matchedAugmentations.entries()) {
      if (
        !match.matchedNode.connected ||
        !augmentation.match(match.matchedNode)
      ) {
        this._matchedAugmentations.delete(match);
      } else {
        this.reRenderAugmentation(panes, augmentation, match, editBuffer);
      }
    }
  }

  // TODO allow limiting to the area shown by the panes
  updateAugmentations(editBuffer: EditBuffer, panes: Pane<T>[]) {
    this.updateExistingAugmentations(editBuffer, panes);

    for (const augmentation of this.getAllAugmentations()) {
      this.checkForNewAugmentations(augmentation, editBuffer);
    }

    this.displayAugmentations(panes);
  }

  displayAugmentations(panes: Pane<T>[]) {
    for (const pane of panes)
      if (pane.nodes[0]?.connected) pane.updateAugmentations();
  }

  checkForNewAugmentations(
    augmentation: Augmentation<any>,
    editBuffer: EditBuffer,
  ) {
    if (augmentation.model !== editBuffer.language) return;
    let checkedNodes = this._augmentationsCheckedTrees.get(augmentation);
    if (!checkedNodes) {
      checkedNodes = new Set();
      this._augmentationsCheckedTrees.set(augmentation, checkedNodes);
    }
    const check = (node: SBNode | undefined) => {
      if (!node) return;
      if (checkedNodes.has(node)) return;

      checkedNodes.add(node);

      // check if we have matched this node already
      for (const [match, aug] of this._matchedAugmentations.entries()) {
        if (match.matchedNode === node && augmentation === aug) {
          return;
        }
      }

      const props = this.matchAugmentation(node, augmentation);
      if (props)
        this._matchedAugmentations.set(
          { props, matchedNode: node },
          augmentation,
        );
    };
    if (augmentation.checkOnEdit) augmentation.checkOnEdit(editBuffer, check);
    else this.defaultCheckOnEdit(augmentation, editBuffer, check);
  }

  defaultCheckOnEdit(
    augmentation: Augmentation<any>,
    editBuffer: EditBuffer,
    check: (node: SBNode) => void,
  ) {
    for (const root of editBuffer.changedNodes) {
      let node: SBNode | null = root;
      for (
        let i = 0;
        i <= (augmentation.matcherDepth ?? 1);
        i++, node = node?.parent
      ) {
        // FIXME limit to nodes of current pane
        if (!node) break;

        check(node);

        // if we check this node later anyways, no need to ascend from here
        if (node.parent && editBuffer.changedNodes.has(node.parent)) break;
      }
    }
  }

  reRenderAugmentation(
    panes: Pane<T>[],
    augmentation: Augmentation<any>,
    match: AugmentationMatch,
    editBuffer: EditBuffer,
  ) {
    // console.assert(match.matchedNode?.connected);

    const props = this.matchAugmentation(match.matchedNode, augmentation);
    if (!props) throw new Error("rerender on non-matching node");
    if (compareReplacementProps(props, match.props, editBuffer)) return false;

    match.props = props;

    for (const pane of panes) pane.reRenderAugmentation(match);
  }

  matchAugmentation(
    node: SBNode,
    augmentation: Augmentation<any>,
  ): ReplacementProps | null {
    const props = augmentation.match(node);
    if (!props) return null;

    props.nodes ??= [node];
    props.nodes = Array.isArray(props.nodes) ? props.nodes : [props.nodes];
    return props;
  }
}

type VitrailPaneProps = {
  fetchAugmentations?: PaneFetchAugmentationsFunc<any>;
  hostOptions: any;
  nodes: SBNode[];
  style: any;
  className: string;
  rangeOffsets: [number, number];
  ref;
  props: { [field: string]: any };
};
export const VitrailPane = forwardRef(function VitrailPane(
  props: VitrailPaneProps,
  ref,
) {
  console.assert(!props.nodes || Array.isArray(props.nodes));
  if (props.nodes && props.nodes.length > 0)
    return h(_VitrailPane, { ...props, ref });
  else return null;
});

const _VitrailPane = forwardRef(function _VitrailPane(
  {
    fetchAugmentations,
    hostOptions,
    nodes,
    style,
    className,
    props,
    rangeOffsets,
  }: VitrailPaneProps,
  ref,
) {
  const vitrail: Vitrail<any> = nodes[0]?.editor;
  console.assert(
    !!vitrail,
    "Trying to display a node that is not connected to an editor in a Pane",
  );
  const pane: Pane<any> = useMemo(
    // fetchAugmentations may not change (or rather: we ignore any changes)
    () =>
      vitrail.createPane(
        fetchAugmentations ?? ((p) => p?.fetchAugmentations()),
        hostOptions,
      ),
    [vitrail],
  );

  if (rangeOffsets) pane.rangeOffsets = rangeOffsets;

  // trigger this as early as possible, such that the pane is synchronously
  // available as a target during cursor enumeration after a change
  useLayoutEffect(() => {
    vitrail.registerPane(pane);
    pane.connectNodes(vitrail, nodes);
    return () => vitrail.unregisterPane(pane);
  }, [vitrail, ...nodes]);

  pane.props.value = props;

  return h("span", {
    key: "stable",
    style,
    class: className,
    ref: (el: HTMLElement) => {
      if (ref) ref.current = el;
      if (el && !pane.view.isConnected) el.appendChild(pane.view);
    },
  });
});

// Deprecated! Use nodesWithWhitespace in your query instead
export function VitrailPaneWithWhitespace({
  nodes,
  ignoreLeft,
  ...props
}: {
  nodes: SBNode[];
  ignoreLeft?: boolean;
}) {
  const list = !nodes[0]
    ? []
    : [
        ...(ignoreLeft || !nodes[0].parent
          ? []
          : takeWhile(
              nodes[0].parent.children
                .slice(0, nodes[0].siblingIndex)
                .reverse(),
              (c) => c.isWhitespace(),
            )),
        ...nodes,
        ...(!last(nodes).parent
          ? []
          : takeWhile(
              last(nodes).parent!.children.slice(last(nodes).siblingIndex + 1),
              (c) => c.isWhitespace(),
            )),
      ];

  return h(VitrailPane, { nodes: list, ...props });
}

export function changesIntendToDeleteNode(
  changes: ReversibleChange<any>[],
  node: SBNode,
) {
  return changes.some(
    (c) => c.intentDeleteNodes?.some((n) => n.contains(node)),
  );
}

export function useValidator(
  model: Model,
  func: ValidatorFunc<any>,
  deps: any[],
  vitrailSignal?: { value: Vitrail<any> },
) {
  if (deps === undefined)
    throw new Error("no dependencies for useValidator provided");

  const vitrailContext = useContext(VitrailContext)?.vitrail;
  const vitrail: Vitrail<any> = vitrailSignal
    ? vitrailSignal.value
    : vitrailContext;

  useEffect(() => {
    let wasCleanedUp = false;
    let cleanup: (() => void) | null = null;
    vitrail?.registerValidator(model, func).then((unregister) => {
      if (wasCleanedUp) {
        unregister();
      } else {
        cleanup = unregister;
      }
    });
    return () => {
      wasCleanedUp = true;
      cleanup?.();
    };
  }, [vitrail, ...deps]);
}

export function useValidateKeepReplacement(
  replacement: AugmentationInstance<any>,
  exception?: (
    root: SBNode,
    diff: EditBuffer,
    changes: ReversibleChange<any>[],
  ) => boolean,
) {
  const { vitrail }: { vitrail: Vitrail<any> } = useContext(VitrailContext);

  useValidator(
    replacement.augmentation.model,
    (root, diff, changes) => {
      if (exception?.(root, diff, changes)) return true;
      if (changesIntendToDeleteNode(changes, replacement.match.matchedNode))
        return true;
      const node = replacement.match.matchedNode;
      if (!node?.connected) return false;
      if (!vitrail.matchAugmentation(node, replacement.augmentation))
        return false;
      return true;
    },
    [...replacement.match.props.nodes, replacement.augmentation],
  );
}

export function useValidateNoError(nodes: SBNode[]) {
  useValidator(nodes[0].language, () => !nodes.some((n) => n.hasError), nodes);
}

export function useValidateKeepNodes(nodes: SBNode[], model?: Model) {
  console.assert(nodes.length > 0 || model);
  useValidator(
    model ?? nodes[0].language,
    (_root, _diff, changes) =>
      nodes.every(
        (node) => changesIntendToDeleteNode(changes, node) || node.connected,
      ),
    nodes,
  );
}
