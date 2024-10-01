import { SBBaseLanguage } from "../core/model.js";
import {
  all,
  first,
  languageSpecific,
  metaexec,
  replace,
  spawnArray,
  type,
} from "../sandblocks/query-builder/functionQueries.js";
import { truncateString, withDo } from "../utils.js";

function matchClassMember(node) {
  return metaexec(node, (capture) => [
    replace(capture),
    first(
      [
        type("method_definition"),
        all(
          [(it) => it.atField("name")?.text, capture("name")],
          [(it) => "Method", capture("label")],
          [(it) => "symbol-method", capture("icon")],
        ),
      ],
      [
        type("field_definition"),
        all(
          [(it) => it.atField("property")?.text, capture("name")],
          [(it) => "Field", capture("label")],
          [(it) => "symbol-field", capture("icon")],
        ),
      ],
      [
        all(
          [(it) => truncateString(it.sourceString, 25), capture("name")],
          [(it) => "Other", capture("label")],
          [(it) => "symbol-misc", capture("icon")],
        ),
      ],
    ),
  ]);
}

function matchTopLevel(node) {
  return metaexec(node, (capture) => [
    replace(capture),
    first(
      [
        languageSpecific(
          ["javascript", "typescript"],
          first(
            [type("export_statement"), (it) => it.childBlock(0)],
            [(it) => it],
          ),
          first(
            [
              type("import_statement"),
              all(
                [(it) => "Import", capture("label")],
                [(it) => it.sourceString.slice(7), capture("name")],
                [(it) => "symbol-interface", capture("icon")],
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
                [(it) => "symbol-variable", capture("icon")],
              ),
            ],
            [
              type("function_declaration"),
              (it) =>
                withDo(
                  it.atField("name")?.text?.[0],
                  (firstLetter) => firstLetter.toUpperCase() === firstLetter,
                ),
              all(
                [(it) => it.atField("name")?.text, capture("name")],
                [(it) => "Component", capture("label")],
                [(it) => "symbol-parameter", capture("icon")],
              ),
            ],
            [
              type("function_declaration"),
              all(
                [(it) => it.atField("name")?.text, capture("name")],
                [(it) => "Function", capture("label")],
                [(it) => "symbol-method", capture("icon")],
              ),
            ],
            [
              type("class_declaration"),
              all(
                [(it) => it.atField("name")?.text, capture("name")],
                [(it) => "Class", capture("label")],
                [(it) => "symbol-class", capture("icon")],
                [
                  (it) => it.atField("body")?.childBlocks,
                  spawnArray(matchClassMember),
                  capture("members"),
                ],
              ),
            ],
            [
              all(
                [(it) => truncateString(it.sourceString, 25), capture("name")],
                [(it) => "Other", capture("label")],
                [(it) => "symbol-misc", capture("icon")],
              ),
            ],
          ),
        ),
      ],
      [
        all(
          [(it) => it.type.replace(/_/g, " "), capture("name")],
          [(it) => "Other", capture("label")],
          [(it) => "symbol-misc", capture("icon")],
        ),
      ],
    ),
  ]);
}

function mergeGroups(nodes) {
  const out: any[] = [];
  for (const symbol of nodes) {
    if (symbol.label === "Import") {
      const last = out[out.length - 1];
      if (last && last.label === "Import") {
        last.nodes.push(symbol.nodes[0]);
      } else {
        out.push({
          name: "imports",
          label: "Import",
          nodes: [symbol.nodes[0]],
          icon: "symbol-interface",
        });
      }
      continue;
    }
    out.push(symbol);
  }
  return out;
}

export function outline(node) {
  return metaexec(node, (capture) => [
    (it) => it.isRoot,
    all([
      first(
        [
          (it) => it.language === SBBaseLanguage,
          (it) => [
            {
              name: "unknown",
              label: "Other",
              nodes: [it],
              icon: "symbol-misc",
            },
          ],
        ],
        [(it) => it.childNodes, spawnArray(matchTopLevel)],
      ),
      mergeGroups,
      capture("topLevel"),
    ]),
  ])!.topLevel;
}
