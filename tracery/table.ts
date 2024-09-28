import { SBNode } from "../core/model.js";
import { h } from "../external/preact.mjs";
import {
  all,
  also,
  debugIt,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { createPlaceholder } from "../vitrail/placeholder.ts";
import {
  useValidateKeepReplacement,
  VitrailPane,
  VitrailPaneWithWhitespace,
} from "../vitrail/vitrail.ts";
import { BUTTON_PLACEMENT, NodeArray, NodeArrayProps } from "./node-array.ts";

export const table = (model) => ({
  type: "replace" as const,
  matcherDepth: 3,
  model,
  match: (it) =>
    metaexec(it, (capture) => [
      query("[$$$items]"),
      (it) => it.items,
      (it) => it.length > 1,
      all(
        [(it) => it.length, capture("rows")],
        [
          (it) => it[0],
          query("[$$$nestedItems]"),
          (it) => it.nestedItems,
          (it) => it.length,
          (it) => it > 1,
          capture("columns"),
        ],
        [
          spawnArray(
            (node) =>
              metaexec(node, (_capture) => [
                query("[$$$nestedItems]"),
                (it) => it.nestedItems,
                (it) => it.length,
                (it) => it === capture.get("columns"),
                _capture("success"),
              ]),
            false,
          ),
        ],
        [
          spawnArray((it) =>
            metaexec(it, (capture) => [
              query("[$$$nestedItems]"),
              (it) => it.nestedItems,
              capture("nestedItems"),
            ]),
          ),
          (it) => it.map((it) => it.nestedItems),
          capture("items"),
        ],
      ),
    ]),
  view: ({ rows, columns, items, replacement, nodes }) => {
    useValidateKeepReplacement(replacement);
    return h(
      "div",
      {},
      h(
        "table",
        { style: { border: "1px solid", borderCollapse: "collapse" } },
        [...Array(rows).keys()].map((i) =>
          h(
            "tr",
            { style: { border: "1px solid" } },
            h(NodeArray, <NodeArrayProps<SBNode>>{
              container: items[i][0].parent,
              items: items[i],
              buttonPos: [BUTTON_PLACEMENT.START, BUTTON_PLACEMENT.END],
              insert: async (index) => {
                nodes[0].editor.transaction(() => {
                  for (const row of items)
                    row[0].parent.insert(
                      createPlaceholder("expression"),
                      "expression",
                      index,
                    );
                });
              },
              remove: (_item, _node, index) => {
                nodes[0].editor.transaction(() => {
                  for (const row of items) row[index].removeFull();
                });
              },
              view: (it, ref, onmousemove, onmouseleave) =>
                h(
                  "td",
                  {
                    style: { border: "1px solid", padding: "5px" },
                    onmouseleave,
                    onmousemove,
                    ref,
                  },
                  h(VitrailPaneWithWhitespace, {
                    ignoreLeft: true,
                    nodes: [it],
                  }),
                ),
              wrap: (it) => it,
            }),
            // [...Array(rows).keys()].map((j) =>
            //   h(
            //     "td",
            //     { style: { border: "1px solid" } },
            //     h(VitrailPaneWithWhitespace, {
            //       ignoreLeft: true,
            //       nodes: [items[j][i]],
            //     }),
            //   ),
            // ),
          ),
        ),
      ),
    );
  },
  rerender: () => true,
  examples: [
    [
      `const a = [
  [0,1,2,3,4,5,6,7,8,9],
  [10,11,12,13,14,15,16,17,18,19],
  [20,21,22,23,24,25,26,27,28,29]
]`,
      [0, 0],
    ],
  ],
});
