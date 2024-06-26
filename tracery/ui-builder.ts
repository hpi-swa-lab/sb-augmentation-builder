import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  metaexec,
  query,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { Augmentation } from "../vitrail/vitrail.ts";

export const uiBuilder = (model): Augmentation<any> => ({
  model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => false,
      replace(capture),
      query("h($tag, $props, $$$children)"),
      all(
        [
          (it) => it.tag,
          bindPlainString,
          (it) => h(TextArea, it),
          capture("tag"),
        ],
        [(it) => it.props, capture("props")],
        [(it) => it.children, capture("children")],
      ),
    ]),
  view: ({ tag, props, children }) =>
    h("div", { style: { border: "1px solid #ccc", borderRadius: "3px" } }, tag),
  rerender: () => true,
  matcherDepth: 3,
});
