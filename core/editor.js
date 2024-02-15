import {
  EditorView,
  basicSetup,
  minimalSetup,
} from "https://esm.sh/codemirror@6.0.1";
import { RangeSet, StateField } from "https://esm.sh/@codemirror/state@6.3.1";
import { Decoration, WidgetType } from "https://esm.sh/@codemirror/view@6.22.0";
import { effect, signal } from "../external/preact-signals-core.mjs";

import {
  AttachOp,
  DetachOp,
  EditBuffer,
  LoadOp,
  RemoveOp,
  UpdateOp,
} from "./diff.js";
import { languageFor } from "./languages.js";
import {
  findChange,
  lastDeepChild,
  lastDeepChildNode,
  orParentThat,
  rangeContains,
  rangeShift,
  ToggleableMutationObserver,
  undoableMutation,
} from "../utils.js";
import { Text, Block, Placeholder } from "../view/elements.js";
import { h, render, shard } from "../view/widgets.js";
import { SBBlock, SBList, SBText } from "./model.js";
import { nextNodePreOrderThat } from "./focus.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { createContext } from "../external/preact.mjs";

customElements.define("sb-text", Text);
customElements.define("sb-block", Block);
customElements.define("sb-placeholder", Placeholder);

// # Lifecycle of a change
// When a change occurs, the view calls SBEditor.applyChanges().
// The editor then join this change with any pending changes (see below).
// It then computes the diff between the last valid state and the state after
// applying all changes. With that diff, we call the registered extensions
// in the following way:
// * beforeModelChange(modelDiff) --> may reject change (see below)
// * modelChange(diff)
// Now the editor will call the view implementation to apply the change.
// We then proceed calling extensions:
// * viewChange(viewDiff)
// And finally ensure that the cursor is still in a valid position.
//
// ## Rejecting and Pending Changes
// When a change is rejected by an extension, we collect the raw change
// in a pendingChanges list. The editor offers functions to force apply
// the pendingChanges, or to revert them.
//
// # View Implementation
// The view implementation is responsible for:
// * translating a modelDiff into a viewDiff by
//   - creating/updating host editor instances (shards)
//   - creating/updating replacements or widgets next to source code
// * dispatching changes in shards to the editor
// * interfacing with SBSelection to handle cursor movement across
//   selectable elements
//
// On file load, the model diff will contain load and attach operations for
// the entire AST. The view implementation always holds at its root a shard
// that points to the AST root. Each shard may override or inherit a list of
// extensions that are active within that shard. The root shard inherits its
// list from the editor.
//
// ## Replacements
// Replacements are user interface widgets that stand in the place of an AST
// node. They may contain shards to nest host editor instances that, again,
// may contain replacements.
// Replacements are provided by extensions.

// * push root shard to queue
// * pop from queue
//   * match replacements sorted by query depth
//     - match: create replacement and push shards to queue
//     - no match: create/update view nodes for children and push to queue

// ### Query Depth Examples
// (program) -> 1
// (true) -> 1
// (function (body (true))) -> 3
// (function (name ="hello")) -> 2

// how do changes stack across shards? how can we only create html where necessary? how do ranges play into it?
// what is another replacement subsumes a sticky replacement? what if it nests it?
// what about offscreen changes that are rejected?

/*
 * shards contain views/text and replacements
 * when a new shard is created, we need to check if new replacements want to act on those views
 * when a change occurs, we want to do the minimal number of checks, asking
    (a) replacements whether they need to be created/removed/updated/moved
    (b) replacements if their shards now match a different node
    (c) replacements if values they pulled out of the tree need to be updated
 * a change implies that we have to recheck up to [query depth] above and below the change's boundaries
 * we know that a replacement can only match in a useful manner if its root node is *visible*
    -> we need to go top-down to see if a replacement higher up in the tree consumes roots that other replacements would have needed
    -> a shard needs to be able to let us iterate over nodes that are visible

    on change:
    * for each (new) shard
      * iterate over visible nodes and nested replacement roots
        * run replacement queries
          * on existing: update()
          * on new: createAndReplace()
          * on node that was replacement root but no longer matches: uninstall() --> iterate over that part too
    (we can use [shard, node] tuples to uniquely identify view nodes)
 */

