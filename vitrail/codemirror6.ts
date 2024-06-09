import {
  Augmentation,
  Change,
  Pane,
  PaneFetchAugmentationsFunc,
  Replacement,
  ReversibleChange,
  Vitrail,
  replacementRange,
} from "./vitrail.ts";
import {
  EditorView,
  indentWithTab,
  javascript,
  autocompletion,
  highlightSpecialChars,
  history,
  drawSelection,
  dropCursor,
  EditorState,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  closeBrackets,
  rectangularSelection,
  crosshairCursor,
  highlightSelectionMatches,
  closeBracketsKeymap,
  defaultKeymap,
  searchKeymap,
  historyKeymap,
  foldKeymap,
  completionKeymap,
  lintKeymap,
  lineNumbers,
  highlightActiveLineGutter,
  keymap,
  foldGutter,
  StateField,
  Decoration,
  Prec,
  RangeSet,
  StateEffect,
  WidgetType,
} from "../codemirror6/external/codemirror.bundle.js";
import { ayuLight } from "../codemirror6/theme.js";
import { rangeShift, parallelToSequentialChanges, last } from "../utils.js";
import { h, render } from "../external/preact.mjs";

const baseCMExtensions = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  ayuLight,
  javascript(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
    indentWithTab,
  ]),
];

export async function createDefaultCodeMirror(
  text: string,
  parent: HTMLElement,
  augmentations: Augmentation<any>[],
  cmExtensions: any[] = [],
) {
  const cm = new EditorView({
    doc: text,
    extensions: [
      ...baseCMExtensions,
      // lineNumbers(),
      highlightActiveLineGutter(),
      // foldGutter(),
      ...cmExtensions,
    ],
    parent,
  });

  const vitrail = await codeMirror6WithVitrail(cm, augmentations, [
    ...baseCMExtensions,
    ...cmExtensions,
  ]);
  return vitrail;
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
            run: () => pane.moveCursor(false),
            preventDefault: true,
          },
          {
            key: "ArrowRight",
            run: () => pane.moveCursor(true),
            preventDefault: true,
          },
          {
            key: "Backspace",
            run: () => pane.handleDeleteAtBoundary(false),
            preventDefault: true,
            stopPropagation: true,
          },
          {
            key: "Delete",
            run: () => pane.handleDeleteAtBoundary(true),
            preventDefault: true,
            stopPropagation: true,
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
              from: fromA + pane.startIndex,
              to: toA + pane.startIndex,
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
                from: fromA + pane.startIndex,
                to: toA + pane.startIndex,
                insert: inserted.toString(),
              });
            });
          console.assert(inverse.length === changes.length);

          parallelToSequentialChanges(changes);
          parallelToSequentialChanges(inverse);
          changes.forEach((c, i) => (c.inverse = inverse[i]));

          // last(changes).selectionRange = rangeShift(
          //   [
          //     update.state.selection.main.head,
          //     update.state.selection.main.anchor,
          //   ],
          //   pane.startIndex,
          // );
          // last(changes).sideAffinity =
          //   pane.startIndex === last(changes).from ? 1 : -1;

          v.applyChanges(changes);
        }
      }),
    ];
  };

  function paneFromCM(
    host: EditorView,
    vitrail: Vitrail<EditorView>,
    fetchAugmentations: PaneFetchAugmentationsFunc<EditorView>,
  ) {
    const pane = new Pane<EditorView>({
      vitrail,
      view: host.dom,
      host,
      fetchAugmentations,
      getLocalSelectionIndices: () => [
        host.state.selection.main.head,
        host.state.selection.main.anchor,
      ],
      syncReplacements: () => host.dispatch({ userEvent: "sync" }),
      focusRange: (head, anchor) => {
        host.focus();
        host.dispatch({ selection: { anchor: head, head: anchor } });
      },
      applyLocalChanges: (changes: Change<EditorView>[]) =>
        host.dispatch(
          host.state.update({ userEvent: "sync", changes, sequential: true }),
        ),
      getText: () => host.state.doc.toString(),
      hasFocus: () => host.hasFocus,
      setText: (text: string) =>
        host.dispatch(
          host.state.update({
            userEvent: "sync",
            changes: [{ from: 0, to: host.state.doc.length, insert: text }],
          }),
        ),
    });

    host.dispatch({ effects: StateEffect.appendConfig.of(extensions(pane)) });

    return pane;
  }

  const pendingChangesHint = document.createElement("div");

  const v = new Vitrail<EditorView>({
    createPane: (
      fetchAugmentations: PaneFetchAugmentationsFunc<EditorView>,
    ) => {
      const host = new EditorView({
        doc: "",
        parent: document.createElement("div"),
      });
      host.dom.style.cssText = "display: inline-flex !important";
      return paneFromCM(host, v, fetchAugmentations);
    },
    showValidationPending: (show) => {
      if (show) document.body.appendChild(pendingChangesHint);
      else pendingChangesHint.remove();
    },
  });
  await v.connectHost(paneFromCM(cm, v, () => augmentations));

  buildPendingChangesHint(v, pendingChangesHint);

  return v;
}
