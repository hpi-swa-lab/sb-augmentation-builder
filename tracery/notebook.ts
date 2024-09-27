import { languageFor } from "../core/languages.js";
import { SBBlock } from "../core/model.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import {
  bindPlainStringFromArray,
  TextArea,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  debugIt,
  metaexec,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { openComponentInWindow } from "./window.js";
import { h, useAsyncEffect } from "../view/widgets.js";
import {
  baseCMExtensions,
  CodeMirrorWithVitrail,
} from "../vitrail/codemirror6.ts";
import { Augmentation } from "../vitrail/vitrail.ts";

function objectField(key: string) {
  return (object) =>
    object.childBlocks
      .find(
        (x) => x.type === "pair" && x.childBlock(0).childBlock(0).text === key,
      )
      ?.childBlock(1);
}

const notebook: Augmentation<any> = {
  match: (node) =>
    metaexec(node, (capture) => [
      (x) => x.type === "object",
      all(
        [objectField("nbformat")],
        [
          objectField("cells"),
          debugIt,
          (x) => x.childBlocks,
          spawnArray((x) =>
            metaexec(x, (capture) => [
              all(
                [
                  objectField("cell_type"),
                  (x) => x.childBlock(0),
                  (x) => x.text,
                  capture("cellType"),
                ],
                [
                  objectField("source"),
                  bindPlainStringFromArray,
                  capture("source"),
                ],
              ),
            ]),
          ),
          capture("cells"),
        ],
      ),
    ]),
  type: "replace" as const,
  matcherDepth: 1,
  model: languageFor("json"),
  view: ({ cells }) =>
    h(
      "div",
      { style: { width: "100%" } },
      cells.map((c) =>
        h(
          "div",
          { style: { marginBottom: "1rem" } },
          c.cellType,
          h("div", { style: { width: "100%" } }, h(TextArea, c.source)),
        ),
      ),
    ),
};

function IPyNotebook({ path, project }) {
  const source = useSignal("");
  const augmentations = useMemo(() => [notebook], []);

  useAsyncEffect(async () => {
    source.value = await project.openFile(path);
  }, [path]);

  return h(
    "div",
    { style: { display: "flex" } },
    h(CodeMirrorWithVitrail, {
      cmExtensions: baseCMExtensions,
      fetchAugmentations: () => augmentations,
      value: source,
    }),
  );
}

export function openIPyNotebook(props, windowProps) {
  openComponentInWindow(IPyNotebook, props, {
    initialSize: { x: 300, y: 230 },
    ...windowProps,
  });
}
