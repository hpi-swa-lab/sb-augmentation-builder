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
        [
          first(
            [
              (it) => /rgb\((\d+)\,(\d+)\,(\d+)\)/g.exec(it),
              (it) => [...it, 255],
            ],
            [(it) => /rgb\((\d+)\,(\d+)\,(\d+)\,(\d+)\)/g.exec(it)],
          ),
          also([(it) => 10, capture("base")]),
        ],
      ),
      (it) => it.slice(1),
      spawnArray([
        (it) => parseInt(it, capture.get("base")),
        (it) => it.toString(16),
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
  examples: [['const color = "#89CC04"', [15, 24]]],
});

//Pure JS Implementation
function matchRecur(tree, captures, condition, extract) {
  if (condition(tree)) captures.push(extract(tree));
  return tree.children.forEach((it) =>
    matchRecur(it, captures, condition, extract),
  );
}

const example = 'const color = "#123456"';
const javaScript = languageFor("javascript");
const tree = javaScript.parseSync(example);
let captures = [];

const condition = (tree) => {
  return (
    tree.type == "string" &&
    (/rgb\(\d+\,\d+\,\d+\)/g.test(tree.sourceString) ||
      /rgb\(\d+\,\d+\,\d+\,(0|0\.\d*|1)\)/g.test(tree.sourceString) ||
      /#([A-F]|\d){6}/g.test(tree.sourceString) ||
      /#([A-F]|\d){8}/g.test(tree.sourceString))
  );
};

const extract = (tree) => {
  if (/rgb\(\d+\,\d+\,\d+\)/g.test(tree.sourceString)) {
    const extract = /rgb\((\d+)\,(\d+)\,(\d+)\)/g.exec(tree.sourceString);
    return {
      r: extract[1].toString(16).toUpperCase(),
      g: extract[2].toString(16).toUpperCase(),
      b: extract[3].toString(16).toUpperCase(),
      a: "FF",
    };
  }
  if (/rgb\(\d+\,\d+\,\d+\,(0|0\.\d*|1)\)/g.test(tree.sourceString)) {
    const extract = /rgb\((\d+)\,(\d+)\,(\d+)\,(0|0\.\d*|1)\)/g.exec(
      tree.sourceString,
    );
    return {
      r: parseInt(extract[1]).toString(16).toUpperCase(),
      g: parseInt(extract[2]).toString(16).toUpperCase(),
      b: parseInt(extract[3]).toString(16).toUpperCase(),
      a: Math.round(parseFloat(extract[4]) * 255)
        .toString(16)
        .toUpperCase(),
    };
  }
  if (/#([A-F]|\d){6}/g.test(tree.sourceString)) {
    const extract = /#([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})/g.exec(
      tree.sourceString,
    );
    return {
      r: extract[1],
      g: extract[2],
      b: extract[3],
      a: "FF",
    };
  }
  if (
    /#([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})/g.test(
      tree.sourceString,
    )
  ) {
    return {
      r: extract[1],
      g: extract[2],
      b: extract[3],
      a: extract[4],
    };
  }
};

matchRecur(tree, captures, condition, extract);
