import { Vitrail, Pane, replacementRange } from "./vitrail.ts";

export async function addVitrailToLivelyEditor(livelyCodeMirror, augmentations) {
  function paneFromLively(livelyCodeMirror, vitrail, fetchAugmentations) {
    if (!livelyCodeMirror.editor) livelyCodeMirror.editView("");
    
    // lively.sleep(0).then(() => livelyCodeMirror.editor.refresh())
    
    // lively.sleep(0).then(() => {
    //   // lively.warn("paneFromLively " + livelyCodeMirror.parentElement)
    //   // livelyCodeMirror.editor.refresh()
    // })
    
    
    const cm = livelyCodeMirror.editor;
    const markers = new Map();

    const pane = new Pane({
      vitrail,
      view: livelyCodeMirror,
      host: livelyCodeMirror,
      fetchAugmentations,
      getLocalSelectionIndices: () => [
        cm.indexFromPos(cm.getCursor("from")),
        cm.indexFromPos(cm.getCursor("to")),
      ],
      syncReplacements: () => {
        for (const replacement of pane.replacements) {
          const range = replacementRange(replacement, vitrail);
          if (markers.has(replacement)) {
            const marker = markers.get(replacement);
            const pos = marker.find();
            if (
              pos &&
              range[0] - pane.startIndex === cm.indexFromPos(pos.from) &&
              range[1] - pane.startIndex === cm.indexFromPos(pos.to)
            ) {
              continue;
            }
            marker.clear();
          }
          const marker = cm.doc.markText(
            cm.posFromIndex(range[0] - pane.startIndex),
            cm.posFromIndex(range[1] - pane.startIndex),
            { replacedWith: replacement.view },
          );
          markers.set(replacement, marker);
        }

        for (const [replacement, marker] of [...markers.entries()]) {
          if (!pane.replacements.includes(replacement)) {
            marker.clear();
            markers.delete(replacement);
          }
        }
      },
      focusRange: (head, anchor) => {
        console.log("focusRange")
        window.timeStart = performance.now()
        queueMicrotask(() => cm.focus());
        cm.setSelection(cm.posFromIndex(anchor), cm.posFromIndex(head));
      },
      applyLocalChanges: function (changes) {
        for (const change of changes) {
          let from = cm.posFromIndex(change.from);
          let to = cm.posFromIndex(change.to);
          cm.replaceRange(change.insert, from, to);
        }
        this.syncReplacements();
      },
      getText: () => cm.getValue(),
      setText: (text) => cm.setValue(text),
      hasFocus: () => cm.hasFocus(),
    });

    cm.on("keydown", (cm, e) => {
      if (e.key === "ArrowLeft") {
        if (pane.moveCursor(false)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      if (e.key === "ArrowRight") {
        if (pane.moveCursor(true)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      if (e.key === "Backspace") {
        if (pane.handleDeleteAtBoundary(false)) {
          lively.warn("NO BACKSPACE");
          e.preventDefault();
        }
      }
      if (e.key === "Delete") {
        if (pane.handleDeleteAtBoundary(true)) e.preventDefault();
      }
    });

    let changeRange = null;
    cm.on("beforeChange", (cm, e) => {
      if (e.origin === "setValue" || !e.origin) return;
      // to resolve the correct indices, we need to calculate the index before
      // the change is applied. However, Vitrail expects the change to have been
      // applied when we inform it of a change. So we need both listeners.
      changeRange = [cm.indexFromPos(e.from), cm.indexFromPos(e.to)];
    });
    cm.on("change", (_cm, e) => {
      if (e.origin === "setValue" || !e.origin) return;

      const [from, to] = changeRange;
      const insert = e.text.join("");

      const change = {
        from: from + pane.startIndex,
        to: to + pane.startIndex,
        insert,
        sourcePane: pane,
        inverse: {
          from: from + pane.startIndex,
          to: from + pane.startIndex + insert.length,
          insert: e.removed,
        },
      };

      v.applyChanges([change]);
    });

    return pane;
  }

  const v = new Vitrail({
    createPane: (fetchAugmentations) => {
      const editor = document.createElement("lively-code-mirror");
      // Check if we are in Lively, otherwise attach an external CodeMirror
      if (!editor.editView) {
        
        editor.editor = CodeMirror(editor, { value: "asd" });
        editor.editor.display.wrapper.style.height = "auto";
        onEnterDOM(editor, () => editor.editor.refresh());
      }
      editor.classList.add("shard");
      editor.style = "display:inline-block; border: 1px solid gray";
      return paneFromLively(editor, v, fetchAugmentations);
    },
    showValidationPending: (pending) => {
      console.log("Validation Pending:", pending);
    },
  });

  await v.connectHost(paneFromLively(livelyCodeMirror, v, () => augmentations));
  return v;
}

function onEnterDOM(element, cb) {
  const observer = new MutationObserver(() => {
    cb();
    observer.disconnect();
  });
  observer.observe(element, { childList: true, subtree: true });
}
