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
  match,
  metaexec,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { openComponentInWindow } from "./window.js";
import { h, useAsyncEffect } from "../view/widgets.js";
import {
  baseCMExtensions,
  CodeMirrorWithVitrail,
} from "../vitrail/codemirror6.ts";
import { Augmentation, VitrailPane } from "../vitrail/vitrail.ts";
import { TraceryInlineEditor } from "./editor.ts";

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
        [objectField("cells"), (x) => x.childBlocks, capture("cells")],
      ),
    ]),
  type: "replace" as const,
  matcherDepth: 1,
  model: languageFor("json"),
  view: ({ cells }) =>
    cells.map((c) => h(VitrailPane, { nodes: [c], key: c.id })),
};

const notebookCell: Augmentation<any> = {
  match: match((capture) => [
    (x) => x.type === "object",
    all(
      [
        objectField("cell_type"),
        (x) => x.childBlock(0),
        (x) => x.text,
        capture("cellType"),
      ],
      [objectField("source"), bindPlainStringFromArray, capture("source")],
    ),
  ]),
  type: "replace" as const,
  matcherDepth: 3,
  model: languageFor("json"),
  view: ({ source: { text, onLocalChange }, cellType }) => {
    const styles = {
      markdown: {
        padding: "0.5em",
        border: "1px solid #ccc",
        borderRadius: "0.5em",
      },
      code: {
        padding: "0.5em",
        border: "1px solid #ccc",
        borderRadius: "0.5em",
        backgroundColor: "#f8f8f8",
      },
    };
    return h(
      "div",
      {
        style: { display: "inline-block", ...styles[cellType] },
      },
      h(
        "div",
        { style: { width: "100%" } },
        h(TraceryInlineEditor, {
          text,
          onLocalChange,
          language: {
            markdown: languageFor("markdown"),
            code: languageFor("python"),
          }[cellType],
        }),
      ),
    );
  },
};

function IPyNotebook({ path, project }) {
  const source = useSignal("");
  const augmentations = useMemo(() => [notebook, notebookCell], []);

  useAsyncEffect(async () => {
    source.value = await project.openFile(path);
  }, [path]);

  return h(
    "div",
    {
      style: { display: "flex", width: "100%", flex: "1 1", overflowY: "auto" },
    },
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
