import { Extension } from "../core/extension.js";

export const undo = new Extension()
  .registerExtensionConnected((editor) => {
    editor.setData("history", new EditHistory());
  })
  .registerShortcut("undo", (x) => x.editor.data("history").undo(x.editor))
  .registerShortcut("redo", (x) => x.editor.data("history").redo(x.editor))
  .registerChangesApplied(
    (changes, oldSource, _newSource, node, _editBuffer, oldSelection) =>
      node.editor.data("history").noteChanges(changes, oldSource, oldSelection),
  )
  .registerSelection((node, view, editor) => editor.data("history").push());

class EditHistory {
  undoStack = [];
  redoStack = [];

  pendingChanges = null;

  noteChanges(changes, oldSource, oldSelection) {
    if (!this.pendingChanges && changes.every((c) => !c.ignoreInHistory))
      this.pendingChanges = [oldSource, oldSelection];
  }

  push() {
    if (this.pendingChanges) {
      this.redoStack = [];
      this.undoStack.push({
        sourceString: this.pendingChanges[0],
        selectionRange: this.pendingChanges[1],
      });
      this.pendingChanges = null;
    }
  }

  undo(editor) {
    this.push();
    const item = this.popUndo();
    if (item) {
      editor.applyChanges([
        {
          from: 0,
          to: editor.range[1],
          insert: item.sourceString,
          selectionRange: item.selectionRange,
          ignoreInHistory: true,
        },
      ]);
    }
  }

  popUndo() {
    if (this.undoStack.length === 0) return;
    const item = this.undoStack.pop();
    this.redoStack.push(item);
    return item;
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const item = this.redoStack.pop();
    this.undoStack.push(item);
    return item;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
