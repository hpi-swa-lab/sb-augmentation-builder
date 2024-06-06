import { codeMirror6WithVitrail } from "./vitrail.ts";
import {
  EditorView,
  indentWithTab,
  javascript,
  autocompletion,
  highlightSpecialChars,
  history,
  drawSelection,
  dropCursor,
  EditorState,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  closeBrackets,
  rectangularSelection,
  crosshairCursor,
  highlightSelectionMatches,
  closeBracketsKeymap,
  defaultKeymap,
  searchKeymap,
  historyKeymap,
  foldKeymap,
  completionKeymap,
  lintKeymap,
  lineNumbers,
  highlightActiveLineGutter,
  keymap,
  foldGutter,
} from "../codemirror6/external/codemirror.bundle.js";
import { ayuLight } from "../codemirror6/theme.js";

const baseCMExtensions = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  ayuLight,
  javascript(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
    indentWithTab,
  ]),
];

export async function createDefaultCodeMirror(
  text: string,
  parent: HTMLElement,
  augmentations,
) {
  const cm = new EditorView({
    doc: text,
    extensions: [
      ...baseCMExtensions,
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
    ],
    parent,
  });

  const vitrail = await codeMirror6WithVitrail(
    cm,
    augmentations,
    baseCMExtensions,
  );
  return vitrail;
}
