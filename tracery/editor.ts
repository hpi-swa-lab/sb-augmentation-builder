import { vim, Vim } from "../codemirror6/external/codemirror-vim.mjs";
import {
  drawSelection,
  lineNumbers,
  keymap,
  javascript,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageForPath, languageFor } from "../core/languages.js";
import { SBBaseLanguage, SBNode } from "../core/model.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { request } from "../sandblocks/host.js";
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
import { augmentationBuilder } from "./augmentation-builder.ts";
import { format } from "./format.js";
import { openReferences } from "./references.ts";
import { uiBuilder } from "./ui-builder.ts";
import { watch, wrapWithWatch } from "./watch.js";
import { openComponentInWindow, parentWindow } from "./window.js";

Vim.map("jk", "<Esc>", "insert");
Vim.mapCommand("<C-e>", "action", "quit");
Vim.mapCommand("<C-q>", "action", "wrapwithwatch");
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
Vim.defineAction("wrapwithwatch", (cm) =>
  cm.cm6.state
    .facet(PaneFacet)
    .vitrail.dispatchEvent(new CustomEvent("wrapwithwatch")),
);
Vim.defineAction("showsenders", (cm) => {
  cm.cm6.state
    .facet(PaneFacet)
    .vitrail.dispatchEvent(new CustomEvent("showsenders"));
});
Vim.mapCommand("gn", "action", "showsenders");
Vim.defineAction("showimplementors", (cm) => {
  cm.cm6.state
    .facet(PaneFacet)
    .vitrail.dispatchEvent(new CustomEvent("showimplementors"));
});
Vim.mapCommand("gm", "action", "showimplementors");

function extensionsForPath(path) {
  const language = languageForPath(path);
  if (language === languageFor("javascript"))
    return {
      cmExtensions: [javascript()],
      augmentations: [
        augmentationBuilder(language),
        watch(language),
        uiBuilder(language),
      ],
    };
  if (language === languageFor("typescript"))
    return {
      cmExtensions: [javascript({ typescript: true })],
      augmentations: [
        augmentationBuilder(language),
        watch(language),
        uiBuilder(language),
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
export function openNodeInWindow(node: SBNode, props: any = {}) {
  openComponentInWindow(FullDeclarationPaneWindow, { nodes: [node], ...props });
}

export function TraceryEditor({ project, path, nodes, window, onLoad }) {
  const source = useSignal(null);
  const vitrail: { value: Vitrail<any> } = useSignal(null);

  useEffect(() => {
    if (path) {
      source.value = null;
      request("readFiles", { paths: [path] }).then(
        ([file]) => (source.value = file.data),
      );
    }
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
      augmentations: [...augmentations, singleDeclaration(language)],
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
