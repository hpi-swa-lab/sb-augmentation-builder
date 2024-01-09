import { Replacement } from "./widgets.js";
import { Editor } from "./editor.js";
import {
  ToggleableMutationObserver,
  getSelection,
  allViewsDo,
  clamp,
  rangeContains,
  orParentThat,
  matchesKey,
  last,
  rectDistance,
} from "../utils.js";
import { Block, Text } from "./elements.js";

// A Shard is a self-contained editable element.
//
// Consequently, it keeps track of the selection and detects and isolates
// modifications to its content. It collaborates with the Editor to update
// the model when changes occur. It contains _EditableElements. It refers
// to a node in the source model. Multiple shards may point to the same node.
export class Shard extends HTMLElement {
  source = null;

  // provide convenience setter for preact, we want this to always
  // call our own update method, so we wrap the arg in an array and
  // thus force preact to always update the property (as the array
  // keeps changing identity)
  set initNode([node]) {
    this.update(node);
  }

  constructor() {
    super();

    // TODO use queue
    // this.addEventListener("compositionstart", () => { });
    // this.addEventListener("compositionend", () => { });

    this.addEventListener("blur", (e) => this.editor.clearSuggestions());

    this.addEventListener("paste", function (event) {
      event.preventDefault();
      event.stopPropagation();
      document.execCommand(
        "inserttext",
        false,
        event.clipboardData.getData("text/plain")
      );
    });

    this.addEventListener("copy", function (e) {
      e.clipboardData.setData("text/plain", this.editor.selectedText);
      e.preventDefault();
      e.stopPropagation();
    });

    this.addEventListener("keydown", async (e) => {
      switch (e.key) {
        case "ArrowUp":
          if (this.editor.suggestions.canMove(-1)) {
            e.preventDefault();
            this.editor.suggestions?.moveSelected(-1);
          }
          break;
        case "ArrowDown":
          if (this.editor.suggestions.canMove(1)) {
            e.preventDefault();
            this.editor.suggestions?.moveSelected(1);
          }
          break;
        case "Delete":
        case "Backspace":
          this.handleDelete(e);
          break;
        case "ArrowRight":
        case "ArrowLeft":
          this.handleMove(e, e.key === "ArrowRight" ? 1 : -1);
          break;
      }

      for (const [action, key] of Object.entries(Editor.keyMap)) {
        if (matchesKey(e, key)) {
          let preventDefault = true;
          let selected = this.editor.selected;

          // dispatch to extensions
          this.editor.extensionsDo((e) =>
            e.dispatchShortcut(action, selected, this.editor.source)
          );

          // built-in actions
          switch (action) {
            case "dismiss":
              this.editor.clearSuggestions();
              break;
            case "save":
              e.preventDefault();
              e.stopPropagation();
              await this.editor.asyncExtensionsDo((e) =>
                e.processAsync("preSave", this.source)
              );
              this.editor.extensionsDo((e) => e.process(["save"], this.source));
              this.editor.dispatchEvent(
                new CustomEvent("save", { detail: this.editor.sourceString })
              );
              break;
            case "cut":
            case "copy":
              // if we don't have a selection, cut/copy the full node
              if (new Set(this.editor.selectionRange).size === 1) {
                this.selectRange(...selected.getRange());
              }
              preventDefault = false;
              break;
          }

          if (preventDefault) {
            e.preventDefault();
            e.stopPropagation();
          }

          break;
        }
      }
    });
  }

  connectedCallback() {
    for (const [key, value] of Object.entries({
      spellcheck: "false",
      autocorrect: "off",
      autocapitalize: "off",
      translate: "no",
      contenteditable: "true",
      role: "textbox",
      "aria-multiline": "true",
      focusable: "true",
    }))
      this.setAttribute(key, value);

    this.editor.registerShard(this);

    this.observer = new ToggleableMutationObserver(this, (mutations) => {
      mutations = [...mutations, ...this.observer.takeRecords()].reverse();
      if (mutations.some((m) => m.type === "attributes")) return;
      console.assert(!mutations.some((m) => m.type === "attributes"));
      if (!mutations.some((m) => this.isMyMutation(m))) return;

      ToggleableMutationObserver.ignoreMutation(() => {
        const { selectionRange, sourceString } =
          this._extractSourceStringAndCursorRange();
        for (const mutation of mutations) this.observer.undoMutation(mutation);

        this.editor.replaceTextFromTyping({
          range: this.range,
          text: sourceString,
          shard: this,
          selectionRange,
        });
      });
    });

    this.editor.extensionsDo((e) =>
      e.process(["replacement", "always"], this.source)
    );
  }

