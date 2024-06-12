import { languageFor } from "../../core/languages.js";
import { h } from "../../external/preact.mjs";
import { PipelineBinding, all, log, metaexec } from "./functionQueries.js";
import {
  VitrailPane,
  VitrailPaneWithWhitespace,
  useValidateKeepReplacement,
} from "../../vitrail/vitrail.ts";
import { createDefaultCodeMirror } from "../../vitrail/codemirror6.ts";
import { cursorPositionsForIndex } from "../../view/focus.ts";

const query = (query, extract?) => (it) => it.query(query, extract);
const queryDeep = (query, extract?) => (it) => it.findQuery(query, extract);

export const watch = {
  model: languageFor("javascript"),
  matcherDepth: Infinity,
  rerender: () => true,
  match: (x, _pane) => {
    return metaexec(x, (capture) => [
      all(
        [
          query("metaexec($_,$_ => $pipeline)"),
          (it) => it.pipeline,
          (it) => new PipelineBinding(it),
          capture("pipeline"),
        ],
        [capture("nodes")],
      ),
    ]);
  },
  view: ({ id, pipeline, replacement }) => {
    useValidateKeepReplacement(replacement);
    console.log("pipeline");
    console.log(pipeline);
    return h(pipeline.component);
  },
};

//const s = createDefaultCodeMirror(
//  `
//  const pipeline = (node) =>
//    metaexec(node, (capture) => [
//      (it) => it.type == "program",
//      (it) => it.children,
//      all(
//        [
//          (it) => it.type == "program",
//          (it) => it.children,
//        ],
//        [
//          (it) => it.type == "program",
//          (it) => it.children,
//          all(
//            [(it) => it.type == "program",
//            (it) => it.children],
//            capture("test")
//          )
//        ],
//      )
//    ]);
//  `,
//  document.querySelector("#editor")!,
//  [watch],
//);

const v = createDefaultCodeMirror(
  `
function collectToplevel(node) {
    return metaexec(node, (capture) => [
      (it) => it.named,
      (it) => it.type != "comment",
      all(
        [(it) => new ExportBinding(it), capture("exported")],
        [
          all(
            [(it) => getDisplayNodes(it), capture("displayNodes")],
            [
              (it) => (it.type == "export_statement" ? it.children[2] : it),
              all(
                [capture("node")],
                [(it) => it.type, capture("type")],
                [
                  first(
                    [
                      (it) => it.type == "class_declaration",
                      //Thing about queryAndCapture methode
                      (it) => it.query("class $name {$$$members}"),
                    ],
                    [
                      (it) => it.type == "import_statement",
                      (it) => it.query("import {$$$members} from '$name'"),
                    ],
                    [
                      (it) => it.type == "function_declaration",
                      (it) => it.children.find((it) => it.type == "identifier"),
                      (it) => ({ name: it, members: [] }),
                    ],
                  ),
                  all(
                    [(it) => it.name.text, capture("name")],
                    [
                      (it) => it.members,
                      spawnArray(collectMembers),
                      capture("members"),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      capture("node"),
    ]);
  }

  const pipeline = (node) =>
    metaexec(node, (capture) => [
      (it) => it.type == "program",
      (it) => it.children,
      spawnArray(collectToplevel),
      capture("topLevel"),
    ]);
      `,
  document.querySelector("#editor")!,
  [watch],
);