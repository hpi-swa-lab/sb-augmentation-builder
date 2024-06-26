import { useMemo } from "../external/preact-hooks.mjs";
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
  height: 100%;
}`);

const emptyList = [];

function TraceryBrowser({ project, initialSelection, window }) {
  const files = useMemo(() => project.allSources, [project]);
  const selectedFile = useSignal(
    initialSelection
      ? files.find((it) => it.path === initialSelection.path)
      : files[0],
  );
  const enabled = useSignal(true);
  const topLevel = useSignal([]);
  const selectedTopLevel = useSignal(null);
  const selectedMember = useSignal(null);
  const selectedNodes =
    selectedMember?.value?.nodes ?? selectedTopLevel?.value?.nodes;

  // need to unset these before rendering if we get deleted
  if (selectedTopLevel.value?.node && !selectedTopLevel.value.node.connected)
    selectedTopLevel.value = null;
  if (selectedMember.value?.node && !selectedMember.value.node.connected)
    selectedMember.value = null;

  return enabled.value
    ? h(
        "div",
        { style: { display: "flex", flexDirection: "column", flex: "1 1 0" } },
        h(
          "div",
          { style: { display: "flex" } },
          h(List, {
            style: { flex: 1, maxWidth: "250px" },
            items: files,
            iconFunc: (it) => "symbol-file",
            selected: selectedFile.value,
            setSelected: (s) => (selectedFile.value = s),
            labelFunc: (it) => it.path.slice(project.path.length + 1),
            height: 200,
            selectionContext: { path: selectedFile.value?.path },
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
            selectionContext: {
              path: selectedFile.value?.path,
              topLevel: selectedTopLevel.value?.name,
            },
          }),
          h(List, {
            style: { flex: 1, maxWidth: "250px" },
            items: selectedTopLevel?.value?.members ?? emptyList,
            selected: selectedMember.value,
            setSelected: (s) => (selectedMember.value = s),
            labelFunc: (it) => it.name,
            height: 200,
            selectionContext: {
              path: selectedFile.value?.path,
              topLevel: selectedTopLevel.value?.name,
              member: selectedMember.value?.name,
            },
          }),
          h(
            "button",
            {
              style: { height: "1.5rem" },
              onClick: () => (enabled.value = !enabled.value),
            },
            "Toggle",
          ),
        ),
        selectedFile.value &&
          h(TraceryEditor, {
            onLoad: (vitrail) => {
              const node = vitrail.getModels().get(vitrail.defaultModel);
              topLevel.value = outline(node);
              selectedTopLevel.value = initialSelection?.topLevel
                ? topLevel.value.find(
                    (it) => it.name === initialSelection.topLevel,
                  )
                : null;
              selectedMember.value = initialSelection?.member
                ? selectedTopLevel.value.members?.find(
                    (it) => it.name === initialSelection.member,
                  )
                : null;
            },
            project,
            path: selectedFile.value.path,
            window,
            nodes: selectedNodes,
            style: { width: "100%" },
          }),
      )
    : selectedFile.value &&
        h(
          "div",
          {
            style: { display: "flex", flexDirection: "column", height: "100%" },
          },
          h(
            "button",
            { onClick: () => (enabled.value = !enabled.value) },
            "Toggle",
          ),
          h(TraceryEditor, {
            project,
            path: selectedFile.value.path,
            window,
            style: { width: "100%", flex: "1 1" },
          }),
        );
}

export function openBrowser(project, props, windowProps) {
  openComponentInWindow(
    TraceryBrowser,
    { project, ...props },
    { initialSize: { x: 700, y: 430 }, ...windowProps },
  );
}
