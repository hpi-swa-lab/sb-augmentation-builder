import { languageFor } from "../core/languages.js";
import { extractType } from "../core/model.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  bindPlainString,
  TextArea,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  also,
  debugIt,
  match,
  metaexec,
  optional,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { Augmentation, VitrailPane } from "../vitrail/vitrail.ts";
import { TraceryEditor } from "./editor.ts";
import { useRuntimeValues } from "./watch.ts";
import { removeCommonIndent } from "./whitespace.ts";
import { openComponentInWindow } from "./window.js";

const notFoundHandler: Augmentation<any> = {
  type: "rewrite" as const,
  model: languageFor("javascript"),
  match: match((capture) => [
    query("$name = express()"),
    (it) => it.name,
    all(
      [(it) => it.text, capture("name")],
      [(it) => it.parent.parent, capture("statement")],
    ),
  ]),
  view: ({ statement, name }) => {
    statement.insertAfter(
      `${name}.use((req, res, next) => {
            req.once("finished", () => {});
            next();
        })`,
    );
  },
};

const listener: Augmentation<any> = {
  type: "insert",
  model: languageFor("javascript"),
  match: match((capture) => [
    // TODO do not hard-code `app`
    query(`app.$method($route, $func)`),
    all(
      [
        (it) => it.method,
        (it) => ["get", "post", "put", "delete"].includes(it.text),
      ],
      [
        (it) => it.func,
        extractType("arguments"),
        (it) => it.childBlock(0),
        (it) => it.text === "req",
        capture("req"),
      ],
    ),
  ]),
  view: ({ req }) => {
    useRuntimeValues(req, console.log);
    return h("div", {}, "Request");
  },
};

const board: Augmentation<any> = {
  type: "replace",
  model: languageFor("javascript"),
  match: match((capture) => [
    (it) => it.isRoot,
    (it) => it.childBlocks,
    all(
      [
        spawnArray((it) =>
          metaexec(it, (cc) => [
            query("const $name = express()"),
            (it) => it.name.text,
            cc("name"),
          ]),
        ),
        (it) => it[0].name,
        capture("server"),
      ],
      [
        spawnArray((it) =>
          metaexec(it, (cc) => [
            (it) => it.childBlock(0),
            query(`${capture.get("server")}.$method($route, $func);`),
            all(
              [
                (it) => it.method,
                (it) => it.text,
                (it) => ["get", "post", "put", "delete"].includes(it),
                cc("method"),
              ],
              [(it) => it.route, bindPlainString, cc("route")],
              [
                (it) => it.func,
                extractType("statement_block"),
                (it) => it.children.slice(1, -1),
                cc("func"),
              ],
            ),
          ]),
        ),
        capture("configs"),
      ],
    ),
  ]),
  view: ({ configs }) => {
    return configs.map(({ method, route, func }) =>
      h(ExpressConfig, { method, route, func, key: func[0]?.id }),
    );
  },
};

function ExpressConfig({ method, route, func }) {
  const augmentations = useMemo(() => [removeCommonIndent(func)], func);
  // const augmentations = useMemo(() => [], []);
  return h(
    "div",
    { style: { background: "#eee" } },
    h("div", {}, "HTTP ", method, h(TextArea, route)),
    h("hr"),
    h(VitrailPane, {
      nodes: func,
      fetchAugmentations: (p) => [...p.fetchAugmentations(), ...augmentations],
    }),
  );
}

function ExpressEditor({ path, project, window }) {
  const augmentations = useMemo(() => [notFoundHandler, board, listener], []);

  return h(
    "div",
    {
      style: { display: "flex", width: "100%", flex: "1 1", overflowY: "auto" },
    },
    h(TraceryEditor, { project, path, window, augmentations }),
  );
}

export function openExpressEditor(props, windowProps) {
  openComponentInWindow(ExpressEditor, props, {
    initialSize: { x: 300, y: 230 },
    ...windowProps,
  });
}
