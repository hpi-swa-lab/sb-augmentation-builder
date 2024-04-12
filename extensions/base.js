import { LoadOp, RemoveOp, UpdateOp } from "../core/diff.js";
import { Extension } from "../core/extension.js";
import { exec, rangeEqual, rangeShift, withDo } from "../utils.js";
import { Widget, h } from "../view/widgets.js";
import { undo } from "./undo.js";

class DetachedShard extends Widget {
  noteProcessed(trigger, node) {
    if (trigger === "replacement") this.shard.update(this.shard.source);
  }
  get shard() {
    return this.childNodes[0];
  }
  set shard(value) {
    this.appendChild(value);
  }
}
customElements.define("sb-detached-shard", DetachedShard);

const BRACE_PAIRS = {
  "{": "}",
  "[": "]",
  "(": ")",
};
const PAIRS = {
  ...BRACE_PAIRS,
  '"': '"',
  "'": "'",
};
const REVERSED_PAIRS = Object.fromEntries(
  Object.entries(PAIRS).map(([a, b]) => [b, a]),
);
const REVERSED_BRACE_PAIRS = Object.fromEntries(
  Object.entries(BRACE_PAIRS).map(([a, b]) => [b, a]),
);

function indexOfLastNewLine(string, index) {
  let i = index;
  while (i >= 0 && string[i] !== "\n") i--;
  return i;
}

function indexOfNextNewLine(string, index) {
  let i = index;
  while (i <= string.length && string[i] !== "\n") i++;
  return i;
}

function indexOfIndentEnd(string, index) {
  let i = indexOfLastNewLine(string, index) + 1;
  while (i <= index && string[i].match(/[ \t]/)) i++;
  return i;
}

export const matchingParentheses = new Extension()
  // skip over closing parentheses
  // FIXME may want to do this only for auto-inserted parentheses
  .registerChangeFilter(([change], { sourceString }) => {
    if (
      REVERSED_BRACE_PAIRS[change.insert] &&
      sourceString[change.from] === change.insert
    ) {
      change.insert = "";
    }
  })

  // insert matching parentheses
  .registerChangeFilter(([change], { sourceString }) => {
    if (PAIRS[change.insert]) {
      const match = PAIRS[change.insert];
      if (change.from === change.to) change.insert += match;
      else {
        change.insert = `${change.insert}${sourceString.slice(
          change.from,
          change.to,
        )}${match}`;
        change.selectionRange = [change.from + 1, change.to + 1];
      }
    }
  })

  // delete matching parentheses together
  .registerChangeFilter(([change], { sourceString }) => {
    const match = PAIRS[change.delete];
    if (match && sourceString[change.from + 1] === match) {
      change.delete += match;
      change.to++;
    }
  })

  // indent on newline
  .registerChangeFilter(([change], { sourceString, tabSize }) => {
    if (change.insert === "\n") {
      function findLastIndent(string, index) {
        return string.slice(
          indexOfLastNewLine(string, index) + 1,
          indexOfIndentEnd(string, index),
        );
      }

      let indent = findLastIndent(sourceString, change.from - 1);
      let offset = indent.length;
      const prev = sourceString[change.from - 1];
      if (PAIRS[prev]) {
        const orig = indent;
        indent += " ".repeat(tabSize);
        if (sourceString[change.from] === PAIRS[prev]) indent += "\n" + orig;
        offset += tabSize;
      }
      change.insert += indent;
      change.selectionRange[0] += offset;
      change.selectionRange[1] += offset;
    }
  });

const suggestions = new Extension()
  .registerShortcut(
    "useSuggestion",
    (x, view, e) => x.editor.useSuggestion(),
    [(x) => x.editor.isSuggestionsListVisible()],
    1,
  )
  .registerShortcut(
    "nextSuggestion",
    (x, view, e) => x.editor.moveSuggestion(1),
    [(x) => x.editor.canMoveSuggestion(1)],
  )
  .registerShortcut(
    "previousSuggestion",
    (x, view, e) => x.editor.moveSuggestion(-1),
    [(x) => x.editor.canMoveSuggestion(-1)],
  )
  .registerShortcut(
    "dismissSuggestions",
    (x, view, e) => x.editor.clearSuggestions(),
    [(x) => x.editor.isSuggestionsListVisible()],
    1,
  );

