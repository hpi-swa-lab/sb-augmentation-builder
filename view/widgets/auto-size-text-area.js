import { Side, findChange } from "../../utils.js";
import { markInputEditableForNode } from "../focus.ts";
import { h } from "../widgets.js";

export function AutoSizeTextArea({ node }) {
  const [text, range] = node.editor.nodeTextWithPendingChanges(node);
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
        ref: markInputEditableForNode(node),
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
            change.from += range[0];
            change.to += range[0];
            change.selectionRange = [
              e.target.selectionStart + range[0],
              e.target.selectionEnd + range[0],
            ];
            change.sideAffinity =
              change.from === range[0] ? Side.Right : Side.Left;
            node.editor.applyChanges([change]);
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
