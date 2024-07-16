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
          (it) => /rgb\([01]?[0-9][0-9]?|2[0-4][0-9]|25[0-5]{3}\)/i.test(it),
          (it) =>/rgb\(([01]?[0-9][0-9]?|2[0-4][0-9]|25[0-5]),([01]?[0-9][0-9]?|2[0-4][0-9]|25[0-5]),([01]?[0-9][0-9]?|2[0-4][0-9]|25[0-5])\)/i.exec(it),
          (it) => 
({r: parseInt(it[1], 10),
g: parseInt(it[2], 10),
b: parseInt(it[3], 10)}),
        ],
        [
          (it) => /^#[0-9A-F]{6}$/i.test(it),
          (it) => /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it),
          (it) => 
({r: parseInt(it[1], 16),
g: parseInt(it[2], 16),
b: parseInt(it[3], 16)}),
        ],
      ),
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
        onchange: (e) => node.replaceWith(e.target.value, "expression"),
        value: `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`,
      }),
    ),
  rerender: () => true,
  examples: [['const color = "rgb(12,34,56)"', [0, 0]],['const color = "#123456"', [0, 0]] ],
};

//const a = "#123456"
