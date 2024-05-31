import { tags as t } from "./external/codemirror.bundle.js";
import {
  EditorView,
  HighlightStyle,
  syntaxHighlighting,
} from "./external/codemirror.bundle.js";

function createTheme({ variant, settings, styles }) {
  const theme = EditorView.theme(
    {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "&": {
        backgroundColor: settings.background,
        color: settings.foreground,
      },
      ".cm-content": {
        caretColor: settings.caret,
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: settings.caret,
      },
      "&.cm-focused .cm-selectionBackgroundm .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: settings.selection,
        },
      ".cm-activeLine": {
        backgroundColor: settings.lineHighlight,
      },
      ".cm-gutters": {
        backgroundColor: settings.gutterBackground,
        color: settings.gutterForeground,
      },
      ".cm-activeLineGutter": {
        backgroundColor: settings.lineHighlight,
      },
    },
    {
      dark: variant === "dark",
    },
  );

  const highlightStyle = HighlightStyle.define(styles);
  const extension = [theme, syntaxHighlighting(highlightStyle)];

  return extension;
}

// Author: Konstantin Pschera
export const ayuLight = createTheme({
  variant: "light",
  settings: {
    background: "#fcfcfc",
    foreground: "#5c6166",
    caret: "#ffaa33",
    selection: "#036dd626",
    gutterBackground: "#fcfcfc",
    gutterForeground: "#8a919966",
    lineHighlight: "#8a91991a",
  },
  styles: [
    {
      tag: t.comment,
      color: "#787b8099",
    },
    {
      tag: t.string,
      color: "#86b300",
    },
    {
      tag: t.regexp,
      color: "#4cbf99",
    },
    {
      tag: [t.number, t.bool, t.null],
      color: "#ffaa33",
    },
    {
      tag: t.variableName,
      color: "#5c6166",
    },
    {
      tag: [t.definitionKeyword, t.modifier],
      color: "#fa8d3e",
    },
    {
      tag: [t.keyword, t.special(t.brace)],
      color: "#fa8d3e",
    },
    {
      tag: t.operator,
      color: "#ed9366",
    },
    {
      tag: t.separator,
      color: "#5c6166b3",
    },
    {
      tag: t.punctuation,
      color: "#5c6166",
    },
    {
      tag: [t.definition(t.propertyName), t.function(t.variableName)],
      color: "#f2ae49",
    },
    {
      tag: [t.className, t.definition(t.typeName)],
      color: "#22a4e6",
    },
    {
      tag: [t.tagName, t.typeName, t.self, t.labelName],
      color: "#55b4d4",
    },
    {
      tag: t.angleBracket,
      color: "#55b4d480",
    },
    {
      tag: t.attributeName,
      color: "#f2ae49",
    },
  ],
});