  disconnectedCallback() {
    this.observer.destroy();
    this.observer = null;

    this.editor.deregisterShard(this);

    this.addEventListener("blur", (e) => this.editor.clearSuggestions());
  }

  get root() {
    return this.childNodes[0];
  }

  get editor() {
    if (this._editor) return this._editor;

    this._editor = orParentThat(this, (x) => x.tagName === "SB-EDITOR");
    if (this._editor) return this._editor;

    return (this._editor = orParentThat(
      this.parentNode,
      (x) => x.tagName === "SB-SHARD" && x.editor
    )?.editor);
  }

  get range() {
    // if we are the root, tree-sitter reports ranges that start after the first whitespace.
    // this conflicts with our updating routines
    if (this.source.isRoot) return [0, this.editor.sourceString.length];
    return this.source.range;
  }

  destroy() {
    this.observer.disconnect();
    this.parentElement?.removeChild(this);
  }

  focus() {
    this.editor.focusShard(this);
  }

  isMyMutation(mutation) {
    let current = mutation.target;
    while (current) {
      if (current === this) return true;
      // in another shard
      if (current.tagName === "SB-SHARD") return false;
      // in a replacement
      if (current instanceof Replacement) return false;
      current = current.parentElement;
    }
    throw new Error("Mutation is not in shard");
  }

  update(node) {
    if (
      !this.source ||
      !this.source.equals(node) ||
      this.childNodes.length === 0
    ) {
      this.innerHTML = "";
      this.append(node.toHTML());
      this.source = node;
    }
  }

  get sourceString() {
    return this.editor.sourceString.slice(...this.range);
  }

  // combined operation to find the source string and cursor range
  // in the dom. we combine this because it is most commonly needed
  // after the user typed something, which changes both, and the
  // way to find them is the same.
  _extractSourceStringAndCursorRange() {
    const selection = getSelection();
    const hasSelection = selection.anchorNode && selection.focusNode;
    const cursorElements = hasSelection
      ? [selection.focusNode, selection.anchorNode]
      : [];
    const visibleRanges = [];

    let start = null;
    let string = "";
    const nestedElements = this._getNestedContentElements(
      this,
      [],
      cursorElements,
      true
    );
    let focusOffset = null;
    let anchorOffset = null;
    const rangeStart = this.range[0];
    for (const nested of [...nestedElements, null]) {
      const range = document.createRange();

      if (start) range.setStartAfter(start);
      else range.setStart(this, 0);

      if (hasSelection && nested === selection.focusNode) {
        range.setEnd(selection.focusNode, selection.focusOffset);
        focusOffset = string.length + range.toString().length;
      }
      if (hasSelection && nested === selection.anchorNode) {
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        anchorOffset = string.length + range.toString().length;
      }
      if (cursorElements.includes(nested)) continue;

      if (nested) range.setEndBefore(nested);
      else range.setEndAfter(this);

      const str = range.toString();
      if (str.length > 0)
        visibleRanges.push([
          rangeStart + string.length,
          rangeStart + string.length + str.length,
        ]);
      start = nested;
      string += str;

      if (nested) {
        string += nested.sourceString ?? "";
      }
    }

    const selectionRange = [
      this.range[0] + focusOffset,
      this.range[0] + anchorOffset,
    ].sort((a, b) => a - b);

    this.visibleRanges = visibleRanges;

    return {
      sourceString: string,
      selectionRange,
      selected: this.findSelectedForRange(selectionRange),
    };
  }

  containsRange(range) {
    if (!this.visibleRanges) this._extractSourceStringAndCursorRange();
    return this.visibleRanges.some((r) => rangeContains(r, range));
  }

