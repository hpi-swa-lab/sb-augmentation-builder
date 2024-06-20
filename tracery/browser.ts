import {
  javascript,
  keymap,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageFor, languageForPath } from "../core/languages.js";
import { SBBaseLanguage } from "../core/model.js";
import { useContext, useEffect, useMemo } from "../external/preact-hooks.mjs";
import {
  batch,
  useSignal,
  useSignalEffect,
} from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { request } from "../sandblocks/host.js";
import { List } from "../sandblocks/list.js";
import {
  all,
  first,
  languageSpecific,
  metaexec,
  replace,
  spawnArray,
  type,
} from "../sandblocks/query-builder/functionQueries.js";
import { takeWhile } from "../utils.js";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import {
  Augmentation,
  Model,
  Vitrail,
  VitrailContext,
  VitrailPane,
  useValidateKeepNodes,
} from "../vitrail/vitrail.ts";
import { openComponentInWindow } from "./window.js";

function extensionsForPath(path) {
  const language = languageForPath(path);
  if (language === languageFor("javascript"))
    return { cmExtensions: [javascript()], augmentations: [browser(language)] };
  return { cmExtensions: [], augmentations: [browser(SBBaseLanguage)] };
}

function TraceryBrowser({ project, path }) {
  const files = useMemo(() => project.allSources, [project]);
  const selectedFile = useSignal(
    path ? files.find((it) => it.path === path) : files[0],
  );
  const source = useSignal("");

  useSignalEffect(() => {
    if (selectedFile.value) {
      source.value = "";
      request("readFiles", { paths: [selectedFile.value.path] }).then(
        ([file]) => (source.value = file.data),
      );
    }
  });

  const { augmentations, cmExtensions } = extensionsForPath(
    selectedFile.value.path,
  );
  return (
    selectedFile.value &&
    source.value &&
    h(CodeMirrorWithVitrail, {
      key: selectedFile.value.path,
      value: source.value,
      onChange: (v) => (source.value = v),
      augmentations,
      cmExtensions: [
        ...cmExtensions,
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              project.writeFile(selectedFile.value.path, source.value);
              return true;
            },
            preventDefault: true,
          },
        ]),
      ],
      props: { selectedFile, files, project },
    })
  );
}

export function openBrowser(project, props, windowProps) {
  openComponentInWindow(TraceryBrowser, { project, ...props }, windowProps);
}

function FullDeclarationPane({ node }) {
  const list = node.isRoot
    ? [node]
    : [
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

const emptyList = [];

function TraceryBrowserAugmentation({ topLevel, nodes }) {
  const { vitrail }: { vitrail: Vitrail<any> } = useContext(VitrailContext);
  const files = vitrail.props.value.files ?? [];
  const selectedFile = vitrail.props.value.selectedFile ?? { value: null };
  const project = vitrail.props.value.project;

  const selectedTopLevel = useSignal(null);
  const selectedMember = useSignal(null);
  const selectedNode =
    selectedMember?.value?.node ?? selectedTopLevel?.value?.node;

  useValidateKeepNodes(selectedNode ? [selectedNode] : [], nodes[0].language);

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column" } },
    h(
      "div",
      { style: { display: "flex" } },
      h(List, {
        items: files,
        selected: selectedFile.value,
        setSelected: (s) => (selectedFile.value = s),
        labelFunc: (it) => it.path.slice(project.path.length + 1),
        height: 200,
      }),
      h(List, {
        items: topLevel,
        selected: selectedTopLevel.value,
        setSelected: (s) => (selectedTopLevel.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
      h(List, {
        items: selectedTopLevel?.value?.members ?? emptyList,
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

export const browser: (model: Model) => Augmentation<any> = (model) => ({
  matcherDepth: 1,
  model,
  match(node) {
    return metaexec(node, (capture) => [
      (it) => it.isRoot,
      all(
        [replace(capture)],
        [
          first(
            [
              (it) => it.language === SBBaseLanguage,
              (it) => [{ name: "unknown", label: "Other", node: it }],
            ],
            [(it) => it.childBlocks, spawnArray(matchTopLevel)],
          ),
          capture("topLevel"),
        ],
      ),
    ]);
  },
  view: TraceryBrowserAugmentation,
});
