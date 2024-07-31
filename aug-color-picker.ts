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
  log,
} from "./sandblocks/query-builder/functionQueries.js";

export const augColor = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      query('"$content"'),
      (it) => it.content,
      capture("node"),
      (it) => it.text,
      first(
        [
          (it) => /rgb\((\d+),(\d+),(\d+)\)/i.exec(it),
          (it) => [...it, 1],
          also([() => 10, capture("base")]),
        ],
        [
          (it) => /rgb\(\ ?(\d+),\ ?(\d+),\ ?(\d+),\ ?([01].\d+)\)/gm.exec(it),
          log("rgba"),
          also([() => 10, capture("base")]),
        ],
        [
          (it) =>
            /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it),
          also([() => 16, capture("base")]),
        ],
        [
          (it) => /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it),
          (it) => [...it, 1],
          also([() => 16, capture("base")]),
        ],
      ),
      //log("array"),
      (it) => ({
        r: parseInt(it[1], capture.get("base")),
        g: parseInt(it[2], capture.get("base")),
        b: parseInt(it[3], capture.get("base")),
        a: it[4] < 1 ? parseFloat(it[4]) : parseInt(it[4], capture.get("base")),
      }),
      //log("object"),
      all(
        [(it) => it.r, capture("r")],
        [(it) => it.g, capture("g")],
        [(it) => it.b, capture("b")],
        [(it) => it.a, capture("a")],
      ),
    ]),
  view: ({ r, g, b, a, node }) => {
    console.log("a: " + a);
    return h(
      "div",
      {
        style: {
          display: "flow",
          flowDirection: "column",
          boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
          padding: "1rem",
        },
      },
      h(
        "div",
        {},
        "color: ",
        h("input", {
          type: "color",
          onchange: (e) => node.replaceWith(e.target.value + a.toString(16)),
          value: `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`,
        }),
      ),
      h(
        "div",
        {},
        "Opacity: ",
        h("input", {
          type: "range",
          min: 0,
          max: 1,
          step: 0.01,
          value: a < 1 ? a : a / 255,
          onchange: (e) => {
            const new_alpha = Math.round(e.target.value * 255).toString(16);
            console.log("new_alpha: " + new_alpha);
            const replacement = `#${r.toString(16)}${g.toString(
              16,
            )}${b.toString(16)}${new_alpha}`;
            console.log("replacement: " + replacement);
            node.replaceWith(replacement, "expression");
          },
        }),
      ),
    );
  },
  rerender: () => true,
  examples: [
    ['const color = "rgb(12,34,56)"', [0, 0]],
    ['const color = "#123456"', [0, 0]],
  ],
});

//const a = "#123456"