const ShardContext = createContext(null);
function stickyShard(node) {
  const owner = useContext(ShardContext);
  useEffect(() => {
    owner.markSticky(node, true);
    return () => owner.markSticky(node, false);
  });
  return shard(node);
}

const PRIORITY_AUGMENT = 100;
const PRIORITY_REPLACE = 200;

const NumberHighlight = {
  query: [(x) => x.type === "number"],
  name: "css:number",
  queryDepth: 1,
  attach: (shard, node) => shard.cssClass(node, "number", true),
  detach: (shard, node) => shard.cssClass(node, "number", false),
  priority: PRIORITY_AUGMENT,
};
const IdentifierHighlight = {
  query: [(x) => x.type === "identifier"],
  name: "css:identifier",
  attach: (shard, node) => shard.cssClass(node, "identifier", true),
  detach: (shard, node) => shard.cssClass(node, "identifier", false),
  priority: PRIORITY_AUGMENT,
};

const BrowserReplacement = {
  query: [
    (x) => x.type === "array",
    (x) => x.childBlock(0).type === "number",
    (x) => x.childBlock(0).text === "1234" || x.childBlock(0).text === "12345",
  ],
  queryDepth: 2,
  component: ({ node }) => [
    `[NUM-${node?.range[0]}]`,
    shard(node.childBlock(0)),
    "[]",
  ],
  name: "sb-browser",
  sticky: true,
  priority: PRIORITY_REPLACE,
};

class BaseShard extends HTMLElement {
  connectedCallback() {
    this.editor = orParentThat(this, (p) => p instanceof BaseEditor);
    this.editor.shards.add(this);
  }
  disconnectedCallback() {
    this.editor.shards.delete(this);
    this.node = null;
  }

  get extensionMarkers() {
    if (true) return [NumberHighlight];
  }

  get extensionReplacements() {
    if (true) return [BrowserReplacement];

    const replacements = [];
    for (const extension of this.extensions) {
      replacements.push(...extension.replacements);
    }
    replacements.sort((a, b) => a.priority - b.priority);
    return replacements;
  }

  extensionsDo(fn) {}

  onTextChanges(changes) {
    // TODO this.extensionsDo((e) => e.filterChanges(changes));
    this.editor.applyChanges(changes);
  }

  onPendingChangesReverted() {
    // may be implemented by subclasses
  }

  set node(n) {
    const init = !this._node;

    this._node?.shards.remove(this);
    this._node = n;
    n?.shards.push(this);

    if (init) {
      this.initView();
      this.applyDiff(new EditBuffer(this.node.initOps()), [
        {
          from: this.node.range[0],
          to: this.node.range[0],
          insert: this.node.sourceString,
        },
      ]);
    }
  }

  get node() {
    return this._node;
  }

  initView() {
    throw "subclass responsibility";
  }

  applyDiff(editBuffer, changes) {
    throw "subclass responsibility";
  }

  applyRejectedDiff(editBuffer, changes) {
    throw "subclass responsibility";
  }

  cssClass(node, cls, add) {
    throw "subclass responsibility";
  }

  isShowing(node) {
    throw "subclass responsibility";
  }

  getReplacementFor(node) {
    throw "subclass responsibility";
  }

  getMarkersFor(node) {
    throw "subclass responsibility";
  }

  installReplacement(node, extension) {
    throw "subclass responsibility";
  }

  uninstallReplacement(node) {
    throw "subclass responsibility";
  }

  buildReplacementFor(node, extension) {
    const view = document.createElement("sb-replacement");
    view.query = extension.query;
    view.component = extension.component;
    view.node = node;
    return view;
  }

