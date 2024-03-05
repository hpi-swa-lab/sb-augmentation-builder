import { last, orParentThat, rangeContains, rangeShift } from "../utils.js";
import { BaseEditor } from "../core/editor.js";
import { BaseShard } from "../core/shard.js";
import {
  EditorView,
  basicSetup,
  minimalSetup,
  RangeSet,
  StateField,
  Prec,
  Decoration,
  WidgetType,
  keymap,
  indentWithTab,
  javascript,
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

class CodeMirrorEditor extends BaseEditor {
  static shardTag = "scm-shard";
}

// TODO moving cursor up/down, then left/right
class CodeMirrorShard extends BaseShard {
  replacementsMap = new Map();

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
        this.node.isRoot ? basicSetup : minimalSetup,
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
          ])
        ),
        keymap.of([indentWithTab]),
        javascript(),
        this.replacementsField,
        EditorView.updateListener.of((v) => this._onChange(v)),
      ],
      parent: this,
    });

    if (!this.node.isRoot)
      this.cm.dom.style.cssText = "display: inline-flex !important";
  }

  _onChange(v) {
    if (v.transactions.some((t) => t.isUserEvent("select.pointer"))) {
      this.editor.selection = {
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
      };
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
        this.range[0]
      );
      this.onTextChanges(changes);
    }
  }

  _collectReplacements() {
    return RangeSet.of(
      this.replacements.map((r) =>
        Decoration.replace({
          widget: new CodeMirrorReplacementWidget(r),
        }).range(...rangeShift(r.range, -this.range[0]))
      )
    );
  }

  applyChanges(editBuffer, changes) {
    let anyChange = false;
    for (const change of changes.filter(
      (c) =>
        c.sourceShard !== this && rangeContains(this.range, [c.from, c.from])
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

    // make sure we update at least ranges for replacements
    if (!anyChange)
      this.cm.dispatch({
        userEvent: "sync",
      });

    this.updateReplacements(editBuffer);
    this.updateMarkers(editBuffer);
  }

  onPendingChangesReverted() {
    this.cm.dispatch({
      userEvent: "sync",
    });
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
    this.applyChanges(editBuffer, changes);
    return [
      () =>
        this.cm.dispatch({
          userEvent: "sync",
          changes: [...changes]
            .reverse()
            .filter(({ inverse: c }) =>
              rangeContains(this.range, [c.from, c.from])
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

  positionAtBoundary(fromPosition, forward) {
    const replacement = orParentThat(
      fromPosition.element,
      (p) => p instanceof CodeMirrorReplacementWidget
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

  elementOffsetForIndex(index) {
    if (this.isShowingIndex(index)) return index - this.range[0];
    else return null;
  }

  coordsForPosition(elementOffset) {
    const pos = this.cm.coordsForPos(elementOffset);
    return new DOMRect(
      pos.left,
      pos.top,
      pos.right - pos.left,
      pos.bottom - pos.top
    );
  }
}

customElements.define("scm-editor", CodeMirrorEditor);
customElements.define("scm-shard", CodeMirrorShard);

const tests = [];
function test(name, cb) {
  tests.push(cb);
}
function assertEq(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`expected ${a} to equal ${b}`);
    for (let i = 0; i < a.length; i++) assertEq(a[i], b[i]);
    return;
  }
  if (typeof a === "object" && typeof b === "object") {
    for (const k in a) assertEq(a[k], b[k]);
    for (const k in b) assertEq(a[k], b[k]);
    return;
  }
  if (a !== b) throw new Error(`expected ${a} to equal ${b}`);
}

test("range shift complex", () => {
  const editor = new CodeMirrorEditor();
  editor.pendingChanges.value = [
    { from: 5, to: 5, insert: "3" },
    { from: 6, to: 6, insert: "2" },
    { from: 7, to: 7, insert: "1" },
    { from: 8, to: 8, insert: "3" },
    { from: 1, to: 7, insert: "" },
  ];
  assertEq(editor.adjustRange([1, 6], false), [1, 4]);
});

test("range shift simple", () => {
  const editor = new CodeMirrorEditor();
  editor.pendingChanges.value = [
    { from: 3, to: 3, insert: "a" },
    { from: 7, to: 10, insert: "" },
  ];
  assertEq(editor.adjustRange([0, 1], false), [0, 1]);
  assertEq(editor.adjustRange([3, 4], false), [4, 5]);
  assertEq(editor.adjustRange([7, 10], false), [7, 8]);
});

test("range shift root", () => {
  const editor = new CodeMirrorEditor();
  editor.pendingChanges.value = [{ from: 0, to: 0, insert: "a" }];
  assertEq(editor.adjustRange([0, 10], true), [0, 11]);
});

test("edit with pending changes", async () => {
  const editor = new CodeMirrorEditor();
  await editor.setText("a + b", "javascript");

  editor.rejectChange = () => true;

  editor.applyChanges([
    {
      from: 0,
      to: 0,
      insert: "c",
    },
  ]);

  assertEq(editor.pendingChanges.value, [{ from: 0, to: 0, insert: "c" }]);

  editor.applyChanges([
    {
      from: 5,
      to: 5,
      insert: "d",
    },
  ]);

  assertEq(editor.pendingChanges.value, [
    { from: 0, to: 0, insert: "c" },
    { from: 5, to: 5, insert: "d" },
  ]);
});

tests.forEach((t) => t());
