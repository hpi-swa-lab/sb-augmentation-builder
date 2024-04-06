import { last, orParentThat, rangeContains, rangeShift } from "../utils.js";
import { BaseEditor } from "../core/editor.js";
import { BaseShard } from "../core/shard.js";
import {
  EditorView,
  basicSetup,
  RangeSet,
  StateField,
  Prec,
  Decoration,
  WidgetType,
  keymap,
  indentWithTab,
  javascript,
  autocompletion,
  startCompletion,
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
  highlightActiveLine,
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
  foldGutter,
} from "./external/codemirror.bundle.js";

class CodeMirrorReplacementWidget extends WidgetType {
  constructor(replacement) {
    super();
    this.replacement = replacement;
  }
  eq(other) {
    return other.replacement === this.replacement;
  }
  toDOM() {
    return this.replacement;
  }
  ignoreEvent() {
    return true;
  }
}

export class CodeMirrorEditor extends BaseEditor {
  static shardTag = "scm-shard";

  addSuggestions(node, suggestions) {
    if (!this.selection.head.element.cm) return;
    this.selection.head.element.suggestionAnchor = node;
    this.selection.head.element.suggestionList = suggestions;
    startCompletion(this.selection.head.element.cm);
  }

  clearSuggestions() {}
}

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
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];
const extraCMExtensionsForRoot = [
  lineNumbers(),
  highlightActiveLineGutter(),
  foldGutter(),
];

// TODO moving cursor up/down, then left/right
class CodeMirrorShard extends BaseShard {
  replacementsMap = new Map();

  suggestionAnchor = null;
  suggestionList = [];

  get hasFocus() {
    return (
      document.activeElement === this ||
      document.activeElement === this.cm.docView.dom
    );
  }

  get replacements() {
    return [...this.replacementsMap.values()];
  }

  replacementsField = StateField.define({
    create: () => Decoration.none,
    update: () => this._collectReplacements(),
    provide: (f) => [
      EditorView.decorations.from(f),
      // EditorView.atomicRanges.of((view) => view.state.field(f) ?? Decoration.none),
    ],
  });

  positionForIndex(index) {
    return { element: this, elementOffset: index - this.range[0], index };
  }