  updateReplacements(editBuffer) {
    // check for replacements that are now gone
    for (const { node: root } of editBuffer.posBuf) {
      for (const node of root.andAllParents()) {
        const replacement = this.getReplacementFor(node);
        if (replacement && !node.exec(...replacement.query))
          this.uninstallReplacement(node, editBuffer);
      }
    }

    // check for new replacements
    for (const op of editBuffer.posBuf) {
      let node = op.node;
      for (const extension of this.extensionReplacements) {
        for (let i = 0; i <= extension.queryDepth; i++) {
          if (!node || !this.isShowing(node)) continue;
          if (!this.getReplacementFor(node) && node?.exec(...extension.query))
            this.installReplacement(node, extension);
          node = node?.parent;
        }
      }
    }
  }

  updateMarkers(editBuffer) {
    for (const op of editBuffer.posBuf) {
      let node = op.node;
      for (const extension of this.extensionMarkers) {
        for (let i = 0; i <= extension.queryDepth; i++) {
          const markers = this.getMarkersFor(node);
          if (!markers) continue;

          const marker = markers.get(extension.name);
          const match = node?.exec(...extension.query);
          if (!marker && match) {
            markers.set(extension.name, extension);
            extension.attach(this, node);
          } else if (marker && !match) {
            markers.delete(extension.name);
            extension.detach(this, node);
          }
          node = node?.parent;
        }
      }
    }
  }
}

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
    return false;
  }
}

class CodeMirrorShard extends BaseShard {
  replacements = new Map();

