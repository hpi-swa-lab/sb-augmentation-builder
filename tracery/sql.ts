import { h } from "../external/preact.mjs";
import {
  all,
  metaexec,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import {
  baseCMExtensions,
  CodeMirrorWithVitrail,
} from "../vitrail/codemirror6.ts";
import { sql as cmSql } from "../codemirror6/external/codemirror.bundle.js";
import { bindPlainString } from "../sandblocks/query-builder/bindings.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";

export const sql = (model) => ({
  type: "replace" as const,
  matcherDepth: 1,
  model,
  match: (node) =>
    metaexec(node, (capture) => [
      query("sql`$_string`"),
      (x) => x.string,
      all(
        [bindPlainString, capture("string")],
        [(x) => x.children.slice(1, -1), capture("nodes")],
      ),
    ]),
  view: ({ string: { text, onLocalChange }, nodes }) => {
    const source = {
      get value() {
        return text;
      },
      set value(v) {},
    };

    return h(
      "span",
      {},
      h(CodeMirrorWithVitrail, {
        fetchAugmentations: () => [],
        onchange: (e) => e.detail.changes.forEach((c) => onLocalChange(c)),
        cmExtensions: [...baseCMExtensions, cmSql()],
        value: source,
        style: { display: "inline-block" },
        className: "no-padding",
      }),
      h(VitrailPane, { nodes }),
    );
  },
  rerender: () => true,
});
