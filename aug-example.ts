import { languageFor } from "./core/languages.js";
import { h } from "./external/preact.mjs";
import {
  metaexec,
  query,
  all,
  first,
  debugIt,
  spawnArray,
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      query("({$$$colorChannels})", "object"),
      (it) => it.colorChannels,
      spawnArray(
        [(it) => it.atField("value"), (it) => it.type === "number"],
        true,
      ),
    ]),
  view: ({ nodes }) => h("div", {}, "test"),
  rerender: () => true,
  examples: [["const a = { r: 0.3 }", [0, 0]]],
};