  initView() {
    this.cm = new EditorView({
      doc: "",
      extensions: [
        this.node.isRoot ? basicSetup : minimalSetup,
        StateField.define({
          create: () => Decoration.none,
          update: () => this._collectReplacements(),
          provide: (f) => [
            EditorView.decorations.from(f),
            EditorView.atomicRanges.of(
              (view) => view.state.field(f) ?? Decoration.none,
            ),
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
    if (v.selectionSet) {
    }
    if (v.docChanged && !v.transactions.some((t) => t.isUserEvent("sync"))) {
      const changes = [];
      v.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        changes.push({
          from: fromA + this.node.range[0],
          to: toA + this.node.range[0],
          insert: inserted.toString(),
          sourceShard: this,
        });
      });
      const inverse = [];
      v.changes
        .invert(v.startState.doc)
        .iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          inverse.push({
            from: fromA + this.node.range[0],
            to: toA + this.node.range[0],
            insert: inserted.toString(),
          });
        });
      console.assert(inverse.length === changes.length);
      changes.forEach((c, i) => (c.inverse = inverse[i]));
      this.onTextChanges(changes);
    }
  }

  _collectReplacements() {
    return RangeSet.of(
      [...this.replacements.values()].map((r) =>
        Decoration.replace({
          widget: new CodeMirrorReplacementWidget(r),
        }).range(...rangeShift(r.node.range, -this.node.range[0])),
      ),
    );
  }

  applyDiff(editBuffer, changes) {
    for (const change of changes.filter(
      (c) =>
        c.sourceShard !== this &&
        rangeContains(this.node.range, [c.from, c.from]),
    )) {
      this.cm.dispatch({
        userEvent: "sync",
        changes: [
          {
            from: change.from - this.node.range[0],
            to: change.to - this.node.range[0],
            insert: change.insert,
          },
        ],
      });
    }
    this.updateReplacements(editBuffer);
    this.updateMarkers(editBuffer);
  }

  updateReplacements(editBuffer) {
    super.updateReplacements(editBuffer);
    this.cm.dispatch({ userEvent: "replacements" });
  }

  applyRejectedDiff(editBuffer, changes) {
    this.applyDiff(editBuffer, changes);
    return [
      () =>
        this.cm.dispatch({
          userEvent: "sync",
          changes: [...changes]
            .reverse()
            .filter(({ inverse: c }) =>
              rangeContains(this.node.range, [c.from, c.from]),
            )
            .map(({ inverse: c }) => ({
              from: c.from - this.node.range[0],
              to: c.to - this.node.range[0],
              insert: c.insert,
            })),
        }),
    ];
  }

  isShowing(node) {
    if (!rangeContains(this.node.range, node.range)) return false;
    // const marks = this.cm.findMarksAt(node.range[0] - this.node.range[0]);
    // return !marks.some((m) => !!m.replacedWith);
    // TODO
    return true;
  }

  getReplacementFor(node) {
    return this.replacements.get(node);
  }

  getMarkersFor(node) {
    // TODO
    return new Map();
  }

  cssClass() {
    // noop, we have our own syntax highlighting
  }

  installReplacement(node, extension) {
    this.replacements.set(node, this.buildReplacementFor(node, extension));
  }

  uninstallReplacement(node) {
    this.replacements.delete(node);
  }
}

class SandblocksShard extends BaseShard {
  views = new Map();
  actualSourceString = null;

  initView() {
    this.actualSourceString = this.node.sourceString;
  }

  isShowing(node) {
    return !!this.views.get(node);
  }

  getReplacementFor(node) {
    const view = this.views.get(node);
    return view?.isNodeReplacement ? view : null;
  }

  getMarkersFor(node) {
    const view = this.views.get(node);
    return view?.markers;
  }

  cssClass(node, cls, add) {
    this.views.get(node).classList.toggle(cls, add);
  }

  applyRejectedDiff(_editBuffer, changes) {
    return changes
      .map((change) => this.applyRejectedChange(change))
      .filter((n) => n);
  }

  onPendingChangesReverted() {
    this.actualSourceString = this.node.sourceString;
  }

  applyDiff(editBuffer, changes) {
    for (const change of editBuffer.negBuf) {
      if (change instanceof DetachOp) {
        const view = this.views.get(change.node);
        if (view) {
          view.remove();
          for (const v of view.allViews()) {
            editBuffer.rememberView(v);
            this.views.delete(v.node);
          }
        }
      }
    }

    const sorted = [...editBuffer.posBuf].sort((a, b) => {
      // we want LoadOp first, then AttachOp, then UpdateOp
      // for AttachOp, we want a topological sort
      if (a instanceof LoadOp) return -1;
      if (b instanceof LoadOp) return 1;
      if (a instanceof AttachOp && b instanceof AttachOp)
        // FIXME do we need a proper topological sort?
        return a.node.depth - b.node.depth;

      if (a instanceof AttachOp && b instanceof UpdateOp) return -1;
      if (a instanceof UpdateOp && b instanceof AttachOp) return 1;
      return 0;
    });

    for (const change of sorted) {
      if (change instanceof AttachOp) {
        const parentView = this.views.get(change.parent);
        if (parentView) {
          const view = this.buildOrRecall(change.node, editBuffer);
          parentView.insertNode(view, change.index);
        } else if (this.node === change.node) {
          this.appendChild(this.buildOrRecall(change.node, editBuffer));
        } else {
          // not within our shard
        }
      }
      if (change instanceof UpdateOp) {
        this.views.get(change.node)?.setAttribute("text", change.text);
      }
    }

    this.updateReplacements(editBuffer);
    this.updateMarkers(editBuffer);
    this.actualSourceString = this.node.sourceString;
  }

  uninstallReplacement(node, editBuffer) {
    const replacement = this.views.get(node);
    const view = this.buildOrRecall(node, editBuffer, true);
    replacement.replaceWith(view);
    this.views.set(node, view);
  }

  installReplacement(node, extension) {
    const view = this.views.get(node);
    const replacement = this.buildReplacementFor(node, extension);
    for (const v of view.allViews()) this.views.delete(v.node);
    view.replaceWith(replacement);
    this.views.set(node, replacement);
  }

  buildOrRecall(node, editBuffer, recursive = false) {
    let view;

    for (const extension of this.extensionReplacements) {
      if (node.exec(...extension.query)) {
        view = this.buildReplacementFor(node, extension);
      }
    }

    if (!view) {
      view = editBuffer?.recallView(node);
      if (view) for (const v of view.allViews()) this.views.set(v.node, v);
    }

    if (!view) {
      if (node instanceof SBText) {
        view = document.createElement("sb-text");
        view.setAttribute("text", node.text);
      } else if (node instanceof SBBlock) {
        view = document.createElement("sb-block");
      } else if (node instanceof SBList) {
        view = document.createElement("sb-view-list");
      } else {
        throw new Error("unknown model node type");
      }
      view.node = node;
    }

    if (recursive) {
      for (const child of node.children) {
        view.appendChild(this.buildOrRecall(child, editBuffer, true));
      }
    }

    this.views.set(node, view);

    return view;
  }

  connectedCallback() {
    super.connectedCallback();
    for (const [key, value] of Object.entries({
      spellcheck: "false",
      autocorrect: "off",
      autocapitalize: "off",
      translate: "no",
      contenteditable: "true",
      "data-gramm": "false",
      "data-gramm_editor": "false",
      "data-enable-grammarly": "false",
      role: "textbox",
      "aria-multiline": "true",
      focusable: "true",
    }))
      this.setAttribute(key, value);

    // TODO
    // markAsEditableElement(this);

    this.observer = new ToggleableMutationObserver(this, (mutations) => {
      mutations = [...mutations, ...this.observer.takeRecords()];
      if (mutations.some((m) => m.type === "attributes")) return;
      if (!mutations.some((m) => this.isMyMutation(m))) return;

      ToggleableMutationObserver.ignoreMutation(() => {
        const { selectionRange, sourceString } =
          this._extractSourceStringAndSelectionRangeAfterMutation();
        ToggleableMutationObserver.undoMutations(mutations);

        const change = findChange(
          this.actualSourceString,
          sourceString,
          this.editor.selectionRange[1] - this.node.range[0],
        );
        if (!change) return;

        change.from += this.node.range[0];
        change.to += this.node.range[0];
        change.selectionRange = selectionRange;

        this.actualSourceString = sourceString;
        this.editor.applyChanges([change]);
      });
    });
  }

  isMyMutation(mutation) {
    if (!mutation.target.parentElement) return false;
    let current = mutation.target;
    while (current) {
      if (current === this) return true;
      // in another shard
      if (current.tagName === this.tagName) return false;
      // in a replacement
      if (current.isNodeReplacement) return false;
      current = current.parentElement;
    }
    throw new Error("Mutation is not in shard");
  }

  applyRejectedChange({ from, to, insert }) {
    if (!rangeContains(this.node.range, [from, from])) return null;

    let start = null;
    let offset = 0;
    const nestedElements = this._getNestedContentElements();
    for (const nested of [...nestedElements, null]) {
      const range = document.createRange();

      if (start) range.setStartAfter(start);
      else range.setStart(this, 0);
      if (nested) range.setEndBefore(nested);
      else range.setEndAfter(lastDeepChild(this));

      const length = range.toString().length;
      offset += length;
      if (offset >= from) {
        console.assert(offset >= to, "change outside visible range");

        offset -= length;

        const range = document.createRange();
        nextNodePreOrderThat(start ? lastDeepChildNode(start) : this, (n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            offset += n.textContent.length;
            if (range.startContainer === document && offset >= from)
              range.setStart(n, from - (offset - n.textContent.length));
            if (offset >= to) {
              range.setEnd(n, to - (offset - n.textContent.length));
              return true;
            }
          }
          return false;
        });

        const undo = undoableMutation(this, () => {
          range.deleteContents();
          if (insert) {
            const placeholder = document.createElement("sb-placeholder");
            placeholder.textContent = insert;
            range.insertNode(placeholder);
          }
        });
        return undo;
      }

      if (nested) offset += nested.sourceString?.length ?? 0;
      console.assert(offset <= from, "insert position was found in nested");
      start = nested;
    }
    console.assert(false, "insert position was not found");
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
    const nestedElements = this._getNestedContentElements(cursorElements);
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
        this.node.range[0] + focusOffset,
        this.node.range[0] + anchorOffset,
      ].sort((a, b) => a - b),
    };
  }

  // Recursively iterate over all elements within this shard.
  // when encountering an element that is neither a Block nor a Text,
  // we note it.
  // Additionally, we need to insert the two elements that our cursor
  // is located in this list, in the right position, so that we can
  // later grab the string from the previous element to the cursor.
  _getNestedContentElements(
    cursorElements = [],
    parent = this,
    list = [],
    insideBlocks = true,
  ) {
    for (const child of parent.childNodes) {
      if (cursorElements.includes(child) || (insideBlocks && !child.isNodeView))
        list.push(child);
      this._getNestedContentElements(
        cursorElements,
        child,
        list,
        insideBlocks && child instanceof Block,
      );
    }
    return list;
  }
}

