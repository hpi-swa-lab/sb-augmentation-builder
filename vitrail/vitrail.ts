import {
  EditorView,
  StateEffect,
  RangeSet,
  StateField,
  Prec,
  Decoration,
  WidgetType,
  keymap,
} from "../codemirror6/external/codemirror.bundle.js";
import {
  AttachOp,
  DetachOp,
  EditBuffer,
  RemoveOp,
  UpdateOp,
} from "../core/diff.js";
import { SBLanguage, SBNode } from "../core/model.js";
import { effect, signal } from "../external/preact-signals-core.mjs";
import { h, render } from "../external/preact.mjs";
import {
  adjustIndex,
  last,
  parallelToSequentialChanges,
  rangeContains,
  rangeIntersects,
  rangeShift,
} from "../utils.js";

interface Replacement<
  Props extends { [field: string]: any } & { nodes: SBNode[] },
> {
  nodes: SBNode[];
  view: HTMLElement;
  augmentation: Augmentation<Props>;
}
function replacementRange(
  replacement: Replacement<any>,
  vitrail: Vitrail<any>,
) {
  return vitrail.adjustRange([
    replacement.nodes[0].range[0],
    last(replacement.nodes).range[1],
  ]);
}

type JSX = any;

interface Augmentation<
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

interface ReversibleChange<T> {
  from: number;
  to: number;
  insert: string;
  inverse: Change<T>;
  sourcePane?: Pane<T>;
  sideAffinity?: -1 | 0 | 1;
  selectionRange?: [number, number];
}
type Change<T> = Omit<ReversibleChange<T>, "inverse">;

type CreatePaneFunc<T> = (
  fetchAugmentations: PaneFetchAugmentationsFunc,
) => Pane<T>;
type EditableGetCursorCandidateFunc = () => {
  distance: number;
  focus: () => void;
};
type EditableFocusAdjacentFunc = (direction: number) => void;
type PaneGetTextFunc = () => string;
type PaneApplyLocalChangesFunc<T> = (changes: Change<T>[]) => void;
type PaneFetchAugmentationsFunc = (parent: Pane<any>) => Augmentation<any>[];
type ValidatorFunc<T> = (
  root: SBNode,
  diff: EditBuffer,
  changes: ReversibleChange<T>[],
) => boolean;

function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}

class Vitrail<T> {
  _panes: Pane<T>[] = [];
  _models: Map<Model, SBNode> = new Map();
  _validators = new Set<[Model, ValidatorFunc<T>]>();

  _rootPane: Pane<T>;
  _sourceString: string;

  _createPane: CreatePaneFunc<T>;
  _showValidationPending: (show: boolean) => void;
  _editableFocusAdjacent: EditableFocusAdjacentFunc;
  _editableGetCursorCandidate: EditableGetCursorCandidateFunc;

  get defaultModel(): Model {
    for (const model of this._models.keys())
      if (model.canBeDefault) return model;
    for (const model of this._models.keys()) return model;
    throw new Error("No default model");
  }

  constructor({
    createPane,
    showValidationPending,
    editableFocusAdjacent,
    editableGetCursorCandidate,
  }: {
    createPane: CreatePaneFunc<T>;
    showValidationPending: (show: boolean) => void;
    editableFocusAdjacent: EditableFocusAdjacentFunc;
    editableGetCursorCandidate: EditableGetCursorCandidateFunc;
  }) {
    this._createPane = createPane;
    this._showValidationPending = showValidationPending;
    this._editableFocusAdjacent = editableFocusAdjacent;
    this._editableGetCursorCandidate = editableGetCursorCandidate;

    this._pendingChanges = signal([]);
    effect(() => {
      this._showValidationPending(this._pendingChanges.value.length > 0);
    });
  }

  async registerValidator(model: Model, cb: ValidatorFunc<T>) {
    if (!(model instanceof SBLanguage)) throw new Error("no model given");
    const p: [Model, ValidatorFunc<T>] = [model, cb];
    this._validators.add(p);
    await this.loadModels();
    return () => this._validators.delete(p);
  }

  async connectHost(pane: Pane<T>) {
    this._rootPane = pane;
    this._panes.push(this._rootPane);
    this._sourceString = this._rootPane.getText();
    await this.loadModels();
    this._rootPane.connectNodes(this, [this._models.get(this.defaultModel)!]);
  }

