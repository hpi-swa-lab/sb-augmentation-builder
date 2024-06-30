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
  highlightActiveLineGutter,
  keymap,
  StateField,
  Decoration,
  Prec,
  RangeSet,
  StateEffect,
  WidgetType,
  Transaction,
  undo,
  redo,
  invertedEffects,
  Annotation,
  Facet,
} from "../codemirror6/external/codemirror.bundle.js";
import {
  rangeShift,
  parallelToSequentialChanges,
  isNullRange,
  arrayEqual,
  withDo,
} from "../utils.js";
import { h, render } from "../external/preact.mjs";
import { useEffect, useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { Vim, getCM } from "../codemirror6/external/codemirror-vim.mjs";

const IntentToDelete = StateEffect.define();

export const baseCMExtensions = [
  highlightSpecialChars(),
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
  EditorView.lineWrapping,
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

export function createJavaScriptCodeMirror(
  text: string,
  parent: HTMLElement,
  augmentations: Augmentation<any>[],
  cmExtensions: any[] = [],
) {
  return createDefaultCodeMirror(text, parent, augmentations, [
    javascript(),
    ...cmExtensions,
  ]);
}

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
      history(),
      highlightActiveLineGutter(),
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
            .filter((r) => !isNullRange(replacementRange(r, pane.vitrail)))
            .map((r) => {
              const range = rangeShift(
                replacementRange(r, pane.vitrail),
                -pane.startIndex,
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
      PaneFacet.of(pane),
      ...extensionsForPane,
      invertedEffects.of((tr) => {
        return tr.effects.filter((e) => e.is(IntentToDelete));
      }),
      EditorView.editable.from(replacementsField, (v) => {
        const replacement: Replacement<any> | null =
          v.iter().value?.widget.replacement;
        // check if there is a single replacement covering the entire pane
        return !(replacement && arrayEqual(replacement.nodes, pane.nodes));
      }),
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
          {
            key: "Mod-z",
            // TODO reverts focus to root
            run: () => v._rootPane.host.dispatch(undo(v._rootPane.host)),
            preventDefault: true,
            stopPropagation: true,
          },
          {
            key: "Mod-y",
            run: () => v._rootPane.host.dispatch(redo(v._rootPane.host)),
            preventDefault: true,
            stopPropagation: true,
          },
        ]),
      ),
      // EditorView.domEventHandlers({
      //     beforeinput(e, view) {
      //         let command = e.inputType == "historyUndo" ? undo : e.inputType == "historyRedo" ? redo : null;
      //         if (!command)
      //             return false;
      //         e.preventDefault();
      //         return command(view);
      //     }
      // }),
      replacementsField,
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((t) => t.isUserEvent("sync"))
        ) {
          const externalChange = update.transactions.some((t) =>
            t.annotation(External),
          );
          const intentDeleteNodes =
            update.transactions.flatMap((t) =>
              t.effects.filter((e) => e.is(IntentToDelete)),
            ) ?? [];
          const changes: ReversibleChange<EditorView>[] = [];
          update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            changes.push({
              from: fromA + pane.startIndex,
              to: toA + pane.startIndex,
              insert: inserted.toString(),
              sourcePane: pane,
              // will be set below
              inverse: null as any,
              noFocus: externalChange,
              intentDeleteNodes: intentDeleteNodes.flatMap((e) => {
                // a redo is occurring: find the node that we marked for deletion earlier
                return e.value
                  .map((n) => v.modelForNode(n)!.childForRange(n.range))
                  .filter((n) => Boolean(n));
              }),
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

          v.applyChanges(changes);
        }
      }),
    ];
  };

  function paneFromCM(
    host: EditorView,
    vitrail: Vitrail<EditorView>,
    fetchAugmentations: PaneFetchAugmentationsFunc<EditorView>,
    isRoot = false,
    hostOptions?,
  ) {
    const pane = new Pane<EditorView>({
      vitrail,
      view: host.dom,
      host,
      fetchAugmentations,
      ensureContinueEditing: () =>
        // FIXME does this insert an i if we are already in insert mode?
        withDo(getCM(host), (cm) => cm && Vim.handleKey(cm, "i")),
      getLocalSelectionIndices: () => [
        host.state.selection.main.head,
        host.state.selection.main.anchor,
      ],
      syncReplacements: () => host.dispatch({ userEvent: "sync" }),
      focusRange: (head, anchor) => {
        host.focus();
        host.dispatch({ selection: { anchor: head, head: anchor } });
      },
      applyLocalChanges: (changes: Change<EditorView>[]) => {
        const intentToDelete = changes.flatMap(
          (c) => c.intentDeleteNodes ?? [],
        );
        host.dispatch(
          host.state.update({
            userEvent: "sync",
            changes,
            sequential: true,
            effects:
              intentToDelete.length > 0
                ? [IntentToDelete.of(intentToDelete)]
                : [],
          }),
        );
      },
      getText: () => host.state.doc.toString(),
      hasFocus: () => host.hasFocus,
      setText: (text: string, undoable: boolean) =>
        host.dispatch(
          host.state.update({
            userEvent: "sync",
            annotations: [Transaction.addToHistory.of(undoable)],
            changes: [{ from: 0, to: host.state.doc.length, insert: text }],
          }),
        ),
    });

    host.dispatch({
      effects: StateEffect.appendConfig.of([
        ...extensions(pane),
        ...(hostOptions?.cmExtensions ? hostOptions.cmExtensions : []),
        ...(isRoot ? [history()] : []),
      ]),
    });

    return pane;
  }

  const pendingChangesHint = document.createElement("div");

  const v = new Vitrail<EditorView>({
    createPane: (
      fetchAugmentations: PaneFetchAugmentationsFunc<EditorView>,
      hostOptions,
    ) => {
      const host = new EditorView({
        doc: "",
        parent: document.createElement("div"),
      });
      host.dom.setAttribute("focusable", "");
      host.dom.focus = () => host.focus();
      host.dom.style.cssText =
        "display: inline-flex !important; background: #fff";
      return paneFromCM(host, v, fetchAugmentations, false, hostOptions);
    },
    showValidationPending: (show) => {
      if (show) document.body.appendChild(pendingChangesHint);
      else pendingChangesHint.remove();
    },
  });
  await v.connectHost(paneFromCM(cm, v, () => augmentations, true));

  buildPendingChangesHint(v, pendingChangesHint);

  return v;
}

