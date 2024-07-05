import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  all,
  debugIt,
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("{ key: $value }", "pair"),
      capture("out"),
      all(
        [(it) => it.value, capture("value")],
        [(it) => it.value, capture("value2")],
      ),
    ]),
  view: ({ nodes }) => h("div", {}, "test"),
  rerender: () => true,
  examples: ["const a = { key: 123 }"],
};
