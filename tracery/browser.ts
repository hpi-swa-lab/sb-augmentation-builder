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

function augmentationsForPath(path) {
  const language = languageForPath(path);
  if (language === languageFor("javascript")) return [browser(language)];
  return [browser(SBBaseLanguage)];
}

function TraceryBrowser() {
  const files = useSignal([]);
  const selectedFile = useSignal(null);
  const source = useSignal("");

  useEffect(() => {
    (async () => {
      // TODO
      const rootPath = "/home/tom/Code/squeak/sb-js";
      const root = await request("openProject", {
        path: rootPath,
      });
      const out: { path: string; hash: string }[] = [];
      const recurse = (file, path) => {
        if (file.children)
          file.children.forEach((child) =>
            recurse(child, path + "/" + file.name),
          );
        else
          out.push({
            path: path + "/" + file.name,
            hash: file.hash,
          });
      };
      for (const child of root.children) recurse(child, rootPath);
      batch(() => {
        source.value = "";
        files.value = out;
        selectedFile.value = out[0];
      });
    })();
  }, []);

  useSignalEffect(() => {
    if (selectedFile.value) {
      source.value = "";
      request("readFiles", { paths: [selectedFile.value.path] }).then(
        ([file]) => (source.value = file.data),
      );
    }
  });

  return (
    selectedFile.value &&
    source.value &&
    h(CodeMirrorWithVitrail, {
      key: selectedFile.value.path,
      value: source.value,
      onChange: (v) => (source.value = v),
      augmentations: augmentationsForPath(selectedFile.value.path),
      props: { selectedFile, files },
    })
  );
}

export function openBrowser() {
  openComponentInWindow(TraceryBrowser, {});
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
  const files = vitrail.props.value.files ?? { value: [] };
  const selectedFile = vitrail.props.value.selectedFile ?? { value: null };

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
        items: files.value,
        selected: selectedFile.value,
        setSelected: (s) => (selectedFile.value = s),
        labelFunc: (it) => it.path,
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
