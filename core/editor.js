import { effect, signal } from "../external/preact-signals-core.mjs";

import { languageFor } from "./languages.js";
import { clamp, last, sequenceMatch } from "../utils.js";
import {
  Text,
  Block,
  Placeholder,
  ViewList,
} from "../sandblocks/editor/elements.js";
import { h, render } from "../view/widgets.js";
import { Extension } from "./extension.js";
import { preferences } from "./preferences.js";
import { setConfig } from "./config.js";

preferences
  // .registerDefaultShortcut("nextSuggestion", "ArrowDown")
  .registerDefaultShortcut("nextSuggestion", "Ctrl-j")
  // .registerDefaultShortcut("previousSuggestion", "ArrowUp")
  .registerDefaultShortcut("previousSuggestion", "Ctrl-k")
  // .registerDefaultShortcut("useSuggestion", "Enter")
  .registerDefaultShortcut("useSuggestion", "Tab")
  .registerDefaultShortcut("dismissSuggestions", "Escape")

  .registerDefaultShortcut("save", "Ctrl-s")
  .registerDefaultShortcut("undo", "Ctrl-z")
  .registerDefaultShortcut("redo", "Ctrl-Z")
  .registerDefaultShortcut("cut", "Ctrl-x")
  .registerDefaultShortcut("copy", "Ctrl-c")
  .registerDefaultShortcut("search", "Ctrl-f")
  .registerDefaultShortcut("indentLess", "Shift-Tab")
  .registerDefaultShortcut("indentMore", "Tab")
  .registerDefaultShortcut("homeSelect", "Shift-Home")
  .registerDefaultShortcut("home", "Home")

  .registerDefaultShortcut("selectNodeUp", "Ctrl-ArrowUp")
  .registerDefaultShortcut("selectNodeDown", "Ctrl-ArrowDown")
  .registerDefaultShortcut("popNodeOut", "Ctrl-o")

  .registerDefaultShortcut("insertFirstArg", "Alt-1")
  .registerDefaultShortcut("insertSecondArg", "Alt-2")
  .registerDefaultShortcut("insertThirdArg", "Alt-3")
  .registerDefaultShortcut("insertFourthArg", "Alt-4")
  .registerDefaultShortcut("insertFifthArg", "Alt-5")

  .registerDefaultShortcut("highlightIt", "Ctrl-h")
  .registerDefaultShortcut("wrapWithWatch", "Ctrl-e")
  .registerDefaultShortcut("printIt", "Ctrl-p")
  .registerDefaultShortcut("browseIt", "Ctrl-b")
  .registerDefaultShortcut("browseSenders", "Alt-n")
  .registerDefaultShortcut("browseImplementors", "Alt-m")
  .registerDefaultShortcut("resetContents", "Ctrl-l")
  .registerDefaultShortcut("addNewBlock", "Ctrl-Enter")

  .addDefaultExtension("base:base", true, false);

customElements.define("sb-text", Text);
customElements.define("sb-block", Block);
customElements.define("sb-placeholder", Placeholder);
customElements.define("sb-view-list", ViewList);

export class BaseEditor extends HTMLElement {
  static init(baseUrl = null) {
    baseUrl ??= new URL(".", location.href).toString();
    setConfig({ baseUrl });
    Extension.clearRegistry();
  }

  // subclassResponsibility
  static shardTag = null;

  shards = new Set();
  pendingChanges = signal([]);
  validators = new Set();
  revertChanges = [];
  inlineExtensions = [];
  extensionData = new Map();
  // an optional field that may contain an object that knows more
  // about this editor, for instance what file is open.
  context = null;

  _selection = {
    head: { element: null, elementOffset: null, index: 0 },
    anchor: { element: null, elementOffset: null, index: 0 },
  };
  _selectedNode = null;
  _selectedView = null;

  get selectedText() {
    return this.sourceString.slice(
      this.selectionRange[0],
      this.selectionRange[1],
    );
  }

