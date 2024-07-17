export { javascript } from "@codemirror/lang-javascript";
export { EditorView, basicSetup, minimalSetup } from "codemirror";
export {
  RangeSet,
  Prec,
  EditorState,
  StateEffect,
  Transaction,
  Annotation,
  EditorSelection,
  MapMode,
  RangeSetBuilder,
  StateField,
  Facet,
} from "@codemirror/state";
export {
  searchKeymap,
  highlightSelectionMatches,
  SearchQuery,
  RegExpCursor,
  setSearchQuery,
} from "@codemirror/search";
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
  showPanel,
  ViewPlugin,
  runScopeHandlers,
  Direction,
} from "@codemirror/view";
export {
  indentWithTab,
  history,
  defaultKeymap,
  historyKeymap,
  undo,
  redo,
  invertedEffects,
  indentLess,
  indentMore,
  indentSelection,
  cursorCharBackward,
  cursorCharLeft,
  insertNewlineAndIndent,
  cursorLineBoundaryForward,
  cursorLineBoundaryBackward,
} from "@codemirror/commands";
export {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  matchBrackets,
  ensureSyntaxTree,
  StringStream,
  indentUnit,
  foldCode,
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
