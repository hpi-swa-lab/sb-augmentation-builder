import { vim, Vim } from "../codemirror6/external/codemirror-vim.mjs";
import {
  drawSelection,
  lineNumbers,
  keymap,
  javascript,
} from "../codemirror6/external/codemirror.bundle.js";
import { languageForPath, languageFor } from "../core/languages.js";
import { SBBaseLanguage } from "../core/model.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { request } from "../sandblocks/host.js";
import {
  metaexec,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { takeWhile } from "../utils.js";
import {
  CodeMirrorWithVitrail,
  baseCMExtensions,
  PaneFacet,
} from "../vitrail/codemirror6.ts";
import {
  Augmentation,
  Model,
  SelectionInteraction,
  VitrailPane,
  useValidateKeepNodes,
  useVitrailProps,
} from "../vitrail/vitrail.ts";
import { openExplorer } from "./explorer.ts";
import { format } from "./format.js";
import { openReferences } from "./references.ts";

Vim.map("jk", "<Esc>", "insert");
Vim.mapCommand("<C-e>", "action", "quit");
Vim.defineEx("write", "w", (cm) =>
  cm.cm6.state.facet(PaneFacet).vitrail.dispatchEvent(new CustomEvent("save")),
);
Vim.defineEx("quit", "q", (cm) =>
  cm.cm6.state.facet(PaneFacet).vitrail.dispatchEvent(new CustomEvent("quit")),
);
Vim.defineAction("quit", (cm) =>
  cm.cm6.state.facet(PaneFacet).vitrail.dispatchEvent(new CustomEvent("quit")),
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
    return { cmExtensions: [javascript()], augmentations: [] };
  if (language === languageFor("typescript"))
    return {
      cmExtensions: [javascript({ typescript: true })],
      augmentations: [],
    };
  return { cmExtensions: [], augmentations: [] };
}

function FullDeclarationPane({ node }) {
  useValidateKeepNodes([node], node.language);

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

  return h(VitrailPane, {
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
  view: ({ nodes }) => {
    const node = useVitrailProps().node ?? nodes[0];
    return h(FullDeclarationPane, { node, key: node });
  },
});

export function TraceryEditor({ project, path, node, window, onLoad }) {
  const source = useSignal(null);
  const vitrail = useSignal(null);

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
        ]),
      ],
      props: { project, node },
    })
  );
}
