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
} from "./sandblocks/query-builder/functionQueries.js";

export const augExample = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      first(
        [
          query('"$content"'),
          (it) => it.content,
          first(
            [query("rgb($r,$g,$b)")],
            [
              (it) => it.text,
              (it) => /^#[0-9A-F]{6}$/i.test(it),
              (it) => /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it),
              (it) => ({
                r: parseInt(it[1], 16),
                g: parseInt(it[2], 16),
                b: parseInt(it[2], 16),
              }),
            ],
          ),
        ],
        [query("{r: $r, g: $g, b: $b")],
      ),
      all(
        [(it) => it.r, capture("r")],
        [(it) => it.g, capture("g")],
        [(it) => it.b, capture("b")],
      ),
    ]),
  view: ({ nodes }) => h("div", {}, "test"),
  rerender: () => true,
  examples: [['const a = "#123456"', [0, 0]]],
};
