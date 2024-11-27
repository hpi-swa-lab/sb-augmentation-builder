import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  spawnArray,
  all,
} from "./sandblocks/query-builder/functionQueries.js";

//Augmentation Builder Implementation
export const replacementStaticTable = (model) => ({
  type: "replace",
  matcherDepth: Infinity,
  model: languageFor("javascript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("[$_items]"),
      (it) => it.items,
      capture("nodes"),
      query("[$$$rows]"),
      (it) => it.rows,
      all(
        [(it) => it.length, capture("rows")],
        [
          (it) => it[0],
          query("[$$$nestedItems]"),
          (it) => it.nestedItems,
          (it) => it.length,
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
            true,
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
        [...Array(rows).keys()].map((i) =>
          h(
            "tr",
            { style: { border: "1px solid" } },
            [...Array(columns).keys()].map((j) =>
              h("td", { style: { border: "1px solid" } }, a[i][j]),
            ),
          ),
        ),
      ),
    );
  },
  rerender: () => true,
  examples: [["const table = [[1,2],[3,4]]", [0, 0]]],
});

//Pure JS Implementation
function matchRecur(tree, captures, condition, extract) {
  if (condition(tree)) captures.push(extract(tree));
  return tree.children.forEach((it) =>
    matchRecur(it, captures, condition, extract),
  );
}

const example = "const table = [[1,2],[3,4]]";
const javaScript = languageFor("javascript");
const tree = javaScript.parseSync(example);
let captures = [];

const condition = (tree) => {
  return (
    tree.type == "array" &&
    tree.childBlocks.every(
      (row) =>
        row.type == "array" &&
        row.childBlocks.length() == tree.childBlocks[0].childBlocks.length(),
    )
  );
};

const extract = (tree) => {
  return {
    nodes: tree,
    rows: tree.childBlocks.length(),
    columns: tree.childBlocks[0].childBlocks.length(),
  };
};

matchRecur(tree, captures, condition, extract);