  async loadModels() {
    for (const pane of this._panes) {
      await pane.loadModels(this, this._sourceString);
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
              // TODO
              pane.applyLocalChanges(
                changes.filter((c) => c.sourcePane !== pane),
              );
              pane.syncReplacements();
            }
            this._revertChanges.push(...changes.map((c) => c.inverse));
            // TODO
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

    // may create or delete panes while iterating, so iterate over a copy
    for (const pane of [...this._panes]) {
      // if we are deleted while iterating, don't process diff
      if (pane.nodes[0]?.connected) {
        // TODO
        pane.applyLocalChanges(changes.filter((c) => c.sourcePane !== pane));

        for (const buffer of update.map((u) => u.diff))
          pane.updateReplacements(buffer);
      }
    }

    // TODO
    // this.selectRange(last(allChanges).selectionRange ?? this.selectionRange);
  }

  adjustRange(range: [number, number]) {
    return [
      adjustIndex(range[0], this._pendingChanges.value, 1),
      adjustIndex(range[1], this._pendingChanges.value, -1),
    ];
  }

  // if we have a pending change, we need to figure out to which node it contributed to.
  // For example, if we have an expression like `1+3` and an insertion of `2` at index 1,
  // we want the side affinity to be -1 to indicate that the `2` is part of the `1` node.
  // This is relevant for shards to include or exclude pending changes.
  //
  // Note that a text inserted in a shard will automatically set its affinity based on the
  // shard boundaries, so this function will only be used to set the affinity for changes
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
    for (const pane of this._panes) {
      // TODO
      pane.applyLocalChanges(this._revertChanges.reverse());
      pane.syncReplacements();
    }
    this._revertChanges = [];
    this._pendingChanges.value = [];
  }
}

class Pane<T> {
  vitrail: Vitrail<T>;
  view: HTMLElement;
  host: T;
  nodes: SBNode[];
  replacements: Replacement<any>[] = [];
  markers: { nodes: SBNode[] }[] = [];

  fetchAugmentations: PaneFetchAugmentationsFunc;
  applyLocalChanges: PaneApplyLocalChangesFunc<T>;
  getText: PaneGetTextFunc;
  syncReplacements: () => void;

  get range() {
    return [this.nodes[0].range[0], last(this.nodes).range[1]];
  }

  constructor({
    vitrail,
    view,
    host,
    syncReplacements,
    getText,
    fetchAugmentations,
    applyLocalChanges,
  }: {
    vitrail: Vitrail<T>;
    view: HTMLElement;
    host: T;
    syncReplacements: () => void;
    fetchAugmentations: (parent: Pane<T>) => Augmentation<any>[];
    applyLocalChanges: PaneApplyLocalChangesFunc<T>;
    getText: PaneGetTextFunc;
  }) {
    this.vitrail = vitrail;
    this.view = view;
    this.host = host;
    this.syncReplacements = syncReplacements;
    this.getText = getText;
    this.applyLocalChanges = applyLocalChanges;
    this.fetchAugmentations = fetchAugmentations;
  }

  async loadModels(v: Vitrail<T>, sourceString: string) {
    for (const augmentation of this.fetchAugmentations(this)) {
      if (!v._models.has(augmentation.model)) {
        v._models.set(
          augmentation.model,
          await augmentation.model.parse(sourceString, v),
        );
      }
    }
  }