  get selectedNode() {
    return this._selectedNode;
  }

  get selectedView() {
    return this._selectedView;
  }

  get selectedShard() {
    return this.selectedView.shard;
  }

  get sourceString() {
    return this.node.sourceString;
  }

  get language() {
    return this.node.language;
  }

  get tabSize() {
    return 2;
  }

  static observedAttributes = ["text", "language", "extensions"];
  async attributeChangedCallback() {
    this._queueUpdate();
  }

  _queuedUpdate = false;
  _queueUpdate() {
    if (this._queuedUpdate) return;
    this._queuedUpdate = true;
    queueMicrotask(() => {
      this._queuedUpdate = false;
      this.setText(this.getAttribute("text"), this.getAttribute("language"));
    });
  }

  get selection() {
    return this._selection;
  }

  get preferences() {
    return preferences;
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
    this.rootShard.extensions = () => [...extensions, ...this.inlineExtensions];
    for (const extension of this.allExtensions())
      for (const func of extension.connected) func(this);
    this.rootShard.editor = this;
    this.rootShard.node = this.node;
    this.appendChild(this.rootShard);
    this.onSelectionChange({
      head: this.rootShard.positionForIndex(0),
      anchor: this.rootShard.positionForIndex(0),
    });
    this.dispatchEvent(new Event("ready"));
  }

  registerValidator(cb) {
    this.validators.add(cb);
  }

  unregisterValidator(cb) {
    this.validators.delete(cb);
  }

  // hook that may be implemented by editors for cleaning up
  onSuccessfulChange() {}

