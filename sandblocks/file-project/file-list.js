import { useState } from "../../external/preact-hooks.mjs";
import { el, h } from "../../view/widgets.js";
import { openComponentInWindow } from "../window.js";
import { FileEditor } from "./file-editor.js";

export function FileTree({ project }) {
  return el(
    "sb-file-tree",
    h(File, {
      file: project.root,
      path: project.path,
      isRoot: true,
      onOpen: (path) => openComponentInWindow(FileEditor, { project, path }),
    }),
  );
}

function File({ file, onOpen, path, isRoot }) {
  const isFolder = file.children;
  const [open, setOpen] = useState(isRoot);
  return el("sb-file" + (isFolder ? " sb-folder" : ""), [
    h(
      "div",
      {
        onclick: () => (isFolder ? setOpen((o) => !o) : onOpen(path)),
        class: "sb-file-name",
      },
      `${isFolder ? (open ? "▼ " : "▶ ") : ""}${file.name}`,
    ),
    open &&
      isFolder &&
      el(
        "sb-file-list",
        file.children
          .sort((a, b) =>
            !!a.children === !!b.children
              ? a.name.localeCompare(b.name)
              : !!b.children - !!a.children,
          )
          .map((child) =>
            h(File, {
              file: child,
              onOpen,
              path: path + "/" + child.name,
            }),
          ),
      ),
  ]);
}
