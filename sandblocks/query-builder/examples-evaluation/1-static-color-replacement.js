import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import { metaexec, query } from "./sandblocks/query-builder/functionQueries.js";

//Augmentation Builder Implementation
export const replacementHexColor = (model) => ({
  type: "replace",
  matcherDepth: Infinity,
  model: languageFor("javascript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("$string"),
      (it) => it.string.sourceString,
      (it) => /#([A-F]|\d){6}/g.test(it),
      capture("hex"),
    ]),
  view: ({ hex }) => {
    return h(
      "div",
      { style: { backgroundColor: hex, width: "3rem", height: "1rem" } },
      "",
    );
  },
  rerender: () => true,
  examples: [['const color = "#89CC04"', [0, 0]]],
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
  return tree.type == "string" && /#([A-F]|\d){6}/g.test(tree.sourceString);
};

const extract = (tree) => {
  return { hex: tree.sourceString };
};

matchRecur(tree, captures, condition, extract);
