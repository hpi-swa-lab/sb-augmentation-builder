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
  type: "replace",
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
  rerender: () =>
    vary("1va2123fdsa", "param", 0, [
      ["a", () => true],
      ["b", () => false],
    ]),
  examples: [["const a = { r: 0.3 }", [0, 0]]],
};
