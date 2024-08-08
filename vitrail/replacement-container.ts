import { adjacentCursorPosition } from "../view/focus";
import {
  AugmentationInstance,
  Vitrail,
  DeletionInteraction,
  SelectionInteraction,
  replacementRange,
} from "./vitrail";

export class VitrailReplacementContainer extends HTMLElement {
  augmentationInstance: AugmentationInstance<any>;
  vitrail: Vitrail<any>;

  get deletion() {
    return (
      this.augmentationInstance.augmentation.deletionInteraction ??
      DeletionInteraction.SelectThenFull
    );
  }

  get selection() {
    return (
      this.augmentationInstance.augmentation.selectionInteraction ??
      SelectionInteraction.StartAndEnd
    );
  }

  get range() {
    return replacementRange(this.augmentationInstance, this.vitrail);
  }

  _selectedAtStart = false;

  _keyListener: (e: KeyboardEvent) => void;
  _clickListener: (e: MouseEvent) => void;

  connectedCallback() {
    this.addEventListener(
      "keydown",
      (this._keyListener = this.onKeyDown.bind(this)),
    );
    this.addEventListener(
      "click",
      (this._clickListener = this.onClick.bind(this)),
    );
    this.setAttribute("tabindex", "-1");
    this.style.verticalAlign = "top";
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this._keyListener);
    this.removeEventListener("click", this._clickListener);
  }

  *cursorPositions() {
    // we may currently be offscreen, e.g. when temporarily detached
    // during pending changes
    if (!this.isConnected) return;

    switch (this.selection) {
      case SelectionInteraction.Start:
        yield { element: this, index: this.range[0] };
        // @ts-expect-error
        yield* super.cursorPositions();
        return;
      case SelectionInteraction.StartAndEnd:
        yield { element: this, index: this.range[0] };
        // @ts-expect-error
        yield* super.cursorPositions();
        yield { element: this, index: this.range[1] };
        return;
      case SelectionInteraction.Skip:
        // @ts-expect-error
        yield* super.cursorPositions();
        return;
    }
  }

  _cursorRoot() {
    return this.vitrail._cursorRoots().find((r) => r.contains(this));
  }

  _focusAdjacent(forward: boolean) {
    const pos = adjacentCursorPosition(
      {
        root: this._cursorRoot(),
        element: this,
        index: this.range[this._selectedAtStart ? 0 : 1],
      },
      forward,
    );
    if (pos) (pos.element as any).focusRange(pos.index, pos.index);
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.target !== this) return;
    if (this.selection === SelectionInteraction.Skip) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this._focusAdjacent(false);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      this._focusAdjacent(true);
      return;
    }

    if (e.key === "Backspace" && document.activeElement === this) {
      e.preventDefault();
      this._deleteFull();
      return;
    }
  }

  _deleteFull() {
    const range = this.range;
    const insert = this.augmentationInstance.match.props.nodes
      .map((n) => n.sourceString)
      .join("");
    this.vitrail.applyChanges([
      {
        from: range[0],
        to: range[1],
        insert: "",
        selectionRange: [range[0], range[0]],
        inverse: { from: range[0], to: range[0], insert },
        intentDeleteNodes: this.augmentationInstance.match.props.nodes,
      },
    ]);
  }

  handleDelete(forward: boolean) {
    switch (this.deletion) {
      case DeletionInteraction.Character:
        const pos = forward ? this.range[0] : this.range[1] - 1;
        this.vitrail.applyChanges([
          {
            from: pos,
            to: pos + 1,
            insert: "",
            selectionRange: [pos, pos],
            inverse: {
              from: pos,
              to: pos,
              insert: this.vitrail.sourceString[pos],
            },
          },
        ]);
        break;
      case DeletionInteraction.Full:
        this._deleteFull();
        break;
      case DeletionInteraction.SelectThenFull:
        this.focus();
        break;
    }
  }

  focusRange(head: number, anchor: number) {
    this._selectedAtStart = head === this.range[0];
    this.focus();
  }

  getSelection() {
    return this._selectedAtStart
      ? [this.range[0], this.range[0]]
      : [this.range[1], this.range[1]];
  }

  onClick(e: MouseEvent) {
    // FIXME doesn't work yet
    if (e.target !== this) return;
    if (this.selection === SelectionInteraction.Skip) return;
    this.focus();
    e.stopPropagation();
    e.preventDefault();
  }
}
customElements.define(
  "vitrail-replacement-container",
  VitrailReplacementContainer,
);
