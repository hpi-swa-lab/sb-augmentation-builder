import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  first,
  also,
  all,
  spawnArray,
} from "./sandblocks/query-builder/functionQueries.js";

//Augmentation Builder Implementation
export const replacementColor = (model) => ({
  type: "replace",
  matcherDepth: Infinity,
  model: languageFor("javascript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query('"$string"'),
      (it) => it.string.sourceString,
      first(
        [
          first(
            [
              (it) => /#([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})/g.exec(it),
              (it) => [...it, "FF"],
            ],
            [
              (it) =>
                /#([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})/g.exec(
                  it,
                ),
            ],
          ),
          also([(it) => 16, capture("base")]),
        ],
        [],
      ),
      (it) => it.slice(1),
      spawnArray([
        (it) => parseInt(it, capture.get("base")),
        (it) => it.toString(capture.get("base")),
        (it) => it.toUpperCase(),
        (it) => it.padStart(2, "0"),
      ]),
      all(
        [(it) => it[0], capture("r")],
        [(it) => it[1], capture("g")],
        [(it) => it[2], capture("b")],
        [(it) => it[3], capture("a")],
      ),
    ]),
  view: ({ r, g, b, a, node }) => {
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
          onchange: (e) => {
            const new_alpha = a < 1 ? Math.round(a * 255).toString(16) : a;
            node.replaceWith(e.target.value + new_alpha);
          },
          value: `#${r}${g}${b}`,
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
          value: parseInt(a, 16) / 255,
          onchange: (e) => {
            const new_alpha = Math.round(e.target.value * 255).toString(16);
            const replacement = `#${r}${g}${b}${new_alpha}`;
            node.replaceWith(replacement, "expression");
          },
        }),
      ),
    );
  },
  rerender: () => true,
  examples: [['const color = "rgb(138,206,0,255)"', [0, 0]]],
});