  initView() {
    this.cm = new EditorView({
      doc: "",
      extensions: [
        ...baseCMExtensions,
        ...(this.node.isRoot ? extraCMExtensionsForRoot : []),
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
            {
              key: "Mod-e",
              ctrl: true,
              preventDefault: true,
              run: (v) => this.onShortcut(window.event),
            },
          ]),
        ),
        keymap.of([indentWithTab]),
        javascript(),
        this.replacementsField,
        autocompletion({
          override: [
            (context) => {
              if (
                !this.suggestionAnchor ||
                !this.node?.connected ||
                !this.isShowing(this.suggestionAnchor)
              )
                return null;
              return {
                from: this.suggestionAnchor.range[0] - this.range[0],
                options: this.suggestionList.map((i) => ({
                  label: i.label ?? i.insertText,
                  detail: i.detail,
                  apply: i.insertText,
                })),
              };
            },
          ],
        }),
        EditorView.updateListener.of((v) => this._onChange(v)),
      ],
      parent: this,
    });

    if (!this.node.isRoot)
      this.cm.dom.style.cssText = "display: inline-flex !important";
  }

  _onChange(v) {
    if (v.transactions.some((t) => t.isUserEvent("select"))) {
      this.editor.onSelectionChange({
        head: {
          element: this,
          elementOffset: v.state.selection.main.head,
          index: v.state.selection.main.head + this.range[0],
        },
        anchor: {
          element: this,
          elementOffset: v.state.selection.main.anchor,
          index: v.state.selection.main.anchor + this.range[0],
        },
      });
    }

    if (v.docChanged && !v.transactions.some((t) => t.isUserEvent("sync"))) {
      const changes = [];
      v.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        changes.push({
          from: fromA + this.range[0],
          to: toA + this.range[0],
          insert: inserted.toString(),
          sourceShard: this,
        });
      });
      const inverse = [];
      v.changes
        .invert(v.startState.doc)
        .iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          inverse.push({
            from: fromA + this.range[0],
            to: toA + this.range[0],
            insert: inserted.toString(),
          });
        });
      console.assert(inverse.length === changes.length);
      changes.forEach((c, i) => (c.inverse = inverse[i]));
      last(changes).selectionRange = rangeShift(
        [v.state.selection.main.head, v.state.selection.main.anchor],
        this.range[0],
      );
      this.onTextChanges(changes);

      if (
        this.node.connected &&
        this.editor.pendingChanges.value.length === 0 &&
        this.node.sourceString !== this.cm.state.doc.toString()
      ) {
        this.cm.dispatch({
          changes: [
            {
              from: 0,
              to: this.cm.state.doc.length,
              insert: this.node.sourceString,
            },
          ],
          userEvent: "sync",
        });
      }
    }
  }

  _collectReplacements() {
    return RangeSet.of(
      this.replacements
        .map((r) => {
          const range = rangeShift(r.range, -this.range[0]);
          return (
            range[0] === range[1] ? Decoration.widget : Decoration.replace
          )({
            widget: new CodeMirrorReplacementWidget(r),
          }).range(...range);
        })
        .sort((a, b) => a.from - b.from),
    );
  }

  _applyTextChanges(changes) {
    let anyChange = false;
    for (const change of changes.filter(
      (c) =>
        c.sourceShard !== this && rangeContains(this.range, [c.from, c.from]),
    )) {
      anyChange = true;
      this.cm.dispatch({
        userEvent: "sync",
        changes: [
          {
            from: change.from - this.range[0],
            to: change.to - this.range[0],
            insert: change.insert,
          },
        ],
      });
    }

    return anyChange;
  }

  applyChanges(editBuffer, changes) {
    this._applyTextChanges(changes);

    this.updateReplacements(editBuffer);
    this.updateMarkers(editBuffer);

    this.cm.dispatch({ userEvent: "sync" });
  }

  onPendingChangesReverted() {
    this.cm.dispatch({ userEvent: "sync" });
  }

  *iterReplacedRanges() {
    const replacedRanges = this.cm.state.field(this.replacementsField);
    const iter = replacedRanges.iter();
    while (iter.value) {
      yield iter.value;
      iter.next();
    }
  }

  *iterVisibleRanges() {
    const replacedRanges = this.cm.state.field(this.replacementsField);
    let current = this.range[0];
    const iter = replacedRanges.iter();
    while (iter.value) {
      yield [current, iter.from + this.range[0]];
      current = iter.to;
      iter.next();
    }
    yield [current, this.range[1]];
  }

  updateReplacements(editBuffer) {
    super.updateReplacements(editBuffer);
    this.cm.dispatch({ userEvent: "replacements" });
  }

  applyRejectedDiff(editBuffer, changes) {
    this._applyTextChanges(changes);
    this.cm.dispatch({ userEvent: "sync" });
    return [
      () =>
        this.cm.dispatch({
          userEvent: "sync",
          changes: [...changes]
            .reverse()
            .filter(({ inverse: c }) =>
              rangeContains(this.range, [c.from, c.from]),
            )
            .map(({ inverse: c }) => ({
              from: c.from - this.range[0],
              to: c.to - this.range[0],
              insert: c.insert,
            })),
        }),
    ];
  }

  isShowing(node) {
    if (!rangeContains(this.range, node.range)) return false;

    for (const replacement of this.replacements) {
      if (rangeContains(replacement.range, node.range)) return false;
    }

    return true;
  }

  isShowingIndex(index) {
    if (index < this.range[0] || index > this.range[1]) return false;

    let visible = true;
    for (const { from, to } of this.iterReplacedRanges()) {
      if (index >= from && index <= to) {
        visible = false;
        return false;
      }
    }
    return visible;
  }

  getReplacementFor(node) {
    return this.replacementsMap.get(node);
  }

  getMarkersFor(node) {
    // TODO
    return new Map();
  }

  *allViews() {}

  cssClass() {
    // noop, we have our own syntax highlighting
  }

  withDom(node, f) {
    // noop
  }

  installReplacement(node, extension) {
    this.replacementsMap.set(node, this.buildReplacementFor(node, extension));
  }

  uninstallReplacement(node) {
    this.replacementsMap.delete(node);
  }

  select({ head: { elementOffset: head }, anchor: { elementOffset: anchor } }) {
    this.cm.focus();
    this.cm.dispatch({
      selection: { anchor, head },
      scrollIntoView: true,
      userEvent: "select",
    });
  }

  scrollToShow(range) {
    // TODO
  }

  positionAtBoundary(fromPosition, forward) {
    const replacement = orParentThat(
      fromPosition.element,
      (p) => p instanceof CodeMirrorReplacementWidget,
    );
    for (const { from, to, value } of this.iterReplacedRanges()) {
      if (value === replacement)
        return {
          element: this,
          elementOffset: forward ? to : from,
          index: this.range[0] + (forward ? to : from),
        };
    }

    // the position was not nested within one of our replacements, so
    // it must have been an external one
    return {
      element: this,
      elementOffset: forward ? 0 : this.cm.state.doc.length,
      index: forward ? this.range[0] : this.range[1],
    };
  }

  coordsForPosition(elementOffset) {
    const pos = this.cm.coordsForPos(elementOffset);
    return new DOMRect(
      pos.left,
      pos.top,
      pos.right - pos.left,
      pos.bottom - pos.top,
    );
  }

  simulateKeyStroke(key) {
    if (key === "Backspace" || key === "Delete")
      this.cm.inputState.handleEvent(new KeyboardEvent("keydown", { key }));
    else document.execCommand("inserttext", false, key);
    this.cm.observer.forceFlush();
  }
}

customElements.define("scm-editor", CodeMirrorEditor);
customElements.define("scm-shard", CodeMirrorShard);
