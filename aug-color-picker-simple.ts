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
  type: "replace",
  matcherDepth: Infinity,
  model: languageFor("javascript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query('"$string"'),
      (it) =>
        /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it.string.text) !=
        null,
      (it) => it.string,
      capture("node"),
      (it) => it.text,
      capture("hex"),
    ]),
  view: ({ hex, node }) => {
    return h("div", {
      style: { height: "1rem", width: "5rem", background: hex },
    });
  },
  rerender: () => true,
  examples: [['const color = "#123456"', [0, 0]]],
});

//matchRecur(
//  tree,
//  captures,
//  (tree) => {
//    tree.type == "string_fragment" &&
//      /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.test(tree.text);
//  },
//  (match) => {
//    ({
//      hex: match.text,
//    });
//  },
//);
