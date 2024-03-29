import { h } from "../../view/widgets.js";
import { editor, useAsyncEffect } from "../../view/widgets.js";
import { languageForExtension } from "../../core/languages.js";
import {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "../../external/preact-hooks.mjs";
import { references } from "./references.js";
import { Extension } from "../../core/extension.js";
import { confirmUnsavedChanges } from "../window.js";
import { wait } from "../../utils.js";
import { preferences } from "../../core/preferences.js";

export function FileEditor({
  window,
  project,
  path,
  style,
  inlineExtensions,

  initialSearchString,
  initialSearchExact,
  initialSelection,
}) {
  const [sourceString, setSourceString] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [searchVisible, setSearchVisible] = useState(!!initialSearchString);

  const fileEditorRef = useRef(null);
  const editorRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    window?.setTitle(path.slice(project.path.length + 1));
  }, [project, path, window]);

  useEffect(() => {
    window?.setOkToClose(
      async () => !unsavedChanges || (await confirmUnsavedChanges()),
    );
  }, [window, unsavedChanges]);

  useAsyncEffect(async () => {
    setSourceString(await project.readFile(path));
    setUnsavedChanges(false);
  }, [path]);

  const ext = path.split(".").slice(-1)[0].toLowerCase();
  const language = languageForExtension(ext);

  const saveExt = useMemo(() =>
    new Extension()
      .registerChangesApplied(() => setUnsavedChanges(true))
      .registerShortcut("save", async ({ editor }, _view, e) => {
        // need to cancel ourselves, since we handle saving asynchronously
        e.preventDefault();

        setSaveInProgress(true);
        for (const ext of editor.allExtensions()) {
          for (const cb of ext.custom("preSave"))
            await cb(editor, editor.sourceString);
        }
        await project.writeFile(path, editor.sourceString);
        setUnsavedChanges(false);
        setSaveInProgress(false);

        for (const ext of editor.allExtensions()) {
          for (const cb of ext.custom("save"))
            await cb(editor, editor.sourceString);
        }
      }),
  );

  const searchExt = useMemo(() =>
    new Extension()
      .registerShortcut("search", (x) => {
        setSearchVisible(true);
        queueMicrotask(() => searchRef.current?.focus());
      })
      .registerCss("search-result", [
        (x) => !!x.editor.data("search-string"),
        (x) => x.isText,
        (x) =>
          x.editor.data("search-is-exact")
            ? x.text === x.editor.data("search-string")
            : x.text
                .toLowerCase()
                .includes(x.editor.data("search-string").toLowerCase()),
      ]),
  );

  return h(
    "sb-file-editor",
    {
      ref: fileEditorRef,
      style: {
        position: "relative",
        display: "flex",
        flexGrow: 1,
        height: 0,
        ...(style ?? {}),
      },
      project,
      path,
    },
    h(
      "div",
      { style: { overflowY: "auto", padding: "2px", width: "100%" } },
      sourceString !== null &&
        editor({
          extensions: [
            ...preferences.getDefaultExtensions(),
            ...language.defaultExtensions,
          ],
          style: { minHeight: "100%", height: "1px" },
          readonly: saveInProgress,
          inlineExtensions: [
            references,
            searchExt,
            saveExt,
            ...(inlineExtensions ?? []),
          ],
          sourceString,
          editorRef,
          context: fileEditorRef.current,
          language: language.name,
          onready: () => {
            if (initialSelection)
              editorRef.current.selectRange(initialSelection, true);
          },
        }),
    ),
    unsavedChanges &&
      h("div", { class: "sb-file-editor-unsaved", title: "Unsaved changes" }),
    sourceString !== null &&
      searchVisible &&
      h(SearchField, {
        editorRef,
        initialSearchString,
        initialSearchExact,
        focusRef: searchRef,
        onClose: (selectRange, shard) => {
          setSearchVisible(false);
          editorRef.current?.focus();
          if (selectRange) shard.selectRange(selectRange);
        },
      }),
  );
}

// custom element for locating file editor props in the tree hierarchy
customElements.define(
  "sb-file-editor",
  class extends HTMLElement {
    project = null;
    path = null;

    get editor() {
      return this.querySelector("sb-editor");
    }
  },
);

function wrapNumber(n, min, max) {
  if (n < min) return max;
  if (n > max) return min;
  return n;
}

function SearchField({
  editorRef,
  focusRef,
  initialSearchString,
  initialSearchExact,
  onClose,
}) {
  const [searchString, setSearchString] = useState(initialSearchString);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchExact, setSearchExact] = useState(initialSearchExact);
  const searchRef = useRef(null);

  const matches = () => editorRef.current?.querySelectorAll(".search-result");

  const close = () => setSearchString(null);

  useAsyncEffect(async () => {
    await wait(0);
    if (initialSearchString) {
      setSelectedIndex(0);
    }
  }, [initialSearchString]);

  useEffect(() => {
    const match = matches()[selectedIndex];

    editorRef.current.setData("search-string", searchString);
    editorRef.current.setData("search-is-exact", searchExact);
    editorRef.current.updateMarker("css:search-result");
    if (searchString === null) {
      onClose(match?.range, match?.shard);
    }
  }, [searchString, searchExact]);

  useEffect(() => {
    editorRef.current
      ?.querySelector(".search-result.active")
      ?.classList.remove("active");

    const m = matches();
    const match = m[selectedIndex];
    if (match) {
      match.classList.add("active");
      match.scrollIntoView({ block: "center" });
    } else if (m[0]) {
      m[0].scrollIntoView({ block: "center" });
    }
  }, [selectedIndex, searchString]);

  return h(
    "div",
    { style: { position: "absolute", bottom: 2, right: 2 } },
    h("input", {
      ref: (e) => {
        searchRef.current = e;
        if (focusRef) focusRef.current = e;
      },
      placeholder: "Search ...",
      value: searchString,
      type: "text",
      onkeydown: (e) => {
        if (e.key === "Enter") {
          setSelectedIndex(
            wrapNumber(
              selectedIndex + (e.shiftKey ? -1 : 1),
              0,
              matches().length - 1,
            ),
          );
        } else if (e.key === "Escape") {
          close();
        }
      },
      oninput: (e) => {
        setSelectedIndex(-1);
        setSearchString(e.target.value);
      },
    }),
    h("input", {
      type: "checkbox",
      checked: searchExact,
      title: "Exact Search",
      onchange: (e) => setSearchExact(e.target.checked),
    }),
    h("button", { onclick: close }, "Close"),
  );
}
