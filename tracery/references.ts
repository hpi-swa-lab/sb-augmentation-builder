import { languageForPath } from "../core/languages.js";
import { SBNode } from "../core/model.js";
import { useSignal } from "../external/preact-signals.mjs";
import { List } from "../sandblocks/list.js";
import { h, useAsyncEffect } from "../view/widgets.js";
import { TraceryEditor } from "./editor.ts";
import { outline } from "./outline.ts";
import { openComponentInWindow } from "./window.js";

export function openReferences(
  project,
  symbol: string,
  type: "implementors" | "senders",
) {
  openComponentInWindow(
    TraceryReferences,
    { project, symbol, type },
    { initialSize: { x: 700, y: 430 } },
  );
}

function TraceryReferences({ project, symbol, type, window }) {
  const files = useSignal(null);
  const selectedNode = useSignal(null);
  const selectedFile = useSignal(null);

  useAsyncEffect(async () => {
    const result: {
      path: string;
      name: string;
      node: SBNode;
      focus: SBNode;
    }[] = [];

    const paths = await findReferences(project, symbol, type);
    for (const { path, data } of await project.readFiles(paths)) {
      const pathName = path.slice(project.path.length + 1);
      const root = await languageForPath(path).parse(data);
      for (const { node, name: topLevelName, members } of outline(root)) {
        let foundAny = false;
        for (const { node, name: memberName } of members ?? []) {
          const focus =
            type === "implementors"
              ? memberName === symbol
              : node.blockThat((n) => n.text === symbol);
          if (focus) {
            foundAny = true;
            result.push({
              path,
              name: `${pathName}:${topLevelName}:${memberName}`,
              topLevel: topLevelName,
              member: memberName,
              node,
              focus,
            });
          }
        }
        if (!foundAny) {
          const focus =
            type === "implementors"
              ? topLevelName === symbol
              : node.blockThat((n) => n.text === symbol);
          if (focus) {
            result.push({
              path,
              name: `${pathName}:${topLevelName}`,
              topLevel: topLevelName,
              node,
              focus,
            });
          }
        }
      }
    }

    selectedFile.value = result[0];
    files.value = result;
  }, [symbol, type, project]);

  return files.value
    ? files.value.length < 1
      ? "No result."
      : [
          h(List, {
            items: files.value,
            selected: selectedFile.value,
            setSelected: (s) => (selectedFile.value = s),
            labelFunc: (it) => it.name,
            height: 200,
            selectionContext: selectedFile.value,
          }),
          selectedFile.value &&
            h(TraceryEditor, {
              project,
              key: selectedFile.value,
              path: selectedFile.value.path,
              onLoad: (vitrail) => {
                const node = vitrail.getModels().get(vitrail.defaultModel);
                selectedNode.value = node.childForRange(
                  selectedFile.value.node.range,
                );
              },
              node: selectedNode.value,
              window,
              style: { width: "100%" },
            }),
        ]
    : "Loading ...";
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
        node.exec(
          (x) => x.type === "export_statement",
          (x) => x.atField("declaration"),
          (x) => x.type === "lexical_declaration",
          (x) => x.childBlock(0),
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
