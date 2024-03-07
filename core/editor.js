import { effect, signal } from "../external/preact-signals-core.mjs";

import { RemoveOp } from "./diff.js";
import { languageFor } from "./languages.js";
import { clamp, last, orParentThat } from "../utils.js";
import { Text, Block, Placeholder } from "../view/elements.js";
import { h, render } from "../view/widgets.js";
import { Extension } from "./extension.js";

customElements.define("sb-text", Text);
customElements.define("sb-block", Block);
customElements.define("sb-placeholder", Placeholder);

function nextEditor(element) {
  return orParentThat(element, (p) => p instanceof BaseEditor);
}

function markInputEditable(input) {
  // codemirror sets css that hides the caret
  input.style.cssText = "caret-color: black !important";
  function update() {
    nextEditor(input).selection = {
      head: { element: input, elementOffset: input.selectionStart },
      anchor: { element: input, elementOffset: input.selectionEnd },
    };
  }
  function move(forward, e) {
    e.preventDefault();
    e.stopPropagation();
    nextEditor(input).moveCursor(forward, e.shiftKey);
  }
  input.resync = update;
  input.cursorPositions = function* () {
    for (let i = 0; i <= input.value.length; i++)
      yield { element: input, elementOffset: i };
  };
  input.select = function ({ head, anchor }) {
    input.focus();
    input.selectionStart = head.elementOffset;
    input.selectionEnd = anchor.elementOffset;
  };
  input.setAttribute("sb-editable", "");
  input.addEventListener("focus", update);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && input.selectionStart === input.value.length)
      move(true, e);
    if (e.key === "ArrowLeft" && input.selectionStart === 0) move(false, e);
  });
}

Element.prototype.cursorPositions = function* () {
  for (const child of this.children) yield* child.cursorPositions();
};

export class BaseEditor extends HTMLElement {
  // subclassResponsibility
  static shardTag = null;

  shards = new Set();
  stickyNodes = new Set();
  pendingChanges = signal([]);
  revertChanges = [];

  selection = {
    head: { element: null, elementOffset: null, index: 0 },
    anchor: { element: null, elementOffset: null, index: 0 },
  };

  static observedAttributes = ["text", "language", "extensions"];
  async attributeChangedCallback(name, _oldValue, newValue) {
    if (name === "text") {
      await this.setText(newValue, this.getAttribute("language"));
    }
  }

  constructor() {
    super();

    const pendingHint = document.createElement("div");
    pendingHint.className = "sb-pending-hint";
    render(
      h(
        "span",
        {},
        "Pending changes",
        h("button", { onClick: () => this.revertPendingChanges() }, "Revert"),
        h("button", { onClick: () => this.applyPendingChanges() }, "Apply"),
      ),
      pendingHint,
    );

    effect(() => {
      if (this.pendingChanges.value.length > 0) {
        this.appendChild(pendingHint);
      } else {
        pendingHint.remove();
      }
    });
  }

  async setText(text, language) {
    this.node = await languageFor(language).initModelAndView(text);
    this.firstElementChild?.remove();
    this.rootShard = document.createElement(this.constructor.shardTag);
    const extensions = await Promise.all(
      (this.getAttribute("extensions") ?? "")
        .split(" ")
        .filter((ext) => ext.length > 0)
        .map((ext) => Extension.get(ext)),
    );
    this.rootShard.extensions = () => extensions;
    this.rootShard.editor = this;
    this.rootShard.node = this.node;
    this.appendChild(this.rootShard);
    this.selection = {
      head: this.rootShard.positionForIndex(0),
      anchor: this.rootShard.positionForIndex(0),
    };
  }

  markSticky(node, sticky) {
    if (sticky) this.stickyNodes.add(node);
    else this.stickyNodes.delete(node);
  }

  // hook that may be implemented by editors for cleaning up
  onSuccessfulChange() {}

  onSelectionChange(selection) {
    this.selection = selection;
  }

  rejectChange(op) {
    return op instanceof RemoveOp && this.stickyNodes.has(op.node);
  }

