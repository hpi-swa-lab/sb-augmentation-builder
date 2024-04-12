import { useContext, useEffect, useMemo } from "../external/preact-hooks.mjs";
import { createContext, h, render } from "../external/preact.mjs";
import { rangeEqual, takeWhile } from "../utils.js";
import { SBList } from "./model.js";

export function useStickyReplacementValidator(replacement) {
  useValidator(
    () =>
      replacement.node.connected && replacement.node.exec(...replacement.query),
    [replacement.node, replacement.query],
  );
}

export function useValidator(func, deps) {
  if (deps === undefined)
    throw new Error("no dependencies for useValidator provided");
  const owner = useContext(ShardContext);
  useEffect(() => {
    owner.editor.registerValidator(func);
    return () => owner.editor.unregisterValidator(func);
  }, deps);
}

export const SelectionInteraction = {
  Skip: "skip",
  Point: "point",
  StartAndEnd: "startAndEnd",
};
export const DeletionInteraction = {
  Character: "character",
  Full: "full",
  SelectThenFull: "selectThenFull",
};

const ShardContext = createContext(null);

export function Shard({ node, sticky, ...props }) {
  if (!node.editor) throw new Error("node has become disconnected");

  useValidator(() => (sticky ? node.connected : true), [node, sticky]);

  return h(node.editor.constructor.shardTag, {
    node,
    key: node.id,
    editor: node.editor,
    ...props,
  });
}

export function ShardList({ list, sticky, ...props }) {
  const node = useMemo(() => new SBList(list), list);

  useValidator(
    () => (sticky ? list.every((n) => n.connected) : true),
    [...list, sticky],
  );

  return h(Shard, { node, ...props });
}

export function Slot({ node, ...props }) {
  const list = [
    ...takeWhile(
      node.parent.children.slice(0, node.siblingIndex).reverse(),
      (c) => c.isWhitespace(),
    ),
    node,
    ...takeWhile(node.parent.children.slice(node.siblingIndex + 1), (c) =>
      c.isWhitespace(),
    ),
  ];

  return h(ShardList, { list, ...props });
}

export class SBReplacement extends HTMLElement {
  editor = null;
  props = {};

  _selectionAtStart = false;
  _selectionInteraction = SelectionInteraction.Skip;
  deletion = DeletionInteraction.Character;

  set selection(v) {
    console.assert(v !== undefined);
    this._selectionInteraction = v;
    if (this._selectionInteraction !== SelectionInteraction.Skip) {
      this.tabIndex = -1;
      this.setAttribute("sb-editable", "");
    } else {
      this.removeAttribute("sb-editable");
      this.tabIndex = undefined;
    }
  }

  get selectable() {
    return this._selectionInteraction !== SelectionInteraction.Skip;
  }

  get range() {
    return this.editor.adjustRange(this.node.range, false);
  }

  get sourceString() {
    return this.node.sourceString;
  }

  get isNodeReplacement() {
    return true;
  }

  *allViews() {
    yield this;
  }

  onKeyDown(e) {
    if (e.target !== this) return;
    if (this._selectionInteraction === SelectionInteraction.Skip) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      return this.editor.moveCursor(false, e.shiftKey);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      return this.editor.moveCursor(true, e.shiftKey);
    }

    if (
      e.key === "Backspace" &&
      this.deletion === DeletionInteraction.SelectThenFull &&
      document.activeElement === this
    ) {
      e.preventDefault();
      this.editor.applyChanges([
        {
          from: this.range[0],
          to: this.range[1],
          insert: "",
          selectionRange: [this.range[0], this.range[0]],
        },
      ]);
      return;
    }

    if (this.shard.onShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
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
          ...this.props,
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
    switch (this._selectionInteraction) {
      case SelectionInteraction.Point:
        yield {
          element: this,
          elementOffset: true,
          index: this.range[0],
        };
        return;
      case SelectionInteraction.StartAndEnd:
        yield {
          element: this,
          elementOffset: true,
          index: this.range[0],
        };
        yield* super.cursorPositions();
        yield {
          element: this,
          elementOffset: false,
          index: this.range[0],
        };
        return;
      case SelectionInteraction.Skip:
        yield* super.cursorPositions();
        return;
    }
  }

  *shardCursorPositions(state) {
    state.index += this.range[1] - this.range[0] - 1;
    yield [this.parentNode, [...this.parentNode.childNodes].indexOf(this) + 1];
    state.index++;
  }

  candidatePositionForIndex(index, other) {
    if (rangeEqual(this.range, [index, other]))
      return {
        distance: 0,
        position: {
          element: this,
          elementOffset: index === this.range[0],
          index,
        },
      };
    else return { position: null, distance: Infinity };
  }

  scrollToShow() {}

  handleDelete(pos) {
    if (this.editor.readonly) return;

    switch (this.deletion) {
      case DeletionInteraction.Character:
        this.editor.applyChanges([
          {
            from: pos,
            to: pos + 1,
            insert: "",
            selectionRange: [pos, pos],
          },
        ]);
        break;
      case DeletionInteraction.Full:
        this.editor.applyChanges([
          {
            from: this.range[0],
            to: this.range[1],
            insert: "",
            selectionRange: [this.range[0], this.range[0]],
          },
        ]);
        break;
      case DeletionInteraction.SelectThenFull:
        this._selectionAtStart = false;
        this.focus();
        break;
    }
  }

  select() {
    this.focus();
  }
}

customElements.define("sb-replacement", SBReplacement);
