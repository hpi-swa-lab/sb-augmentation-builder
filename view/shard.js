import { Replacement } from "./widgets.js";
import { Editor } from "./editor.js";
import {
  ToggleableMutationObserver,
  getSelection,
  allViewsDo,
  rangeContains,
  orParentThat,
  matchesKey,
  lastDeepChild,
  withDo,
  rangeDistance,
  rangeEqual,
} from "../utils.js";
import { Block } from "./elements.js";
import {
  followingEditablePart,
  followingElementThat,
  markAsEditableElement,
} from "../core/focus.js";

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
                debugger;
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

    markAsEditableElement(this);

    this.editor.registerShard(this);

    this.observer = new ToggleableMutationObserver(this, (mutations) => {
      mutations = [...mutations, ...this.observer.takeRecords()].reverse();
      if (mutations.some((m) => m.type === "attributes")) return;
      if (!mutations.some((m) => this.isMyMutation(m))) return;

      ToggleableMutationObserver.ignoreMutation(() => {
        const { selectionRange, sourceString } =
          this._extractSourceStringAndSelectionRangeAfterMutation();
        for (const mutation of mutations) this.observer.undoMutation(mutation);

        this.editor.replaceTextFromTyping({
          range: this.range,
          text: sourceString,
          selectionRange,
        });
      });
    });
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

  _lastSelectionRange = null;
  focus() {
    // FIXME necessary? if so, creates a loop with the selection's focus logic
    // this.editor.focusShard(this);
    // super.focus();
    if (this._lastSelectionRange) {
      this.editor.changeSelection((selection) => {
        selection.addRange(this._lastSelectionRange);
      });
    } else super.focus();
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

  get node() {
    return this.source;
  }

  // extract the current DOM selection.
  // to be used only after DOM changes have been reconciled with the model.
  _extractSelectionRange() {
    const range = getSelection().getRangeAt(0);
    this._lastSelectionRange = range;
    return this._rangeForSelection(range);
  }

  _rangeForSelection(range) {
    const start = this._indexForSelection(
      range.startContainer,
      range.startOffset
    );
    const end = this._indexForSelection(range.endContainer, range.endOffset);
    const selectionRange = [start, end].sort((a, b) => a - b);
    return { selectionRange, view: this.findSelectedForRange(selectionRange) };
  }

  _indexForSelection(node, offset) {
    const ref =
      node instanceof window.Text
        ? node
        : node.childNodes[Math.min(offset, node.childNodes.length - 1)];

    const parent = followingElementThat(ref, -1, (n) => !!n.range);
    if (node.parentElement === parent && node instanceof window.Text)
      return parent.range[0] + offset;
    else return parent.range[offset >= parent.childNodes.length ? 1 : 0];
  }

  // combined operation to find the source string and cursor range
  // in the dom. to be used after a DOM mutation has happened that
  // we have not yet undone and reconciled with the model.
  _extractSourceStringAndSelectionRangeAfterMutation() {
    const selection = getSelection();
    const hasSelection = selection.anchorNode && selection.focusNode;
    const cursorElements = hasSelection
      ? [selection.focusNode, selection.anchorNode]
      : [];

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
      else range.setEndAfter(lastDeepChild(this));

      start = nested;
      string += range.toString();

      if (nested) {
        string += nested.sourceString ?? "";
      }
    }

    return {
      sourceString: string,
      selectionRange: [
        this.range[0] + focusOffset,
        this.range[0] + anchorOffset,
      ].sort((a, b) => a - b),
    };
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
      // if (!child.node.isText) return;
      if (child.shard !== this) return;
      const [start, end] = child.range;
      if (start <= range[0] && end >= range[1]) {
        if (
          !candidate ||
          ((child.node.preferForSelection ||
            !candidate.node.preferForSelection) &&
            candidate.range[1] - candidate.range[0] >= end - start)
        )
          candidate = child;
      }
    });

    while (
      candidate.parentElement?.range &&
      candidate.parentElement.tagName !== "SB-SHARD" &&
      rangeEqual(candidate.range, candidate.parentElement.range)
    ) {
      candidate = candidate.parentElement;
    }

    return candidate;
  }

  closestElementForRange(range) {
    let candidate = null;
    let bestDistance = Infinity;

    allViewsDo(this, (child) => {
      if (!child.node.isText) return;
      if (child.shard !== this) return;
      let distance = rangeDistance(range, child.range);
      if (distance < bestDistance) {
        candidate = child;
        bestDistance = distance;
      }
    });

    return candidate;
  }

  _cursorToRange(start, end) {
    const range = document.createRange();
    if (start === end && start === 0 && this.range[0] === 0) {
      range.setStart(this, 0);
      range.setEnd(this, 0);
      return range;
    }

    let startNode = this.root.findTextForCursor(start);
    let endNode = this.root.findTextForCursor(end);
    if (!startNode || !endNode) {
      return null;
    }
    range.setStart(...startNode.rangeParams(start));
    range.setEnd(...endNode.rangeParams(end));
    return range;
  }

  ////////////////////////////////////
  // Selection API
  ////////////////////////////////////
  sbSelectRange(range) {
    const selectionRange = this._cursorToRange(...range);
    if (!selectionRange) return null;
    let view = this.findSelectedForRange(range);

    // if we are at the very start, there may be no view
    if (!view && range[0] === this.range[0]) view = this;
    console.assert(view);

    this.editor.changeSelection((selection) =>
      selection.addRange(selectionRange)
    );
    return view;
  }
  sbSelectAtBoundary(part, atStart) {
    const node = part ? part.node : this.source;
    const range = withDo(node.range[atStart ? 0 : 1], (p) => [p, p]);

    const sel = document.createRange();
    if (atStart) {
      if (part) sel.setStartBefore(part);
      else sel.setStart(this, 0);
    } else {
      if (part) sel.setStartAfter(part);
      else sel.setStart(this, this.childNodes.length);
    }
    sel.collapse(true);
    this.editor.changeSelection((selection) => selection.addRange(sel));

    return { view: part ?? this.closestElementForRange(range), range };
  }
  sbIsMoveAtBoundary(delta) {
    const newPos = this.editor.selection.range[0] + delta;
    const me = this.closestElementForRange([newPos, newPos]);
    if (!me) {
      return !rangeContains(this.range, [newPos, newPos]);
    }
    const myRange = me.range;
    if (rangeContains(myRange, [newPos, newPos])) return false;
    const following = followingEditablePart(me, delta);
    return following?.shard !== me.shard;
  }
  sbCandidateForRange(range) {
    if (!rangeContains(this.range, range)) return null;

    const view = this.closestElementForRange(range);
    const rect = view?.getBoundingClientRect();
    return view ? { view, rect, range: view.range } : null;
  }
  sbSelectedEditablePart() {
    const point = withDo(this.editor.selection.range[0], (p) => [p, p]);
    const el = this.closestElementForRange(point);
    if (!el || !rangeContains(el.range, point)) return null;
    return el;
    // const part = this.editor.selection.sbLastPart;
    // if (!part || !part.isConnected || part.shard !== this) return null;
    // return part;
  }
}
