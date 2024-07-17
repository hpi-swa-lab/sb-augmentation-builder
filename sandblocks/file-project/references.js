import { h, useAsyncEffect } from "../../view/widgets.js";
import { useState } from "../../external/preact-hooks.mjs";
import { Extension } from "../../core/extension.js";
import { openComponentInWindow } from "../window.js";
import { List } from "../list.js";
import { FileEditor } from "./file-editor.js";

export const references = new Extension()
  .registerShortcut("browseSenders", (x) => {
    openComponentInWindow(References, {
      project: x.editor.context.project,
      symbol: x.text,
      sourcePath: x.editor.context.path,
      type: "senders",
    });
  })
  .registerShortcut("browseImplementors", (x) => {
    openComponentInWindow(References, {
      project: x.editor.context.project,
      symbol: x.text,
      sourcePath: x.editor.context.path,
      type: "implementors",
    });
  });

function References({ project, symbol, sourcePath, type }) {
  const [references, setReferences] = useState([]);
  const [selected, setSelected] = useState(null);

  useAsyncEffect(async () => {
    const references = await project.inAllFilesDo(
      (path) => path.endsWith(".js"),
      (file, source) => {
        const senders = [];
        const implementors = [];
        source.allNodesDo((node) => {
          node.exec(
            (x) => x.type === "member_expression",
            (x) => x.atField("property"),
            (x) => senders.push(x.text),
          );
          node.exec(
            (x) =>
              [
                "function",
                "method_definition",
                "function_declaration",
              ].includes(x.type),
            (x) => x.atField("name"),
            (x) => implementors.push(x.text),
          );
        });
        return { senders, implementors };
      },
      (map, symbol, type) => {
        return Object.entries(map)
          .filter(([_, types]) => types[type].includes(symbol))
          .map(([path, _]) => path);
      },
      [symbol, type],
    );

    setReferences(references);
    setSelected(references[0]);
  }, [project]);

  return [
    h(List, {
      items: references,
      labelFunc: (x) => x.slice(project.path.length + 1),
      selected,
      setSelected,
    }),
    h("hr"),
    selected &&
      h(FileEditor, {
        key: selected,
        path: selected,
        project,
        style: {},
        initialSearchString: symbol,
        initialSearchExact: true,
      }),
  ];
}
