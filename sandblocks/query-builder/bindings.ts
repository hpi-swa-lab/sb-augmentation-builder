import { SBBlock } from "../../core/model.js";
import { h } from "../../external/preact.mjs";
import { Side, findChange, rangeShift } from "../../utils.js";
import {
  mapIndex,
  markInputEditableForNode,
  remapIndices,
  remapIndicesReverse,
} from "../../view/focus.ts";
import { Change } from "../../vitrail/vitrail.ts";

export function bindSourceString(node: SBBlock) {
  const [text, range] = node.editor.nodeTextWithPendingChanges([node]);
  return {
    text,
    range,
    indexMap: [],
    onLocalChange: (change: Change<any>) => {
      change.from += range[0];
      change.to += range[0];
      if (change.selectionRange)
        change.selectionRange = rangeShift(change.selectionRange, range[0]) as [
          number,
          number,
        ];
      node.editor.applyChanges([change]);
    },
  };
}

export function bindPlainString(node: SBBlock) {
  const contentNodes = node.childBlocks as SBBlock[];
  const quote = node.childNode(0) as SBBlock | null;
  if (!quote) return { text: "", onLocalChange: () => {} };

  const [original, range] =
    contentNodes.length > 0
      ? node.editor.nodeTextWithPendingChanges(contentNodes)
      : ["", [quote.range[0] + 1, quote.range[0] + 1]];

  const rules: [string, string][] = [
    ["\\" + quote.text, quote.text],
    ["\\n", "\n"],
  ];
  const [text, indexMap] = remapIndices(original, rules);

  return {
    text,
    range,
    indexMap,
    onLocalChange: (change: Change<any>) => {
      change.from = mapIndex(indexMap, change.from) + range[0];
      change.to = mapIndex(indexMap, change.to) + range[0];
      if (change.insert)
        change.insert = remapIndicesReverse(change.insert, rules)[0];
      if (change.selectionRange)
        change.selectionRange = [
          mapIndex(indexMap, change.selectionRange[0]) + range[0],
          mapIndex(indexMap, change.selectionRange[1]) + range[0],
        ];
      node.editor.applyChanges([change]);
    },
  };
}

export function TextArea({ text, onLocalChange, range, indexMap }) {
  const style = {
    padding: 0,
    lineHeight: "inherit",
    fontWeight: "inherit",
    fontSize: "inherit",
    border: "none",
  };
  return h(
    "span",
    { style: { display: "inline-grid" } },
    h(
      "textarea",
      {
        ref: markInputEditableForNode(range, indexMap),
        rows: 1,
        cols: 1,
        style: {
          ...style,
          overflow: "hidden",
          resize: "none",
          gridArea: "1 / 1 / 2 / 2",
        },
        onInput: (e) => {
          const change = findChange(
            text,
            e.target.value,
            e.target.selectionStart,
          );
          if (change) {
            change.selectionRange = [
              e.target.selectionStart,
              e.target.selectionEnd,
            ];
            change.sideAffinity = change.from === 0 ? Side.Right : Side.Left;
            onLocalChange(change);
          }
        },
      },
      text,
    ),
    h(
      "span",
      {
        style: {
          ...style,
          whiteSpace: "pre-wrap",
          visibility: "hidden",
          gridArea: "1 / 1 / 2 / 2",
        },
      },
      text,
    ),
  );
}
