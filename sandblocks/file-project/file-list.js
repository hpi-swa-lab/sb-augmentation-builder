import { useContext, useState } from "../../external/preact-hooks.mjs";
import { createContext } from "../../external/preact.mjs";
import { el, h } from "../../view/widgets.js";
import { openComponentInWindow } from "../window.js";
import { FileEditor } from "./file-editor.js";

const ProjectContext = createContext(null);

export function FileTree({ project }) {
  return h(
    ProjectContext.Provider,
    { value: project },
    el(
      "sb-file-tree",
      h(File, {
        file: project.root,
        path: project.path,
        isRoot: true,
        onOpen: (path) => openComponentInWindow(FileEditor, { project, path }),
      }),
    ),
  );
}

function File({ file, onOpen, path, isRoot }) {
  const isFolder = file.children;
  const [open, setOpen] = useState(isRoot);
  const [hover, setHover] = useState(false);

  return el("sb-file" + (isFolder ? " sb-folder" : ""), [
    h(
      "div",
      {
        onclick: () => (isFolder ? setOpen((o) => !o) : onOpen(path)),
        onmouseenter: () => setHover(true),
        onmouseleave: () => setHover(false),
        class: "sb-file-name",
      },
      `${isFolder ? (open ? "▼ " : "▶ ") : ""}${file.name}`,
      hover && isFolder && h(FolderMenu, { file, path }),
    ),
    open && isFolder && h(Folder, { file, path, onOpen }),
  ]);
}

function Folder({ file, path, onOpen }) {
  return el(
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
  );
}

function FolderMenu({ file, path }) {
  const project = useContext(ProjectContext);

  return h(
    "button",
    {
      style: { height: "1rem", display: "flex", alignItems: "center" },
      title: "Create new file",
      onClick: (e) => {
        e.stopPropagation();
        const name = prompt("Enter file name");
        project.writeFile(path + "/" + name, "");
        file.children.push({ name });
      },
    },
    "+",
  );
}
