import { useContext, useEffect } from "../external/preact-hooks.mjs";
import { createContext, h, render } from "../external/preact.mjs";
import { orParentThat } from "../utils.js";
import { shard } from "../view/widgets.js";
import { BaseShard } from "./shard.js";

const ShardContext = createContext(null);
export function StickyShard({ node, ...props }) {
  const owner = useContext(ShardContext);
  useEffect(() => {
    owner.editor.markSticky(node, true);
    return () => owner.editor.markSticky(node, false);
  });
  return shard(node, props);
}
export const Shard = ({ node, ...props }) => {
  if (!node.editor) throw new Error("node has become disconnected");
  return h(node.editor.constructor.shardTag, {
    node,
    key: node.id,
    editor: node.editor,
    ...props,
  });
};

export class SBReplacement extends HTMLElement {
  editor = null;

  _selectionAtStart = false;

  set selectable(v) {
    if (v) {
      this.tabIndex = -1;
      this.setAttribute("sb-editable", "");
    } else {
      this.removeAttribute("sb-editable");
      this.tabIndex = undefined;
    }
  }

  get range() {
    return this.editor.adjustRange(this.node.range, false);
  }

  get shard() {
    return orParentThat(this, (p) => p instanceof BaseShard);
  }

  get sourceString() {
    return this.node.sourceString;
  }

  get isNodeReplacement() {
    return true;
  }

  takeCursor(atStart) {
    this.focus();
    this._selectionAtStart = atStart;
  }

  *allViews() {
    yield this;
  }

  onKeyDown(e) {
    if (!this.hasAttribute("sb-editable")) return;

    if (e.key === "ArrowLeft" && this._selectionAtStart) {
      e.preventDefault();
      this.editor.moveCursor(false, e.shiftKey);
    }
    if (e.key === "ArrowRight" && !this._selectionAtStart) {
      e.preventDefault();
      this.editor.moveCursor(true, e.shiftKey);
    }
  }

  connectedCallback() {
    this.setAttribute("contenteditable", "false");
    this.addEventListener(
      "keydown",
      (this._keyListener = this.onKeyDown.bind(this)),
    );
    this.style.verticalAlign = "top";
    this.render();
  }

  render() {
    console.assert(this.shard);
    render(
      h(
        ShardContext.Provider,
        { value: this.shard },
        h(this.component, {
          ...(this.props ?? {}),
          node: this.node,
          replacement: this,
        }),
      ),
      this,
    );
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this._keyListener);
  }

  *cursorPositions() {
    if (this.hasAttribute("sb-editable"))
      yield {
        element: this,
        elementOffset: true,
        index: this.range[0],
      };
    yield* super.cursorPositions();
    if (this.hasAttribute("sb-editable"))
      yield {
        element: this,
        elementOffset: false,
        index: this.range[0],
      };
  }
}

customElements.define("sb-replacement", SBReplacement);
