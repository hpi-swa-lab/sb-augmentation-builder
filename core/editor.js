import { basicSetup, EditorView } from "https://esm.sh/codemirror@6.0.1";
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
  ToggleableMutationObserver,
  undoableMutation,
} from "../utils.js";
import { Text, Block, Placeholder } from "../view/elements.js";
import { h, render } from "../view/widgets.js";
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

const BrowserReplacementData = {
  query: [(x) => x.type === "number"],
  name: "replacement:number",
  attach: (shard, node) =>
    shard.installReplacement(node, { component: () => "NUM", sticky: false }),
  detach: (shard, node) => shard.uninstallReplacement(node),
  priority: PRIORITY_REPLACE,
};

const BrowserReplacement = {
  query: [(x) => x.type === "number"],
  component: ({ node }) => `[NUM-${node?.range[0]}]`,
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
    this.editor.shards.remove(this);
  }

  get extensionReplacements() {
    if (true) {
      return [BrowserReplacement];
    }
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

  onPendingChangesReverted() {}

  init(node) {
    this.node = node;
    this.initView();
    this.applyDiff(new EditBuffer(node.initOps()));
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

  applyDiffToExtensions(editBuffer, changes) {
    // TODO
    const modifiers = [];
    this.extensionsDo((e) => modifiers.push(...e.dataModifiers));
    modifiers.sort((a, b) => a.priority - b.priority);

    for (const change of editBuffer.ops) {
      if (!this.isShowing(change.node)) continue;

      for (const dataModifier of modifiers) {
        const hash = `${change.node}:${dataModifier.name}`;
        if (change instanceof AttachOp && !this.attachedData[hash]) {
          dataModifier.attach(this, change.node);
          this.attachedData[hash] = true;
        } else if (change instanceof DetachOp && this.attachedData[hash]) {
          dataModifier.detach(this, change.node);
          delete this.attachedData[hash];
        }
      }
    }
  }

  cssClass(node, cls, add) {
    throw "subclass responsibility";
  }
}

class CodeMirrorShard extends BaseShard {
  initView() {
    this.cm = new EditorView({
      doc: this.node.sourceString,
      extensions: [
        basicSetup,
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            const changes = [];
            v.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
              changes.push({
                from: fromA,
                to: toA,
                insert: inserted.toString(),
                sourceShard: this,
              });
            });
            const inverse = [];
            v.changes
              .invert(v.startState.doc)
              .iterChanges((fromA, toA, fromB, toB, inserted) => {
                inverse.push({
                  from: fromA,
                  to: toA,
                  insert: inserted.toString(),
                });
              });
            console.assert(inverse.length === changes.length);
            changes.forEach((c, i) => (c.inverse = inverse[i]));
            this.onTextChanges(changes);
          }
        }),
      ],
      parent: this,
    });
  }

  applyDiff(editBuffer, changes) {
    // TODO iterate over shards other than me and make the change visible
  }

  applyRejectedDiff(editBuffer, changes) {
    this.applyDiff(editBuffer, changes);
    return [
      () =>
        this.cm.dispatch({
          changes: [...changes].reverse().map(({ inverse: c }) => ({
            from: c.from,
            to: c.to,
            insert: c.insert,
          })),
        }),
    ];
  }

  isShowing(node) {
    if (!rangeContains(this.node.range, node.range)) return false;
    // const marks = this.cm.findMarksAt(node.range[0] - this.node.range[0]);
    // return !marks.some((m) => !!m.replacedWith);
    return true;
  }

  applyChanges(editBuffer, changes) {
    // TODO update text and range according to the changes list

    this.applyDiffToExtensions(editBuffer, changes);
  }

  cssClass() {
    // noop, we have our own syntax highlighting
  }

  installReplacement() {
    const instance = super.installReplacement(node, args);
    // TODO tag vs element
    this.livelyCM.wrapWidgetSync(instance, ...pos);
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

  cssClass(node, cls, add) {
    this.views.get(node).classList.toggle(cls, add);
  }

  installReplacement(node, args) {
    const instance = super.installReplacement(node, args);
    this.views.get(node).replaceWith(instance);
    this.views.set(node, instance);
  }

  uninstallReplacement(node) {
    super.uninstallReplacement(node);

    const replacement = this.views.get(node);
    this.views.delete(node);
    replacement.replaceWith(this.buildOrRecall(node));
  }

  applyRejectedDiff(_editBuffer, changes) {
    return changes.map((change) => this.applyRejectedChange(change));
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

    this.applyDiffToExtensions(editBuffer, changes);

    const sorted = [...editBuffer.posBuf].sort((a, b) => {
      // we want LoadOp first, then AttachOp, then UpdateOp
      // for AttachOp, we want a topological sort
      if (a instanceof LoadOp) return -1;
      if (b instanceof LoadOp) return 1;
      if (a instanceof AttachOp && b instanceof AttachOp)
        // FIXME technically we want a proper topological sort
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
        } else if (change.node.isRoot && this.node.isRoot) {
          this.node = change.node;
          this.appendChild(this.buildOrRecall(change.node, editBuffer));
        } else {
          // not within our shard
        }
      }
      if (change instanceof UpdateOp) {
        this.views.get(change.node)?.setAttribute("text", change.text);
      }
    }

    this.actualSourceString = this.node.sourceString;
  }

  onPendingChangesReverted() {
    this.actualSourceString = this.node.sourceString;
  }

  buildOrRecall(node, editBuffer) {
    let view;

    for (const extension of this.extensionReplacements) {
      if (node.exec(...extension.query)) {
        view = document.createElement("sb-replacement");
        view.component = extension.component;
        view.node = node;
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
  static shardClass = null;

  get selectionRange() {
    return [0, 0];
  }

  static observedAttributes = ["text", "language", "extensions"];
  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === "text") {
      this.node = await languageFor(
        this.getAttribute("language"),
      ).initModelAndView(newValue);
      this.rootShard = new this.constructor.shardClass();
      this.rootShard.init(this.node);
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

  shards = new Set();
  stickyNodes = new Set();

  markSticky(node, sticky) {
    if (sticky) this.stickyNodes.add(node);
    else this.stickyNodes.remove(node);
  }

  pendingChanges = signal([]);
  revertChanges = [];

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
    for (const shard of this.shards) shard.applyDiff(diff, changes);
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
  static shardClass = CodeMirrorShard;
}

class SandblocksEditor extends BaseEditor {
  static shardClass = SandblocksShard;

  onSuccessfulChange() {
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