  connectNodes(v: Vitrail<T>, nodes: SBNode[]) {
    this.nodes = nodes;

    const buffers = this.getInitEditBuffersForRoots([...v._models.values()]);
    for (const buffer of buffers) this.updateReplacements(buffer);
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
          render(replacement.augmentation.view(match), replacement.view);
        }
      }
    }

    // check for new replacements
    for (const root of changedNodes) {
      for (const augmentation of this.fetchAugmentations(this)) {
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

  installReplacement<
    Props extends { [field: string]: any } & { nodes: SBNode[] },
  >(augmentation: Augmentation<Props>, match: Props) {
    const view = document.createElement("span");
    render(augmentation.view(match), view);

    this.replacements.push({
      nodes: match.nodes,
      view,
      augmentation,
    });
  }

  uninstallReplacement(replacement: Replacement<any>) {
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
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

class CodeMirrorReplacementWidget extends WidgetType {
  replacement: Replacement<any>;

  constructor(replacement: Replacement<any>) {
    super();
    this.replacement = replacement;
  }
  eq(other: CodeMirrorReplacementWidget) {
    return other.replacement === this.replacement;
  }
  toDOM() {
    return this.replacement.view;
  }
  ignoreEvent() {
    return true;
  }
}

function buildPendingChangesHint(v: Vitrail<EditorView>, box: HTMLElement) {
  box.className = "sb-pending-hint";
  render(
    h(
      "span",
      {},
      "Pending changes",
      h("button", { onClick: () => v.revertPendingChanges() }, "Revert"),
      h("button", { onClick: () => v.applyPendingChanges() }, "Apply"),
    ),
    box,
  );
}

export async function codeMirror6WithVitrail(
  cm: EditorView,
  augmentations: Augmentation<any>[],
  extensionsForPane: any[],
) {
  const extensions = (pane: Pane<EditorView>) => {
    const replacementsField = StateField.define({
      create: () => Decoration.none,
      update: () => {
        return RangeSet.of(
          pane.replacements
            .map((r) => {
              const range = rangeShift(
                replacementRange(r, pane.vitrail),
                -pane.range[0],
              );
              return (
                range[0] === range[1] ? Decoration.widget : Decoration.replace
              )({
                widget: new CodeMirrorReplacementWidget(r),
              }).range(...range);
            })
            .sort((a, b) => a.from - b.from),
        );
      },
      provide: (f) => [
        EditorView.decorations.from(f),
        // EditorView.atomicRanges.of((view) => view.state.field(f) ?? Decoration.none),
      ],
    });

    return [
      ...extensionsForPane,
      Prec.highest(
        keymap.of([
          {
            key: "ArrowLeft",
            run: (v) => this.editor.moveCursor(false),
            preventDefault: true,
          },
          {
            key: "ArrowRight",
            run: (v) => this.editor.moveCursor(true),
            preventDefault: true,
          },
          {
            key: "Backspace",
            run: (v) => this.handleDeleteAtBoundary(false),
            preventDefault: true,
          },
        ]),
      ),
      replacementsField,
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((t) => t.isUserEvent("sync"))
        ) {
          const changes: ReversibleChange<EditorView>[] = [];
          update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            changes.push({
              from: fromA + pane.range[0],
              to: toA + pane.range[0],
              insert: inserted.toString(),
              sourcePane: pane,
              // will be set below
              inverse: null as any,
            });
          });
          const inverse: ReversibleChange<EditorView>["inverse"][] = [];
          update.changes
            .invert(update.startState.doc)
            .iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              inverse.push({
                from: fromA + pane.range[0],
                to: toA + pane.range[0],
                insert: inserted.toString(),
              });
            });
          console.assert(inverse.length === changes.length);

          parallelToSequentialChanges(changes);
          parallelToSequentialChanges(inverse);
          changes.forEach((c, i) => (c.inverse = inverse[i]));

          last(changes).selectionRange = rangeShift(
            [
              update.state.selection.main.head,
              update.state.selection.main.anchor,
            ],
            pane.range[0],
          );
          last(changes).sideAffinity =
            pane.range[0] === last(changes).from ? 1 : -1;

          v.applyChanges(changes);
        }
      }),
    ];
  };

  function paneFromCM(
    host: EditorView,
    vitrail: Vitrail<EditorView>,
    fetchAugmentations: PaneFetchAugmentationsFunc,
  ) {
    const pane = new Pane<EditorView>({
      vitrail,
      view: host.dom,
      host,
      syncReplacements: () => host.dispatch({ userEvent: "sync" }),
      fetchAugmentations,
      applyLocalChanges: (changes: Change<EditorView>[]) =>
        host.dispatch(host.state.update({ changes, sequential: true })),
      getText: () => host.state.doc.toString(),
    });

    host.dispatch({ effects: StateEffect.appendConfig.of(extensions(pane)) });

    return pane;
  }

  const pendingChangesHint = document.createElement("div");

  const v = new Vitrail<EditorView>({
    createPane: (fetchAugmentations: PaneFetchAugmentationsFunc) => {
      const host = new EditorView({
        doc: "",
        parent: document.createElement("div"),
      });
      return paneFromCM(host, v, fetchAugmentations);
    },
    showValidationPending: (show) => {
      if (show) document.body.appendChild(pendingChangesHint);
      else pendingChangesHint.remove();
    },
    editableFocusAdjacent: (direction) => {},
    editableGetCursorCandidate: () => ({ distance: 0, focus: () => {} }),
  });
  await v.connectHost(paneFromCM(cm, v, () => augmentations));

  buildPendingChangesHint(v, pendingChangesHint);

  return v;
}
