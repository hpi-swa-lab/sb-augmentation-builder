import { SBBlock, SBLanguage, SBNode, SBText } from "../core/model.js";
import { h } from "../external/preact.mjs";
import {
  metaexec,
  query,
  first,
  also,
  all,
} from "../sandblocks/query-builder/functionQueries.js";
import { nodesSourceString } from "../utils.js";
import {
  DeletionInteraction,
  SelectionInteraction,
} from "../vitrail/vitrail.ts";

class _SBWhitespaceModel extends SBLanguage {
  constructor() {
    super({ name: "whitespace", extensions: [], defaultExtensions: [] });
  }

  _parse(text, _old) {
    const root = new SBBlock("document", null, 0, text.length, true);
    const add = (type, text, start, end) => {
      const block = new SBBlock(type, null, start, end, true);
      block.appendChild(new SBText(text, start, end));
      root.appendChild(block);
    };
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\t") add("tab", "\t", i, i + 1);
      else if (text[i] === "\n") add("newline", "\n", i, i + 1);
      else if (text[i] === " " && text[i + 1] === " ") {
        add("tab", "  ", i, i + 2);
        i++;
      } else {
        const start = i;
        let s = "";
        do {
          s += text[i];
          i++;
        } while (
          text[i + 1] !== "\t" &&
          text[i + 1] !== "\n" &&
          i < text.length
        );
        add("text", s, start, i);
      }
    }
    return root;
  }
}
export const SBWhitespaceModel = new _SBWhitespaceModel();

export const removeCommonIndent = (rootNodes: SBBlock[]) => ({
  type: "replace" as const,
  selectionInteraction: SelectionInteraction.Start,
  deletionInteraction: DeletionInteraction.SelectThenFull,
  matcherDepth: Infinity,
  model: SBWhitespaceModel,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => consecutiveTabs(it, indentInNodes(rootNodes)),
      capture("nodes"),
    ]),
  view: () => {
    return h(
      "span",
      {
        style: { opacity: 0.3, display: "inline-block", padding: "0 0.25rem" },
      },
      "⭾",
    );
  },
  rerender: () => true,
});

function consecutiveTabs(node: SBBlock, count: number) {
  if (node.type !== "newline") return null;

  node = node.nextSiblingBlock;
  const nodes: SBBlock[] = [];
  let i = 0;
  while (node && node.type === "tab") {
    i++;
    nodes.push(node);
    if (i === count) return nodes;
    node = node.nextSiblingBlock;
  }
  return null;
}

function indentInNodes(nodes: SBBlock[]) {
  const string = nodesSourceString(nodes);
  let minIndent = Infinity;
  for (let i = 0; i < string.length; i++) {
    if (string[i] === "\n") {
      let j = i;
      let indent = 0;
      while (
        (string[j + 1] === " " && string[j + 2] === " ") ||
        string[j + 1] === "\t"
      ) {
        j += string[j + 1] === " " ? 2 : 1;
        indent++;
      }
      j--;
      if (indent > 0 && indent < minIndent) {
        minIndent = indent;
      }
    }
  }
  return minIndent;
}

function distanceToNewline(node) {
  let i = 0;
  while (node && node.type !== "newline") {
    i++;
    node = node.previousSiblingChild;
  }
  return i;
}

function isWithinIndents(node, indent) {
  return node.type === "tab" && distanceToNewline(node) <= indent;
}
