import {
  orParentThat,
  rangeContains,
  rangeDistance,
  rangeEqual,
  rangeShift,
  rectDistance,
  withDo,
} from "../utils.js";
import { Replacement } from "../view/widgets.js";

// sbSelectRange([start, end], testOnly): View | null
// sbSelectAtBoundary(part?, atStart): {view: View, range}
// sbIsMoveAtBoundary(delta): boolean
// sbCandidateForRange(range): {view, rect} | null
// sbSelectedEditablePart(): Element | null
// [OPTIONAL] sbNoteFocusChange(received): void

function nodeIsEditablePart(node) {
  return (
    node instanceof Element &&
    (node.tagName === "SB-TEXT" ||
      // nodeIsEditable(node) ||
      (node.getAttribute("role") === "presentation" &&
        node.tagName === "SPAN") ||
      !!node.getAttribute("sb-editable-part"))
  );
}

export function nodeIsEditable(node) {
  return !!node.getAttribute("sb-editable");
}

export function nodeEditableForPart(node) {
  return orParentThat(node, (p) => nodeIsEditable(p));
}

export function followingEditablePart(
  node,
  direction,
  sameShardAllowed = false,
) {
  const currentEditable = nodeEditableForPart(node);
  return followingElementThat(
    node,
    direction,
    (n) =>
      nodeIsEditablePart(n) &&
      n !== currentEditable &&
      !hasParent(n, node) &&
      (sameShardAllowed || nodeEditableForPart(n) !== currentEditable),
  );
}

export function followingElementThat(node, direction, predicate) {
  do {
    node =
      direction > 0 ? nextElementPreOrder(node) : previousElementPreOrder(node);
    if (node && predicate(node)) return node;
  } while (node);
  return null;
}

function parent(node) {
  return node.parentNode ?? node.getRootNode()?.host;
}

function lastChild(node) {
  if (node.shadowRoot) return node.shadowRoot.lastElementChild;
  else return node.lastElementChild;
}

function hasParent(node, p) {
  while (p) {
    if (node === p) return true;
    p = parent(p);
  }
  return false;
}

function nextElementPreOrder(node) {
  if (node.shadowRoot) return node.shadowRoot.firstElementChild;
  if (node.firstElementChild) return node.firstElementChild;
  if (node.nextElementSibling) return node.nextElementSibling;

  let current = node;
  while ((current = parent(current))) {
    if (current.nextElementSibling) return current.nextElementSibling;
  }
  return null;
}

function previousElementPreOrder(node) {
  if (node.previousElementSibling) {
    let current = node.previousElementSibling;
    while (lastChild(current)) current = lastChild(current);
    return current;
  }
  return parent(node);
}

export function nextNodePreOrderThat(node, predicate) {
  do {
    node = nextNodePreOrder(node);
    if (node && predicate(node)) return node;
  } while (node);
  return null;
}
function nextNodePreOrder(node) {
  if (node.shadowRoot) return node.shadowRoot.firstChild;
  if (node.firstChild) return node.firstChild;
  if (node.nextSibling) return node.nextSibling;

  let current = node;
  while ((current = parent(current))) {
    if (current.nextSibling) return current.nextSibling;
  }
  return null;
}

// Manages selection and caret position for an editor.
// Both positions within the text buffer (range) and outside
// (replacements / widgets) are supported. the selection is
// responsible for moving the cursor between those.
export class SBSelection extends EventTarget {
  range = [0, 0];
  lastEditable = null;
  lastRect = null;
  lastNode = null;

  // if parts remain stable throughout selection changes, clients
  // may use this field to access the current part as set by informChange.
  // when accessing it, clients must make sure that it is still valid.
  // SBSelection will never read from this field, instead deferring to
  // lastEditable.sbSelectedEditablePart()
  sbLastPart = null;

  // encompasses exactly the full node
  get isExact() {
    return (
      this.range &&
      this.lastNode?.range &&
      rangeEqual(this.range, this.lastNode.range)
    );
  }

