import { SBBlock } from "../../core/model.js";
import { useEffect, useRef } from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";
import { Side, findChange, last, rangeShift } from "../../utils.js";
import {
  mapIndexToGlobal,
  markInputEditableForNode,
  remapIndices,
  remapIndicesReverse,
} from "../../view/focus.ts";
import { applyStringChange, Change } from "../../vitrail/vitrail.ts";

export function bindSourceString(node: SBBlock) {
  const [text, range] = node.editor.nodeTextWithPendingChanges([node]);
  return {
    node,
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

// take an array of JSON (not JS) strings
export function bindPlainStringFromArray(node) {
  const rules: [string, string][] = [
    ['\\"', '"'],
    ["\\n", "\n"],
  ];

  const textsAndRanges = node.childBlocks.map((x) => {
    const [original, range] = x.editor.nodeTextWithPendingChanges([
      x.childBlock(0),
    ]);
    const [text, indexMap] = remapIndices(original, rules);
    return [text, range, indexMap, x];
  });

  const start = node.children[0].range[1];
  const indexMap = textsAndRanges.flatMap(([_, __, indexMap, node]) =>
    indexMap.map(([a, b]) => [a + node.range[0] - start, b]),
  );
  return {
    node,
    text: textsAndRanges.map(([text]) => text).join(""),
    range:
      textsAndRanges.length > 0
        ? [textsAndRanges[0][1], last(textsAndRanges)[1]]
        : [node.children[0].range[1], node.children[1].range[0]],
    indexMap,
    onLocalChange: (change: Change<any>) => {
      change.from = mapIndexToGlobal(indexMap, change.from);
      change.to = mapIndexToGlobal(indexMap, change.to);
      if (change.insert)
        change.insert = remapIndicesReverse(change.insert, rules)[0];
      // const [_, newIndexMap] = remapIndices(
      //   applyStringChange(original, change),
      //   rules,
      // );
      change.from += start;
      change.to += start;
      // if (change.selectionRange) {
      //   change.selectionRange = [
      //     mapIndexToGlobal(newIndexMap, change.selectionRange[0]) + start,
      //     mapIndexToGlobal(newIndexMap, change.selectionRange[1]) + start,
      //   ];
      // }
      node.editor.applyChanges([change]);
    },
  };
}

export function bindPlainString(node: SBBlock) {
  if (node.type !== "string" && node.type !== "template_string")
    throw new Error("Expected string");

  const contentNodes =
    node.type === "template_string"
      ? node.children.slice(1, node.children.length - 1)
      : node.childBlocks;
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
    node,
    text,
    range,
    indexMap,
    onLocalChange: (change: Change<any>, noFocus = false) => {
      change.from = mapIndexToGlobal(indexMap, change.from);
      change.to = mapIndexToGlobal(indexMap, change.to);
      if (change.insert)
        change.insert = remapIndicesReverse(change.insert, rules)[0];
      const [_, newIndexMap] = remapIndices(
        applyStringChange(original, change),
        rules,
      );
      change.from += range[0];
      change.to += range[0];
      change.noFocus = noFocus;
      if (change.selectionRange) {
        change.selectionRange = [
          mapIndexToGlobal(newIndexMap, change.selectionRange[0]) + range[0],
          mapIndexToGlobal(newIndexMap, change.selectionRange[1]) + range[0],
        ];
      }
      node.editor.applyChanges([change]);
    },
  };
}

export function TextArea({
  text,
  onLocalChange,
  onLocalSelectionChange = (textarea) => {},
  range,
  indexMap,
  style,
  textStyle: _textStyle = {},
}) {
  // text = text[text.length - 1] === "\n" ? text : text + "\n";
  const textAreaRef = useRef(null);
  const textStyle = {
    padding: 0,
    lineHeight: "inherit",
    fontWeight: "inherit",
    fontSize: "inherit",
    border: "none",
    ..._textStyle,
  };

  useEffect(() => {
    const handler = () => {
      if (document.activeElement === textAreaRef.current)
        onLocalSelectionChange(textAreaRef.current);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  return h(
    "span",
    { style: { ...style, display: "inline-grid" } },
    h(
      "textarea",
      {
        ref: (e) => {
          textAreaRef.current = e;
          markInputEditableForNode(range, indexMap)(e);
        },
        rows: 1,
        cols: 1,
        style: {
          ...textStyle,
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
          whiteSpace: "pre-wrap",
          visibility: "hidden",
          gridArea: "1 / 1 / 2 / 2",
          ...textStyle,
        },
      },
      text,
    ),
  );
}
