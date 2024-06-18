import { languageFor } from "../core/languages.js";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { List } from "../sandblocks/list.js";
import {
  all,
  first,
  metaexec,
  replace,
  spawnArray,
  type,
} from "../sandblocks/query-builder/functionQueries.js";
import { takeWhile } from "../utils.js";
import { Augmentation, VitrailPane } from "../vitrail/vitrail.ts";
import { openComponentInWindow } from "./window.js";

function FullDeclarationPane({ node }) {
  const list = [
    ...takeWhile(
      node.parent.children.slice(0, node.siblingIndex).reverse(),
      (c) => c.isWhitespace() || c.type === "comment",
    ),
    node,
    ...takeWhile(
      node.parent.children.slice(node.siblingIndex + 1),
      (c) => c.isWhitespace() || c.type === "comment",
    ),
  ];

  return h(
    "div",
    { style: { flexDirection: "column" } },
    h(
      "div",
      {},
      h(
        "button",
        {
          onclick: () => {
            openComponentInWindow(FullDeclarationPane, { node });
          },
        },
        "Open",
      ),
    ),
    h(VitrailPane, { nodes: list }),
  );
}

function TraceryBrowser({ topLevel }) {
  const selectedTopLevel = useSignal(null);
  const selectedMember = useSignal(null);
  const selectedNode =
    selectedMember?.value?.node ?? selectedTopLevel?.value?.node;

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column" } },
    h(
      "div",
      { style: { display: "flex" } },
      h(List, {
        items: topLevel,
        selected: selectedTopLevel.value,
        setSelected: (s) => (selectedTopLevel.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
      h(List, {
        items: selectedTopLevel?.value?.members ?? [],
        selected: selectedMember.value,
        setSelected: (s) => (selectedMember.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
    ),
    selectedNode && h(FullDeclarationPane, { node: selectedNode }),
    // selectedNode && h(VitrailPane, { nodes: [selectedNode] }),
  );
}

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
    first([type("export_statement"), (it) => it.childBlock(0)], [(it) => it]),
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
  ]);
}

export const browser: Augmentation<any> = {
  matcherDepth: 1,
  model: languageFor("javascript"),
  match(node) {
    return metaexec(node, (capture) => [
      type("program"),
      all(
        [replace(capture)],
        [
          (it) => it.childBlocks,
          spawnArray(matchTopLevel),
          capture("topLevel"),
        ],
      ),
    ]);
  },
  view: TraceryBrowser,
};
