import { useMemo, useRef } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { List } from "../sandblocks/list.js";
import { appendCss, clamp } from "../utils.js";
import { openComponentInWindow } from "./window.js";
import { TraceryEditor } from "./editor.ts";
import { outline } from "./outline.ts";
import { removeCommonIndent } from "./whitespace.ts";
import { useValidator } from "../vitrail/vitrail.ts";

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
  const topLevelEntries = useSignal([]);
  const selectedTopLevel = useSignal(null);
  const selectedMember = useSignal(null);
  const vitrail = useSignal(null);

  const selectedIndex = useRef(0);

  const getModel = () => vitrail.value.defaultModel;
  const getRoot = () => vitrail.value.getModels().get(getModel());
  const getOutline = () => outline(getRoot());

  let selectedNodes = selectedMember.value ?? selectedTopLevel.value;
  // TODO same for selectedMember
  if (selectedNodes && !selectedNodes[0].connected) {
    selectedTopLevel.value = topLevelEntries.value
      ? topLevelEntries.value[
          clamp(selectedIndex.value, 0, topLevelEntries.value.length - 1)
        ]?.nodes
      : null;
    selectedNodes = selectedTopLevel.value;
  }

  const selectedTopLevelItem = topLevelEntries.value?.find(
    (e) => e.nodes[0] === selectedTopLevel.value?.[0],
  );
  const selectedMemberItem = selectedTopLevelItem?.members?.find(
    (e) => e.nodes[0] === selectedMember.value?.[0],
  );
  selectedIndex.value = topLevelEntries.value.indexOf(selectedTopLevelItem);

  const removeIndent = useMemo(
    () => removeCommonIndent(selectedNodes ?? []),
    selectedNodes ?? [],
  );

  useValidator(
    vitrail.value && getModel(),
    (_root, _diff, _changes) => {
      // const del = changesIntendToDeleteNode(changes, selectedNodes[0]);
      return !selectedNodes || !!selectedNodes[0].connected;
    },
    [...(selectedNodes ?? [])],
    vitrail,
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
          h(
            "div",
            {
              style: {
                flex: 1,
                maxWidth: "250px",
                display: "flex",
                flexDirection: "column",
              },
            },
            h(List, {
              style: { flex: 1 },
              items: topLevelEntries.value,
              selected: selectedTopLevelItem,
              setSelected: (s) => {
                selectedTopLevel.value = s.nodes;
                selectedMember.value = null;
              },
              labelFunc: (it) => it.name,
              height: 200,
              selectionContext: {
                path: selectedFile.value?.path,
                topLevel: selectedTopLevelItem?.name,
              },
            }),
            h(
              "button",
              {
                onClick: () => {
                  const node = getRoot().insert(
                    "__VI_PLACEHOLDER_statement;",
                    "statement",
                    0,
                  );
                  selectedTopLevel.value = getOutline().find(({ nodes }) =>
                    nodes.includes(node),
                  ).nodes;
                },
              },
              "Add",
            ),
          ),
          h(
            "div",
            {
              style: {
                flex: 1,
                maxWidth: "250px",
                display: "flex",
                flexDirection: "column",
              },
            },
            h(List, {
              style: { flex: 1, maxWidth: "250px" },
              items: selectedTopLevelItem?.members ?? emptyList,
              selected: selectedMemberItem,
              setSelected: (s) => (selectedMember.value = s.nodes),
              labelFunc: (it) => it.name,
              height: 200,
              selectionContext: {
                path: selectedFile.value?.path,
                topLevel: selectedTopLevelItem?.name,
                member: selectedMemberItem?.name,
              },
            }),
            h(
              "button",
              {
                onClick: () => {
                  const node = getRoot().insert(
                    "__VI_PLACEHOLDER_statement;",
                    "statement",
                    0,
                  );
                  selectedTopLevel.value = getOutline().find(({ nodes }) =>
                    nodes.includes(node),
                  ).nodes;
                },
              },
              "Add",
            ),
          ),
          h("div", {
            style: { height: "1.5rem" },
          }),
        ),
        selectedFile.value &&
          h(TraceryEditor, {
            className: "tracery-browser",
            onLoad: (v) => {
              vitrail.value = v;
              topLevelEntries.value = getOutline();
              selectedTopLevel.value =
                topLevelEntries.value.find(
                  (entry) => entry.name === initialSelection?.topLevel,
                )?.nodes ?? topLevelEntries.value[0]?.nodes;
              selectedMember.value = selectedTopLevel.value?.members?.find(
                (entry) => entry.name === initialSelection?.member,
              )?.nodes;
            },
            onChange: () => (topLevelEntries.value = getOutline()),
            augmentations: [removeIndent],
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

export function openBrowser(project, props, windowProps = {}) {
  openComponentInWindow(
    TraceryBrowser,
    { project, ...props },
    { initialSize: { x: 700, y: 430 }, ...windowProps },
  );
}