  onSelectionChange(selection) {
    this._selection = selection;

    for (const shard of this.shards) {
      for (const ext of shard.extensions()) {
        for (const func of ext.caret) func(this, shard);
      }
    }

    if (selection.head.index !== undefined) {
      const node = selection.head.element.selectedFor(this.selectionRange);
      const view = selection.head.element.viewFor(node);
      if (node && node !== this._selectedNode) {
        this._selectedNode = node;
        this._selectedView = view;
        for (const shard of this.shards) {
          for (const ext of shard.extensions()) {
            for (const func of ext.selection) func(node, view, this);
          }
        }
      }
    }
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

  insertTextFromCommand(position, text) {
    this.applyChanges([
      {
        from: position,
        to: position,
        insert: text,
        selectionRange: [position + text.length, position + text.length],
      },
    ]);
  }

  applyChanges(changes, forceApply = false) {
    const oldSelection = this.selectionRange;
    const oldSource = this.node.sourceString;
    let newSource = oldSource;
    const allChanges = [...this.pendingChanges.value, ...changes];
    for (const { from, to, insert } of allChanges) {
      newSource =
        newSource.slice(0, from) + (insert ?? "") + newSource.slice(to);
    }

    const { diff, tx, root } = this.node.updateModelAndView(newSource);
    const oldRoot = this.node;
    this.node = root;

    if (!forceApply) {
      for (const validator of this.validators) {
        if (!validator(root, diff, allChanges)) {
          tx.rollback();
          this.node = oldRoot;
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
      last(allChanges).selectionRange?.[0] ?? this.selectionRange[0];
    let bestCandidate =
      this.selection.head.element.candidatePositionForIndex(newIndex);
    if (bestCandidate && bestCandidate.distance > 0) {
      for (const shard of this.shards) {
        const candidate = shard.candidatePositionForIndex(newIndex);
        if (candidate.distance < bestCandidate.distance)
          bestCandidate = candidate;
      }
    }
    if (bestCandidate?.position) {
      this.onSelectionChange({
        head: bestCandidate.position,
        anchor: bestCandidate.position,
      });
      bestCandidate.position.element.select(this.selection);
    }

    this.clearSuggestions();
    for (const extension of this.allExtensions()) {
      for (const func of extension.changesApplied)
        func(changes, oldSource, newSource, this.node, diff, oldSelection);
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

  get range() {
    return [0, this.node.sourceString.length];
  }

  moveCursor(forward, selecting, wordWise) {
    this.selection.head.element.resync?.();
    const { head } = this.selection;
    const next = forward
      ? this.nextPosition(head, wordWise)
      : this.previousPosition(head, wordWise);
    if (next && next.element !== head.element) {
      this.selection.head = next;
      if (!selecting) this.selection.anchor = next;
      // FIXME what if head and anchor are in different elements?
      this.selection.head.element.select(this.selection);
      this.onSelectionChange(this.selection);
      return true;
    }
    return false;
  }

  nextPosition(a) {
    let next = false;
    for (const b of this.cursorPositions()) {
      if (next) return b;
      if (positionEqual(a, b)) next = true;
    }
    return null;
  }

  previousPosition(a) {
    let last = null;
    for (const b of this.cursorPositions()) {
      if (positionEqual(a, b)) return last;
      last = b;
    }
    return last;
  }

  *allExtensions() {
    yield* this.rootShard.extensions();
  }

  setData(key, value) {
    this.extensionData.set(key, value);
  }

  data(key, orCreate) {
    if (orCreate && !this.extensionData.has(key))
      this.extensionData.set(key, orCreate());
    return this.extensionData.get(key);
  }

  updateMarker(namePrefix) {
    for (const shard of this.shards) {
      for (const extension of shard.extensions()) {
        for (const marker of extension.markers) {
          if (marker.name.startsWith(namePrefix)) {
            for (const view of shard.allViews()) {
              const markers = shard.getMarkersFor(view.node);
              if (!markers) continue;
              const hasMarker = markers.get(marker.name);
              const hasMatch = view.node?.exec(...marker.query);
              if (!hasMarker && hasMatch) {
                markers.set(marker.name, marker);
                marker.attach(shard, view.node);
              } else if (hasMarker && !hasMatch) {
                markers.delete(marker.name);
                marker.detach(shard, view.node);
              }
            }
          }
        }
      }
    }
  }

  addSuggestionsAndFilter(node, candidates) {
    const query = node.text.toLowerCase();
    const exactMatches = candidates
      .filter((w) => w.label.toLowerCase().startsWith(query))
      .sort((a, b) => a.label.length - b.label.length);
    const fuzzyMatches = candidates
      .filter((w) => !exactMatches.includes(w) && sequenceMatch(query, w.label))
      .sort((a, b) => a.label.length - b.label.length);
    this.addSuggestions(node, [...exactMatches, ...fuzzyMatches].slice(0, 10));
  }

  addSuggestions(node, list) {
    throw "subclass responsibility";
  }

  clearSuggestions() {
    throw "subclass responsibility";
  }

  useSuggestion() {
    throw "subclass responsibility";
  }

  isSuggestionsListVisible() {
    throw "subclass responsibility";
  }

  canMoveSuggestion(delta) {
    throw "subclass responsibility";
  }

  moveSuggestion(delta) {
    throw "subclass responsibility";
  }
}

function positionEqual(a, b) {
  // allow tuples by unpacking
  return (
    a.element === b.element &&
    (Array.isArray(a.elementOffset) && Array.isArray(b.elementOffset)
      ? a.elementOffset.every((x, i) => x === b.elementOffset[i])
      : a.elementOffset === b.elementOffset)
  );
}

class OffscreenShard {
  candidatePositionForIndex(index) {
    return null;
  }
  *extensions() {}
}
export class OffscreenEditor extends BaseEditor {
  rootShard = new OffscreenShard();
  selection = {
    head: { index: 0, element: this.rootShard },
    anchor: { index: 0, element: this.rootShard },
  };
  constructor(root) {
    super();
    this.node = root;
  }

  clearSuggestions() {}
}
customElements.define("sb-offscreen-editor", OffscreenEditor);
