import { SBBlock, SBNode } from "../core/model.js";
import { useEffect, useMemo } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  metaexec,
  type,
  query,
  captureAll,
  spawnArray,
  getDebugHistory,
  debugHistory,
  evalRange,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";
import { openBrowser } from "./browser.ts";
import { FileProject } from "./project.js";
import { useComputed, useSignal } from "../external/preact-signals.mjs";
import { randomId, rangeSize } from "../utils.js";
import { useAsyncEffect } from "../view/widgets.js";
import { objectToString } from "./query-builder.ts";

export async function openNewAugmentation(
  project: FileProject,
  example: string,
  node: SBNode,
) {
  const name = prompt("Name of the augmentation");
  const template = `import { languageFor } from "./core/languages.js";
import { metaexec, all, } from "./sandblocks/query-builder/functionQueries.js";
import { h } from "./external/preact.mjs";

export const ${name} = {
  matcherDepth: Infinity,
  model: languageFor("${node.language.name}"),
  examples: [${JSON.stringify(example)}],
  match: (it) => metaexec(it, (capture) => [query(${JSON.stringify(example)})]),
  view: ({ nodes }) => h("div", {}, "Augmentation"),
  rerender: () => true,
}`;
  await project.createFile(name + ".ts", template);
  openBrowser(project, {
    initialSelection: {
      topLevel: name,
      path: project.path + "/" + name + ".ts",
    },
  });
}

function getAbsolutePath(node: SBBlock) {
  const n = node.cloneOffscreen();
  const path = (n.atField("source") as any).childBlock(0);
  // TODO not sure how to resolve this properly yet
  // full URL is needed since we are using a dynamic import without path
  path.replaceWith(path.text.replace(/^\./, "https://localhost:3000"));
  return n.sourceString;
}

export const augmentationBuilder = (model) => ({
  matcherDepth: 8,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      type("object"),
      query(
        `({
        matcherDepth: $depth,
        model: $model,
        match: $match,
        view: $view,
        rerender: $rerender,
        (?examples: [$_examples]?)
      })`,
        "object",
      ),
      captureAll(capture),
    ]),
  view: ({ examples, match, view, nodes: [node] }) => {
    const augmentation = useSignal(null);
    const debugId = useMemo(() => randomId().toString(), []);
    const debugHistoryAug = useComputed(() =>
      debugHistory.value ? debugHistory.value : new Map(),
    );

    useAsyncEffect(async () => {
      debugHistory.value = new Map(
        debugHistory.value.set(`suc_${debugId}`, false),
      );
      try {
        const aug = node.cloneOffscreen();
        aug
          .findQuery("metaexec($_args)")
          ?.args?.insert(`"${debugId}"`, "expression", 9e8);
        const imports =
          metaexec(node.root, (capture) => [
            (it) => it.childBlocks,
            spawnArray((it) =>
              metaexec(it, (capture) => [
                type("import_statement"),
                getAbsolutePath,
                capture("source"),
              ]),
            ),
            capture("imports"),
          ])
            ?.imports?.map((i) => i.source)
            .join("\n") ?? "";
        const src = `${imports}
        export const a = ${aug.sourceString}`;
        const a = (
          await import("data:text/javascript;charset=utf-8;base64," + btoa(src))
        ).a;
        augmentation.value = a;
        //console.log("Aug");
        //console.log(augmentation.value);
        //console.log(debugHistory.value.get(`suc_${debugId}`));
      } catch (e) {
        console.log("Failed to eval augmentation", e);
      }
    }, [node.sourceString, evalRange.value]);

    const exampleSelectionRange = useSignal([0, 0]);

    if (debugHistoryAug.value.has(`fin_${debugId}`))
      console.log(debugHistory.value.get(`fin_${debugId}`));

    return h(
      "div",
      {
        style: { display: "flex", border: "1px solid #333" },
        focusable: true,
      },
      h(
        "div",
        {},
        h("strong", {}, "Match"),
        h("div", {}, h(VitrailPane, { nodes: [match], props: { debugId } })),
        h("hr"),
        h("strong", {}, "View"),
        h("div", {}, h(VitrailPane, { nodes: [view] })),
        //h("strong", {}, "History"),
        //h(
        //  "div",
        //  {},
        //  debugHistoryAug.value.has(`fin_${debugId}`)
        //    ? debugHistoryAug.value
        //        .get(`fin_${debugId}`)
        //        .map((it) =>
        //          h(
        //            "div",
        //            {},
        //            `id: ${it.id.toString()}, ${objectToString(it, 1, true)}`,
        //          ),
        //        )
        //    : null,
        //),
      ),
      h(
        "table",
        { style: { maxWidth: "500px", width: "100%", tableLayout: "fixed" } },
        h(
          "tr",
          { style: { height: "1rem" } },
          h("td", {}, "Examples"),
          h("td", {}, "Preview"),
        ),
        h(NodeArray, {
          insertItem: () => "['', [0, 0]]",
          container: examples,
          wrap: (it) => it,
          view: (it, ref, onmousemove, onmouseleave) => {
            const e = bindPlainString(it.childBlock(0));
            return h(
              "tr",
              { ref, onmousemove, onmouseleave },
              h(
                "td",
                {},
                h(TextArea, {
                  ...e,
                  onLocalSelectionChange: (textarea) => {
                    exampleSelectionRange.value = [
                      textarea.selectionStart,
                      textarea.selectionEnd,
                    ];
                  },
                  style: { width: "100%", border: "1px solid #ccc" },
                }),
                h(
                  "button",
                  {
                    style: {
                      visibility:
                        rangeSize(exampleSelectionRange.value) > 0
                          ? "visible"
                          : "hidden",
                    },
                    onclick: () => {
                      evalRange.value = [
                        exampleSelectionRange.value[0],
                        exampleSelectionRange.value[1],
                      ];
                      exampleSelectionRange.value = [0, 0];
                      augmentation.value = null;
                    },
                  },
                  "Mark for Feedback",
                ),
              ),
              h(
                "td",
                {},
                h(CodeMirrorWithVitrail, {
                  // FIXME currently destroys and recreates the entire editor.
                  // can we do it incrementally?
                  key: augmentation.value,
                  value: { value: e.text },
                  augmentations: augmentation.value ? [augmentation.value] : [],
                }),
              ),
            );
          },
        }),
      ),
    );
  },
});
