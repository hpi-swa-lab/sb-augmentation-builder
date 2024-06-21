import { languageForPath } from "../core/languages.js";
import { useSignal } from "../external/preact-signals.mjs";
import { h, useAsyncEffect } from "../view/widgets.js";

export function openReferences(
  project,
  symbol: string,
  type: "implementors" | "senders",
) {}

function References({ project, symbol, type }) {
  const files = useSignal(null);
  const selected = useSignal(null);

  useAsyncEffect(async () => {
    files.value = await findReferences(project, symbol, type);
    selected.value = files.value[0];

    const contents = await project.readFiles(files.value);
    contents.map(({ path, data }) => languageForPath(path).parseSync(data));
  });

  return (
    files.value && [
      h(List, {
        items: files.value,
        selected: selected.value,
        setSelected: (s) => (selected.value = s),
        labelFunc: (it) => it.path.slice(project.path.length + 1),
        height: 200,
      }),
      h(CodeMirrorWithVitrail, {
        key: selected.value.path,
        value: source,
        onSave: () => formatAndSave(),
        onQuit: () => window.close(),
        onshowsenders: () => findReferences("senders"),
        onshowimplementors: () => findReferences("implementors"),
        augmentations,
        cmExtensions: [
          vim(),
          ...cmExtensions,
          ...baseCMExtensions,
          drawSelection(),
          lineNumbers({
            formatNumber: (line, state) =>
              state.facet(PaneFacet).startLineNumber + line - 1,
          }),
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
      }),
    ]
  );
}

async function findReferences(
  project,
  symbol: string,
  type: "implementors" | "senders",
) {
  return await project.inAllFilesDo(
    (path) => path.endsWith(".js") || path.endsWith("ts"),
    (file, source) => {
      const senders: string[] = [];
      const implementors: string[] = [];
      source.allNodesDo((node) => {
        node.exec(
          (x) => x.type === "member_expression",
          (x) => x.atField("property"),
          (x) => senders.push(x.text),
        );
        node.exec(
          (x) =>
            ["function", "method_definition", "function_declaration"].includes(
              x.type,
            ),
          (x) => x.atField("name"),
          (x) => implementors.push(x.text),
        );
      });
      return { senders, implementors };
    },
    (
      map: { [key: string]: { implementors: string[]; senders: string[] } },
      symbol: string,
      type: "senders" | "implementors",
    ) => {
      return Object.entries(map)
        .filter(([_, types]) => types[type].includes(symbol))
        .map(([path, _]) => path);
    },
    [symbol, type],
  );
}