class BaseEditor extends HTMLElement {
  // subclassResponsibility
  static shardTag = null;

  shards = new Set();
  stickyNodes = new Set();
  pendingChanges = signal([]);
  revertChanges = [];

  get selectionRange() {
    return [0, 0];
  }

  static observedAttributes = ["text", "language", "extensions"];
  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === "text") {
      this.node = await languageFor(
        this.getAttribute("language"),
      ).initModelAndView(newValue);
      this.rootShard = document.createElement(this.constructor.shardTag);
      this.rootShard.node = this.node;
      this.appendChild(this.rootShard);
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

  markSticky(node, sticky) {
    if (sticky) this.stickyNodes.add(node);
    else this.stickyNodes.delete(node);
  }

  // hook that may be implemented by editors for cleaning up
  onSuccessfulChange() {}

  applyChanges(changes, forceApply = false) {
    let newSource = this.node.sourceString;
    const allChanges = [...this.pendingChanges.value, ...changes];
    for (const { from, to, insert } of allChanges) {
      newSource =
        newSource.slice(0, from) + (insert ?? "") + newSource.slice(to);
    }

    const { diff, tx } = this.node.updateModelAndView(newSource);
    if (!forceApply) {
      for (const op of diff.negBuf) {
        if (op instanceof RemoveOp && (this.stickyNodes.has(op.node) || true)) {
          tx.rollback();
          for (const shard of this.shards)
            this.revertChanges.push(...shard.applyRejectedDiff(diff, changes));
          this.pendingChanges.value = [
            ...this.pendingChanges.value,
            ...changes,
          ];
          return false;
        }
      }
    }

    this.onSuccessfulChange();
    tx.commit();

    // may create or delete shards while iterating, so iterate over a copy
    for (const shard of [...this.shards]) {
      // if we are deleted while iterating, don't process diff
      if (shard.node) shard.applyDiff(diff, changes);
    }

    this.pendingChanges.value = [];
    this.revertChanges = [];
  }

  revertPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() => {
      for (const change of this.revertChanges.reverse()) change();
      this.revertChanges = [];
      this.pendingChanges.value = [];
      for (const shard of this.shards) shard.onPendingChangesReverted();
    });
  }

  applyPendingChanges() {
    ToggleableMutationObserver.ignoreMutation(() => {
      this.applyChanges([], true);
    });
  }
}

