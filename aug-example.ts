import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  debugIt,
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("{ key: $value }", "pair"),
      capture("out"),
    ]),
  view: ({ nodes }) => h("div", {}, "Augmentation"),
  rerender: () => true,
  examples: ["const a = { key: 123 }"],
};
