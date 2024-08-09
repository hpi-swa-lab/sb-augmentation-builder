import {
  metaexec,
  all,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";

export const exploriants = (model) => ({
  type: "replace" as const,
  matcherDepth: Infinity,
  model,
  examples: [""],
  match: (it) =>
    metaexec(it, (capture) => [
      query('vary("$id", $name, $index, $variations)'),
      all(
        [(it) => it.id, (it) => it.text, capture("id")],
        [(it) => it.name, bindPlainString, capture("name")],
        [(it) => it.index, capture("index")],
        [
          (it) => it.variations,
          (it) => it.childBlocks,
          spawnArray(
            (it) =>
              metaexec(it, (capture) => [
                query("[$name, () => $variation]"),
                all(
                  [(it) => it.name, bindPlainString, capture("name")],
                  [(it) => it.variation, capture("variation")],
                ),
              ]),
            false,
          ),
          capture("variations"),
        ],
      ),
    ]),
  view: ({ variations, name, id, index }) =>
    h(
      "span",
      { style: { display: "inline-block", border: "1px solid #ccc" } },
      [
        h("div", {}, h(TextArea, name)),
        h(
          "div",
          { style: { display: "flex" } },
          variations.map(({ name }, i) =>
            h(
              "div",
              {
                key: i,
                style: {
                  padding: "0.3rem",
                  cursor: "pointer",
                  background: parseInt(index.text) === i ? "#ccc" : "#fff",
                },
                onclick: () =>
                  index.replaceWith(i.toString(), { noFocus: true }),
              },
              h("div", {}, h(TextArea, name)),
            ),
          ),
        ),
        h(
          "div",
          {},
          h(VitrailPane, { nodes: [variations[index.text].variation] }),
        ),
      ],
    ),
  rerender: () => true,
});
