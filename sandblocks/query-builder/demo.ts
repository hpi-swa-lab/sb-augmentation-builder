import { languageFor } from "../../core/languages.js";
import { h } from "../../external/preact.mjs";
import {
  PipelineBinding,
  all,
  log,
  metaexec,
  replace,
} from "./functionQueries.js";
import {
  VitrailPane,
  VitrailPaneWithWhitespace,
  useValidateKeepReplacement,
} from "../../vitrail/vitrail.ts";
import { createDefaultCodeMirror } from "../../vitrail/codemirror6.ts";
import { cursorPositionsForIndex } from "../../view/focus.ts";

const query = (query, extract?) => (it) => it.query(query, extract);
const queryDeep = (query, extract?) => (it) => it.findQuery(query, extract);

export const pipelineBuilder = {
  model: languageFor("javascript"),
  matcherDepth: Infinity,
  rerender: () => true,
  match: (x, _pane) => {
    return metaexec(x, (capture) => [
      all(
        [
          query("metaexec($a,$b => $pipeline)"),
          (it) => it.pipeline,
          (it) => new PipelineBinding(it),
          capture("pipeline"),
        ],
        [replace(capture)],
      ),
    ]);
  },
  view: ({ id, pipeline, replacement }) => {
    useValidateKeepReplacement(replacement);
    return pipeline.component();
  },
};

//const s = createDefaultCodeMirror(
//  `
//  const pipeline = (node) =>
//    metaexec(node, (capture) => [
//          (it) => it.type == "program2",
//          (it) => it.type == "program2",
//      all(
//        [
//          (it) => it.type == "program2",
//          (it) => it.children,
//        ]
//      )
//    ]);
//  `,
//  document.querySelector("#editor")!,
//  [pipelineBuilder],
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
                      type("class_declaration"),
                      query("class $name {$$$members}"),
                    ],
                    [
                      type("import_statement"),
                      query("import {$$$members} from '$name'"),
                    ],
                    [
                      type("function_declaration"),
                      (it) => it.children.find((it) => it.type == "identifier"),
                      all(
                        [(it) => it.name],
                        [(it) => it.members]
                      ),
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
    ]);
  }

  const pipeline = (node) =>
    metaexec(node, (capture) => [
      type("program"),
      (it) => it.children,
      spawnArray(collectToplevel),
      capture("topLevel"),
    ]);
      `,
  document.querySelector("#editor")!,
  [pipelineBuilder],
);
