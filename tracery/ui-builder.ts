import { extractType } from "../core/model.js";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
  bindSourceString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  first,
  metaexec,
  query,
  replace,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { Augmentation, VitrailPane } from "../vitrail/vitrail.ts";

export const uiBuilder = (model): Augmentation<any> => ({
  model,
  match: (it) =>
    metaexec(it, (capture) => [
      replace(capture),
      query("h($tag, $props, $$$children)"),
      all(
        [
          (it) => it.tag,
          first(
            [(it) => it.type === "string", bindPlainString],
            [bindSourceString],
          ),
          (it) => h(TextArea, it),
          capture("tag"),
        ],
        [
          (it) => it.props.childBlocks,
          spawnArray((it) =>
            metaexec(it, (capture) => [
              query("({$key: $value})", extractType("pair")),
              all(
                [(it) => it.key.text, capture("key")],
                [(it) => it.value, capture("value")],
              ),
            ]),
          ),
          capture("props"),
        ],
        [(it) => it.children, capture("children")],
      ),
    ]),
  view: ({ tag, props, children }) =>
    h(
      "span",
      { style: { display: "inline-block" } },
      h(
        "span",
        {
          style: {
            display: "inline-block",
            border: "1px solid #ccc",
            borderRadius: "5px",
            padding: "0.25rem",
          },
        },
        h("span", { style: { color: "blue", marginRight: "0.25rem" } }, tag),
        props.map(({ key, value }) =>
          h(
            "span",
            {
              style: {
                background: "#eee",
                padding: "0.1rem 0.5rem",
                marginLeft: "0.25rem",
                borderRadius: "9999px",
                cursor: "pointer",
              },
              key,
            },
            key,
          ),
        ),
      ),
      h("br"),
      h(
        "span",
        { style: { display: "inline-block", paddingLeft: "1rem" } },
        h(VitrailPane, { nodes: children }),
      ),
    ),
  rerender: () => true,
  matcherDepth: 3,
});
