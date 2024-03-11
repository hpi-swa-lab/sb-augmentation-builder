import { editor, h } from "../view/widgets.js";
import { Extension } from "../core/extension.js";
import { FileEditor } from "./file-project/file-editor.js";
import { randomId } from "../utils.js";
import { localStorageProject } from "./local-project.js";

// const extraExtensions = {
//   markdown: ["markdown:calc"],
//   javascript: [],
// };

// customElements.define(
//   "sb-workspace-block",
//   class extends Replacement {
//     update(node) {
//       const language = languageFor(
//         node.childBlocks
//           .find((b) => b.atField("key").childBlock(0).text === "language")
//           .atField("value")
//           .childBlock(0).text
//       );
//
//       const sourceString = JSON.parse(
//         node.childBlocks
//           .find((b) => b.atField("key").childBlock(0).text === "text")
//           .atField("value").sourceString
//       );
//
//       this.render(
//         h(
//           "div",
//           { style: "padding: 0.5rem" },
//           editor({
//             key: node.id,
//             extensions: [
//               "base:base",
//               ...language.defaultExtensions,
//               ...(extraExtensions[language.name] ?? []),
//             ],
//             inlineExtensions: [nestedWorkspaceShortcuts],
//             sourceString,
//             language: language.name,
//           })
//         )
//       );
//     }
//   }
// );
//
// customElements.define(
//   "sb-workspace",
//   class extends Replacement {
//     update(node) {
//       const list = [];
//       let first = true;
//       for (const block of node.childBlock(0).childBlocks.map((x) => shard(x))) {
//         if (!first) {
//           list.push(h("hr"));
//         }
//         list.push(block);
//         first = false;
//       }
//       this.render([div(list), h("style", {}, "hr { margin: 0; }")]);
//     }
//   }
// );

// const jsonWorkspace = new Extension()
//   .registerReplacement((e) => [
//     (x) => x.type === "object",
//     (x) => true,
//     (x) => e.ensureReplacement(x, "sb-workspace-block"),
//   ])
//   .registerReplacement((e) => [
//     (x) => true,
//     (x) => x.type === "document",
//     (x) => e.ensureReplacement(x, "sb-workspace"),
//   ]);

// const workspaceShortcuts = new Extension().registerShortcut(
//   "addNewBlock",
//   (x) => {
//     x.orAnyParent((x) => x.parent?.type === "array").insertAfter(
//       '{"language":"markdown", "text": "text"}',
//       "_value"
//     );
//   }
// );
// const nestedWorkspaceShortcuts = new Extension().registerShortcut(
//   "addNewBlock",
//   (x) => {
//     x.editor.parentNode.parentNode.parentNode.source
//       .orAnyParent((x) => x.parent?.type === "array")
//       .insertAfter('{"language":"markdown", "text": "text"}', "_value");
//   }
// );

export function BlocksWorkspace() {
  return editor({
    inlineExtensions: [jsonWorkspace, workspaceShortcuts],
    extensions: [],
    sourceString: JSON.stringify(
      [
        { text: "text", language: "javascript" },
        { text: '{"language": 2}', language: "json" },
        { text: `# hi\n\n**2**+2\n32`, language: "markdown" },
      ],
      null,
      2
    ),
    language: "json",
  });
}

export function Workspace() {
  return h(FileEditor, {
    project: localStorageProject,
    path: `workspace-${randomId()}.js`,
  });
}
