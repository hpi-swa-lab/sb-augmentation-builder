import { languageFor } from "../core/languages.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  all,
  match,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import { appendCss } from "../utils.js";
import { Augmentation, VitrailPaneWithWhitespace } from "../vitrail/vitrail.ts";

appendCss(`
.vector {
  position: relative;
  display: inline-table;
  flex-direction: column;
  padding: 0 5px;
}

.vector td {
  padding: 0 2px;
  text-align: center;
}

.vector:after, .vector:before {
  position: absolute;
  content: "";
  display: block;
  width: 5px;
  height: 100%;
  left: 0;
  top: 0;
  border-width: 1px 0 1px 1px;
  border-style: solid;
  border-color: black;
  z-index: 1;
}
.vector:after {
  right: 0;
  left: auto;
  border-width: 1px 1px 1px 0;
}
`);

export const vectors = <Augmentation<any>>{
  type: "replace",
  model: languageFor("glsl"),
  matcherDepth: 3,
  match: match((capture) => [
    query("$func($$$args);"),
    all(
      [
        (it) => it.func.text,
        (it) => ["vec3", "vec4", "vec2", "mat3", "mat4", "mat2"].includes(it),
        capture("type"),
      ],
      [(it) => it.args, capture("args")],
    ),
  ]),
  view: ({ type, args, replacement: { view } }) => {
    useEffect(() => {
      view.style.verticalAlign = "middle";
    }, [view]);

    const numColumns = type.startsWith("vec")
      ? 1
      : type === "mat2"
        ? 2
        : type === "mat3"
          ? 3
          : 4;
    const numRows = parseInt(type.slice(3));

    return h(
      "table",
      { class: "vector", style: {} },
      Array.from({ length: numRows }).map((_, i) =>
        h(
          "tr",
          {},
          Array.from({ length: numColumns }).map((_, j) =>
            h(
              "td",
              {},
              h(VitrailPaneWithWhitespace, {
                ignoreLeft: true,
                className: "no-padding",
                nodes: [args[i * numColumns + j]],
              }),
            ),
          ),
        ),
      ),
    );
  },
};
