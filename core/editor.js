import { basicSetup, EditorView } from "https://esm.sh/codemirror@6.0.1";

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
  orParentThat,
  rangeContains,
  ToggleableMutationObserver,
} from "../utils.js";
import { Text, Block } from "../view/elements.js";
import { markAsEditableElement } from "./focus.js";
import { Replacement } from "../view/widgets.js";
import { SBBlock, SBList, SBText } from "./model.js";

customElements.define("sb-text", Text);
customElements.define("sb-block", Block);

class BaseShard extends HTMLElement {
  get editor() {
    return orParentThat(this, (p) => p instanceof BaseEditor);
  }

  stickyNodes = new Set();

  extensionsDo(fn) {}

  markSticky(node, sticky) {
    if (sticky) this.stickyNodes.add(node);
    else this.stickyNodes.remove(node);
  }

  onTextChanges(changes) {
    // TODO this.extensionsDo((e) => e.filterChanges(changes));
    this.editor.applyChanges(changes);
  }

  approveDiff(diff) {
    for (const op of diff) {
      if (op instanceof RemoveOp && this.stickyNodes.includes(op.node))
        return false;
    }
    return true;
  }

  init(node) {
    this.node = node;
    this.initView();
    this.applyDiff(new EditBuffer(node.initOps()));
  }

  initView() {
    throw "subclass responsibility";
  }

  applyDiff(editBuffer, changes) {
    // should call applyDiffToExtensions
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

  _renderReplacement(instance, component) {
    render(
      instance,
      h(ShardContext.Provider, { value: this }, h(component, { node }))
    );
  }
  installReplacement(node, { component, sticky }) {
    const instance = document.createElement("span");
    if (sticky) this.markSticky(node, true);
    this._renderReplacement(instance, component);
    return instance;
  }
  uninstallReplacement(node) {
    this.markSticky(node, false);
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
              });
            });
            this.onTextChanges(changes);
          }
        }),
      ],
      parent: this,
    });
  }

  applyDiff(editBuffer, changes) {
    // TODO
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
    this.views.get(node).replaceWith(node.toHTML());
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

  buildOrRecall(node, editBuffer) {
    let view = editBuffer.recallView(node);
    if (view) {
      for (const v of view.allViews()) this.views.set(v.node, v);
    } else {
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
      mutations = [...mutations, ...this.observer.takeRecords()].reverse();
      if (mutations.some((m) => m.type === "attributes")) return;
      if (!mutations.some((m) => this.isMyMutation(m))) return;

      ToggleableMutationObserver.ignoreMutation(() => {
        const { selectionRange, sourceString } =
          this._extractSourceStringAndSelectionRangeAfterMutation();
        for (const mutation of mutations) this.observer.undoMutation(mutation);

        const change = findChange(
          this.actualSourceString,
          sourceString,
          this.editor.selectionRange[1] - this.node.range[0]
        );
        if (!change) return;

        change.from += this.node.range[0];
        change.to += this.node.range[0];
        change.selectionRange = selectionRange;

        this.editor.applyChanges([change]);
      });
    });
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
        this.getAttribute("language")
      ).initModelAndView(newValue);
      this.rootShard = new this.constructor.shardClass();
      this.rootShard.init(this.node);
      this.appendChild(this.rootShard);
    }
  }

  applyChanges(changes) {
    let newSource = this.node.sourceString;
    for (const { from, to, insert } of changes) {
      newSource =
        newSource.slice(0, from) + (insert ?? "") + newSource.slice(to);
    }

    const { diff, tx } = this.node.updateModelAndView(newSource);
    this.rootShard.applyDiff(diff, changes);
  }
}

class SCMEditor extends BaseEditor {
  static shardClass = CodeMirrorShard;
}

class SandblocksEditor extends BaseEditor {
  static shardClass = SandblocksShard;
}

customElements.define("scm-editor", SCMEditor);
customElements.define("sb-editor", SandblocksEditor);
customElements.define("scm-shard", CodeMirrorShard);
customElements.define("sb-shard", SandblocksShard);
