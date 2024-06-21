import { SBBaseLanguage } from "../core/model.js";
import {
  all,
  first,
  languageSpecific,
  metaexec,
  spawnArray,
  type,
} from "../sandblocks/query-builder/functionQueries.js";

function matchClassMember(node) {
  return metaexec(node, (capture) => [
    capture("node"),
    first(
      [
        type("method_definition"),
        all(
          [(it) => it.atField("name")?.text, capture("name")],
          [(it) => "Method", capture("label")],
        ),
      ],
      [
        type("field_definition"),
        all(
          [(it) => it.atField("name")?.text, capture("name")],
          [(it) => "Field", capture("label")],
        ),
      ],
    ),
  ]);
}

function matchTopLevel(node) {
  return metaexec(node, (capture) => [
    capture("node"),
    first(
      [
        languageSpecific(
          "javascript",
          first(
            [type("export_statement"), (it) => it.childBlock(0)],
            [(it) => it],
          ),
          first(
            [
              type("import"),
              all(
                ["Import", capture("label")],
                [(it) => it.sourceString, capture("name")],
              ),
            ],
            [
              type("lexical_declaration"),
              all(
                [
                  (it) => it.childBlocks,
                  (it) => it.map((it) => it.atField("name")?.text).join(", "),
                  capture("name"),
                ],
                [(it) => "Declaration", capture("label")],
              ),
            ],
            [
              type("function_declaration"),
              all(
                [(it) => it.atField("name")?.text, capture("name")],
                [(it) => "Function", capture("label")],
              ),
            ],
            [
              type("class_declaration"),
              all(
                [(it) => it.atField("name")?.text, capture("name")],
                [(it) => "Class", capture("label")],
                [
                  (it) => it.atField("body")?.childBlocks,
                  spawnArray(matchClassMember),
                  capture("members"),
                ],
              ),
            ],
            [
              all(
                [(it) => it.sourceString, capture("name")],
                [(it) => "Other", capture("label")],
              ),
            ],
          ),
        ),
      ],
      [
        all(
          [(it) => "unknown", capture("name")],
          [(it) => "Other", capture("label")],
        ),
      ],
    ),
  ]);
}

export function outline(node) {
  return metaexec(node, (capture) => [
    (it) => it.isRoot,
    all([
      first(
        [
          (it) => it.language === SBBaseLanguage,
          (it) => [{ name: "unknown", label: "Other", node: it }],
        ],
        [(it) => it.childBlocks, spawnArray(matchTopLevel)],
      ),
      capture("topLevel"),
    ]),
  ])?.topLevel;
}
