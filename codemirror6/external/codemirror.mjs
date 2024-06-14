export { javascript } from "@codemirror/lang-javascript";
export { EditorView, basicSetup, minimalSetup } from "codemirror";
export {
  RangeSet,
  StateField,
  Prec,
  EditorState,
  StateEffect,
  Transaction,
  Annotation,
} from "@codemirror/state";
export { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
export {
  Decoration,
  WidgetType,
  keymap,
  rectangularSelection,
  highlightSpecialChars,
  dropCursor,
  crosshairCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  drawSelection,
} from "@codemirror/view";
export {
  indentWithTab,
  history,
  defaultKeymap,
  historyKeymap,
  undo,
  redo,
  invertedEffects,
} from "@codemirror/commands";
export {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
} from "@codemirror/language";
export { lintKeymap } from "@codemirror/lint";
export {
  autocompletion,
  startCompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
export { tags } from "@lezer/highlight";
