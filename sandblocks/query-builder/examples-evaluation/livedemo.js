import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  first,
  all,
} from "./sandblocks/query-builder/functionQueries.js";

//Augmentation Builder Implementation
export const replacementHexColor = (model) => ({
  type: "replace",
  matcherDepth: Infinity,
  model: languageFor("javascript"),
  match: (it) => metaexec(it, (capture) => [(it) => "start here"]),
  view: ({ hex }) => {
    return h(
      "div",
      { style: { backgroundColor: hex, width: "3rem", height: "1rem" } },
      "",
    );
  },
  rerender: () => true,
  examples: [["", [0, 0]]],
});