export const base = new Extension()
  .copyFrom(undo)
  .copyFrom(suggestions)

  // AST-select up-down
  .registerShortcut(
    "selectNodeUp",
    (x, view, e) => {
      const editor = x.editor;
      let target = x;

      if (!x.isFullySelected) {
        editor.setData("selectionDownRange", editor.selectionRange);
        editor.data("selectionDownList", () => []).push(target);
        target.select(view);
        return;
      }

      while (target.parent && rangeEqual(target.range, target.parent.range))
        target = target.parent;

      let parent = target.parent;
      while (parent && !editor.isShowing(parent)) parent = parent.parent;

      if (!parent) return;
      editor.data("selectionDownList", () => []).push(parent);

      parent.select(view);
    },
    [(x) => x.editor.selectedNode],
  )
  .registerShortcut(
    "selectNodeDown",
    (x, view, e) => {
      if (!view) return;
      const list = x.editor.data("selectionDownList", () => []);
      list.pop();
      if (list.length <= 1) {
        view.editor.selectRange(x.editor.data("selectionDownRange"));
      } else {
        const target = list[list.length - 1];
        (target ?? x.childBlock(0) ?? x.childNode(0))?.select(view);
      }
    },
    [(x) => x.editor.selectedNode],
  )
  .registerSelection((node, view, editor) => {
    const list = editor.data("selectionDownList", () => []);
    if (
      list[list.length - 1] !== node
      // in particular, if we are triggering multiple times for the same
      // range, we want to ignore anything but the first time
      // (!node.children[0] || !rangeEqual(node.range, node.children[0].range))
    ) {
      editor.setData("selectionDownList", []);
    }
  })

  .registerShortcut(
    "popNodeOut",
    (x, view, e) => {
      const window = document.createElement("sb-window");
      const detached = e.createWidget("sb-detached-shard");
      detached.shard = x.editor.createShardFor(x);
      window.appendChild(detached);
      x.editor.after(window);
    },
    [(x) => x.editor.selectedNode],
  )

  .registerShortcut("indentLess", ({ editor }, view, e) => {
    // TODO if we have a selection, shift whole selection
    const index = editor.selectionRange[0] - 1;
    const start = indexOfLastNewLine(editor.sourceString, index);
    const end = indexOfIndentEnd(editor.sourceString, index);

    if (end >= start + editor.tabSize)
      editor.applyChanges([
        {
          from: end - editor.tabSize,
          to: end,
          insert: "",
          selectionRange: rangeShift(editor.selectionRange, -editor.tabSize),
        },
      ]);
  })

  .registerShortcut("indentMore", ({ editor }, view, e) => {
    // TODO if we have a selection, shift whole selection
    editor.applyChanges([
      {
        from: editor.selectionRange[0],
        to: editor.selectionRange[0],
        insert: " ".repeat(editor.tabSize),
        selectionRange: rangeShift(editor.selectionRange, editor.tabSize),
      },
    ]);
  })

  .copyFrom(matchingParentheses)

  // .registerQuery("shortcut", (e) => [
  //   needsSelection,
  //   (x) => {
  //     function callback(shift) {
  //       return function (node, view) {
  //         const selection = node.editor.selectionRange;
  //         const src = node.root.sourceString;
  //         const start = indexOfNextNewLine(src, selection[0]);
  //         let index = indexOfIndentEnd(src, start - 1);
  //         if (index === selection[0])
  //           index = indexOfLastNewLine(src, start - 1) + 1;
  //         node.editor.selectRange(
  //           index,
  //           shift ? selection[1] : index,
  //           view.shard,
  //           false
  //         );
  //       };
  //     }
  //     e.registerShortcut(x, "home", callback(false));
  //     e.registerShortcut(x, "homeSelect", callback(true));
  //   },
  // ])

  .registerCaret((e, shard) => {
    // FIXME storing this info in the editor does not work for multiple shards
    e.data("bracket-highlight", () => []).forEach((c) =>
      shard.cssClass(c, "highlight", false),
    );
    e.setData("bracket-highlight", []);

    exec(
      e.node,
      (x) => e.selectionRange[0] === e.selectionRange[1],
      (x) => x.leafForPosition(e.selectionRange[0]),
      (l) => {
        do {
          l = l.parent;
        } while (
          l &&
          !(
            l.children.some((c) => BRACE_PAIRS[c.text]) &&
            l.children.some((c) => REVERSED_BRACE_PAIRS[c.text])
          )
        );
        return l;
      },
      (l) => [
        l.children.find((c) => BRACE_PAIRS[c.text]),
        l.children.find((c) => REVERSED_BRACE_PAIRS[c.text]),
      ],
      (pair) => {
        e.setData("bracket-highlight", pair);
        pair.forEach((c) => shard.cssClass(c, "highlight", true));
      },
    );
  })

  .registerCss(
    "highlight",
    [
      (x) => x.isText,
      (x) => {
        const text = x.editor.selectedNode?.text;
        return !!text && x.text === text;
      },
      // contains at least one of these
      (x) => !!x.text.match(/["'A-Za-z0-9_\-:]+/),
    ],
    1,
  )
  .registerSelection((node, view, editor) =>
    editor.updateMarker("css:highlight"),
  );

const words = new Map();
function noteWord(word) {
  if (word.match(/^[A-Za-z][A-Za-z_-]+$/))
    words.set(word, (words.get(word) ?? 0) + 1);
}
function forgetWord(word) {
  const count = words.get(word);
  if (count === undefined) return;
  if (count <= 1) words.delete(word);
  else words.set(word, count - 1);
}
export const identifierSuggestions = new Extension()
  .registerChangesApplied((_changes, _oldSource, _newSource, root) => {
    const x = root.editor.selectedNode;
    if (x.isText)
      root.editor.addSuggestionsAndFilter(
        x,
        [...words.keys()].map((label) => ({ label })),
      );
  })
  .registerExtensionConnected((editor) => {
    for (const x of editor.node.allNodes()) noteWord(x.text);
  })
  .registerChangesApplied((_changes, _oldSource, _newSource, _root, diff) => {
    diff.opsDo((op) => {
      if (op instanceof UpdateOp && op.node.isText) {
        forgetWord(op.oldText);
        noteWord(op.text);
      }
      if (op instanceof RemoveOp && op.node.isText) {
        forgetWord(op.node.text);
      }
      if (op instanceof LoadOp && op.node.isText) {
        noteWord(op.node.text);
      }
    });
  });

export const doubleClickToCollapse = new Extension().registerDoubleClick(
  (e) => [
    (x) => x.named,
    (x) => {
      // TODO: should only replace the view that was clicked on
      x.viewsDo((v) => e.installReplacement(v, "sb-collapse"));
      e.stopPropagation();
    },
  ],
);

// class SBCollapse extends Replacement {
//   update(node) {
//     const src = node.sourceString;
//     const max = Math.min(
//       20,
//       withDo(src.indexOf("\n"), (n) => (n === -1 ? Infinity : n))
//     );
//     this.render(
//       h(
//         "span",
//         {
//           onClick: () => this.uninstall(),
//           style: {
//             background: "#eee",
//             border: "1px solid #ccc",
//             borderRadius: "6px",
//             padding: "0 0.5rem",
//             fontStyle: "italic",
//             cursor: "pointer",
//           },
//         },
//         src.slice(0, max),
//         src.length > max && "…"
//       ),
//       this
//     );
//   }
// }