  replaceTextFromCommand(range, text) {
    this.applyChanges([
      {
        from: range[0],
        to: range[1],
        insert: text,
        selectionRange: [range[0] + text.length, range[0] + text.length],
      },
    ]);
  }

  applyChanges(changes, forceApply = false) {
    let newSource = this.node.sourceString;
    const allChanges = [...this.pendingChanges.value, ...changes];
    for (const { from, to, insert } of allChanges) {
      newSource =
        newSource.slice(0, from) + (insert ?? "") + newSource.slice(to);
    }

    const { diff, tx, root } = this.node.updateModelAndView(newSource);
    this.node = root;
    if (!forceApply) {
      for (const op of [...diff.negBuf, ...diff.posBuf]) {
        if (this.rejectChange(op)) {
          tx.rollback();
          this.pendingChanges.value = [
            ...this.pendingChanges.value,
            ...changes,
          ];
          for (const shard of this.shards)
            this.revertChanges.push(...shard.applyRejectedDiff(diff, changes));
          return false;
        }
      }
    }

    this.onSuccessfulChange();
    tx.commit();

    // may create or delete shards while iterating, so iterate over a copy
    for (const shard of [...this.shards]) {
      // if we are deleted while iterating, don't process diff
      if (shard.node?.connected) shard.applyChanges(diff, changes);
    }

    this.pendingChanges.value = [];
    this.revertChanges = [];

    // update selection: if the index is no longer visible, find a new element
    const newIndex =
      last(allChanges).selectionRange?.[0] ?? this.selectionRange;
    let bestCandidate =
      this.selection.head.element.candidatePositionForIndex(newIndex);
    if (bestCandidate.distance > 0) {
      for (const shard of this.shards) {
        const candidate = shard.candidatePositionForIndex(newIndex);
        if (candidate.distance < bestCandidate.distance)
          bestCandidate = candidate;
      }
    }
    if (bestCandidate.position) {
      this.selection = {
        head: bestCandidate.position,
        anchor: bestCandidate.position,
      };
      bestCandidate.position.element.select(this.selection);
    }
  }

  revertPendingChanges() {
    if (this.pendingChanges.value.length == 0) return;
    for (const change of this.revertChanges.reverse()) change();
    this.revertChanges = [];
    this.pendingChanges.value = [];
    for (const shard of this.shards) shard.onPendingChangesReverted();
  }

  applyPendingChanges() {
    this.applyChanges([], true);
  }

  adjustRange(range, preferGrow) {
    return range.map((index) => {
      for (const change of this.pendingChanges.value) {
        if (
          (!preferGrow && index >= change.from) ||
          (preferGrow && index > change.from)
        )
          index +=
            change.insert.length -
            (clamp(index, change.from, change.to) - change.from);
      }
      return index;
    });
  }

  get selectionRange() {
    return [this.selection.head.index, this.selection.anchor.index].sort(
      (a, b) => a - b,
    );
  }

  i = 0;
  moveCursor(forward, selecting) {
    this.selection.head.element.resync?.();
    const { head } = this.selection;
    const next = forward
      ? this.nextPosition(head)
      : this.previousPosition(head);
    this.i++;
    // if (this.i === 2) debugger;
    if (next) {
      this.selection.head = next;
      if (!selecting) this.selection.anchor = next;
      // FIXME what if head and anchor are in different elements?
      this.selection.head.element.select(this.selection);
    }
    return true;
  }

  nextPosition(a) {
    let next = false;
    for (const b of this.cursorPositions()) {
      if (next) return b;
      if (this.positionEqual(a, b)) next = true;
    }
    return null;
  }

  previousPosition(a) {
    let last = null;
    for (const b of this.cursorPositions()) {
      if (this.positionEqual(a, b)) return last;
      last = b;
    }
    return last;
  }

  positionEqual(a, b) {
    // allow tuples by unpacking
    return (
      a.element === b.element &&
      (Array.isArray(a.elementOffset) && Array.isArray(b.elementOffset)
        ? a.elementOffset.every((x, i) => x === b.elementOffset[i])
        : a.elementOffset === b.elementOffset)
    );
  }
}
