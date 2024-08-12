import { useMemo } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { List } from "../sandblocks/list.js";
import { appendCss } from "../utils.js";
import { openComponentInWindow } from "./window.js";
import { TraceryEditor, openNodesInWindow } from "./editor.ts";
import { outline } from "./outline.ts";
import { removeCommonIndent } from "./whitespace.ts";

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
  const selectedTopLevelName = useSignal(initialSelection?.topLevel);
  const selectedMemberName = useSignal(initialSelection?.member);
  const vitrail = useSignal(null);

  const getModel = () => vitrail.value.defaultModel;
  const getOutline = () => outline(vitrail.value.getModels().get(getModel()));

  const getSelection = (outline?) => {
    const selectedTopLevel = (outline ?? topLevel.value).find(
      (it) => it.name === selectedTopLevelName.value,
    );
    const selectedMember = selectedTopLevel?.members?.find(
      (it) => it.name === selectedMemberName.value,
    );
    const selectedNodes = selectedMember?.nodes ?? selectedTopLevel?.nodes;
    return { selectedTopLevel, selectedMember, selectedNodes };
  };

  const { selectedTopLevel, selectedMember, selectedNodes } = getSelection();

  const removeIndent = useMemo(
    () => removeCommonIndent(selectedNodes ?? []),
    selectedNodes,
  );

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
            selected: selectedTopLevel,
            setSelected: (s) => {
              selectedTopLevelName.value = s.name;
              selectedMemberName.value = null;
            },
            labelFunc: (it) => it.name,
            height: 200,
            selectionContext: {
              path: selectedFile.value?.path,
              topLevel: selectedTopLevel?.name,
            },
          }),
          h(List, {
            style: { flex: 1, maxWidth: "250px" },
            items: selectedTopLevel?.members ?? emptyList,
            selected: selectedMember,
            setSelected: (s) => (selectedMemberName.value = s.name),
            labelFunc: (it) => it.name,
            height: 200,
            selectionContext: {
              path: selectedFile.value?.path,
              topLevel: selectedTopLevel?.name,
              member: selectedMember?.name,
            },
          }),
          h(
            "div",
            {
              style: { height: "1.5rem" },
            },
            h(
              "button",
              { onClick: () => (enabled.value = !enabled.value) },
              "Toggle",
            ),
            h(
              "button",
              { onClick: () => openNodesInWindow(selectedNodes) },
              "Open",
            ),
          ),
        ),
        selectedFile.value &&
          h(TraceryEditor, {
            onLoad: (v) => {
              vitrail.value = v;
              topLevel.value = getOutline();

              v.registerValidator(
                getModel(),
                () => !!getSelection(getOutline()).selectedTopLevel,
              );
            },
            onChange: () => (topLevel.value = getOutline()),
            project,
            path: selectedFile.value.path,
            window,
            augmentations: [removeIndent],
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

export function openBrowser(project, props, windowProps = {}) {
  openComponentInWindow(
    TraceryBrowser,
    { project, ...props },
    { initialSize: { x: 700, y: 430 }, ...windowProps },
  );
}
