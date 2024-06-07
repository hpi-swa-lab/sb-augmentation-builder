import { Vitrail, Pane } from "./vitrail";

export async function addVitrailToLivelyEditor(livelyEditor, augmentations) {
  function paneFromLively(livelyEditor, vitrail, fetchAugmentations) {
    let isMyChange = false;
    const cm = livelyEditor.cm;
    const markers = new Map();

    const doChange = (func) => {
      isMyChange = true;
      func();
      isMyChange = false;
    };

    const pane = new Pane({
      vitrail,
      view: livelyEditor,
      host: livelyEditor,
      fetchAugmentations,
      getLocalSelectionIndices: () => [
        cm.indexFromPos(cm.getCursor("from")),
        cm.indexFromPos(cm.getCursor("to")),
      ],
      syncReplacements: () => {
        for (const replacement of pane.replacements) {
          if (markers.has(replacement)) {
            const marker = markers.get(replacement);
            const range = replacement.range;
            const { from, to } = marker.find();
            if (
              range[0] - pane.startIndex === cm.indexFromPos(from) &&
              range[1] - pane.startIndex === cm.indexFromPos(to)
            ) {
              continue;
            }
            marker.clear();
          }
          const marker = cm.doc.markText(
            cm.posFromIndex(replacement.range[0]),
            cm.posFromIndex(replacement.range[1]),
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
        cm.focus();
        cm.setSelection(cm.posFromIndex(anchor), cm.posFromIndex(head));
      },
      applyLocalChanges: (changes) => {
        for (const change of changes) {
          let from = cm.posFromIndex(change.from);
          let to = cm.posFromIndex(change.to);
          doChange(() => cm.replaceRange(change.insert, from, to));
        }
      },
      getText: () => livelyEditor.value,
      setText: (text) => doChange(() => (livelyEditor.value = text)),
      hasFocus: () => cm.hasFocus(),
    });

    cm.on("beforeSelectionChange", (cm, e, sel) => {
      if (e.origin !== "+move") return;
      let delta = Math.sign(
        cm.indexFromPos(e.ranges[0].head) -
          cm.indexFromPos(cm.getCursor("from")),
      );

      // if we hit a boundary, codemirror reports this via hitSide but does not move the ranges
      if (delta === 0) {
        console.assert(e.ranges[0].head.hitSide);
        delta = cm.indexFromPos(e.ranges[0].head) === 0 ? -1 : 1;
      }

      pane.moveCursor(delta > 0);
    });

    cm.on("keypress", (cm, e) => {
      if (e.key === "Backspace") {
        pane.handleDeleteAtBoundary(false);
        e.preventDefault();
      }
      if (e.key === "Delete") {
        pane.handleDeleteAtBoundary(true);
        e.preventDefault();
      }
    });

    cm.on("change", (cm, e) => {
      if (isMyChange) return;

      const from = cm.indexFromPos(e.from);
      const to = cm.indexFromPos(e.to);
      const insert = e.text.join("");

      const change = {
        from: from + pane.startIndex,
        to: to + pane.startIndex,
        insert,
        sourcePane: pane,
        inverse: {
          from: e.from + pane.startIndex,
          to: e.from + pane.startIndex + insert.length,
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
      editor.style = "display:inline-block; border: 1px solid gray";
      editor.className = node == node.root ? "" : "shard";
      return paneFromLively(editor, v, fetchAugmentations);
    },
    showValidationPending: () => {
      // TODO
    },
  });

  await v.connectHost(paneFromLively(livelyEditor, v, () => augmentations));
  return v;
}
