import { augColor } from "../aug-color-picker.ts";
import {
  augBool,
  augChartsColor,
  augChartsJS,
  augChartsType,
  augTransparentColor,
} from "../aug-example-charts.ts";
import { vim, Vim } from "../codemirror6/external/codemirror-vim.mjs";
import {
  drawSelection,
  lineNumbers,
  keymap,
  javascript,
  cpp,
  python,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageForPath, languageFor } from "../core/languages.js";
import { SBBaseLanguage, SBNode } from "../core/model.js";
import { useEffect, useMemo } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { appendCss, last, takeWhile } from "../utils.js";
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
import { babylonian } from "./babylonian.ts";
import { exploriants } from "./exploriants.ts";
import { format } from "./format.js";
import { queryBuilder } from "./query-builder.ts";
import {
  markdownImage,
  markdownLink,
  markdownTag,
  recipesList,
} from "./recipes.ts";
import { openReferences } from "./references.ts";
import { color, slider, spreadsheet } from "./livelits.ts";
import { sql } from "./sql.ts";
import { table } from "./table.ts";
import {
  invisibleWatchRewrite,
  testLogs,
  watch,
  wrapWithWatch,
} from "./watch.ts";
import { openComponentInWindow, parentWindow } from "./window.js";
import { vectors } from "./glsl.ts";
import { openExplorer } from "./explorer.ts";

appendCss(`.diagnostic { background: rgba(255, 0, 0, 0.2); }`);

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
        testLogs(language),
        augmentationBuilder(language),
        queryBuilder(language),
        watch(language),
        // uiBuilder(language),
        invisibleWatchRewrite(language),
        placeholder(language),
        exploriants(language),
        augChartsJS(language),
        augChartsColor(language),
        augTransparentColor(language),
        augBool(language),
        augColor(language),
        augChartsType(language),
        sql(language),
        table(language),
        babylonian(language),
        slider(language),
        color(language),
        spreadsheet(language),
      ],
    };
  if (language === languageFor("typescript"))
    return {
      cmExtensions: [javascript({ typescript: true })],
      augmentations: [
        testLogs(language),
        augmentationBuilder(language),
        queryBuilder(language),
        watch(language),
        invisibleWatchRewrite(language),
        // uiBuilder(language),
        placeholder(language),
        exploriants(language),
        augChartsJS(language),
        augChartsColor(language),
        augTransparentColor(language),
        augBool(language),
        augColor(language),
        augChartsType(language),
        table(language),
        babylonian(language),
        slider(language),
      ],
    };
  if (language === languageFor("markdown"))
    return {
      cmExtensions: [],
      augmentations: [recipesList, markdownTag, markdownLink, markdownImage],
    };
  if (language === languageFor("glsl"))
    return {
      cmExtensions: [cpp()],
      augmentations: [vectors],
    };
  if (language === languageFor("python"))
    return {
      cmExtensions: [python()],
      augmentations: [
        watch(language),
        invisibleWatchRewrite(language),
        babylonian(language),
      ],
    };
  return { cmExtensions: [], augmentations: [] };
}

function FullDeclarationPane({ nodes, ...props }: { nodes: SBNode[] }) {
  useValidateKeepNodes(nodes, nodes[0].language);

  // make sure no changes in our cell would destroy the next node
  const nextNode = last(nodes).nextSiblingNode;
  useValidateKeepNodes(nextNode ? [nextNode] : [], nodes[0].language);

  const list = nodes[0].isRoot
    ? nodes
    : [
        ...takeWhile(
          nodes[0].parent!.children.slice(0, nodes[0].siblingIndex).reverse(),
          (c) => c.isWhitespace() || c.type === "comment",
        ),
        ...nodes,
        ...takeWhile(
          last(nodes).parent!.children.slice(last(nodes).siblingIndex + 1),
          (c) => c.isWhitespace() || c.type === "comment",
        ),
      ];

  return h(VitrailPane, {
    ...props,
    // prevent making the trailing newline editable
    rangeOffsets: last(list).text.endsWith("\n") ? [0, 1] : [0, 0],
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
  name: "singleDeclaration",
  type: "replace" as const,
  matcherDepth: 1,
  model,
  selectionInteraction: SelectionInteraction.Skip,
  match: (node) => (node.isRoot ? {} : null),
  view: ({ nodes: topLevel }) => {
    const nodes = useVitrailProps().nodes ?? topLevel;
    return h(FullDeclarationPane, { nodes });
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
export function openFileInWindow(project, path: string, windowProps) {
  openComponentInWindow(
    TraceryEditor,
    {
      project,
      path,
      style: { width: "100%", flex: "1 1" },
    },
    windowProps,
  );
}

export function TraceryInlineEditor({ source, fileSuffix }) {
  const { augmentations, cmExtensions } = useMemo(
    () => extensionsForPath(fileSuffix),
    [fileSuffix],
  );

  return h(CodeMirrorWithVitrail, {
    fetchAugmentations: () => augmentations,
    value: source,
    cmExtensions: [
      // vim(),
      ...cmExtensions,
      ...baseCMExtensions,
      drawSelection(),
    ],
  });
}

export function TraceryEditor({
  project,
  path,
  nodes,
  window,
  onLoad,
  onChange,
  augmentations: extraAugmentations,
}) {
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

  const { augmentations, cmExtensions } = useMemo(
    () => extensionsForPath(path),
    [path],
  );

  const formatAndSave = async () => {
    // TODO
    console.log(vitrail.value.rewrittenSourceString);
    return;

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

  useSignalEffect(() => {
    // subscribe
    diagnostics.value;

    // FIXME not a good updating mechanism for diagnostics
    // vitrail.value?.updateAllAugmentations();
  });
  useSignalEffect(() => {
    // subscribe
    source.value;
    // cheap operation when nothing changes, so we can do it on every render
    vitrail.value?.updateAugmentationList();
  });
  useEffect(() => {
    vitrail.value?.updateAugmentationList();
  }, [nodes]);

  const language = nodes?.[0]
    ? nodes[0].language
    : languageForPath(path) ?? SBBaseLanguage;
  const singleDecl = useMemo(() => singleDeclaration(language), [language]);

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
      onchange: (e) => {
        onChange?.(e);
        project.onChangeFile({ ...e.detail, path });
      },
      oncreateaugmentation: () =>
        vitrail.value &&
        openNewAugmentation(
          project,
          vitrail.value.selectedString() ?? "",
          vitrail.value.selectedNode(),
        ),
      fetchAugmentations: () =>
        <Augmentation<any>[]>[
          ...augmentations,
          ...(extraAugmentations ?? []),
          ...(nodes ? [singleDecl] : []),
          // {
          //   type: "mark" as const,
          //   model: SBBaseLanguage,
          //   matcherDepth: 1,
          //   match: (node) =>
          //     node instanceof SBBlock && node.type === "document" && {},
          //   view: () =>
          //     diagnostics.value.map((d) => ({
          //       attributes: { class: "diagnostic" },
          //       offset: d.range[0],
          //       length: d.range[1] - d.range[0],
          //     })),
          // },
        ],
      cmExtensions: [
        // vim(),
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
          {
            key: "Mod-p",
            run: () => {
              eval(vitrail.value.selectedString(true) ?? "");
              return true;
            },
            preventDefault: true,
          },
          {
            key: "Mod-h",
            run: () => {
              openExplorer(vitrail.value.selectedNode());
              return true;
            },
            preventDefault: true,
          },
        ]),
      ],
      props: { project, nodes, path },
    })
  );
}
