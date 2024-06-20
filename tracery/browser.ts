import {
  EditorView,
  defaultHighlightStyle,
  drawSelection,
  javascript,
  keymap,
  syntaxHighlighting,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageFor, languageForPath } from "../core/languages.js";
import { SBBaseLanguage } from "../core/model.js";
import { useContext, useMemo, useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
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
import { appendCss, takeWhile } from "../utils.js";
import {
  CodeMirrorWithVitrail,
  baseCMExtensions,
} from "../vitrail/codemirror6.ts";
import { vim } from "../codemirror6/external/codemirror-vim.mjs";
import {
  Augmentation,
  Model,
  Vitrail,
  VitrailContext,
  VitrailPane,
  useValidateKeepNodes,
} from "../vitrail/vitrail.ts";
import { format } from "./format.js";
import { openComponentInWindow } from "./window.js";

appendCss(`
.tracery-browser {
  display: flex;
  height: 0;
  flex: 1 1 0;
  width: 100%;
}
.tracery-browser > .cm-editor {
  width: 100%;
}
  
.pane-full-width > .cm-editor {
  width: 100%;
}`);

function extensionsForPath(path) {
  const language = languageForPath(path);
  if (language === languageFor("javascript"))
    return { cmExtensions: [javascript()], augmentations: [] };
  return { cmExtensions: [], augmentations: [browser(SBBaseLanguage)] };
}

function TraceryBrowser({ project, path }) {
  const files = useMemo(() => project.allSources, [project]);
  const selectedFile = useSignal(
    path ? files.find((it) => it.path === path) : files[0],
  );
  const source = useSignal("");
  const vitrailRef = useRef();

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

  const formatAndSave = async () => {
    if (vitrailRef.current)
      await format(vitrailRef.current, selectedFile.value.path);
    project.writeFile(selectedFile.value.path, source.value);
  };

  return (
    selectedFile.value &&
    source.value &&
    h(CodeMirrorWithVitrail, {
      vitrailRef,
      className: "tracery-browser",
      key: selectedFile.value.path,
      value: source.value,
      onChange: (v) => (source.value = v),
      augmentations,
      cmExtensions: [
        vim(),
        ...cmExtensions,
        ...baseCMExtensions,
        drawSelection(),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              formatAndSave();
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

function FullDeclarationPane({ node, style }) {
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
    { style: { flexDirection: "column", ...style } },
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
    h(VitrailPane, { nodes: list, className: "pane-full-width" }),
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
        style: { flex: 1, maxWidth: "250px" },
        items: files,
        selected: selectedFile.value,
        setSelected: (s) => (selectedFile.value = s),
        labelFunc: (it) => it.path.slice(project.path.length + 1),
        height: 200,
      }),
      h(List, {
        style: { flex: 1, maxWidth: "250px" },
        items: topLevel,
        selected: selectedTopLevel.value,
        setSelected: (s) => (selectedTopLevel.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
      h(List, {
        style: { flex: 1, maxWidth: "250px" },
        items: selectedTopLevel?.value?.members ?? emptyList,
        selected: selectedMember.value,
        setSelected: (s) => (selectedMember.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
    ),
    selectedNode &&
      h(FullDeclarationPane, { node: selectedNode, style: { width: "100%" } }),
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
