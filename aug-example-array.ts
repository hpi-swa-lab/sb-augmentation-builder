import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  all,
  first,
  debugIt,
  log,
  spawnArray,
  allMatch,
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("[$$$items]"),
      (it) => it.items,
      all(
        [(it) => it.length, capture("rows")],
        [
          spawnArray(
            [
              query("[$$$items]"),
              (it) => it.items,
              (it) => it.length === capture.get("rows"),
              (it) => it.length,
              capture("columns"),
            ],
            false,
          ),
        ],
      ),
    ]),
  view: ({ nodes, rows, columns }) => {
    const a = eval(nodes[0].sourceString);
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
              h("td", { style: { border: "1px solid" } }, a[j][i]),
            ),
          ),
        ),
      ),
    );
  },
  rerender: () => true,
  examples: [
    [
      "const a = [[0,1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18,19],[20,21,22,23,24,25,26,27,28,29]]",
      [0, 0],
    ],
  ],
};