  rectsForRange(range) {
    if (!this.visibleRanges) this._extractSourceStringAndCursorRange();
    for (const visible of this.visibleRanges) {
      if (rangeContains(visible, range)) {
        const selection = this._cursorToRange(...range);
        return selection.getClientRects();
      }
    }
    return [];
  }

  // Recursively iterate over all elements within this shard.
  // when encountering an element that is neither a Block nor a Text,
  // we note it.
  // Additionally, we need to insert the two elements that our cursor
  // is located in this list, in the right position, so that we can
  // later grab the string from the previous element to the cursor.
  _getNestedContentElements(parent, list, cursorElements, insideBlocks) {
    for (const child of parent.childNodes) {
      if (cursorElements.includes(child) || (insideBlocks && !child.isNodeView))
        list.push(child);
      this._getNestedContentElements(
        child,
        list,
        cursorElements,
        insideBlocks && child instanceof Block
      );
    }
    return list;
  }

  // smallest child encompassing range: on a tie, prefer named nodes
  // e.g., for this scenario: `abc|(` even though at index 3 is valid
  // for both the identifier and the parens, we prefer the identifier.
  findSelectedForRange(range) {
    let candidate = null;

    // we may have been deleted entirely
    if (!this.root) return null;

    allViewsDo(this, (child) => {
      const [start, end] = child.getRange();
      if (start <= range[0] && end >= range[1]) {
        if (
          !candidate ||
          ((child.node.named || !candidate.node.named) &&
            candidate.getRange()[1] - candidate.getRange()[0] >= end - start)
        )
          candidate = child;
      }
    });
    return candidate;
  }

  _cursorToRange(start, end) {
    const range = document.createRange();
    let startNode = this.root.findTextForCursor(start);
    let endNode = this.root.findTextForCursor(end);
    if (!startNode || !endNode) {
      console.log("could not find text node for cursor", start, end);
      startNode = endNode = this.root.anyTextForCursor();
      start = clamp(start, ...startNode.range);
      end = clamp(end, ...endNode.range);
    }
    range.setStart(...startNode.rangeParams(start));
    range.setEnd(...endNode.rangeParams(end));
    return range;
  }

  _clampRange(start, end) {
    const range = this.range;
    return [clamp(start, ...range), clamp(end, ...range)];
  }

  selectRange(start, end) {
    if (end === undefined) end = start;

    this.editor.changeSelection((selection) => {
      const range = this._cursorToRange(...this._clampRange(start, end));
      selection.addRange(range);
    });
  }

  distanceToIndex(position, filter) {
    if (!this.visibleRanges) this._extractSourceStringAndCursorRange();
    let distance = this.editor.sourceString.length;
    for (const range of this.visibleRanges.filter(filter)) {
      if (range[0] <= position && range[1] >= position) return 0;
      distance = Math.min(
        distance,
        Math.abs(position - range[0]),
        Math.abs(position - range[1])
      );
    }
    return distance;
  }

  pixelDistanceToSelection(selection) {
    if (!this.visibleRanges) this._extractSourceStringAndCursorRange();
    const mine = this.containsRange(selection.range)
      ? last(this.rectsForRange(selection.range))
      : this.getBoundingClientRect();
    return rectDistance(selection.rect, mine);
  }

  isMoveAtBoundary(position, delta) {
    if (!this.visibleRanges) this._extractSourceStringAndCursorRange();
    return this.visibleRanges.some(([start, end]) =>
      delta > 0 ? position === end : position === start
    );
  }

  // TODO handle shift-selection and ctrl move
  handleMove(e, delta) {
    const current = this.editor.selection.range[0];
    if (this.isMoveAtBoundary(current, delta)) {
      const { shard, position } = this.editor.shardAndPositionForMove(
        current,
        delta
      );
      shard.selectRange(position, position);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  handleDelete(e) {
    const current = this.editor.selection.range[0];
    const isDelete = e.key === "Delete";
    if (this.isMoveAtBoundary(current, isDelete ? 1 : -1)) {
      const pos = isDelete ? current : current - 1;
      this.editor.applyChanges([
        {
          from: current + (isDelete ? 0 : -1),
          to: current + (isDelete ? 1 : 0),
          text: "",
          selectionRange: [pos, pos],
        },
      ]);
      e.preventDefault();
      e.stopPropagation();
    }
  }
}
