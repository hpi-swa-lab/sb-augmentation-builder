import { nextHash, orParentThat } from "../../utils.js";

// _EditableElement is the superclass for Text and Block elements, grouping
// common functionality.
class _EditableElement extends HTMLElement {
  markers = new Map();

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

  get isNodeView() {
    return true;
  }

  isReplacementAllowed(tag) {
    return (
      !this.disabledReplacements?.has(tag.toUpperCase()) &&
      !(orParentThat(this, (x) => x.isNodeReplacement)?.node === this.node)
    );
  }

  setAllowReplacement(tagName, allow) {
    if (allow) {
      this.disabledReplacements?.delete(tagName.toUpperCase());
    } else {
      (this.disabledReplacements ??= new Set()).add(tagName.toUpperCase());
    }
  }

  get range() {
    return this.node.range;
  }

  select() {
    this.editor.selectRange(...this.range);
  }

  *allViews() {
    yield this;
    for (const child of this.children) {
      if (child.isNodeView) {
        yield* child.allViews();
      } else if (child.isNodeReplacement) {
        yield child;
      }
    }
  }

  *andAllParents() {
    let current = this;
    while (current?.isNodeView) {
      yield current;
      current = current.parentElement;
    }
  }

  findTextForCursor(cursor) {
    for (const child of this.children) {
      if (["SB-TEXT", "SB-BLOCK"].includes(child.tagName)) {
        const [start, end] = child.node.range;
        if (start <= cursor && end >= cursor) {
          if (child.tagName === "SB-BLOCK") {
            const candidate = child.findTextForCursor(cursor);
            if (candidate) return candidate;
          } else return child;
        }
      }
    }
    return null;
  }

  *shardCursorPositions(state) {
    for (const child of this.children) {
      if (child.shardCursorPositions) yield* child.shardCursorPositions(state);
    }
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

  connectedCallback() {
    this.addEventListener("dblclick", this.onDoubleClick);
  }
  disconnectedCallback() {
    this.removeEventListener("dblclick", this.onDoubleClick);
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
        start &&
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

  // insert a node at the given index, skipping over any
  // elements that do not correspond to nodes
  // FIXME may want to consider mapping via .node instead
  insertNode(node, index) {
    for (const child of this.childNodes) {
      if (index === 0) {
        this.insertBefore(node, child);
        return;
      }
      if (child.isNodeReplacement || child.isNodeView) {
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
    return [this.childNodes[0], offset - this.range[0]];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "text") {
      this.textContent = newValue;
    }
  }
  findTextForCursor(cursor) {
    let [start, end] = this.range;
    if (start <= cursor && end >= cursor) return this;
    else return null;
  }

  *shardCursorPositions(state) {
    if (this.childNodes.length === 0)
      this.appendChild(document.createTextNode(""));

    for (const child of this.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (let i = 1; i <= child.textContent.length; i++) {
          yield [child, i];
          state.index++;
        }
      } else if (child.shardCursorPositions) {
        yield* child.shardCursorPositions(state);
      }
    }
  }
}

export class Placeholder extends _EditableElement {
  get range() {
    return null;
  }

  *shardCursorPositions(state) {
    for (const child of this.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (let i = 1; i <= child.textContent.length; i++) {
          yield [child, i];
          state.index++;
        }
      } else if (child.shardCursorPositions) {
        yield* child.shardCursorPositions(state);
      }
    }
  }
}

export class ViewList extends _EditableElement {
  insertNode(node, index) {
    for (const child of this.childNodes) {
      if (index === 0) {
        this.insertBefore(node, child);
        return;
      }
      if (child.isNodeReplacement || child.isNodeView) {
        index--;
      }
    }
    this.appendChild(node);
  }
}
