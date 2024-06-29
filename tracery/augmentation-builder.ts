import { languageFor } from "../core/languages.js";
import { SBNode, extractType } from "../core/model.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  metaexec,
  type,
  all,
  query,
  queryDeep,
  captureAll,
  debugIt,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";
import { openBrowser } from "./browser.ts";
import { FileProject } from "./project.js";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

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

(window as any).languageFor = languageFor;
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
    const augmentation = useMemo(() => {
      try {
        const aug = node.cloneOffscreen();
        aug
          .findQuery("metaexec($_args)")
          ?.args?.insert("'debugID'", "expression", 9e8);
        // FIXME return eval(`const a = ${aug.sourceString}; a`);
      } catch (e) {
        console.log("Failed to eval augmentation", e);
      }
    }, [node.sourceString]);
    return h(
      "div",
      { style: { display: "flex", border: "1px solid #333" } },
      h(
        "div",
        {},
        h("strong", {}, "Match"),
        h("div", {}, h(VitrailPane, { nodes: [match] })),
        h("hr"),
        h("strong", {}, "View"),
        h("div", {}, h(VitrailPane, { nodes: [view] })),
      ),
      h(
        "table",
        { style: { width: 400 } },
        h(
          "tr",
          { style: { height: "1rem" } },
          h("td", {}, "Examples"),
          h("td", {}, "Preview"),
        ),
        h(NodeArray, {
          container: examples,
          wrap: (it) => it,
          view: (it, ref, onmousemove, onmouseleave) => {
            const e = bindPlainString(it);
            return h(
              "tr",
              { ref, onmousemove, onmouseleave },
              h("td", {}, h(TextArea, { ...e, style: { width: "100%" } })),
              h(
                "td",
                {},
                h(CodeMirrorWithVitrail, {
                  // FIXME currently destroys and recreates the entire editor.
                  // can we do it incrementally?
                  key: node.sourceString,
                  value: e.text,
                  augmentations: augmentation ? [augmentation] : [],
                }),
              ),
            );
          },
        }),
      ),
    );
  },
});
