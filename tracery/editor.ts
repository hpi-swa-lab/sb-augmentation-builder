import { vim, Vim } from "../codemirror6/external/codemirror-vim.mjs";
import {
  drawSelection,
  lineNumbers,
  keymap,
  javascript,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageForPath, languageFor } from "../core/languages.js";
import { SBBaseLanguage, SBBlock, SBNode } from "../core/model.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  metaexec,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { last, takeWhile } from "../utils.js";
import {
  CodeMirrorWithVitrail,
  baseCMExtensions,
  PaneFacet,
} from "../vitrail/codemirror6.ts";
import { placeholder } from "../vitrail/placeholder.ts";
import {
  Augmentation,
  Model,
  SelectionInteraction,
  Vitrail,
  VitrailContext,
  VitrailPane,
  useValidateKeepNodes,
  useVitrailProps,
} from "../vitrail/vitrail.ts";
import {
  augmentationBuilder,
  openNewAugmentation,
} from "./augmentation-builder.ts";
import { format } from "./format.js";
import { queryBuilder } from "./query-builder.ts";
import { openReferences } from "./references.ts";
import { watch, wrapWithWatch } from "./watch.ts";
import { openComponentInWindow, parentWindow } from "./window.js";

function defineAction(bind, name) {
  Vim.defineAction(name, (cm) =>
    cm.cm6.state.facet(PaneFacet).vitrail.dispatchEvent(new CustomEvent(name)),
  );
  Vim.mapCommand(bind, "action", name);
}
defineAction("gn", "showsenders");
defineAction("gm", "showimplementors");
defineAction("<C-q>", "wrapwithwatch");
defineAction("<C-a>", "createaugmentation");

Vim.map("jk", "<Esc>", "insert");
Vim.mapCommand("<C-e>", "action", "quit");
Vim.defineEx("write", "w", (cm) =>
  cm.cm6.state.facet(PaneFacet).vitrail.dispatchEvent(new CustomEvent("save")),
);
Vim.defineEx(
  "quit",
  "q",
  (cm) => (parentWindow(cm.cm6.state.facet(PaneFacet).view) as any)?.close(),
);
Vim.defineAction(
  "quit",
  (cm) => (parentWindow(cm.cm6.state.facet(PaneFacet).view) as any)?.close(),
);

function extensionsForPath(path): {
  cmExtensions: any[];
  augmentations: Augmentation<any>[];
} {
  const language = languageForPath(path);
  if (language === languageFor("javascript"))
    return {
      cmExtensions: [javascript()],
      augmentations: [
        augmentationBuilder(language),
        queryBuilder(language),
        watch(language),
        // uiBuilder(language),
        placeholder(language),
      ],
    };
  if (language === languageFor("typescript"))
    return {
      cmExtensions: [javascript({ typescript: true })],
      augmentations: [
        augmentationBuilder(language),
        queryBuilder(language),
        watch(language),
        // uiBuilder(language),
        placeholder(language),
      ],
    };
  return { cmExtensions: [], augmentations: [] };
}

function FullDeclarationPane({ nodes, ...props }) {
  useValidateKeepNodes(nodes, nodes[0].language);

  const list = nodes[0].isRoot
    ? nodes
    : [
        ...takeWhile(
          nodes[0].parent.children.slice(0, nodes[0].siblingIndex).reverse(),
          (c) => c.isWhitespace() || c.type === "comment",
        ),
        ...nodes,
        ...takeWhile(
          last(nodes).parent.children.slice(last(nodes).siblingIndex + 1),
          (c) => c.isWhitespace() || c.type === "comment",
        ),
      ];

  return h(VitrailPane, {
    ...props,
    nodes: list,
    className: "pane-full-width",
    hostOptions: {
      cmExtensions: [
        lineNumbers({
          formatNumber: (line, state) =>
            (
              (state.facet(PaneFacet as any) as any).startLineNumber +
              line -
              1
            ).toString(),
        }),
      ],
    },
  });
}

