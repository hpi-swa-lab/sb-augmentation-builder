import { SBBlock, SBNode } from "../core/model.js";
import { useEffect, useMemo, useRef } from "../external/preact-hooks.mjs";
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
import {
  useComputed,
  useSignal,
  useSignalEffect,
} from "../external/preact-signals.mjs";
import { randomId, rangeSize, replaceRange, rangeShift } from "../utils.js";
import {
  Codicon,
  useAsyncEffect,
  useDebouncedEffect,
} from "../view/widgets.js";
import { objectToString } from "./query-builder.ts";
import { removeCommonIndent } from "./whitespace.ts";

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
  type: "replace" as const,
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
  const path = (node.atField("source") as any).childBlock(0);

  // TODO not sure how to resolve this properly yet
  // full URL is needed since we are using a dynamic import without path
  return replaceRange(
    node.sourceString,
    rangeShift(path.range, -node.range[0]) as [number, number],
    path.text.replace(/^\./, "https://localhost:3000"),
  );
}

async function execAugmentation(node: SBBlock, debugId: string) {
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
  return (
    await import("data:text/javascript;charset=utf-8;base64," + btoa(src))
  ).a;
}

export const augmentationBuilder = (model) => ({
  type: "replace" as const,
  matcherDepth: 8,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      type("object"),
      query(
        `({
        type: $type,
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
    //const debugId = useMemo(() => randomId().toString(), []);
    const debugId = -1;
    const debugHistoryAug = useComputed(() =>
      debugHistory.value ? debugHistory.value : new Map(),
    );
    const vitrailRef = useRef(null);
    useSignalEffect(() => {
      // subscribe
      augmentation.value;

      vitrailRef.current?.updateAugmentationList();
    });

    useDebouncedEffect(
      500,
      () => {
        debugHistory.value = new Map(
          debugHistory.value.set(`suc_${debugId}`, false),
        );
        execAugmentation(node, `${debugId}`)
          .then((a) => (augmentation.value = a))
          .catch((e) => console.log("Failed to eval augmentation", e));
      },
      [node.sourceString, evalRange.value, augmentation],
    );

    const exampleSelectionRange = useSignal([0, 0]);
    const viewExpanded = useSignal(true);

    const removeIndent = useMemo(() => removeCommonIndent([view]), [view]);

    return h(
      "div",
      {
        style: {
          display: "flex",
          border: "1px solid #333",
          boxShadow: "0 8px 8px -4px gray",
        },
        focusable: true,
      },
      h(
        "div",
        {},
        h("strong", {}, "Match"),
        h(
          "div",
          { style: { overflow: "auto", maxWidth: "100%" } },
          h(VitrailPane, { nodes: [match], props: { debugId } }),
        ),
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
        "div",
        { style: { boxShadow: "0 8px 8px -4px gray" } },

        h(
          "div",
          {
            style: { display: "flex", flexDirection: "row" },
            onclick: () => (viewExpanded.value = !viewExpanded.value),
          },
          h("strong", {}, "View"),
          h(Codicon, {
            name: viewExpanded.value ? "chevron-up" : "chevron-down",
            style: { width: "1rem" },
          }),
        ),
        viewExpanded.value
          ? h(
              "div",
              {},
              h(VitrailPane, {
                nodes: [view],
                fetchAugmentations: (p) => [
                  ...p.fetchAugmentations(),
                  removeIndent,
                ],
              }),
            )
          : null,
        h("hr"),
        h(
          "div",
          { style: { boxShadow: "0 8px 8px -4px gray" } },
          h(
            "div",
            {},
            h("strong", {}, "Examples"),
            h(
              "table",
              {
                style: {
                  maxWidth: "550px",
                  width: "100%",
                  tableLayout: "fixed",
                },
              },
              h(
                "tr",
                { style: { height: "1rem" } },
                h("td", {}, "Code"),
                h("td", {}, "Preview"),
              ),
              h(NodeArray, {
                insertItem: () => "['', [0, 0]]",
                container: examples,
                wrap: (it) => it,
                view: (it, ref, onmousemove, onmouseleave) => {
                  const e = bindPlainString(it.childBlock(0));
                  const text = useSignal(e.text);
                  useEffect(() => {
                    if (e.text !== text.value) text.value = e.text;
                  }, [e.text]);
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
                        style: {
                          width: "100%",
                          minWidth: "250px",
                          border: "1px solid #ccc",
                        },
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
                        vitrailRef: vitrailRef,
                        value: text,
                        fetchAugmentations: () =>
                          augmentation.value ? [augmentation.value] : [],
                      }),
                    ),
                  );
                },
              }),
            ),
          ),
        ),
      ),
    );
  },
});