class SCMEditor extends BaseEditor {
  static shardTag = "scm-shard";
}

class SandblocksEditor extends BaseEditor {
  static shardTag = "sb-shard";

  onSuccessfulChange() {
    // unlike in the text editor, pending changes are inserted as
    // placeholders and are turned into blocks once valid, so we
    // revert here and the shard will apply the view changes
    this.revertPendingChanges();
  }
}

class SBReplacement extends HTMLElement {
  get shard() {
    return orParentThat(this, (p) => p instanceof BaseShard);
  }

  get sourceString() {
    return this.node.sourceString;
  }

  get isNodeReplacement() {
    return true;
  }

  insertNode() {
    // called when applying diffs to view -- we don't want to receive children
  }

  *allViews() {
    yield this;
  }

  connectedCallback() {
    this.setAttribute("contenteditable", "false");
    render(
      h(
        ShardContext.Provider,
        { value: this.shard },
        h(this.component, { ...(this.props ?? {}), node: this.node }),
      ),
      this,
    );
  }
}

customElements.define("scm-editor", SCMEditor);
customElements.define("sb-editor", SandblocksEditor);
customElements.define("scm-shard", CodeMirrorShard);
customElements.define("sb-shard", SandblocksShard);
customElements.define("sb-replacement", SBReplacement);