const External = Annotation.define();
export const PaneFacet = Facet.define({
  static: true,
  combine: (values) => values[0],
});

export function CodeMirrorWithVitrail({
  value,
  augmentations,
  cmExtensions,
  props,
  style,
  className,
  onLoad,
  ...other
}: {
  value: { value: string };
  parent: HTMLElement;
  augmentations: Augmentation<any>[];
  cmExtensions?: any[];
  props: { [key: string]: any };
  style: any;
  className?: string;
  onLoad?: (vitrail: Vitrail<EditorView>) => void;
  [key: string]: any;
}) {
  const vitrail = useSignal(null);
  const view = useSignal(null);
  const parent = useRef();

  useEffect(() => {
    const cm = new EditorView({
      doc: "",
      root: document,
      extensions: [history(), highlightActiveLineGutter()],
      parent: parent.current,
    });
    codeMirror6WithVitrail(cm, augmentations, cmExtensions ?? []).then((v) => {
      vitrail.value = v;
      view.value = cm;
      onLoad?.(v);
    });
  }, []);

  useSignalEffect(() => {
    const handler = ({ detail: { sourceString } }) => {
      value.value = sourceString;
    };
    if (vitrail.value) vitrail.value.addEventListener("change", handler);
    return () => {
      if (vitrail.value) vitrail.value.removeEventListener("change", handler);
    };
  });

  useEffect(() => {
    const handlers = Object.entries(other)
      .filter(([key]) => key.startsWith("on"))
      .map(([key, handler]) => [key.slice(2).toLowerCase(), handler]);
    for (const [eventName, handler] of handlers) {
      if (vitrail.value) vitrail.value.addEventListener(eventName, handler);
    }
    return () => {
      for (const [eventName, handler] of handlers) {
        if (vitrail.value)
          vitrail.value.removeEventListener(eventName, handler);
      }
    };
  }, [other, vitrail.value]);

  useEffect(() => {
    if (vitrail.value) vitrail.value.props.value = props;
  }, [vitrail.value, props]);

  useSignalEffect(() => {
    const currentValue = vitrail.value?.sourceString ?? "";
    if (view.value && value.value !== currentValue) {
      view.value.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value.value || "",
        },
        annotations: [External.of(true)],
      });
    }
  });

  return h("div", { ref: parent, style, class: className });
}
