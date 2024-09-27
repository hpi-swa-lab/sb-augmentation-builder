import { h } from "../external/preact.mjs";
import {
  all,
  debugIt,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import {
  useValidateKeepReplacement,
  VitrailPane,
  VitrailPaneWithWhitespace,
} from "../vitrail/vitrail.ts";

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
            [
              query("[$$$nestedItems]"),
              (it) => it.nestedItems,
              (it) => it.length,
              (it) => it === capture.get("columns"),
            ],
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
  view: ({ rows, columns, items, replacement }) => {
    useValidateKeepReplacement(replacement);
    return h(
      "div",
      {},
      h(
        "table",
        { style: { border: "1px solid", borderCollapse: "collapse" } },
        [...Array(columns).keys()].map((i) =>
          h(
            "tr",
            { style: { border: "1px solid" } },
            [...Array(rows).keys()].map((j) =>
              h(
                "td",
                { style: { border: "1px solid" } },
                h(VitrailPaneWithWhitespace, {
                  ignoreLeft: true,
                  nodes: [items[j][i]],
                }),
              ),
            ),
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
