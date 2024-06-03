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
import { SBNode } from "../core/model.js";
import { render } from "../external/preact.mjs";
import { last, rangeContains, rangeIntersects, rangeShift } from "../utils.js";

interface Replacement<
  Props extends { [field: string]: any } & { nodes: SBNode[] },
> {
  nodes: SBNode[];
  view: HTMLElement;
  augmentation: Augmentation<Props>;
}
function replacementRange(replacement: Replacement<any>) {
  return [replacement.nodes[0].range[0], last(replacement.nodes).range[1]];
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

type CreatePaneFunc<T> = (
  fetchAugmentations: PaneFetchAugmentationsFunc,
) => Pane<T>;
type EditableGetCursorCandidateFunc = () => {
  distance: number;
  focus: () => void;
};
type EditableFocusAdjacentFunc = (direction: number) => void;
type PaneGetTextFunc = () => string;
type PaneApplyLocalEditFunc = (from: number, to: number, text: string) => void;
type PaneFetchAugmentationsFunc = (parent: Pane<any>) => Augmentation<any>[];

function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x);
}

class Vitrail<T> {
  panes: Pane<T>[] = [];
  models: Map<Model, SBNode> = new Map();

  rootPane: Pane<T>;

  createPane: CreatePaneFunc<T>;
  showValidationPending: () => void;
  editableFocusAdjacent: EditableFocusAdjacentFunc;
  editableGetCursorCandidate: EditableGetCursorCandidateFunc;

  get defaultModel(): Model {
    for (const model of this.models.keys())
      if (model.canBeDefault) return model;
    for (const model of this.models.keys()) return model;
    throw new Error("No default model");
  }

  constructor({
    createPane,
    showValidationPending,
    editableFocusAdjacent,
    editableGetCursorCandidate,
  }: {
    createPane: CreatePaneFunc<T>;
    showValidationPending: () => void;
    editableFocusAdjacent: EditableFocusAdjacentFunc;
    editableGetCursorCandidate: EditableGetCursorCandidateFunc;
  }) {
    this.createPane = createPane;
    this.showValidationPending = showValidationPending;
    this.editableFocusAdjacent = editableFocusAdjacent;
    this.editableGetCursorCandidate = editableGetCursorCandidate;
  }

  async connectHost(pane: Pane<T>) {
    this.rootPane = pane;
    this.panes.push(this.rootPane);
    await this.loadModels(this.rootPane.getText());
    this.rootPane.connectNodes(this, [this.models.get(this.defaultModel)!]);
  }

  async loadModels(sourceString: string) {
    for (const pane of this.panes) {
      await pane.loadModels(this, sourceString);
    }
  }
}

class Pane<T> {
  view: HTMLElement;
  host: T;
  nodes: SBNode[];
  replacements: Replacement<any>[] = [];
  markers: { nodes: SBNode[] }[] = [];

  fetchAugmentations: PaneFetchAugmentationsFunc;
  applyLocalEdit: PaneApplyLocalEditFunc;
  getText: PaneGetTextFunc;
  syncReplacements: () => void;

  get range() {
    return [this.nodes[0].range[0], last(this.nodes).range[1]];
  }

  constructor({
    view,
    host,
    syncReplacements,
    getText,
    fetchAugmentations,
    applyLocalEdit,
  }: {
    view: HTMLElement;
    host: T;
    syncReplacements: () => void;
    fetchAugmentations: (parent: Pane<T>) => Augmentation<any>[];
    applyLocalEdit: PaneApplyLocalEditFunc;
    getText: PaneGetTextFunc;
  }) {
    this.view = view;
    this.host = host;
    this.syncReplacements = syncReplacements;
    this.getText = getText;
    this.applyLocalEdit = applyLocalEdit;
    this.fetchAugmentations = fetchAugmentations;
  }

  async loadModels(v: Vitrail<T>, sourceString: string) {
    for (const augmentation of this.fetchAugmentations(this)) {
      if (!v.models.has(augmentation.model)) {
        v.models.set(
          augmentation.model,
          await augmentation.model.parse(sourceString, v),
        );
      }
    }
  }

  connectNodes(v: Vitrail<T>, nodes: SBNode[]) {
    this.nodes = nodes;

    const buffers = this.getInitEditBuffersForRoots([...v.models.values()]);
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
    // if (this.parentShard?.replacements.some((r) => r.node === node)) return false;
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
      if (rangeIntersects(replacementRange(replacement), node.range))
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
              const range = rangeShift(replacementRange(r), -pane.range[0]);
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
        // v.notifyEdit(update);
      }),
    ];
  };

  function paneFromCM(
    host: EditorView,
    fetchAugmentations: PaneFetchAugmentationsFunc,
  ) {
    const pane = new Pane<EditorView>({
      view: host.dom,
      host,
      syncReplacements: () => host.dispatch({ userEvent: "sync" }),
      fetchAugmentations,
      applyLocalEdit: (from, to, text) => {
        host.dispatch(
          host.state.update({
            changes: { from, to, insert: text },
          }),
        );
      },
      getText: () => host.state.doc.toString(),
    });

    host.dispatch({ effects: StateEffect.appendConfig.of(extensions(pane)) });

    return pane;
  }

  const v = new Vitrail<EditorView>({
    createPane: (fetchAugmentations: PaneFetchAugmentationsFunc) => {
      const host = new EditorView({
        doc: "",
        parent: document.createElement("div"),
      });
      return paneFromCM(host, fetchAugmentations);
    },
    showValidationPending: () => {},
    editableFocusAdjacent: (direction) => {},
    editableGetCursorCandidate: () => ({ distance: 0, focus: () => {} }),
  });
  await v.connectHost(paneFromCM(cm, () => augmentations));

  return v;
}