const singleDeclaration: (model: Model) => Augmentation<any> = (model) => ({
  type: "replace" as const,
  matcherDepth: 1,
  model,
  selectionInteraction: SelectionInteraction.Skip,
  match(node) {
    return metaexec(node, (capture) => [(it) => it.isRoot, replace(capture)]);
  },
  view: ({ nodes: topLevel }) => {
    const nodes = useVitrailProps().nodes ?? topLevel;
    return h(FullDeclarationPane, { nodes, key: nodes[0].id });
  },
});

function FullDeclarationPaneWindow({ nodes, ...props }) {
  return h(
    VitrailContext.Provider,
    { value: { vitrail: nodes[0].editor } },
    h(
      "div",
      { style: { height: "100%", overflowY: "auto" } },
      h(FullDeclarationPane, { nodes, ...props }),
    ),
  );
}
export function openNodesInWindow(nodes: SBNode[], props: any = {}) {
  openComponentInWindow(FullDeclarationPaneWindow, { nodes, ...props });
}

export function TraceryEditor({ project, path, nodes, window, onLoad }) {
  const source = useSignal(null);
  const diagnostics = useSignal([]);
  const vitrail: { value: Vitrail<any> } = useSignal(null);

  useEffect(() => {
    if (path) {
      source.value = null;
      project.openFile(path).then((data) => (source.value = data));
    }
  }, [path]);

  useEffect(() => {
    const languageClient = project.languageClientFor(languageForPath(path));
    if (!languageClient) return;

    const handler = ({ detail: { path: p, diagnostics: d } }) => {
      if (p === path) diagnostics.value = d;
    };
    languageClient.addEventListener("diagnostics", handler);
    return () => languageClient.removeEventListener("diagnostics", handler);
  }, [path]);

  const { augmentations, cmExtensions } = extensionsForPath(path);

  const formatAndSave = async () => {
    if (vitrail.value) await format(vitrail.value, path);
    project.writeFile(path, source.value);
  };

  const findReferences = async (type: "implementors" | "senders") => {
    const symbol = vitrail.value.selectedNode().text;
    openReferences(project, symbol, type);
  };

  const _wrapWithWatch = () => {
    const node = vitrail.value
      .selectedNode()
      ?.orParentThat((n) => n.isExpression);
    wrapWithWatch(node);
  };

  const language = languageForPath(path) ?? SBBaseLanguage;
  return (
    path &&
    source.value !== null &&
    h(CodeMirrorWithVitrail, {
      onLoad: (v) => {
        vitrail.value = v;
        onLoad?.(v);
      },
      className: "tracery-browser",
      key: path,
      value: source,
      onSave: () => formatAndSave(),
      onQuit: () => window?.close(),
      onshowsenders: () => findReferences("senders"),
      onshowimplementors: () => findReferences("implementors"),
      onwrapwithwatch: () => _wrapWithWatch(),
      onchange: (e) => project.onChangeFile({ ...e.detail, path }),
      oncreateaugmentation: () =>
        vitrail.value &&
        openNewAugmentation(
          project,
          vitrail.value.selectedString() ?? "",
          vitrail.value.selectedNode(),
        ),
      augmentations: <Augmentation<any>[]>[
        ...augmentations,
        singleDeclaration(language),
        // {
        //  type: "mark" as const,
        //   model: SBBaseLanguage,
        //   matcherDepth: 1,
        //   match: (node) =>
        //     node instanceof SBBlock && node.type === "document" && {},
        //   view: () =>
        //     diagnostics.value.map((d) => ({ relativeRange: [], style: {} })),
        // },
      ],
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
          {
            key: "Mod-q",
            run: () => {
              _wrapWithWatch();
              return true;
            },
            preventDefault: true,
          },
        ]),
      ],
      props: { project, nodes },
    })
  );
}