import { h, render } from "../external/preact.mjs";
import { FileProject } from "./project.js";
import { matchesKey } from "../utils.js";
import { openBrowser } from "./browser.ts";
import { openSearch } from "./search.js";

const project = new FileProject({ folder: "/home/tom/Code/squeak/sb-js" });
await project.open();

openBrowser(
  project,
  {},
  {
    doNotStartAttached: true,
    initialPosition: { x: 100, y: 100 },
    initialSize: { x: 800, y: 600 },
  },
);

const editor = document.createElement("div");
render(
  h("button", { onclick: () => openBrowser(project) }, "Open Browser"),
  editor,
);
document.body.appendChild(editor);

document.body.addEventListener("keydown", (e) => {
  if (matchesKey(e, "Ctrl-b")) {
    openBrowser(project);
  } else if (matchesKey(e, "Ctrl-0")) {
    openSearch(project);
  } else {
    return;
  }
  e.preventDefault();
  e.stopPropagation();
});