  get notificationPoint() {
    const s = getSelection();
    if (s.rangeCount > 0) {
      return withDo(s.getRangeAt(0).getBoundingClientRect(), (r) => [
        r.x + r.width,
        r.y,
      ]);
    }
    return this.lastRect
      ? [this.lastRect.x + this.lastRect.width, this.lastRect.y]
      : withDo(getEditor(this.lastEditable).getBoundingClientRect(), (r) => [
          r.x,
          r.y,
        ]);
  }

  moveToRange(editor, targetRange, scrollIntoView = true) {
    const start = this.viewForMove(editor, targetRange);
    for (const direction of [1, -1]) {
      let node = start;
      do {
        let view = nodeEditableForPart(node).sbSelectRange(targetRange);
        if (view) {
          this._moveTo(view, targetRange, scrollIntoView);
          return;
        }
        node = followingEditablePart(node, direction);
      } while (node);
    }
    this.informChange(null, targetRange, editor);
  }

  focusEditable(editable) {
    if (editable === this.lastEditable) {
      editable.focus();
      return;
    }
    let info = editable.sbSelectAtBoundary(null, true);
    this._moveTo(info.view, info.range, false);
  }

  viewForMove(editor, newRange = null) {
    newRange ??= this.range;

    let best;

    if (this.lastEditable?.isConnected)
      best = this.lastEditable.sbSelectedEditablePart();

    if (best) {
      console.assert(best.isConnected);
      return best;
    }

    for (const editable of getAllEditableElements(editor)) {
      if (editable.sbSelectRange(newRange, true)) return editable;
    }

    if (this.lastRect) {
      let bestPixelDist = Infinity;
      let bestIndexDist = Infinity;
      for (const editable of getAllEditableElements(editor)) {
        const info = editable.sbCandidateForRange(newRange);
        if (info) {
          const pixelDist = rectDistance(info.rect, this.lastRect);
          const indexDist = rangeDistance(info.range, newRange);
          if (
            indexDist < bestIndexDist ||
            (indexDist === bestIndexDist && pixelDist < bestPixelDist)
          ) {
            best = info.view;
            bestPixelDist = pixelDist;
            bestIndexDist = indexDist;
          }
        }
      }
      if (best) return best;
    }

    for (const editable of getAllEditableElements(editor)) {
      const info = editable.sbCandidateForRange(newRange);
      if (info) return info.view;
    }

    for (const editable of getAllEditableElements(editor)) {
      return editable;
    }

    throw new Error("no editables in editor");
  }

  moveToNext(editor, delta) {
    let node = followingEditablePart(
      this.viewForMove(
        editor,
        this.range ? rangeShift(this.range, delta) : null,
      ),
      delta,
    );
    if (!node) return;

    let info = nodeEditableForPart(node).sbSelectAtBoundary(node, delta > 0);
    this._moveTo(info.view, info.range, true);
  }

