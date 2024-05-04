import { findChange } from "../../utils.js";
import { h, markInputEditable } from "../widgets.js";

export function AutoSizeTextArea({ node }) {
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
        ref: (current) => {
          if (current) {
            markInputEditable(current);
            current.range = node.range;
          }
        },
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
            node.text,
            e.target.value,
            e.target.selectionStart,
          );
          if (change) {
            change.from += node.range[0];
            change.to += node.range[0];
            change.selectionRange = [
              e.target.selectionStart + node.range[0],
              e.target.selectionEnd + node.range[0],
            ];
            node.editor.applyChanges([change]);
          }
        },
      },
      node.text,
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
      node.text,
    ),
  );
}
