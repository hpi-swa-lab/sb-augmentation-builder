import { Replacement } from "./widgets.js";
import { nextHash, orParentThat } from "../utils.js";

// _EditableElement is the superclass for Text and Block elements, grouping
// common functionality.
class _EditableElement extends HTMLElement {
  get shard() {
    let current = this.parentElement;
    while (current) {
      if (current.tagName === "SB-SHARD") return current;
      current = current.parentElement;
    }
    return current;
  }
  get editor() {
    return orParentThat(this, (x) => x.tagName === "SB-EDITOR");
  }

  isReplacementAllowed(tag) {
    return !this.disabledReplacements?.has(tag.toUpperCase());
  }

  setAllowReplacement(tagName, allow) {
    if (allow) {
      this.disabledReplacements?.delete(tagName.toUpperCase());
    } else {
      (this.disabledReplacements ??= new Set()).add(tagName.toUpperCase());
    }
  }

  getRange() {
    return this.node.range;
  }

  get range() {
    return this.node.range;
  }

  isFullySelected() {
    const [a, b] = this.getRange();
    const [c, d] = this.editor.selectionRange;
    return a === c && b === d;
  }

  select() {
    this.editor.changeSelection((selection) =>
      selection.selectAllChildren(this)
    );
  }

  connectedCallback() {
    this.addEventListener("dblclick", this.onDoubleClick);
  }
  disconnectedCallback() {
    this.removeEventListener("dblclick", this.onDoubleClick);
  }
  onDoubleClick(e) {
    e.stopPropagation();
    this.editor.extensionsDo((e) => e.process(["doubleClick"], this.node));
  }
}

// Block the view for any non-terminal node.
export class Block extends _EditableElement {
  constructor() {
    super();
    this.hash = nextHash();

    let start;
    this.addEventListener("mousedown", (e) => {
      start = [e.clientX, e.clientY];
      if (e.target === this && this.editor.interactionMode === "block")
        this.select();
    });
    this.addEventListener("click", (e) => {
      if (
        e.target === this &&
        e.clientX === start[0] &&
        e.clientY === start[1] &&
        this.editor.interactionMode === "block"
      )
        this.select();
    });
    // this.addEventListener("dragstart", (e) => {});
  }
  connectedCallback() {
    super.connectedCallback();
    // TODO update on change
    if (this.isConnected && this.editor.interactionMode === "block")
      this.setAttribute("draggable", true);
  }
  set node(v) {
    super.node = v;
    if (v.named) this.setAttribute("type", v.type);
    if (v.field) this.setAttribute("field", v.field);
    else this.removeAttribute("field");
    // FIXME js specific
    if (
      [
        "class_declaration",
        "function_declaration",
        "method_definition",
      ].includes(v.type)
    )
      this.setAttribute("scope", true);
  }
  findTextForCursor(cursor) {
    for (const child of this.children) {
      if (["SB-TEXT", "SB-BLOCK"].includes(child.tagName)) {
        const [start, end] = child.node.range;
        if (start <= cursor && end >= cursor) {
          if (child.tagName === "SB-BLOCK")
            return child.findTextForCursor(cursor);
          else return child;
        }
      }
    }
    return null;
  }
  anyTextForCursor() {
    const recurse = (n) => {
      for (const child of n.shadowRoot?.children ?? n.children) {
        if (child.tagName === "SB-TEXT") return child;
        else {
          const ret = recurse(child);
          if (ret) return ret;
        }
      }
    };
    return recurse(this);
  }

  // insert a node at the given index, skipping over any
  // elements that do not correspond to nodes
  // FIXME may want to consider mapping via .node instead
  insertNode(node, index) {
    for (const child of this.childNodes) {
      if (index === 0) {
        this.insertBefore(node, child);
        return;
      }
      if (
        child instanceof Replacement ||
        child instanceof Block ||
        child instanceof Text
      ) {
        index--;
      }
    }
    this.appendChild(node);
  }
}

// Text is the view for a terminal node.
export class Text extends _EditableElement {
  static observedAttributes = ["text"];
  constructor() {
    super();
    this.hash = nextHash();
  }
  rangeParams(offset) {
    if (this.childNodes.length === 0)
      this.appendChild(document.createTextNode(""));
    return [this.childNodes[0], offset - this.getRange()[0]];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "text") {
      this.textContent = newValue;
    }
  }
  findTextForCursor(cursor) {
    const [start, end] = this.range;
    if (start <= cursor && end >= cursor) return this;
    else return null;
  }
}
