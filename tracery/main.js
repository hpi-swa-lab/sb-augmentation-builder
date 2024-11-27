import { h, render } from "../external/preact.mjs";
import { FileProject } from "./project.js";
import { appendCss, linkCss, matchesKey } from "../utils.js";
import { openBrowser } from "./browser.ts";
import { openSearch } from "./search.js";
import { useAsyncEffect, useLocalStorageSignal } from "../view/widgets.js";
import { useEffect, useMemo } from "../external/preact-hooks.mjs";
import { openPotluck } from "./potluck.ts";
import { openIPyNotebook } from "./notebook.ts";
import { openFileInWindow } from "./editor.ts";
import { openExpressEditor } from "./express.ts";

appendCss(`
html {
  font-family: sans-serif;
  font-size: 13px;
}`);
linkCss("../external/codicon/codicon.css");
appendCss(`.codicon {
  vertical-align: middle;
}`);

function Tracery() {
  const projectPath = useLocalStorageSignal("project-path", "./");
  const startUpFile = useLocalStorageSignal(
    "start-up-file",
    "sandblocks/query-builder/examples-evaluation/3-dynamic-color-replacement.js:replacementColor",
  );
  const project = useMemo(
    () =>
      projectPath.value ? new FileProject({ folder: projectPath.value }) : null,
    [projectPath.value],
  );

  useEffect(() => {
    const handler = async () => await project?.close();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [project]);

  useEffect(() => {
    const listener = (e) => {
      if (matchesKey(e, "Ctrl-b")) {
        openBrowser(project, {
          initialSelection: document.activeElement.selectionContext,
        });
      } else if (matchesKey(e, "Ctrl-0")) {
        openSearch(project);
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    document.body.addEventListener("keydown", listener);
    return () => document.body.removeEventListener("keydown", listener);
  }, [project]);

  useAsyncEffect(async () => {
    if (project) {
      await project.open();

      if (false)
        openIPyNotebook(
          { path: "notebook-example.ipynb", project },
          { doNotStartAttached: true, initialPosition: { x: 100, y: 100 } },
        );

      if (false)
        openFileInWindow(project, "recipes.md", {
          doNotStartAttached: true,
          initialPosition: { x: 100, y: 100 },
          initialSize: { x: 300, y: 400 },
        });

      if (false)
        openExpressEditor(
          { project, path: "example-files/express.js" },
          {
            doNotStartAttached: true,
            initialPosition: { x: 100, y: 100 },
            initialSize: { x: 300, y: 400 },
          },
        );

      if (true)
        openBrowser(
          project,
          {
            initialSelection: startUpFile.value
              ? {
                  path: project.path + "/" + startUpFile.value.split(":")[0],
                  topLevel: startUpFile.value.split(":")[1],
                }
              : undefined,
          },
          {
            doNotStartAttached: true,
            initialPosition: { x: 100, y: 100 },
            initialSize: { x: 800, y: 800 },
          },
        );
    }
  }, [project]);

  return [
    h(
      "button",
      {
        onclick: () => {
          const path = prompt("Enter project path", projectPath.value ?? "");
          if (path) projectPath.value = path;
        },
      },
      "Set Project Path",
    ),
    h(
      "button",
      {
        onclick: () => {
          const val = prompt(
            "Enter Start Up Path (relativePath:symbolName)",
            startUpFile.value ?? "",
          );
          if (val) startUpFile.value = val;
        },
      },
      "Set Start Up Path",
    ),
    projectPath.value &&
      h("button", { onclick: () => openBrowser(project) }, "Open Browser"),
    h("button", { onclick: () => openPotluck() }, "Open Potluck"),
  ];
}

const editor = document.createElement("div");
render(h(Tracery), editor);
document.body.appendChild(editor);
