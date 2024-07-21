import { extractType } from "../core/model.js";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
  bindSourceString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  first,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { Augmentation } from "../vitrail/vitrail.ts";
import { openNodesInWindow } from "./editor.ts";
import { NodeArray } from "./node-array.ts";

export const uiBuilder = (model): Augmentation<any> => ({
  type: "replace" as const,
  model,
  match: (it) =>
    metaexec(it, (capture) => [
      query("h($tag, $props, $$$children)"),
      all(
        [
          (it) => it.tag,
          first(
            [(it) => it.type === "string", bindPlainString],
            [bindSourceString],
          ),
          (it) => h(TextArea, it),
          capture("tag"),
        ],
        [
          (it) => it.props.childBlocks,
          spawnArray((it) =>
            metaexec(it, (capture) => [
              query("({$key: $value})", extractType("pair")),
              all(
                [(it) => it.key.text, capture("key")],
                [(it) => it.value, capture("value")],
              ),
            ]),
          ),
          capture("props"),
        ],
        [(it) => it.children, capture("children")],
      ),
    ]),
  view: ({ tag, props, children, nodes }) =>
    h(
      "span",
      { style: { display: "inline-block" } },
      h(
        "span",
        {
          style: {
            display: "inline-block",
            border: "1px solid #ccc",
            borderRadius: "5px",
            padding: "0.25rem",
          },
        },
        h("span", { style: { color: "blue", marginRight: "0.25rem" } }, tag),
        props.map(({ key, value }) => h(PropEditor, { key, value, name: key })),
      ),
      h("br"),
      h(
        "span",
        { style: { display: "inline-block", paddingLeft: "1rem" } },
        h(NodeArray, {
          items: children,
          container: nodes[0].atField("arguments"),
          baseIndex: 2,
        }),
        // h(VitrailPane, { nodes: children }),
      ),
    ),
  rerender: () => true,
  matcherDepth: 3,
});

function PropEditor({ name, value }) {
  const hovered = useSignal(false);

  return h(
    "span",
    {
      onmouseenter: () => (hovered.value = true),
      onmouseleave: () => (hovered.value = false),
      style: {
        background: "#eee",
        padding: "0.1rem 0.5rem",
        marginLeft: "0.25rem",
        borderRadius: "9999px",
        cursor: "pointer",
        position: "relative",
      },
      onClick: () => openNodesInWindow([value]),
    },
    name,
    hovered.value &&
      h(
        "span",
        {
          style: {
            position: "absolute",
            top: "100%",
            left: "50%",
            width: "max-content",
            transform: "translate(-50%, 0)",
            background: "#fff",
            padding: "0.5rem",
            border: "1px solid #ccc",
            borderRadius: "5px",
            zIndex: 10000000,
          },
        },
        value.sourceString,
      ),
  );
}