  _moveTo(view, range, scrollIntoView = true) {
    console.assert(view);
    this.informChange(view, range);
    if (scrollIntoView)
      view.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  informChange(view, range, editor = null) {
    editor ??= getEditor(view);
    const newEditable = nodeEditableForPart(view);

    if (this.lastEditable !== newEditable) {
      this.lastEditable?.sbNoteFocusChange?.(false);
      newEditable?.sbNoteFocusChange?.(true);
    }

    this.range = range;
    this.sbLastPart = view;
    this.lastEditable = newEditable;
    const node = range && editor.source.childEncompassingRange(range);

    if (this.lastNode !== node) {
      this.lastRect = view?.getBoundingClientRect();

      this.dispatchEvent(
        new CustomEvent("viewChange", { detail: { view, node } }),
      );
      this.lastNode = node;
    }
    this.dispatchEvent(new CustomEvent("caretChange"));
  }
}

// mark this element as editable and subscribe to key events to check
// whether a requested cursor move hit the element's boundary.
// For preact, use with `h("input", { ref: markAsEditableElement })`.
export function markAsEditableElement(element) {
  if (!element) return;
  if (element.getAttribute("sb-editable")) return;

  element.setAttribute("sb-editable", "true");

  switch (element.tagName) {
    case "INPUT":
    case "TEXTAREA":
      element.addEventListener("keydown", handleKeyDown.bind(element));
      _markInput(element);
      break;
    case "SB-SHARD":
      // all implemented in the shard class
      element.addEventListener("keydown", handleKeyDown.bind(element));
      break;
    default:
      if (element.isNodeReplacement)
        element.addEventListener("keydown", handleKeyDown.bind(element));
      break;
  }
}

function handleKeyDown(e) {
  if (document.activeElement !== this || e.shiftKey) return;

  switch (e.key) {
    case "ArrowLeft":
      handleMove.call(this, e, -1);
      break;
    case "ArrowRight":
      handleMove.call(this, e, 1);
      break;
    case "Delete":
    case "Backspace":
      handleDelete.call(this, e);
      break;
  }
}

function getEditor(el) {
  return orParentThat(el, (e) => e.sbIsEditor);
}

function getAllEditableElements(el) {
  return getEditor(el).querySelectorAll("[sb-editable]");
}

// TODO handle shift-selection and ctrl move
function handleMove(e, delta) {
  if (this.sbIsMoveAtBoundary(delta)) {
    const editor = getEditor(this);
    editor.selection.moveToNext(editor, delta);
    e.preventDefault();
  }
  e.stopPropagation();
}

function handleDelete(e) {
  const isDelete = e.key === "Delete";
  const editor = getEditor(this);
  this.sbUpdateRange();
  const range = editor.selection.range;
  if (
    range !== null &&
    range[0] === range[1] &&
    this.sbIsMoveAtBoundary(isDelete ? 1 : -1)
  ) {
    const current = range[0];
    const pos = isDelete ? current : current - 1;
    if (pos < 0) return;
    editor.applyChanges([
      {
        from: current + (isDelete ? 0 : -1),
        to: current + (isDelete ? 1 : 0),
        text: "",
        selectionRange: [pos, pos],
      },
    ]);
    e.preventDefault();
  }
  e.stopPropagation();
}

function _markInput(element) {
  const getRange = () =>
    element.range
      ? [
          element.selectionStart + element.range[0],
          element.selectionEnd + element.range[0],
        ]
      : null;
  element.setAttribute("sb-editable-part", "true");
  element.sbCandidateForRange = (range) =>
    element.range && rangeContains(element.range, range)
      ? {
          view: element,
          rect: element.getBoundingClientRect(),
          range: element.range,
        }
      : null;
  element.sbUpdateRange = () => {
    if (element.range)
      getEditor(element).selection.informChange(element, getRange());
  };
  element.sbSelectAtBoundary = (part, atStart) => {
    const position = atStart ? 0 : element.value.length;
    element.focus();
    element.selectionStart = position;
    element.selectionEnd = position;
    return {
      view: element,
      range: element.range
        ? withDo(element.range[atStart ? 0 : 1], (p) => [p, p])
        : undefined,
    };
  };
  element.sbSelectRange = (range, testOnly) => {
    if (!element.range) return null;
    if (!rangeContains(element.range, range)) return null;
    if (!testOnly) {
      element.focus();
      element.selectionStart = range[0] - element.range[0];
      element.selectionEnd = range[1] - element.range[0];
    }
    return element;
  };
  element.sbIsMoveAtBoundary = (delta) => {
    const position = element.selectionStart;
    return delta > 0 ? position === element.value.length : position === 0;
  };
  element.addEventListener("focus", () =>
    getEditor(element).selection.informChange(element, getRange()),
  );
  element.sbSelectedEditablePart = () => (element.isConnected ? element : null);
}
