import { useEffect, useMemo, useRef } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { List } from "../sandblocks/list.js";
import { appendCss } from "../utils.js";
import { openComponentInWindow } from "./window.js";
import { TraceryEditor } from "./editor.ts";
import { outline } from "./outline.ts";

appendCss(`
.tracery-browser {
  display: flex;
  height: 0;
  flex: 1 1 0;
  width: 100%;
}
.tracery-browser > .cm-editor {
  width: 100%;
}
  
.pane-full-width > .cm-editor {
  width: 100%;
}`);

const emptyList = [];

function TraceryBrowser({ project, initialSelection, window }) {
  const files = useMemo(() => project.allSources, [project]);
  const selectedFile = useSignal(
    initialSelection
      ? files.find((it) => it.path === initialSelection[0])
      : files[0],
  );
  const topLevel = useSignal([]);
  const selectedTopLevel = useSignal(null);
  const selectedMember = useSignal(null);
  const selectedNode =
    selectedMember?.value?.node ?? selectedTopLevel?.value?.node;

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", flex: "1 1 0" } },
    h(
      "div",
      { style: { display: "flex" } },
      h(List, {
        style: { flex: 1, maxWidth: "250px" },
        items: files,
        selected: selectedFile.value,
        setSelected: (s) => (selectedFile.value = s),
        labelFunc: (it) => it.path.slice(project.path.length + 1),
        height: 200,
      }),
      h(List, {
        style: { flex: 1, maxWidth: "250px" },
        items: topLevel.value,
        selected: selectedTopLevel.value,
        setSelected: (s) => {
          selectedTopLevel.value = s;
          selectedMember.value = null;
        },
        labelFunc: (it) => it.name,
        height: 200,
      }),
      h(List, {
        style: { flex: 1, maxWidth: "250px" },
        items: selectedTopLevel?.value?.members ?? emptyList,
        selected: selectedMember.value,
        setSelected: (s) => (selectedMember.value = s),
        labelFunc: (it) => it.name,
        height: 200,
      }),
    ),
    selectedFile.value &&
      h(TraceryEditor, {
        onLoad: (vitrail) => {
          const node = vitrail.getModels().get(vitrail.defaultModel);
          topLevel.value = outline(node);
        },
        project,
        path: selectedFile.value.path,
        window,
        node: selectedNode,
        style: { width: "100%" },
      }),
  );
}

export function openBrowser(project, props, windowProps) {
  openComponentInWindow(
    TraceryBrowser,
    { project, ...props },
    { ...windowProps, initialSize: { x: 700, y: 430 } },
  );
}
