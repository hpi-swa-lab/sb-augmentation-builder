import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  all,
  first,
  debugIt,
  spawnArray,
  optional,
  type,
  also,
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query('"$content"'),
      (it) => it.content,
      capture("node"),
      (it) => it.text,
      first(
        [
          (it) => /rgb\((\d+),(\d+),(\d+)\)/i.exec(it),
          also([(_) => 10, capture("base")]),
          optional([(_) => false]),
        ],
        [
          (it) => /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it),
          also([(_) => 16, capture("base")]),
        ],
      ),
      (it) => ({
        r: parseInt(it[1], capture.get("base")),
        g: parseInt(it[2], capture.get("base")),
        b: parseInt(it[3], capture.get("base")),
      }),
      all(
        [(it) => it.r, capture("r")],
        [(it) => it.g, capture("g")],
        [(it) => it.b, capture("b")],
      ),
    ]),
  view: ({ r, g, b, node }) =>
    h(
      "div",
      {},
      h("input", {
        type: "color",
        onchange: (e) => node.replaceWith(e.target.value),
        value: `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`,
      }),
    ),
  rerender: () => true,
  examples: [
    ['const color = "rgb(12,34,56)"', [0, 0]],
    ['const color = "#123456"', [0, 0]],
  ],
};

//const a = "#123456"
