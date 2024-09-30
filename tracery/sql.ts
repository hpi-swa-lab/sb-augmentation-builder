import { h } from "../external/preact.mjs";
import {
  all,
  metaexec,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import { sql as cmSql } from "../codemirror6/external/codemirror.bundle.js";
import { bindPlainString } from "../sandblocks/query-builder/bindings.ts";
import {
  baseCMExtensions,
  CodeMirrorWithVitrail,
} from "../vitrail/codemirror6.ts";

/* # Excursion on language composition in Vitrail
- if we use augmentations to replace escaped chars with unescaped, we get
  troubles with input -- chars are inserted unescaped
- if we use panes, we need to add a system of remapping to panes. What's
  awkward is that the models of augmentations specific to the nested
  language should run on the unescaped text, but Vitrail collects all
  models at the root.
- finally, we can nest another full Vitrail editor and pass the text to it.
  This option gives us the most flexibility. Here the awkward part is that
  we have two definitions of cursorPositions on every nested element -- one
  for the outer and one for the inner text. We can dispatch the local changes
  to the outer editor with noFocus but that's of course also a workaround.
*/

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
        onchange: (e) =>
          e.detail.changes.forEach((c) => onLocalChange(c, true)),
        cmExtensions: [...baseCMExtensions, cmSql()],
        value: source,
        style: { display: "inline-block" },
        className: "no-padding",
      }),
      // h(VitrailPane, { nodes }),
    );
  },
  rerender: () => true,
});
