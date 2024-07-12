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
      (it) => it.type == "array",

      first(
        [(it) => it.type == "array", (it) => null],
        [(it) => null],
        [(it) => it],
      ),
      all(
        [(it) => it.childBlocks, allMatch([(it) => it.type == "array"])],
        [(it) => it.childBlocks, spawnArray([(it) => it.toString()])],
        [
          (it) =>
            it.childBlocks.every(
              (child) =>
                child.childBlocks.length ==
                it.childBlocks[0].childBlocks.length,
            ),
          (it) =>
            it.childBlocks.every((child) =>
              child.childBlocks.every(
                (child) => child.type == it.childBlocks[0].childBlocks[0].type,
              ),
            ),
          capture("array"),
          all(
            [(it) => it.childBlocks.length, capture("rows")],
            [(it) => it.childBlocks[0].childBlocks.length, capture("columns")],
            [(it) => it.childBlocks[0].childBlocks[0].type, capture("type")],
          ),
        ],
      ),
    ]),
  view: ({ nodes, array, rows, columns, type }) => {
    const a = eval(array.sourceString);
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
      h("div", { style: { color: "gray" } }, type),
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
