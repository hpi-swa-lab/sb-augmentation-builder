/* esm.sh - esbuild bundle(@replit/codemirror-vim@6.2.1) es2022 production */
import {
  EditorSelection as ve,
  MapMode as rr,
  Prec as cn,
  RangeSetBuilder as hn,
  StateEffect as dn,
  StateField as vn,
} from "./codemirror.bundle.js";
import {
  foldCode as pn,
  matchBrackets as Xt,
  indentUnit as Zt,
  ensureSyntaxTree as nr,
  StringStream as gn,
} from "./codemirror.bundle.js";
import * as ir from "./codemirror.bundle.js";
import {
  runScopeHandlers as ai,
  EditorView as Je,
  Direction as yn,
  ViewPlugin as mn,
  Decoration as lt,
  showPanel as ar,
} from "./codemirror.bundle.js";
import {
  SearchQuery as Cn,
  setSearchQuery as ut,
  RegExpCursor as kn,
} from "./codemirror.bundle.js";
import {
  indentMore as wn,
  indentLess as Sn,
  cursorLineBoundaryBackward as xn,
  cursorLineBoundaryForward as Mn,
  cursorCharBackward as Ln,
  cursorCharLeft as bn,
  insertNewlineAndIndent as Tn,
  indentSelection as An,
  undo as On,
  redo as En,
} from "./codemirror.bundle.js";
function Rn(f) {
  var o = f.Pos;
  function c(e, t, r) {
    if (t.line === r.line && t.ch >= r.ch - 1) {
      var n = e.getLine(t.line),
        i = n.charCodeAt(t.ch);
      55296 <= i && i <= 55551 && (r.ch += 1);
    }
    return { start: t, end: r };
  }
  var h = [
      { keys: "<Left>", type: "keyToKey", toKeys: "h" },
      { keys: "<Right>", type: "keyToKey", toKeys: "l" },
      { keys: "<Up>", type: "keyToKey", toKeys: "k" },
      { keys: "<Down>", type: "keyToKey", toKeys: "j" },
      { keys: "g<Up>", type: "keyToKey", toKeys: "gk" },
      { keys: "g<Down>", type: "keyToKey", toKeys: "gj" },
      { keys: "<Space>", type: "keyToKey", toKeys: "l" },
      { keys: "<BS>", type: "keyToKey", toKeys: "h" },
      { keys: "<Del>", type: "keyToKey", toKeys: "x" },
      { keys: "<C-Space>", type: "keyToKey", toKeys: "W" },
      { keys: "<C-BS>", type: "keyToKey", toKeys: "B" },
      { keys: "<S-Space>", type: "keyToKey", toKeys: "w" },
      { keys: "<S-BS>", type: "keyToKey", toKeys: "b" },
      { keys: "<C-n>", type: "keyToKey", toKeys: "j" },
      { keys: "<C-p>", type: "keyToKey", toKeys: "k" },
      { keys: "<C-[>", type: "keyToKey", toKeys: "<Esc>" },
      { keys: "<C-c>", type: "keyToKey", toKeys: "<Esc>" },
      { keys: "<C-[>", type: "keyToKey", toKeys: "<Esc>", context: "insert" },
      { keys: "<C-c>", type: "keyToKey", toKeys: "<Esc>", context: "insert" },
      { keys: "<C-Esc>", type: "keyToKey", toKeys: "<Esc>" },
      { keys: "<C-Esc>", type: "keyToKey", toKeys: "<Esc>", context: "insert" },
      { keys: "s", type: "keyToKey", toKeys: "cl", context: "normal" },
      { keys: "s", type: "keyToKey", toKeys: "c", context: "visual" },
      { keys: "S", type: "keyToKey", toKeys: "cc", context: "normal" },
      { keys: "S", type: "keyToKey", toKeys: "VdO", context: "visual" },
      { keys: "<Home>", type: "keyToKey", toKeys: "0" },
      { keys: "<End>", type: "keyToKey", toKeys: "$" },
      { keys: "<PageUp>", type: "keyToKey", toKeys: "<C-b>" },
      { keys: "<PageDown>", type: "keyToKey", toKeys: "<C-f>" },
      { keys: "<CR>", type: "keyToKey", toKeys: "j^", context: "normal" },
      { keys: "<Ins>", type: "keyToKey", toKeys: "i", context: "normal" },
      {
        keys: "<Ins>",
        type: "action",
        action: "toggleOverwrite",
        context: "insert",
      },
      {
        keys: "H",
        type: "motion",
        motion: "moveToTopLine",
        motionArgs: { linewise: !0, toJumplist: !0 },
      },
      {
        keys: "M",
        type: "motion",
        motion: "moveToMiddleLine",
        motionArgs: { linewise: !0, toJumplist: !0 },
      },
      {
        keys: "L",
        type: "motion",
        motion: "moveToBottomLine",
        motionArgs: { linewise: !0, toJumplist: !0 },
      },
      {
        keys: "h",
        type: "motion",
        motion: "moveByCharacters",
        motionArgs: { forward: !1 },
      },
      {
        keys: "l",
        type: "motion",
        motion: "moveByCharacters",
        motionArgs: { forward: !0 },
      },
      {
        keys: "j",
        type: "motion",
        motion: "moveByLines",
        motionArgs: { forward: !0, linewise: !0 },
      },
      {
        keys: "k",
        type: "motion",
        motion: "moveByLines",
        motionArgs: { forward: !1, linewise: !0 },
      },
      {
        keys: "gj",
        type: "motion",
        motion: "moveByDisplayLines",
        motionArgs: { forward: !0 },
      },
      {
        keys: "gk",
        type: "motion",
        motion: "moveByDisplayLines",
        motionArgs: { forward: !1 },
      },
      {
        keys: "w",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !0, wordEnd: !1 },
      },
      {
        keys: "W",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !0, wordEnd: !1, bigWord: !0 },
      },
      {
        keys: "e",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !0, wordEnd: !0, inclusive: !0 },
      },
      {
        keys: "E",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !0, wordEnd: !0, bigWord: !0, inclusive: !0 },
      },
      {
        keys: "b",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !1, wordEnd: !1 },
      },
      {
        keys: "B",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !1, wordEnd: !1, bigWord: !0 },
      },
      {
        keys: "ge",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !1, wordEnd: !0, inclusive: !0 },
      },
      {
        keys: "gE",
        type: "motion",
        motion: "moveByWords",
        motionArgs: { forward: !1, wordEnd: !0, bigWord: !0, inclusive: !0 },
      },
      {
        keys: "{",
        type: "motion",
        motion: "moveByParagraph",
        motionArgs: { forward: !1, toJumplist: !0 },
      },
      {
        keys: "}",
        type: "motion",
        motion: "moveByParagraph",
        motionArgs: { forward: !0, toJumplist: !0 },
      },
      {
        keys: "(",
        type: "motion",
        motion: "moveBySentence",
        motionArgs: { forward: !1 },
      },
      {
        keys: ")",
        type: "motion",
        motion: "moveBySentence",
        motionArgs: { forward: !0 },
      },
      {
        keys: "<C-f>",
        type: "motion",
        motion: "moveByPage",
        motionArgs: { forward: !0 },
      },
      {
        keys: "<C-b>",
        type: "motion",
        motion: "moveByPage",
        motionArgs: { forward: !1 },
      },
      {
        keys: "<C-d>",
        type: "motion",
        motion: "moveByScroll",
        motionArgs: { forward: !0, explicitRepeat: !0 },
      },
      {
        keys: "<C-u>",
        type: "motion",
        motion: "moveByScroll",
        motionArgs: { forward: !1, explicitRepeat: !0 },
      },
      {
        keys: "gg",
        type: "motion",
        motion: "moveToLineOrEdgeOfDocument",
        motionArgs: {
          forward: !1,
          explicitRepeat: !0,
          linewise: !0,
          toJumplist: !0,
        },
      },
      {
        keys: "G",
        type: "motion",
        motion: "moveToLineOrEdgeOfDocument",
        motionArgs: {
          forward: !0,
          explicitRepeat: !0,
          linewise: !0,
          toJumplist: !0,
        },
      },
      { keys: "g$", type: "motion", motion: "moveToEndOfDisplayLine" },
      { keys: "g^", type: "motion", motion: "moveToStartOfDisplayLine" },
      { keys: "g0", type: "motion", motion: "moveToStartOfDisplayLine" },
      { keys: "0", type: "motion", motion: "moveToStartOfLine" },
      {
        keys: "^",
        type: "motion",
        motion: "moveToFirstNonWhiteSpaceCharacter",
      },
      {
        keys: "+",
        type: "motion",
        motion: "moveByLines",
        motionArgs: { forward: !0, toFirstChar: !0 },
      },
      {
        keys: "-",
        type: "motion",
        motion: "moveByLines",
        motionArgs: { forward: !1, toFirstChar: !0 },
      },
      {
        keys: "_",
        type: "motion",
        motion: "moveByLines",
        motionArgs: { forward: !0, toFirstChar: !0, repeatOffset: -1 },
      },
      {
        keys: "$",
        type: "motion",
        motion: "moveToEol",
        motionArgs: { inclusive: !0 },
      },
      {
        keys: "%",
        type: "motion",
        motion: "moveToMatchedSymbol",
        motionArgs: { inclusive: !0, toJumplist: !0 },
      },
      {
        keys: "f<character>",
        type: "motion",
        motion: "moveToCharacter",
        motionArgs: { forward: !0, inclusive: !0 },
      },
      {
        keys: "F<character>",
        type: "motion",
        motion: "moveToCharacter",
        motionArgs: { forward: !1 },
      },
      {
        keys: "t<character>",
        type: "motion",
        motion: "moveTillCharacter",
        motionArgs: { forward: !0, inclusive: !0 },
      },
      {
        keys: "T<character>",
        type: "motion",
        motion: "moveTillCharacter",
        motionArgs: { forward: !1 },
      },
      {
        keys: ";",
        type: "motion",
        motion: "repeatLastCharacterSearch",
        motionArgs: { forward: !0 },
      },
      {
        keys: ",",
        type: "motion",
        motion: "repeatLastCharacterSearch",
        motionArgs: { forward: !1 },
      },
      {
        keys: "'<register>",
        type: "motion",
        motion: "goToMark",
        motionArgs: { toJumplist: !0, linewise: !0 },
      },
      {
        keys: "`<register>",
        type: "motion",
        motion: "goToMark",
        motionArgs: { toJumplist: !0 },
      },
      {
        keys: "]`",
        type: "motion",
        motion: "jumpToMark",
        motionArgs: { forward: !0 },
      },
      {
        keys: "[`",
        type: "motion",
        motion: "jumpToMark",
        motionArgs: { forward: !1 },
      },
      {
        keys: "]'",
        type: "motion",
        motion: "jumpToMark",
        motionArgs: { forward: !0, linewise: !0 },
      },
      {
        keys: "['",
        type: "motion",
        motion: "jumpToMark",
        motionArgs: { forward: !1, linewise: !0 },
      },
      {
        keys: "]p",
        type: "action",
        action: "paste",
        isEdit: !0,
        actionArgs: { after: !0, isEdit: !0, matchIndent: !0 },
      },
      {
        keys: "[p",
        type: "action",
        action: "paste",
        isEdit: !0,
        actionArgs: { after: !1, isEdit: !0, matchIndent: !0 },
      },
      {
        keys: "]<character>",
        type: "motion",
        motion: "moveToSymbol",
        motionArgs: { forward: !0, toJumplist: !0 },
      },
      {
        keys: "[<character>",
        type: "motion",
        motion: "moveToSymbol",
        motionArgs: { forward: !1, toJumplist: !0 },
      },
      { keys: "|", type: "motion", motion: "moveToColumn" },
      {
        keys: "o",
        type: "motion",
        motion: "moveToOtherHighlightedEnd",
        context: "visual",
      },
      {
        keys: "O",
        type: "motion",
        motion: "moveToOtherHighlightedEnd",
        motionArgs: { sameLine: !0 },
        context: "visual",
      },
      { keys: "d", type: "operator", operator: "delete" },
      { keys: "y", type: "operator", operator: "yank" },
      { keys: "c", type: "operator", operator: "change" },
      { keys: "=", type: "operator", operator: "indentAuto" },
      {
        keys: ">",
        type: "operator",
        operator: "indent",
        operatorArgs: { indentRight: !0 },
      },
      {
        keys: "<",
        type: "operator",
        operator: "indent",
        operatorArgs: { indentRight: !1 },
      },
      { keys: "g~", type: "operator", operator: "changeCase" },
      {
        keys: "gu",
        type: "operator",
        operator: "changeCase",
        operatorArgs: { toLower: !0 },
        isEdit: !0,
      },
      {
        keys: "gU",
        type: "operator",
        operator: "changeCase",
        operatorArgs: { toLower: !1 },
        isEdit: !0,
      },
      {
        keys: "n",
        type: "motion",
        motion: "findNext",
        motionArgs: { forward: !0, toJumplist: !0 },
      },
      {
        keys: "N",
        type: "motion",
        motion: "findNext",
        motionArgs: { forward: !1, toJumplist: !0 },
      },
      {
        keys: "gn",
        type: "motion",
        motion: "findAndSelectNextInclusive",
        motionArgs: { forward: !0 },
      },
      {
        keys: "gN",
        type: "motion",
        motion: "findAndSelectNextInclusive",
        motionArgs: { forward: !1 },
      },
      { keys: "gq", type: "operator", operator: "hardWrap" },
      {
        keys: "gw",
        type: "operator",
        operator: "hardWrap",
        operatorArgs: { keepCursor: !0 },
      },
      {
        keys: "x",
        type: "operatorMotion",
        operator: "delete",
        motion: "moveByCharacters",
        motionArgs: { forward: !0 },
        operatorMotionArgs: { visualLine: !1 },
      },
      {
        keys: "X",
        type: "operatorMotion",
        operator: "delete",
        motion: "moveByCharacters",
        motionArgs: { forward: !1 },
        operatorMotionArgs: { visualLine: !0 },
      },
      {
        keys: "D",
        type: "operatorMotion",
        operator: "delete",
        motion: "moveToEol",
        motionArgs: { inclusive: !0 },
        context: "normal",
      },
      {
        keys: "D",
        type: "operator",
        operator: "delete",
        operatorArgs: { linewise: !0 },
        context: "visual",
      },
      {
        keys: "Y",
        type: "operatorMotion",
        operator: "yank",
        motion: "expandToLine",
        motionArgs: { linewise: !0 },
        context: "normal",
      },
      {
        keys: "Y",
        type: "operator",
        operator: "yank",
        operatorArgs: { linewise: !0 },
        context: "visual",
      },
      {
        keys: "C",
        type: "operatorMotion",
        operator: "change",
        motion: "moveToEol",
        motionArgs: { inclusive: !0 },
        context: "normal",
      },
      {
        keys: "C",
        type: "operator",
        operator: "change",
        operatorArgs: { linewise: !0 },
        context: "visual",
      },
      {
        keys: "~",
        type: "operatorMotion",
        operator: "changeCase",
        motion: "moveByCharacters",
        motionArgs: { forward: !0 },
        operatorArgs: { shouldMoveCursor: !0 },
        context: "normal",
      },
      {
        keys: "~",
        type: "operator",
        operator: "changeCase",
        context: "visual",
      },
      {
        keys: "<C-u>",
        type: "operatorMotion",
        operator: "delete",
        motion: "moveToStartOfLine",
        context: "insert",
      },
      {
        keys: "<C-w>",
        type: "operatorMotion",
        operator: "delete",
        motion: "moveByWords",
        motionArgs: { forward: !1, wordEnd: !1 },
        context: "insert",
      },
      { keys: "<C-w>", type: "idle", context: "normal" },
      {
        keys: "<C-i>",
        type: "action",
        action: "jumpListWalk",
        actionArgs: { forward: !0 },
      },
      {
        keys: "<C-o>",
        type: "action",
        action: "jumpListWalk",
        actionArgs: { forward: !1 },
      },
      {
        keys: "<C-e>",
        type: "action",
        action: "scroll",
        actionArgs: { forward: !0, linewise: !0 },
      },
      {
        keys: "<C-y>",
        type: "action",
        action: "scroll",
        actionArgs: { forward: !1, linewise: !0 },
      },
      {
        keys: "a",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "charAfter" },
        context: "normal",
      },
      {
        keys: "A",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "eol" },
        context: "normal",
      },
      {
        keys: "A",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "endOfSelectedArea" },
        context: "visual",
      },
      {
        keys: "i",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "inplace" },
        context: "normal",
      },
      {
        keys: "gi",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "lastEdit" },
        context: "normal",
      },
      {
        keys: "I",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "firstNonBlank" },
        context: "normal",
      },
      {
        keys: "gI",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "bol" },
        context: "normal",
      },
      {
        keys: "I",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { insertAt: "startOfSelectedArea" },
        context: "visual",
      },
      {
        keys: "o",
        type: "action",
        action: "newLineAndEnterInsertMode",
        isEdit: !0,
        interlaceInsertRepeat: !0,
        actionArgs: { after: !0 },
        context: "normal",
      },
      {
        keys: "O",
        type: "action",
        action: "newLineAndEnterInsertMode",
        isEdit: !0,
        interlaceInsertRepeat: !0,
        actionArgs: { after: !1 },
        context: "normal",
      },
      { keys: "v", type: "action", action: "toggleVisualMode" },
      {
        keys: "V",
        type: "action",
        action: "toggleVisualMode",
        actionArgs: { linewise: !0 },
      },
      {
        keys: "<C-v>",
        type: "action",
        action: "toggleVisualMode",
        actionArgs: { blockwise: !0 },
      },
      {
        keys: "<C-q>",
        type: "action",
        action: "toggleVisualMode",
        actionArgs: { blockwise: !0 },
      },
      { keys: "gv", type: "action", action: "reselectLastSelection" },
      { keys: "J", type: "action", action: "joinLines", isEdit: !0 },
      {
        keys: "gJ",
        type: "action",
        action: "joinLines",
        actionArgs: { keepSpaces: !0 },
        isEdit: !0,
      },
      {
        keys: "p",
        type: "action",
        action: "paste",
        isEdit: !0,
        actionArgs: { after: !0, isEdit: !0 },
      },
      {
        keys: "P",
        type: "action",
        action: "paste",
        isEdit: !0,
        actionArgs: { after: !1, isEdit: !0 },
      },
      { keys: "r<character>", type: "action", action: "replace", isEdit: !0 },
      { keys: "@<register>", type: "action", action: "replayMacro" },
      { keys: "q<register>", type: "action", action: "enterMacroRecordMode" },
      {
        keys: "R",
        type: "action",
        action: "enterInsertMode",
        isEdit: !0,
        actionArgs: { replace: !0 },
        context: "normal",
      },
      {
        keys: "R",
        type: "operator",
        operator: "change",
        operatorArgs: { linewise: !0, fullLine: !0 },
        context: "visual",
        exitVisualBlock: !0,
      },
      { keys: "u", type: "action", action: "undo", context: "normal" },
      {
        keys: "u",
        type: "operator",
        operator: "changeCase",
        operatorArgs: { toLower: !0 },
        context: "visual",
        isEdit: !0,
      },
      {
        keys: "U",
        type: "operator",
        operator: "changeCase",
        operatorArgs: { toLower: !1 },
        context: "visual",
        isEdit: !0,
      },
      { keys: "<C-r>", type: "action", action: "redo" },
      { keys: "m<register>", type: "action", action: "setMark" },
      { keys: '"<register>', type: "action", action: "setRegister" },
      {
        keys: "<C-r><register>",
        type: "action",
        action: "insertRegister",
        context: "insert",
        isEdit: !0,
      },
      {
        keys: "<C-o>",
        type: "action",
        action: "oneNormalCommand",
        context: "insert",
      },
      {
        keys: "zz",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "center" },
      },
      {
        keys: "z.",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "center" },
        motion: "moveToFirstNonWhiteSpaceCharacter",
      },
      {
        keys: "zt",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "top" },
      },
      {
        keys: "z<CR>",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "top" },
        motion: "moveToFirstNonWhiteSpaceCharacter",
      },
      {
        keys: "zb",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "bottom" },
      },
      {
        keys: "z-",
        type: "action",
        action: "scrollToCursor",
        actionArgs: { position: "bottom" },
        motion: "moveToFirstNonWhiteSpaceCharacter",
      },
      { keys: ".", type: "action", action: "repeatLastEdit" },
      {
        keys: "<C-a>",
        type: "action",
        action: "incrementNumberToken",
        isEdit: !0,
        actionArgs: { increase: !0, backtrack: !1 },
      },
      {
        keys: "<C-x>",
        type: "action",
        action: "incrementNumberToken",
        isEdit: !0,
        actionArgs: { increase: !1, backtrack: !1 },
      },
      {
        keys: "<C-t>",
        type: "action",
        action: "indent",
        actionArgs: { indentRight: !0 },
        context: "insert",
      },
      {
        keys: "<C-d>",
        type: "action",
        action: "indent",
        actionArgs: { indentRight: !1 },
        context: "insert",
      },
      { keys: "a<register>", type: "motion", motion: "textObjectManipulation" },
      {
        keys: "i<register>",
        type: "motion",
        motion: "textObjectManipulation",
        motionArgs: { textObjectInner: !0 },
      },
      {
        keys: "/",
        type: "search",
        searchArgs: { forward: !0, querySrc: "prompt", toJumplist: !0 },
      },
      {
        keys: "?",
        type: "search",
        searchArgs: { forward: !1, querySrc: "prompt", toJumplist: !0 },
      },
      {
        keys: "*",
        type: "search",
        searchArgs: {
          forward: !0,
          querySrc: "wordUnderCursor",
          wholeWordOnly: !0,
          toJumplist: !0,
        },
      },
      {
        keys: "#",
        type: "search",
        searchArgs: {
          forward: !1,
          querySrc: "wordUnderCursor",
          wholeWordOnly: !0,
          toJumplist: !0,
        },
      },
      {
        keys: "g*",
        type: "search",
        searchArgs: {
          forward: !0,
          querySrc: "wordUnderCursor",
          toJumplist: !0,
        },
      },
      {
        keys: "g#",
        type: "search",
        searchArgs: {
          forward: !1,
          querySrc: "wordUnderCursor",
          toJumplist: !0,
        },
      },
      { keys: ":", type: "ex" },
    ],
    y = h.length,
    k = [
      { name: "colorscheme", shortName: "colo" },
      { name: "map" },
      { name: "imap", shortName: "im" },
      { name: "nmap", shortName: "nm" },
      { name: "vmap", shortName: "vm" },
      { name: "omap", shortName: "om" },
      { name: "noremap", shortName: "no" },
      { name: "nnoremap", shortName: "nn" },
      { name: "vnoremap", shortName: "vn" },
      { name: "inoremap", shortName: "ino" },
      { name: "onoremap", shortName: "ono" },
      { name: "unmap" },
      { name: "mapclear", shortName: "mapc" },
      { name: "nmapclear", shortName: "nmapc" },
      { name: "vmapclear", shortName: "vmapc" },
      { name: "imapclear", shortName: "imapc" },
      { name: "omapclear", shortName: "omapc" },
      { name: "write", shortName: "w" },
      { name: "undo", shortName: "u" },
      { name: "redo", shortName: "red" },
      { name: "set", shortName: "se" },
      { name: "setlocal", shortName: "setl" },
      { name: "setglobal", shortName: "setg" },
      { name: "sort", shortName: "sor" },
      { name: "substitute", shortName: "s", possiblyAsync: !0 },
      { name: "startinsert", shortName: "start" },
      { name: "nohlsearch", shortName: "noh" },
      { name: "yank", shortName: "y" },
      { name: "delmarks", shortName: "delm" },
      { name: "registers", shortName: "reg", excludeFromCommandHistory: !0 },
      { name: "vglobal", shortName: "v" },
      { name: "delete", shortName: "d" },
      { name: "join", shortName: "j" },
      { name: "normal", shortName: "norm" },
      { name: "global", shortName: "g" },
    ],
    x = mt("");
  function M(e) {
    e.setOption("disableInput", !0),
      e.setOption("showCursorWhenSelecting", !1),
      f.signal(e, "vim-mode-change", { mode: "normal" }),
      e.on("cursorActivity", Ut),
      Ie(e),
      f.on(e.getInputField(), "paste", P(e));
  }
  function b(e) {
    e.setOption("disableInput", !1),
      e.off("cursorActivity", Ut),
      f.off(e.getInputField(), "paste", P(e)),
      (e.state.vim = null),
      $e && clearTimeout($e);
  }
  function P(e) {
    var t = e.state.vim;
    return (
      t.onPasteFn ||
        (t.onPasteFn = function () {
          t.insertMode ||
            (e.setCursor(J(e.getCursor(), 0, 1)), Ke.enterInsertMode(e, {}, t));
        }),
      t.onPasteFn
    );
  }
  var F = /[\d]/,
    I = [
      f.isWordChar,
      function (e) {
        return e && !f.isWordChar(e) && !/\s/.test(e);
      },
    ],
    E = [
      function (e) {
        return /\S/.test(e);
      },
    ],
    V = ["<", ">"],
    K = ["-", '"', ".", ":", "_", "/", "+"],
    U = /^\w$/,
    W;
  try {
    W = new RegExp("^[\\p{Lu}]$", "u");
  } catch {
    W = /^[A-Z]$/;
  }
  function oe(e, t) {
    return t >= e.firstLine() && t <= e.lastLine();
  }
  function ne(e) {
    return /^[a-z]$/.test(e);
  }
  function Ee(e) {
    return "()[]{}".indexOf(e) != -1;
  }
  function ke(e) {
    return F.test(e);
  }
  function se(e) {
    return W.test(e);
  }
  function $(e) {
    return /^\s*$/.test(e);
  }
  function pe(e) {
    return ".?!".indexOf(e) != -1;
  }
  function ze(e, t) {
    for (var r = 0; r < t.length; r++) if (t[r] == e) return !0;
    return !1;
  }
  var we = {};
  function Re(e, t, r, n, i) {
    if (t === void 0 && !i)
      throw Error("defaultValue is required unless callback is provided");
    if (
      (r || (r = "string"),
      (we[e] = { type: r, defaultValue: t, callback: i }),
      n)
    )
      for (var a = 0; a < n.length; a++) we[n[a]] = we[e];
    t && qe(e, t);
  }
  function qe(e, t, r, n) {
    var i = we[e];
    n = n || {};
    var a = n.scope;
    if (!i) return new Error("Unknown option: " + e);
    if (i.type == "boolean") {
      if (t && t !== !0) return new Error("Invalid argument: " + e + "=" + t);
      t !== !1 && (t = !0);
    }
    i.callback
      ? (a !== "local" && i.callback(t, void 0),
        a !== "global" && r && i.callback(t, r))
      : (a !== "local" && (i.value = i.type == "boolean" ? !!t : t),
        a !== "global" && r && (r.state.vim.options[e] = { value: t }));
  }
  function Me(e, t, r) {
    var n = we[e];
    r = r || {};
    var i = r.scope;
    if (!n) return new Error("Unknown option: " + e);
    if (n.callback) {
      let a = t && n.callback(void 0, t);
      return i !== "global" && a !== void 0
        ? a
        : i !== "local"
          ? n.callback()
          : void 0;
    } else
      return (
        (i !== "global" && t && t.state.vim.options[e]) ||
        (i !== "local" && n) ||
        {}
      ).value;
  }
  Re("filetype", void 0, "string", ["ft"], function (e, t) {
    if (t !== void 0)
      if (e === void 0) {
        let r = t.getOption("mode");
        return r == "null" ? "" : r;
      } else {
        let r = e == "" ? "null" : e;
        t.setOption("mode", r);
      }
  }),
    Re("textwidth", 80, "number", ["tw"], function (e, t) {
      if (t !== void 0)
        if (e === void 0) {
          var r = t.getOption("textwidth");
          return r;
        } else {
          var n = Math.round(e);
          n > 1 && t.setOption("textwidth", n);
        }
    });
  var vr = function () {
      var e = 100,
        t = -1,
        r = 0,
        n = 0,
        i = new Array(e);
      function a(u, d, v) {
        var m = t % e,
          C = i[m];
        function g(w) {
          var S = ++t % e,
            A = i[S];
          A && A.clear(), (i[S] = u.setBookmark(w));
        }
        if (C) {
          var p = C.find();
          p && !ue(p, d) && g(d);
        } else g(d);
        g(v), (r = t), (n = t - e + 1), n < 0 && (n = 0);
      }
      function s(u, d) {
        (t += d), t > r ? (t = r) : t < n && (t = n);
        var v = i[(e + t) % e];
        if (v && !v.find()) {
          var m = d > 0 ? 1 : -1,
            C,
            g = u.getCursor();
          do
            if (
              ((t += m), (v = i[(e + t) % e]), v && (C = v.find()) && !ue(g, C))
            )
              break;
          while (t < r && t > n);
        }
        return v;
      }
      function l(u, d) {
        var v = t,
          m = s(u, d);
        return (t = v), m && m.find();
      }
      return { cachedCursor: void 0, add: a, find: l, move: s };
    },
    pt = function (e) {
      return e
        ? {
            changes: e.changes,
            expectCursorActivityForChange: e.expectCursorActivityForChange,
          }
        : { changes: [], expectCursorActivityForChange: !1 };
    };
  class pr {
    constructor() {
      (this.latestRegister = void 0),
        (this.isPlaying = !1),
        (this.isRecording = !1),
        (this.replaySearchQueries = []),
        (this.onRecordingDone = void 0),
        (this.lastInsertModeChanges = pt());
    }
    exitMacroRecordMode() {
      var t = L.macroModeState;
      t.onRecordingDone && t.onRecordingDone(),
        (t.onRecordingDone = void 0),
        (t.isRecording = !1);
    }
    enterMacroRecordMode(t, r) {
      var n = L.registerController.getRegister(r);
      if (n) {
        if ((n.clear(), (this.latestRegister = r), t.openDialog)) {
          var i = be("span", { class: "cm-vim-message" }, "recording @" + r);
          this.onRecordingDone = t.openDialog(i, null, { bottom: !0 });
        }
        this.isRecording = !0;
      }
    }
  }
  function Ie(e) {
    return (
      e.state.vim ||
        (e.state.vim = {
          inputState: new Ct(),
          lastEditInputState: void 0,
          lastEditActionCommand: void 0,
          lastHPos: -1,
          lastHSPos: -1,
          lastMotion: null,
          marks: {},
          insertMode: !1,
          insertModeReturn: !1,
          insertModeRepeat: void 0,
          visualMode: !1,
          visualLine: !1,
          visualBlock: !1,
          lastSelection: null,
          lastPastedText: null,
          sel: {},
          options: {},
          expectLiteralNext: !1,
        }),
      e.state.vim
    );
  }
  var L;
  function gt() {
    L = {
      searchQuery: null,
      searchIsReversed: !1,
      lastSubstituteReplacePart: void 0,
      jumpList: vr(),
      macroModeState: new pr(),
      lastCharacterSearch: { increment: 0, forward: !0, selectedCharacter: "" },
      registerController: new kr({}),
      searchHistoryController: new kt(),
      exCommandHistoryController: new kt(),
    };
    for (var e in we) {
      var t = we[e];
      t.value = t.defaultValue;
    }
  }
  var De,
    le = {
      enterVimMode: M,
      leaveVimMode: b,
      buildKeyMap: function () {},
      getRegisterController: function () {
        return L.registerController;
      },
      resetVimGlobalState_: gt,
      getVimGlobalState_: function () {
        return L;
      },
      maybeInitVimState_: Ie,
      suppressErrorLogging: !1,
      InsertModeKey: it,
      map: function (e, t, r) {
        de.map(e, t, r);
      },
      unmap: function (e, t) {
        return de.unmap(e, t);
      },
      noremap: function (e, t, r) {
        de.map(e, t, r, !0);
      },
      mapclear: function (e) {
        var t = h.length,
          r = y,
          n = h.slice(0, t - r);
        if (((h = h.slice(t - r)), e))
          for (var i = n.length - 1; i >= 0; i--) {
            var a = n[i];
            if (e !== a.context)
              if (a.context) this._mapCommand(a);
              else {
                var s = ["normal", "insert", "visual"];
                for (var l in s)
                  if (s[l] !== e) {
                    var u = Object.assign({}, a);
                    (u.context = s[l]), this._mapCommand(u);
                  }
              }
          }
      },
      langmap: yt,
      vimKeyFromEvent: He,
      setOption: qe,
      getOption: Me,
      defineOption: Re,
      defineEx: function (e, t, r) {
        if (!t) t = e;
        else if (e.indexOf(t) !== 0)
          throw new Error(
            '(Vim.defineEx) "' +
              t +
              '" is not a prefix of "' +
              e +
              '", command not registered',
          );
        (Wt[e] = r),
          (de.commandMap_[t] = { name: e, shortName: t, type: "api" });
      },
      handleKey: function (e, t, r) {
        var n = this.findKey(e, t, r);
        if (typeof n == "function") return n();
      },
      multiSelectHandleKey: un,
      findKey: function (e, t, r) {
        var n = Ie(e),
          i = e;
        function a() {
          var v = L.macroModeState;
          if (v.isRecording) {
            if (t == "q") return v.exitMacroRecordMode(), G(i), !0;
            r != "mapping" && on(v, t);
          }
        }
        function s() {
          if (t == "<Esc>") {
            if (n.visualMode) ye(i);
            else if (n.insertMode) Te(i);
            else return;
            return G(i), !0;
          }
        }
        function l() {
          if (s()) return !0;
          n.inputState.keyBuffer.push(t);
          var v = n.inputState.keyBuffer.join(""),
            m = t.length == 1,
            C = Ae.matchCommand(v, h, n.inputState, "insert"),
            g = n.inputState.changeQueue;
          if (C.type == "none") return G(i), !1;
          if (C.type == "partial") {
            if (
              (C.expectLiteralNext && (n.expectLiteralNext = !0),
              De && window.clearTimeout(De),
              (De =
                m &&
                window.setTimeout(function () {
                  n.insertMode && n.inputState.keyBuffer.length && G(i);
                }, Me("insertModeEscKeysTimeout"))),
              m)
            ) {
              var p = i.listSelections();
              (!g || g.removed.length != p.length) &&
                (g = n.inputState.changeQueue = new mr()),
                (g.inserted += t);
              for (var w = 0; w < p.length; w++) {
                var S = ie(p[w].anchor, p[w].head),
                  A = Le(p[w].anchor, p[w].head),
                  T = i.getRange(S, i.state.overwrite ? J(A, 0, 1) : A);
                g.removed[w] = (g.removed[w] || "") + T;
              }
            }
            return !m;
          }
          if (
            ((n.expectLiteralNext = !1),
            De && window.clearTimeout(De),
            C.command && g)
          ) {
            for (var p = i.listSelections(), w = 0; w < p.length; w++) {
              var O = p[w].head;
              i.replaceRange(
                g.removed[w] || "",
                J(O, 0, -g.inserted.length),
                O,
                "+input",
              );
            }
            L.macroModeState.lastInsertModeChanges.changes.pop();
          }
          return C.command || G(i), C.command;
        }
        function u() {
          if (a() || s()) return !0;
          n.inputState.keyBuffer.push(t);
          var v = n.inputState.keyBuffer.join("");
          if (/^[1-9]\d*$/.test(v)) return !0;
          var m = /^(\d*)(.*)$/.exec(v);
          if (!m) return G(i), !1;
          var C = n.visualMode ? "visual" : "normal",
            g = m[2] || m[1];
          n.inputState.operatorShortcut &&
            n.inputState.operatorShortcut.slice(-1) == g &&
            (g = n.inputState.operatorShortcut);
          var p = Ae.matchCommand(g, h, n.inputState, C);
          return p.type == "none"
            ? (G(i), !1)
            : p.type == "partial"
              ? (p.expectLiteralNext && (n.expectLiteralNext = !0), !0)
              : p.type == "clear"
                ? (G(i), !0)
                : ((n.expectLiteralNext = !1),
                  (n.inputState.keyBuffer.length = 0),
                  (m = /^(\d*)(.*)$/.exec(v)),
                  m &&
                    m[1] &&
                    m[1] != "0" &&
                    n.inputState.pushRepeatDigit(m[1]),
                  p.command);
        }
        var d;
        return (
          n.insertMode ? (d = l()) : (d = u()),
          d === !1
            ? !n.insertMode && t.length === 1
              ? function () {
                  return !0;
                }
              : void 0
            : d === !0
              ? function () {
                  return !0;
                }
              : function () {
                  return i.operation(function () {
                    i.curOp.isVimOp = !0;
                    try {
                      d.type == "keyToKey"
                        ? Fe(i, d.toKeys, d)
                        : Ae.processCommand(i, n, d);
                    } catch (v) {
                      throw (
                        ((i.state.vim = void 0),
                        Ie(i),
                        le.suppressErrorLogging || console.log(v),
                        v)
                      );
                    }
                    return !0;
                  });
                }
        );
      },
      handleEx: function (e, t) {
        de.processCommand(e, t);
      },
      defineMotion: wr,
      defineAction: xr,
      defineOperator: Sr,
      mapCommand: nn,
      _mapCommand: $t,
      defineRegister: Cr,
      exitVisualMode: ye,
      exitInsertMode: Te,
    },
    Be = [],
    _e = !1,
    Q;
  function gr(e) {
    if (e[0] == "<") {
      var t = e.toLowerCase().slice(1, -1),
        r = t.split("-");
      if (((t = r.pop() || ""), t == "lt")) e = "<";
      else if (t == "space") e = " ";
      else if (t == "cr")
        e = `
`;
      else if (Ne[t]) {
        var n = Q.value,
          i = {
            key: Ne[t],
            target: {
              value: n,
              selectionEnd: n.length,
              selectionStart: n.length,
            },
          };
        Q.onKeyDown && Q.onKeyDown(i, Q.value, s),
          Q && Q.onKeyUp && Q.onKeyUp(i, Q.value, s);
        return;
      }
    }
    if (
      e ==
      `
`
    ) {
      var a = Q;
      (Q = null), a.onClose && a.onClose(a.value);
    } else Q.value = (Q.value || "") + e;
    function s(l) {
      typeof l == "string" ? (Q.value = l) : (Q = null);
    }
  }
  function Fe(e, t, r) {
    var n = _e;
    if (r) {
      if (Be.indexOf(r) != -1) return;
      Be.push(r), (_e = r.noremap != !1);
    }
    try {
      for (var i = Ie(e), a = /<(?:[CSMA]-)*\w+>|./gi, s; (s = a.exec(t)); ) {
        var l = s[0],
          u = i.insertMode;
        if (Q) {
          gr(l);
          continue;
        }
        var d = le.handleKey(e, l, "mapping");
        if (!d && u && i.insertMode) {
          if (l[0] == "<") {
            var v = l.toLowerCase().slice(1, -1),
              m = v.split("-");
            if (((v = m.pop() || ""), v == "lt")) l = "<";
            else if (v == "space") l = " ";
            else if (v == "cr")
              l = `
`;
            else if (Ne.hasOwnProperty(v)) {
              (l = Ne[v]), qt(e, l);
              continue;
            } else (l = l[0]), (a.lastIndex = s.index + 1);
          }
          e.replaceSelection(l);
        }
      }
    } finally {
      if ((Be.pop(), (_e = Be.length ? n : !1), !Be.length && Q)) {
        var C = Q;
        (Q = null), Ve(e, C);
      }
    }
  }
  var Ge = {
      Return: "CR",
      Backspace: "BS",
      Delete: "Del",
      Escape: "Esc",
      Insert: "Ins",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      ArrowUp: "Up",
      ArrowDown: "Down",
      Enter: "CR",
      " ": "Space",
    },
    yr = {
      Shift: 1,
      Alt: 1,
      Command: 1,
      Control: 1,
      CapsLock: 1,
      AltGraph: 1,
      Dead: 1,
      Unidentified: 1,
    },
    Ne = {};
  "Left|Right|Up|Down|End|Home"
    .split("|")
    .concat(Object.keys(Ge))
    .forEach(function (e) {
      Ne[(Ge[e] || "").toLowerCase()] = Ne[e.toLowerCase()] = e;
    });
  function He(e, t) {
    var r = e.key;
    if (!yr[r]) {
      r.length > 1 && r[0] == "n" && (r = r.replace("Numpad", "")),
        (r = Ge[r] || r);
      var n = "";
      if (
        (e.ctrlKey && (n += "C-"),
        e.altKey && (n += "A-"),
        e.metaKey && (n += "M-"),
        f.isMac && e.altKey && !e.metaKey && !e.ctrlKey && (n = n.slice(2)),
        (n || r.length > 1) && e.shiftKey && (n += "S-"),
        t && !t.expectLiteralNext && r.length == 1)
      ) {
        if (x.keymap && r in x.keymap)
          (x.remapCtrl != !1 || !n) && (r = x.keymap[r]);
        else if (r.charCodeAt(0) > 255) {
          var i = e.code?.slice(-1) || "";
          e.shiftKey || (i = i.toLowerCase()), i && (r = i);
        }
      }
      return (n += r), n.length > 1 && (n = "<" + n + ">"), n;
    }
  }
  function yt(e, t) {
    x.string !== e && (x = mt(e)), (x.remapCtrl = t);
  }
  function mt(e) {
    let t = {};
    if (!e) return { keymap: t, string: "" };
    function r(n) {
      return n.split(/\\?(.)/).filter(Boolean);
    }
    return (
      e.split(/((?:[^\\,]|\\.)+),/).map((n) => {
        if (!n) return;
        let i = n.split(/((?:[^\\;]|\\.)+);/);
        if (i.length == 3) {
          let a = r(i[1]),
            s = r(i[2]);
          if (a.length !== s.length) return;
          for (let l = 0; l < a.length; ++l) t[a[l]] = s[l];
        } else if (i.length == 1) {
          let a = r(n);
          if (a.length % 2 !== 0) return;
          for (let s = 0; s < a.length; s += 2) t[a[s]] = a[s + 1];
        }
      }),
      { keymap: t, string: e }
    );
  }
  Re("langmap", void 0, "string", ["lmap"], function (e, t) {
    if (e === void 0) return x.string;
    yt(e);
  });
  class Ct {
    constructor() {
      (this.prefixRepeat = []),
        (this.motionRepeat = []),
        (this.operator = null),
        (this.operatorArgs = null),
        (this.motion = null),
        (this.motionArgs = null),
        (this.keyBuffer = []),
        (this.registerName = null),
        (this.changeQueue = null);
    }
    pushRepeatDigit(t) {
      this.operator
        ? (this.motionRepeat = this.motionRepeat.concat(t))
        : (this.prefixRepeat = this.prefixRepeat.concat(t));
    }
    getRepeat() {
      var t = 0;
      return (
        (this.prefixRepeat.length > 0 || this.motionRepeat.length > 0) &&
          ((t = 1),
          this.prefixRepeat.length > 0 &&
            (t *= parseInt(this.prefixRepeat.join(""), 10)),
          this.motionRepeat.length > 0 &&
            (t *= parseInt(this.motionRepeat.join(""), 10))),
        t
      );
    }
  }
  function G(e, t) {
    (e.state.vim.inputState = new Ct()),
      (e.state.vim.expectLiteralNext = !1),
      f.signal(e, "vim-command-done", t);
  }
  function mr() {
    (this.removed = []), (this.inserted = "");
  }
  class ge {
    constructor(t, r, n) {
      this.clear(),
        (this.keyBuffer = [t || ""]),
        (this.insertModeChanges = []),
        (this.searchQueries = []),
        (this.linewise = !!r),
        (this.blockwise = !!n);
    }
    setText(t, r, n) {
      (this.keyBuffer = [t || ""]),
        (this.linewise = !!r),
        (this.blockwise = !!n);
    }
    pushText(t, r) {
      r &&
        (this.linewise ||
          this.keyBuffer.push(`
`),
        (this.linewise = !0)),
        this.keyBuffer.push(t);
    }
    pushInsertModeChanges(t) {
      this.insertModeChanges.push(pt(t));
    }
    pushSearchQuery(t) {
      this.searchQueries.push(t);
    }
    clear() {
      (this.keyBuffer = []),
        (this.insertModeChanges = []),
        (this.searchQueries = []),
        (this.linewise = !1);
    }
    toString() {
      return this.keyBuffer.join("");
    }
  }
  function Cr(e, t) {
    var r = L.registerController.registers;
    if (!e || e.length != 1) throw Error("Register name must be 1 character");
    if (r[e]) throw Error("Register already defined " + e);
    (r[e] = t), K.push(e);
  }
  class kr {
    constructor(t) {
      (this.registers = t),
        (this.unnamedRegister = t['"'] = new ge()),
        (t["."] = new ge()),
        (t[":"] = new ge()),
        (t["/"] = new ge()),
        (t["+"] = new ge());
    }
    pushText(t, r, n, i, a) {
      if (t !== "_") {
        i &&
          n.charAt(n.length - 1) !==
            `
` &&
          (n += `
`);
        var s = this.isValidRegister(t) ? this.getRegister(t) : null;
        if (!s) {
          switch (r) {
            case "yank":
              this.registers[0] = new ge(n, i, a);
              break;
            case "delete":
            case "change":
              n.indexOf(`
`) == -1
                ? (this.registers["-"] = new ge(n, i))
                : (this.shiftNumericRegisters_(),
                  (this.registers[1] = new ge(n, i)));
              break;
          }
          this.unnamedRegister.setText(n, i, a);
          return;
        }
        var l = se(t);
        l ? s.pushText(n, i) : s.setText(n, i, a),
          t === "+" && navigator.clipboard.writeText(n),
          this.unnamedRegister.setText(s.toString(), i);
      }
    }
    getRegister(t) {
      return this.isValidRegister(t)
        ? ((t = t.toLowerCase()),
          this.registers[t] || (this.registers[t] = new ge()),
          this.registers[t])
        : this.unnamedRegister;
    }
    isValidRegister(t) {
      return t && (ze(t, K) || U.test(t));
    }
    shiftNumericRegisters_() {
      for (var t = 9; t >= 2; t--)
        this.registers[t] = this.getRegister("" + (t - 1));
    }
  }
  class kt {
    constructor() {
      (this.historyBuffer = []),
        (this.iterator = 0),
        (this.initialPrefix = null);
    }
    nextMatch(t, r) {
      var n = this.historyBuffer,
        i = r ? -1 : 1;
      this.initialPrefix === null && (this.initialPrefix = t);
      for (var a = this.iterator + i; r ? a >= 0 : a < n.length; a += i)
        for (var s = n[a], l = 0; l <= s.length; l++)
          if (this.initialPrefix == s.substring(0, l))
            return (this.iterator = a), s;
      if (a >= n.length) return (this.iterator = n.length), this.initialPrefix;
      if (a < 0) return t;
    }
    pushInput(t) {
      var r = this.historyBuffer.indexOf(t);
      r > -1 && this.historyBuffer.splice(r, 1),
        t.length && this.historyBuffer.push(t);
    }
    reset() {
      (this.initialPrefix = null), (this.iterator = this.historyBuffer.length);
    }
  }
  var Ae = {
      matchCommand: function (e, t, r, n) {
        var i = Mr(e, t, n, r);
        if (!i.full && !i.partial) return { type: "none" };
        if (!i.full && i.partial)
          return {
            type: "partial",
            expectLiteralNext:
              i.partial.length == 1 &&
              i.partial[0].keys.slice(-11) == "<character>",
          };
        for (var a, s = 0; s < i.full.length; s++) {
          var l = i.full[s];
          a || (a = l);
        }
        if (
          a.keys.slice(-11) == "<character>" ||
          a.keys.slice(-10) == "<register>"
        ) {
          var u = br(e);
          if (!u || u.length > 1) return { type: "clear" };
          r.selectedCharacter = u;
        }
        return { type: "full", command: a };
      },
      processCommand: function (e, t, r) {
        switch (((t.inputState.repeatOverride = r.repeatOverride), r.type)) {
          case "motion":
            this.processMotion(e, t, r);
            break;
          case "operator":
            this.processOperator(e, t, r);
            break;
          case "operatorMotion":
            this.processOperatorMotion(e, t, r);
            break;
          case "action":
            this.processAction(e, t, r);
            break;
          case "search":
            this.processSearch(e, t, r);
            break;
          case "ex":
          case "keyToEx":
            this.processEx(e, t, r);
            break;
        }
      },
      processMotion: function (e, t, r) {
        (t.inputState.motion = r.motion),
          (t.inputState.motionArgs = Ue(r.motionArgs)),
          this.evalInput(e, t);
      },
      processOperator: function (e, t, r) {
        var n = t.inputState;
        if (n.operator)
          if (n.operator == r.operator) {
            (n.motion = "expandToLine"),
              (n.motionArgs = { linewise: !0, repeat: 1 }),
              this.evalInput(e, t);
            return;
          } else G(e);
        (n.operator = r.operator),
          (n.operatorArgs = Ue(r.operatorArgs)),
          r.keys.length > 1 && (n.operatorShortcut = r.keys),
          r.exitVisualBlock && ((t.visualBlock = !1), Pe(e)),
          t.visualMode && this.evalInput(e, t);
      },
      processOperatorMotion: function (e, t, r) {
        var n = t.visualMode,
          i = Ue(r.operatorMotionArgs);
        i && n && i.visualLine && (t.visualLine = !0),
          this.processOperator(e, t, r),
          n || this.processMotion(e, t, r);
      },
      processAction: function (e, t, r) {
        var n = t.inputState,
          i = n.getRepeat(),
          a = !!i,
          s = Ue(r.actionArgs) || { repeat: 1 };
        n.selectedCharacter && (s.selectedCharacter = n.selectedCharacter),
          r.operator && this.processOperator(e, t, r),
          r.motion && this.processMotion(e, t, r),
          (r.motion || r.operator) && this.evalInput(e, t),
          (s.repeat = i || 1),
          (s.repeatIsExplicit = a),
          (s.registerName = n.registerName),
          G(e),
          (t.lastMotion = null),
          r.isEdit && this.recordLastEdit(t, n, r),
          Ke[r.action](e, s, t);
      },
      processSearch: function (e, t, r) {
        if (!e.getSearchCursor) return;
        var n = r.searchArgs.forward,
          i = r.searchArgs.wholeWordOnly;
        he(e).setReversed(!n);
        var a = n ? "/" : "?",
          s = he(e).getQuery(),
          l = e.getScrollInfo();
        function u(w, S, A) {
          L.searchHistoryController.pushInput(w),
            L.searchHistoryController.reset();
          try {
            We(e, w, S, A);
          } catch {
            D(e, "Invalid regex: " + w), G(e);
            return;
          }
          Ae.processMotion(e, t, {
            keys: "",
            type: "motion",
            motion: "findNext",
            motionArgs: { forward: !0, toJumplist: r.searchArgs.toJumplist },
          });
        }
        function d(w) {
          e.scrollTo(l.left, l.top), u(w, !0, !0);
          var S = L.macroModeState;
          S.isRecording && ln(S, w);
        }
        function v(w, S, A) {
          var T = He(w),
            O,
            _;
          T == "<Up>" || T == "<Down>"
            ? ((O = T == "<Up>"),
              (_ = w.target ? w.target.selectionEnd : 0),
              (S = L.searchHistoryController.nextMatch(S, O) || ""),
              A(S),
              _ &&
                w.target &&
                (w.target.selectionEnd = w.target.selectionStart =
                  Math.min(_, w.target.value.length)))
            : T &&
              T != "<Left>" &&
              T != "<Right>" &&
              L.searchHistoryController.reset();
          var ee;
          try {
            ee = We(e, S, !0, !0);
          } catch {}
          ee
            ? e.scrollIntoView(Ht(e, !n, ee), 30)
            : (rt(e), e.scrollTo(l.left, l.top));
        }
        function m(w, S, A) {
          var T = He(w);
          T == "<Esc>" ||
          T == "<C-c>" ||
          T == "<C-[>" ||
          (T == "<BS>" && S == "")
            ? (L.searchHistoryController.pushInput(S),
              L.searchHistoryController.reset(),
              We(e, s),
              rt(e),
              e.scrollTo(l.left, l.top),
              f.e_stop(w),
              G(e),
              A(),
              e.focus())
            : T == "<Up>" || T == "<Down>"
              ? f.e_stop(w)
              : T == "<C-u>" && (f.e_stop(w), A(""));
        }
        switch (r.searchArgs.querySrc) {
          case "prompt":
            var C = L.macroModeState;
            if (C.isPlaying) {
              let S = C.replaySearchQueries.shift();
              u(S, !0, !1);
            } else
              Ve(e, {
                onClose: d,
                prefix: a,
                desc: "(JavaScript regexp)",
                onKeyUp: v,
                onKeyDown: m,
              });
            break;
          case "wordUnderCursor":
            var g = et(e, { noSymbol: !0 }),
              p = !0;
            if ((g || ((g = et(e, { noSymbol: !1 })), (p = !1)), !g)) {
              D(e, "No word under cursor"), G(e);
              return;
            }
            let w = e.getLine(g.start.line).substring(g.start.ch, g.end.ch);
            p && i ? (w = "\\b" + w + "\\b") : (w = Tr(w)),
              (L.jumpList.cachedCursor = e.getCursor()),
              e.setCursor(g.start),
              u(w, !0, !1);
            break;
        }
      },
      processEx: function (e, t, r) {
        function n(a) {
          L.exCommandHistoryController.pushInput(a),
            L.exCommandHistoryController.reset(),
            de.processCommand(e, a),
            e.state.vim && G(e);
        }
        function i(a, s, l) {
          var u = He(a),
            d,
            v;
          (u == "<Esc>" ||
            u == "<C-c>" ||
            u == "<C-[>" ||
            (u == "<BS>" && s == "")) &&
            (L.exCommandHistoryController.pushInput(s),
            L.exCommandHistoryController.reset(),
            f.e_stop(a),
            G(e),
            l(),
            e.focus()),
            u == "<Up>" || u == "<Down>"
              ? (f.e_stop(a),
                (d = u == "<Up>"),
                (v = a.target ? a.target.selectionEnd : 0),
                (s = L.exCommandHistoryController.nextMatch(s, d) || ""),
                l(s),
                v &&
                  a.target &&
                  (a.target.selectionEnd = a.target.selectionStart =
                    Math.min(v, a.target.value.length)))
              : u == "<C-u>"
                ? (f.e_stop(a), l(""))
                : u &&
                  u != "<Left>" &&
                  u != "<Right>" &&
                  L.exCommandHistoryController.reset();
        }
        r.type == "keyToEx"
          ? de.processCommand(e, r.exArgs.input)
          : t.visualMode
            ? Ve(e, {
                onClose: n,
                prefix: ":",
                value: "'<,'>",
                onKeyDown: i,
                selectValueOnOpen: !1,
              })
            : Ve(e, { onClose: n, prefix: ":", onKeyDown: i });
      },
      evalInput: function (e, t) {
        var r = t.inputState,
          n = r.motion,
          i = r.motionArgs || { repeat: 1 },
          a = r.operator,
          s = r.operatorArgs || {},
          l = r.registerName,
          u = t.sel,
          d = H(t.visualMode ? te(e, u.head) : e.getCursor("head")),
          v = H(t.visualMode ? te(e, u.anchor) : e.getCursor("anchor")),
          m = H(d),
          C = H(v),
          g,
          p,
          w;
        if (
          (a && this.recordLastEdit(t, r),
          r.repeatOverride !== void 0
            ? (w = r.repeatOverride)
            : (w = r.getRepeat()),
          w > 0 && i.explicitRepeat
            ? (i.repeatIsExplicit = !0)
            : (i.noRepeat || (!i.explicitRepeat && w === 0)) &&
              ((w = 1), (i.repeatIsExplicit = !1)),
          r.selectedCharacter &&
            (i.selectedCharacter = s.selectedCharacter = r.selectedCharacter),
          (i.repeat = w),
          G(e),
          n)
        ) {
          var S = Se[n](e, d, i, t, r);
          if (((t.lastMotion = Se[n]), !S)) return;
          if (i.toJumplist) {
            var A = L.jumpList,
              T = A.cachedCursor;
            T ? (Tt(e, T, S), delete A.cachedCursor) : Tt(e, d, S);
          }
          S instanceof Array ? ((p = S[0]), (g = S[1])) : (g = S),
            g || (g = H(d)),
            t.visualMode
              ? ((t.visualBlock && g.ch === 1 / 0) || (g = te(e, g, m)),
                p && (p = te(e, p)),
                (p = p || C),
                (u.anchor = p),
                (u.head = g),
                Pe(e),
                xe(e, t, "<", j(p, g) ? p : g),
                xe(e, t, ">", j(p, g) ? g : p))
              : a || ((g = te(e, g, m)), e.setCursor(g.line, g.ch));
        }
        if (a) {
          if (s.lastSel) {
            p = C;
            var O = s.lastSel,
              _ = Math.abs(O.head.line - O.anchor.line),
              ee = Math.abs(O.head.ch - O.anchor.ch);
            O.visualLine
              ? (g = new o(C.line + _, C.ch))
              : O.visualBlock
                ? (g = new o(C.line + _, C.ch + ee))
                : O.head.line == O.anchor.line
                  ? (g = new o(C.line, C.ch + ee))
                  : (g = new o(C.line + _, C.ch)),
              (t.visualMode = !0),
              (t.visualLine = O.visualLine),
              (t.visualBlock = O.visualBlock),
              (u = t.sel = { anchor: p, head: g }),
              Pe(e);
          } else
            t.visualMode &&
              (s.lastSel = {
                anchor: H(u.anchor),
                head: H(u.head),
                visualBlock: t.visualBlock,
                visualLine: t.visualLine,
              });
          var z, Z, B, N, re;
          if (t.visualMode) {
            (z = ie(u.head, u.anchor)),
              (Z = Le(u.head, u.anchor)),
              (B = t.visualLine || s.linewise),
              (N = t.visualBlock ? "block" : B ? "line" : "char");
            var Y = c(e, z, Z);
            if (((re = Ye(e, { anchor: Y.start, head: Y.end }, N)), B)) {
              var q = re.ranges;
              if (N == "block")
                for (var Ce = 0; Ce < q.length; Ce++)
                  q[Ce].head.ch = X(e, q[Ce].head.line);
              else N == "line" && (q[0].head = new o(q[0].head.line + 1, 0));
            }
          } else {
            if (((z = H(p || C)), (Z = H(g || m)), j(Z, z))) {
              var ot = z;
              (z = Z), (Z = ot);
            }
            (B = i.linewise || s.linewise),
              B ? Nr(e, z, Z) : i.forward && Br(e, z, Z),
              (N = "char");
            var fn = !i.inclusive || B,
              Y = c(e, z, Z);
            re = Ye(e, { anchor: Y.start, head: Y.end }, N, fn);
          }
          e.setSelections(re.ranges, re.primary),
            (t.lastMotion = null),
            (s.repeat = w),
            (s.registerName = l),
            (s.linewise = B);
          var st = Xe[a](e, s, re.ranges, C, g);
          t.visualMode && ye(e, st != null), st && e.setCursor(st);
        }
      },
      recordLastEdit: function (e, t, r) {
        var n = L.macroModeState;
        n.isPlaying ||
          ((e.lastEditInputState = t),
          (e.lastEditActionCommand = r),
          (n.lastInsertModeChanges.changes = []),
          (n.lastInsertModeChanges.expectCursorActivityForChange = !1),
          (n.lastInsertModeChanges.visualBlock = e.visualBlock
            ? e.sel.head.line - e.sel.anchor.line
            : 0));
      },
    },
    Se = {
      moveToTopLine: function (e, t, r) {
        var n = nt(e).top + r.repeat - 1;
        return new o(n, me(e.getLine(n)));
      },
      moveToMiddleLine: function (e) {
        var t = nt(e),
          r = Math.floor((t.top + t.bottom) * 0.5);
        return new o(r, me(e.getLine(r)));
      },
      moveToBottomLine: function (e, t, r) {
        var n = nt(e).bottom - r.repeat + 1;
        return new o(n, me(e.getLine(n)));
      },
      expandToLine: function (e, t, r) {
        var n = t;
        return new o(n.line + r.repeat - 1, 1 / 0);
      },
      findNext: function (e, t, r) {
        var n = he(e),
          i = n.getQuery();
        if (i) {
          var a = !r.forward;
          return (a = n.isReversed() ? !a : a), Ft(e, i), Ht(e, a, i, r.repeat);
        }
      },
      findAndSelectNextInclusive: function (e, t, r, n, i) {
        var a = he(e),
          s = a.getQuery();
        if (s) {
          var l = !r.forward;
          l = a.isReversed() ? !l : l;
          var u = Yr(e, l, s, r.repeat, n);
          if (u) {
            if (i.operator) return u;
            var d = u[0],
              v = new o(u[1].line, u[1].ch - 1);
            if (n.visualMode) {
              (n.visualLine || n.visualBlock) &&
                ((n.visualLine = !1),
                (n.visualBlock = !1),
                f.signal(e, "vim-mode-change", {
                  mode: "visual",
                  subMode: "",
                }));
              var m = n.sel.anchor;
              if (m)
                return a.isReversed()
                  ? r.forward
                    ? [m, d]
                    : [m, v]
                  : r.forward
                    ? [m, v]
                    : [m, d];
            } else
              (n.visualMode = !0),
                (n.visualLine = !1),
                (n.visualBlock = !1),
                f.signal(e, "vim-mode-change", { mode: "visual", subMode: "" });
            return l ? [v, d] : [d, v];
          }
        }
      },
      goToMark: function (e, t, r, n) {
        var i = Qe(e, n, r.selectedCharacter || "");
        return i
          ? r.linewise
            ? { line: i.line, ch: me(e.getLine(i.line)) }
            : i
          : null;
      },
      moveToOtherHighlightedEnd: function (e, t, r, n) {
        if (n.visualBlock && r.sameLine) {
          var i = n.sel;
          return [
            te(e, new o(i.anchor.line, i.head.ch)),
            te(e, new o(i.head.line, i.anchor.ch)),
          ];
        } else return [n.sel.head, n.sel.anchor];
      },
      jumpToMark: function (e, t, r, n) {
        for (var i = t, a = 0; a < r.repeat; a++) {
          var s = i;
          for (var l in n.marks)
            if (ne(l)) {
              var u = n.marks[l].find(),
                d = r.forward ? j(u, s) : j(s, u);
              if (!d && !(r.linewise && u.line == s.line)) {
                var v = ue(s, i),
                  m = r.forward ? xt(s, u, i) : xt(i, u, s);
                (v || m) && (i = u);
              }
            }
        }
        return r.linewise && (i = new o(i.line, me(e.getLine(i.line)))), i;
      },
      moveByCharacters: function (e, t, r) {
        var n = t,
          i = r.repeat,
          a = r.forward ? n.ch + i : n.ch - i;
        return new o(n.line, a);
      },
      moveByLines: function (e, t, r, n) {
        var i = t,
          a = i.ch;
        switch (n.lastMotion) {
          case this.moveByLines:
          case this.moveByDisplayLines:
          case this.moveByScroll:
          case this.moveToColumn:
          case this.moveToEol:
            a = n.lastHPos;
            break;
          default:
            n.lastHPos = a;
        }
        var s = r.repeat + (r.repeatOffset || 0),
          l = r.forward ? i.line + s : i.line - s,
          u = e.firstLine(),
          d = e.lastLine(),
          v = e.findPosV(i, r.forward ? s : -s, "line", n.lastHSPos),
          m = r.forward ? v.line > l : v.line < l;
        return (
          m && ((l = v.line), (a = v.ch)),
          l < u && i.line == u
            ? this.moveToStartOfLine(e, t, r, n)
            : l > d && i.line == d
              ? Rt(e, t, r, n, !0)
              : (r.toFirstChar && ((a = me(e.getLine(l))), (n.lastHPos = a)),
                (n.lastHSPos = e.charCoords(new o(l, a), "div").left),
                new o(l, a))
        );
      },
      moveByDisplayLines: function (e, t, r, n) {
        var i = t;
        switch (n.lastMotion) {
          case this.moveByDisplayLines:
          case this.moveByScroll:
          case this.moveByLines:
          case this.moveToColumn:
          case this.moveToEol:
            break;
          default:
            n.lastHSPos = e.charCoords(i, "div").left;
        }
        var a = r.repeat,
          s = e.findPosV(i, r.forward ? a : -a, "line", n.lastHSPos);
        if (s.hitSide)
          if (r.forward) {
            var l = e.charCoords(s, "div"),
              u = { top: l.top + 8, left: n.lastHSPos };
            s = e.coordsChar(u, "div");
          } else {
            var d = e.charCoords(new o(e.firstLine(), 0), "div");
            (d.left = n.lastHSPos), (s = e.coordsChar(d, "div"));
          }
        return (n.lastHPos = s.ch), s;
      },
      moveByPage: function (e, t, r) {
        var n = t,
          i = r.repeat;
        return e.findPosV(n, r.forward ? i : -i, "page");
      },
      moveByParagraph: function (e, t, r) {
        var n = r.forward ? 1 : -1;
        return It(e, t, r.repeat, n).start;
      },
      moveBySentence: function (e, t, r) {
        var n = r.forward ? 1 : -1;
        return Vr(e, t, r.repeat, n);
      },
      moveByScroll: function (e, t, r, n) {
        var i = e.getScrollInfo(),
          a = null,
          s = r.repeat;
        s || (s = i.clientHeight / (2 * e.defaultTextHeight()));
        var l = e.charCoords(t, "local");
        if (((r.repeat = s), (a = Se.moveByDisplayLines(e, t, r, n)), !a))
          return null;
        var u = e.charCoords(a, "local");
        return e.scrollTo(null, i.top + u.top - l.top), a;
      },
      moveByWords: function (e, t, r) {
        return _r(e, t, r.repeat, !!r.forward, !!r.wordEnd, !!r.bigWord);
      },
      moveTillCharacter: function (e, t, r) {
        var n = r.repeat,
          i = tt(e, n, r.forward, r.selectedCharacter, t),
          a = r.forward ? -1 : 1;
        return At(a, r), i ? ((i.ch += a), i) : null;
      },
      moveToCharacter: function (e, t, r) {
        var n = r.repeat;
        return At(0, r), tt(e, n, r.forward, r.selectedCharacter, t) || t;
      },
      moveToSymbol: function (e, t, r) {
        var n = r.repeat;
        return (
          (r.selectedCharacter && Dr(e, n, r.forward, r.selectedCharacter)) || t
        );
      },
      moveToColumn: function (e, t, r, n) {
        var i = r.repeat;
        return (
          (n.lastHPos = i - 1),
          (n.lastHSPos = e.charCoords(t, "div").left),
          Fr(e, i)
        );
      },
      moveToEol: function (e, t, r, n) {
        return Rt(e, t, r, n, !1);
      },
      moveToFirstNonWhiteSpaceCharacter: function (e, t) {
        var r = t;
        return new o(r.line, me(e.getLine(r.line)));
      },
      moveToMatchedSymbol: function (e, t) {
        for (
          var r = t, n = r.line, i = r.ch, a = e.getLine(n), s;
          i < a.length;
          i++
        )
          if (((s = a.charAt(i)), s && Ee(s))) {
            var l = e.getTokenTypeAt(new o(n, i + 1));
            if (l !== "string" && l !== "comment") break;
          }
        if (i < a.length) {
          var u = s === "<" || s === ">" ? /[(){}[\]<>]/ : /[(){}[\]]/,
            d = e.findMatchingBracket(new o(n, i), { bracketRegex: u });
          return d.to;
        } else return r;
      },
      moveToStartOfLine: function (e, t) {
        return new o(t.line, 0);
      },
      moveToLineOrEdgeOfDocument: function (e, t, r) {
        var n = r.forward ? e.lastLine() : e.firstLine();
        return (
          r.repeatIsExplicit && (n = r.repeat - e.getOption("firstLineNumber")),
          new o(n, me(e.getLine(n)))
        );
      },
      moveToStartOfDisplayLine: function (e) {
        return e.execCommand("goLineLeft"), e.getCursor();
      },
      moveToEndOfDisplayLine: function (e) {
        e.execCommand("goLineRight");
        var t = e.getCursor();
        return t.sticky == "before" && t.ch--, t;
      },
      textObjectManipulation: function (e, t, r, n) {
        var i = {
            "(": ")",
            ")": "(",
            "{": "}",
            "}": "{",
            "[": "]",
            "]": "[",
            "<": ">",
            ">": "<",
          },
          a = { "'": !0, '"': !0, "`": !0 },
          s = r.selectedCharacter || "";
        s == "b" ? (s = "(") : s == "B" && (s = "{");
        var l = !r.textObjectInner,
          u,
          d;
        if (i[s]) {
          if (((d = !0), (u = Nt(e, t, s, l)), !u)) {
            var v = e.getSearchCursor(new RegExp("\\" + s, "g"), t);
            v.find() && (u = Nt(e, v.from(), s, l));
          }
        } else if (a[s]) (d = !0), (u = Wr(e, t, s, l));
        else if (s === "W" || s === "w")
          for (var m = r.repeat || 1; m-- > 0; ) {
            var C = et(
              e,
              {
                inclusive: l,
                innerWord: !l,
                bigWord: s === "W",
                noSymbol: s === "W",
                multiline: !0,
              },
              u && u.end,
            );
            C && (u || (u = C), (u.end = C.end));
          }
        else if (s === "p")
          if (((u = It(e, t, r.repeat, 0, l)), (r.linewise = !0), n.visualMode))
            n.visualLine || (n.visualLine = !0);
          else {
            var g = n.inputState.operatorArgs;
            g && (g.linewise = !0), u.end.line--;
          }
        else if (s === "t") u = Kr(e, t, l);
        else if (s === "s") {
          var p = e.getLine(t.line);
          t.ch > 0 && pe(p[t.ch]) && (t.ch -= 1);
          var w = Bt(e, t, r.repeat, 1, l),
            S = Bt(e, t, r.repeat, -1, l);
          $(e.getLine(S.line)[S.ch]) &&
            $(e.getLine(w.line)[w.ch - 1]) &&
            (S = { line: S.line, ch: S.ch + 1 }),
            (u = { start: S, end: w });
        }
        return u
          ? e.state.vim.visualMode
            ? Rr(e, u.start, u.end, d)
            : [u.start, u.end]
          : null;
      },
      repeatLastCharacterSearch: function (e, t, r) {
        var n = L.lastCharacterSearch,
          i = r.repeat,
          a = r.forward === n.forward,
          s = (n.increment ? 1 : 0) * (a ? -1 : 1);
        e.moveH(-s, "char"), (r.inclusive = !!a);
        var l = tt(e, i, a, n.selectedCharacter);
        return l ? ((l.ch += s), l) : (e.moveH(s, "char"), t);
      },
    };
  function wr(e, t) {
    Se[e] = t;
  }
  function wt(e, t) {
    for (var r = [], n = 0; n < t; n++) r.push(e);
    return r;
  }
  var Xe = {
    change: function (e, t, r) {
      var n,
        i,
        a = e.state.vim,
        s = r[0].anchor,
        l = r[0].head;
      if (a.visualMode)
        if (t.fullLine)
          (l.ch = Number.MAX_VALUE),
            l.line--,
            e.setSelection(s, l),
            (i = e.getSelection()),
            e.replaceSelection(""),
            (n = s);
        else {
          i = e.getSelection();
          var v = wt("", r.length);
          e.replaceSelections(v), (n = ie(r[0].head, r[0].anchor));
        }
      else {
        i = e.getRange(s, l);
        var u = a.lastEditInputState;
        if (u?.motion == "moveByWords" && !$(i)) {
          var d = /\s+$/.exec(i);
          d &&
            u.motionArgs &&
            u.motionArgs.forward &&
            ((l = J(l, 0, -d[0].length)), (i = i.slice(0, -d[0].length)));
        }
        t.linewise &&
          ((s = new o(s.line, me(e.getLine(s.line)))),
          l.line > s.line && (l = new o(l.line - 1, Number.MAX_VALUE))),
          e.replaceRange("", s, l),
          (n = s);
      }
      L.registerController.pushText(
        t.registerName,
        "change",
        i,
        t.linewise,
        r.length > 1,
      ),
        Ke.enterInsertMode(e, { head: n }, e.state.vim);
    },
    delete: function (e, t, r) {
      var n,
        i,
        a = e.state.vim;
      if (a.visualBlock) {
        i = e.getSelection();
        var u = wt("", r.length);
        e.replaceSelections(u), (n = ie(r[0].head, r[0].anchor));
      } else {
        var s = r[0].anchor,
          l = r[0].head;
        t.linewise &&
          l.line != e.firstLine() &&
          s.line == e.lastLine() &&
          s.line == l.line - 1 &&
          (s.line == e.firstLine()
            ? (s.ch = 0)
            : (s = new o(s.line - 1, X(e, s.line - 1)))),
          (i = e.getRange(s, l)),
          e.replaceRange("", s, l),
          (n = s),
          t.linewise && (n = Se.moveToFirstNonWhiteSpaceCharacter(e, s));
      }
      return (
        L.registerController.pushText(
          t.registerName,
          "delete",
          i,
          t.linewise,
          a.visualBlock,
        ),
        te(e, n)
      );
    },
    indent: function (e, t, r) {
      var n = e.state.vim,
        i = n.visualMode ? t.repeat || 0 : 1;
      if (e.indentMore)
        for (var a = 0; a < i; a++)
          t.indentRight ? e.indentMore() : e.indentLess();
      else {
        var s = r[0].anchor.line,
          l = n.visualBlock ? r[r.length - 1].anchor.line : r[0].head.line;
        t.linewise && l--;
        for (var u = s; u <= l; u++)
          for (var a = 0; a < i; a++) e.indentLine(u, t.indentRight);
      }
      return Se.moveToFirstNonWhiteSpaceCharacter(e, r[0].anchor);
    },
    indentAuto: function (e, t, r) {
      return (
        e.execCommand("indentAuto"),
        Se.moveToFirstNonWhiteSpaceCharacter(e, r[0].anchor)
      );
    },
    hardWrap: function (e, t, r, n) {
      if (e.hardWrap) {
        var i = r[0].anchor.line,
          a = r[0].head.line;
        t.linewise && a--;
        var s = e.hardWrap({ from: i, to: a });
        return s > i && t.linewise && s--, t.keepCursor ? n : new o(s, 0);
      }
    },
    changeCase: function (e, t, r, n, i) {
      for (
        var a = e.getSelections(), s = [], l = t.toLower, u = 0;
        u < a.length;
        u++
      ) {
        var d = a[u],
          v = "";
        if (l === !0) v = d.toLowerCase();
        else if (l === !1) v = d.toUpperCase();
        else
          for (var m = 0; m < d.length; m++) {
            var C = d.charAt(m);
            v += se(C) ? C.toLowerCase() : C.toUpperCase();
          }
        s.push(v);
      }
      return (
        e.replaceSelections(s),
        t.shouldMoveCursor
          ? i
          : !e.state.vim.visualMode &&
              t.linewise &&
              r[0].anchor.line + 1 == r[0].head.line
            ? Se.moveToFirstNonWhiteSpaceCharacter(e, n)
            : t.linewise
              ? n
              : ie(r[0].anchor, r[0].head)
      );
    },
    yank: function (e, t, r, n) {
      var i = e.state.vim,
        a = e.getSelection(),
        s = i.visualMode
          ? ie(i.sel.anchor, i.sel.head, r[0].head, r[0].anchor)
          : n;
      return (
        L.registerController.pushText(
          t.registerName,
          "yank",
          a,
          t.linewise,
          i.visualBlock,
        ),
        s
      );
    },
  };
  function Sr(e, t) {
    Xe[e] = t;
  }
  var Ke = {
    jumpListWalk: function (e, t, r) {
      if (!r.visualMode) {
        var n = t.repeat || 1,
          i = t.forward,
          a = L.jumpList,
          s = a.move(e, i ? n : -n),
          l = s ? s.find() : void 0;
        (l = l || e.getCursor()), e.setCursor(l);
      }
    },
    scroll: function (e, t, r) {
      if (!r.visualMode) {
        var n = t.repeat || 1,
          i = e.defaultTextHeight(),
          a = e.getScrollInfo().top,
          s = i * n,
          l = t.forward ? a + s : a - s,
          u = H(e.getCursor()),
          d = e.charCoords(u, "local");
        if (t.forward)
          l > d.top
            ? ((u.line += (l - d.top) / i),
              (u.line = Math.ceil(u.line)),
              e.setCursor(u),
              (d = e.charCoords(u, "local")),
              e.scrollTo(null, d.top))
            : e.scrollTo(null, l);
        else {
          var v = l + e.getScrollInfo().clientHeight;
          v < d.bottom
            ? ((u.line -= (d.bottom - v) / i),
              (u.line = Math.floor(u.line)),
              e.setCursor(u),
              (d = e.charCoords(u, "local")),
              e.scrollTo(null, d.bottom - e.getScrollInfo().clientHeight))
            : e.scrollTo(null, l);
        }
      }
    },
    scrollToCursor: function (e, t) {
      var r = e.getCursor().line,
        n = e.charCoords(new o(r, 0), "local"),
        i = e.getScrollInfo().clientHeight,
        a = n.top;
      switch (t.position) {
        case "center":
          a = n.bottom - i / 2;
          break;
        case "bottom":
          var s = new o(r, e.getLine(r).length - 1),
            l = e.charCoords(s, "local"),
            u = l.bottom - a;
          a = a - i + u;
          break;
      }
      e.scrollTo(null, a);
    },
    replayMacro: function (e, t, r) {
      var n = t.selectedCharacter || "",
        i = t.repeat || 1,
        a = L.macroModeState;
      for (n == "@" ? (n = a.latestRegister) : (a.latestRegister = n); i--; )
        an(e, r, a, n);
    },
    enterMacroRecordMode: function (e, t) {
      var r = L.macroModeState,
        n = t.selectedCharacter;
      L.registerController.isValidRegister(n) && r.enterMacroRecordMode(e, n);
    },
    toggleOverwrite: function (e) {
      e.state.overwrite
        ? (e.toggleOverwrite(!1),
          e.setOption("keyMap", "vim-insert"),
          f.signal(e, "vim-mode-change", { mode: "insert" }))
        : (e.toggleOverwrite(!0),
          e.setOption("keyMap", "vim-replace"),
          f.signal(e, "vim-mode-change", { mode: "replace" }));
    },
    enterInsertMode: function (e, t, r) {
      if (!e.getOption("readOnly")) {
        (r.insertMode = !0), (r.insertModeRepeat = (t && t.repeat) || 1);
        var n = t ? t.insertAt : null,
          i = r.sel,
          a = t.head || e.getCursor("head"),
          s = e.listSelections().length;
        if (n == "eol") a = new o(a.line, X(e, a.line));
        else if (n == "bol") a = new o(a.line, 0);
        else if (n == "charAfter") {
          var l = c(e, a, J(a, 0, 1));
          a = l.end;
        } else if (n == "firstNonBlank") {
          var l = c(e, a, Se.moveToFirstNonWhiteSpaceCharacter(e, a));
          a = l.end;
        } else if (n == "startOfSelectedArea") {
          if (!r.visualMode) return;
          r.visualBlock
            ? ((a = new o(
                Math.min(i.head.line, i.anchor.line),
                Math.min(i.head.ch, i.anchor.ch),
              )),
              (s = Math.abs(i.head.line - i.anchor.line) + 1))
            : i.head.line < i.anchor.line
              ? (a = i.head)
              : (a = new o(i.anchor.line, 0));
        } else if (n == "endOfSelectedArea") {
          if (!r.visualMode) return;
          r.visualBlock
            ? ((a = new o(
                Math.min(i.head.line, i.anchor.line),
                Math.max(i.head.ch, i.anchor.ch) + 1,
              )),
              (s = Math.abs(i.head.line - i.anchor.line) + 1))
            : i.head.line >= i.anchor.line
              ? (a = J(i.head, 0, 1))
              : (a = new o(i.anchor.line, 0));
        } else if (n == "inplace") {
          if (r.visualMode) return;
        } else n == "lastEdit" && (a = Vt(e) || a);
        e.setOption("disableInput", !1),
          t && t.replace
            ? (e.toggleOverwrite(!0),
              e.setOption("keyMap", "vim-replace"),
              f.signal(e, "vim-mode-change", { mode: "replace" }))
            : (e.toggleOverwrite(!1),
              e.setOption("keyMap", "vim-insert"),
              f.signal(e, "vim-mode-change", { mode: "insert" })),
          L.macroModeState.isPlaying ||
            (e.on("change", jt),
            r.insertEnd && r.insertEnd.clear(),
            (r.insertEnd = e.setBookmark(a, { insertLeft: !0 })),
            f.on(e.getInputField(), "keydown", Jt)),
          r.visualMode && ye(e),
          Lt(e, a, s);
      }
    },
    toggleVisualMode: function (e, t, r) {
      var n = t.repeat,
        i = e.getCursor(),
        a;
      if (r.visualMode)
        r.visualLine != !!t.linewise || r.visualBlock != !!t.blockwise
          ? ((r.visualLine = !!t.linewise),
            (r.visualBlock = !!t.blockwise),
            f.signal(e, "vim-mode-change", {
              mode: "visual",
              subMode: r.visualLine
                ? "linewise"
                : r.visualBlock
                  ? "blockwise"
                  : "",
            }),
            Pe(e))
          : ye(e);
      else {
        (r.visualMode = !0),
          (r.visualLine = !!t.linewise),
          (r.visualBlock = !!t.blockwise),
          (a = te(e, new o(i.line, i.ch + n - 1)));
        var s = c(e, i, a);
        (r.sel = { anchor: s.start, head: s.end }),
          f.signal(e, "vim-mode-change", {
            mode: "visual",
            subMode: r.visualLine
              ? "linewise"
              : r.visualBlock
                ? "blockwise"
                : "",
          }),
          Pe(e),
          xe(e, r, "<", ie(i, a)),
          xe(e, r, ">", Le(i, a));
      }
    },
    reselectLastSelection: function (e, t, r) {
      var n = r.lastSelection;
      if ((r.visualMode && bt(e, r), n)) {
        var i = n.anchorMark.find(),
          a = n.headMark.find();
        if (!i || !a) return;
        (r.sel = { anchor: i, head: a }),
          (r.visualMode = !0),
          (r.visualLine = n.visualLine),
          (r.visualBlock = n.visualBlock),
          Pe(e),
          xe(e, r, "<", ie(i, a)),
          xe(e, r, ">", Le(i, a)),
          f.signal(e, "vim-mode-change", {
            mode: "visual",
            subMode: r.visualLine
              ? "linewise"
              : r.visualBlock
                ? "blockwise"
                : "",
          });
      }
    },
    joinLines: function (e, t, r) {
      var n, i;
      if (r.visualMode) {
        if (((n = e.getCursor("anchor")), (i = e.getCursor("head")), j(i, n))) {
          var a = i;
          (i = n), (n = a);
        }
        i.ch = X(e, i.line) - 1;
      } else {
        var s = Math.max(t.repeat, 2);
        (n = e.getCursor()), (i = te(e, new o(n.line + s - 1, 1 / 0)));
      }
      for (var l = 0, u = n.line; u < i.line; u++) {
        l = X(e, n.line);
        var d = "",
          v = 0;
        if (!t.keepSpaces) {
          var m = e.getLine(n.line + 1);
          (v = m.search(/\S/)), v == -1 ? (v = m.length) : (d = " ");
        }
        e.replaceRange(d, new o(n.line, l), new o(n.line + 1, v));
      }
      var C = te(e, new o(n.line, l));
      r.visualMode && ye(e, !1), e.setCursor(C);
    },
    newLineAndEnterInsertMode: function (e, t, r) {
      r.insertMode = !0;
      var n = H(e.getCursor());
      if (n.line === e.firstLine() && !t.after)
        e.replaceRange(
          `
`,
          new o(e.firstLine(), 0),
        ),
          e.setCursor(e.firstLine(), 0);
      else {
        (n.line = t.after ? n.line : n.line - 1),
          (n.ch = X(e, n.line)),
          e.setCursor(n);
        var i =
          f.commands.newlineAndIndentContinueComment ||
          f.commands.newlineAndIndent;
        i(e);
      }
      this.enterInsertMode(e, { repeat: t.repeat }, r);
    },
    paste: function (e, t, r) {
      var n = L.registerController.getRegister(t.registerName);
      if (t.registerName === "+")
        navigator.clipboard.readText().then((a) => {
          this.continuePaste(e, t, r, a, n);
        });
      else {
        var i = n.toString();
        this.continuePaste(e, t, r, i, n);
      }
    },
    continuePaste: function (e, t, r, n, i) {
      var a = H(e.getCursor());
      if (n) {
        if (t.matchIndent) {
          var s = e.getOption("tabSize"),
            l = function (Y) {
              var q = Y.split("	").length - 1,
                Ce = Y.split(" ").length - 1;
              return q * s + Ce * 1;
            },
            u = e.getLine(e.getCursor().line),
            d = l(u.match(/^\s*/)[0]),
            v = n.replace(/\n$/, ""),
            m = n !== v,
            C = l(n.match(/^\s*/)[0]),
            n = v.replace(/^\s*/gm, function (Y) {
              var q = d + (l(Y) - C);
              if (q < 0) return "";
              if (e.getOption("indentWithTabs")) {
                var Ce = Math.floor(q / s);
                return Array(Ce + 1).join("	");
              } else return Array(q + 1).join(" ");
            });
          n += m
            ? `
`
            : "";
        }
        if (t.repeat > 1) var n = Array(t.repeat + 1).join(n);
        var g = i.linewise,
          p = i.blockwise;
        if (p) {
          (n = n.split(`
`)),
            g && n.pop();
          for (var w = 0; w < n.length; w++) n[w] = n[w] == "" ? " " : n[w];
          (a.ch += t.after ? 1 : 0), (a.ch = Math.min(X(e, a.line), a.ch));
        } else
          g
            ? r.visualMode
              ? (n = r.visualLine
                  ? n.slice(0, -1)
                  : `
` +
                    n.slice(0, n.length - 1) +
                    `
`)
              : t.after
                ? ((n =
                    `
` + n.slice(0, n.length - 1)),
                  (a.ch = X(e, a.line)))
                : (a.ch = 0)
            : (a.ch += t.after ? 1 : 0);
        var S;
        if (r.visualMode) {
          r.lastPastedText = n;
          var A,
            T = Er(e, r),
            O = T[0],
            _ = T[1],
            ee = e.getSelection(),
            z = e.listSelections(),
            Z = new Array(z.length).join("1").split("1");
          r.lastSelection && (A = r.lastSelection.headMark.find()),
            L.registerController.unnamedRegister.setText(ee),
            p
              ? (e.replaceSelections(Z),
                (_ = new o(O.line + n.length - 1, O.ch)),
                e.setCursor(O),
                Mt(e, _),
                e.replaceSelections(n),
                (S = O))
              : r.visualBlock
                ? (e.replaceSelections(Z),
                  e.setCursor(O),
                  e.replaceRange(n, O, O),
                  (S = O))
                : (e.replaceRange(n, O, _),
                  (S = e.posFromIndex(e.indexFromPos(O) + n.length - 1))),
            A && (r.lastSelection.headMark = e.setBookmark(A)),
            g && (S.ch = 0);
        } else if (p) {
          e.setCursor(a);
          for (var w = 0; w < n.length; w++) {
            var B = a.line + w;
            B > e.lastLine() &&
              e.replaceRange(
                `
`,
                new o(B, 0),
              );
            var N = X(e, B);
            N < a.ch && Ar(e, B, a.ch);
          }
          e.setCursor(a),
            Mt(e, new o(a.line + n.length - 1, a.ch)),
            e.replaceSelections(n),
            (S = a);
        } else if ((e.replaceRange(n, a), g)) {
          var B = t.after ? a.line + 1 : a.line;
          S = new o(B, me(e.getLine(B)));
        } else
          (S = H(a)), /\n/.test(n) || (S.ch += n.length - (t.after ? 1 : 0));
        r.visualMode && ye(e, !1), e.setCursor(S);
      }
    },
    undo: function (e, t) {
      e.operation(function () {
        St(e, f.commands.undo, t.repeat)(),
          e.setCursor(te(e, e.getCursor("start")));
      });
    },
    redo: function (e, t) {
      St(e, f.commands.redo, t.repeat)();
    },
    setRegister: function (e, t, r) {
      r.inputState.registerName = t.selectedCharacter;
    },
    insertRegister: function (e, t, r) {
      var n = t.selectedCharacter,
        i = L.registerController.getRegister(n),
        a = i && i.toString();
      a && e.replaceSelection(a);
    },
    oneNormalCommand: function (e, t, r) {
      Te(e, !0),
        (r.insertModeReturn = !0),
        f.on(e, "vim-command-done", function n() {
          r.visualMode ||
            (r.insertModeReturn &&
              ((r.insertModeReturn = !1),
              r.insertMode || Ke.enterInsertMode(e, {}, r)),
            f.off(e, "vim-command-done", n));
        });
    },
    setMark: function (e, t, r) {
      var n = t.selectedCharacter;
      n && xe(e, r, n, e.getCursor());
    },
    replace: function (e, t, r) {
      var n = t.selectedCharacter || "",
        i = e.getCursor(),
        a,
        s,
        l = e.listSelections();
      if (r.visualMode) (i = e.getCursor("start")), (s = e.getCursor("end"));
      else {
        var u = e.getLine(i.line);
        (a = i.ch + t.repeat),
          a > u.length && (a = u.length),
          (s = new o(i.line, a));
      }
      var d = c(e, i, s);
      if (
        ((i = d.start),
        (s = d.end),
        n ==
          `
`)
      )
        r.visualMode || e.replaceRange("", i, s),
          (
            f.commands.newlineAndIndentContinueComment ||
            f.commands.newlineAndIndent
          )(e);
      else {
        var v = e.getRange(i, s);
        if (
          ((v = v.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, n)),
          (v = v.replace(/[^\n]/g, n)),
          r.visualBlock)
        ) {
          var m = new Array(e.getOption("tabSize") + 1).join(" ");
          (v = e.getSelection()),
            (v = v.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, n));
          var C = v.replace(/\t/g, m).replace(/[^\n]/g, n).split(`
`);
          e.replaceSelections(C);
        } else e.replaceRange(v, i, s);
        r.visualMode
          ? ((i = j(l[0].anchor, l[0].head) ? l[0].anchor : l[0].head),
            e.setCursor(i),
            ye(e, !1))
          : e.setCursor(J(s, 0, -1));
      }
    },
    incrementNumberToken: function (e, t) {
      for (
        var r = e.getCursor(),
          n = e.getLine(r.line),
          i = /(-?)(?:(0x)([\da-f]+)|(0b|0|)(\d+))/gi,
          a,
          s,
          l,
          u;
        (a = i.exec(n)) !== null &&
        ((s = a.index), (l = s + a[0].length), !(r.ch < l));

      );
      if (!(!t.backtrack && l <= r.ch)) {
        if (a) {
          var d = a[2] || a[4],
            v = a[3] || a[5],
            m = t.increase ? 1 : -1,
            C = { "0b": 2, 0: 8, "": 10, "0x": 16 }[d.toLowerCase()],
            g = parseInt(a[1] + v, C) + m * t.repeat;
          u = g.toString(C);
          var p = d
            ? new Array(v.length - u.length + 1 + a[1].length).join("0")
            : "";
          u.charAt(0) === "-"
            ? (u = "-" + d + p + u.substr(1))
            : (u = d + p + u);
          var w = new o(r.line, s),
            S = new o(r.line, l);
          e.replaceRange(u, w, S);
        } else return;
        e.setCursor(new o(r.line, s + u.length - 1));
      }
    },
    repeatLastEdit: function (e, t, r) {
      var n = r.lastEditInputState;
      if (n) {
        var i = t.repeat;
        i && t.repeatIsExplicit
          ? (n.repeatOverride = i)
          : (i = n.repeatOverride || i),
          zt(e, r, i, !1);
      }
    },
    indent: function (e, t) {
      e.indentLine(e.getCursor().line, t.indentRight);
    },
    exitInsertMode: function (e, t) {
      Te(e);
    },
  };
  function xr(e, t) {
    Ke[e] = t;
  }
  function te(e, t, r) {
    var n = e.state.vim,
      i = n.insertMode || n.visualMode,
      a = Math.min(Math.max(e.firstLine(), t.line), e.lastLine()),
      s = e.getLine(a),
      l = s.length - 1 + +!!i,
      u = Math.min(Math.max(0, t.ch), l),
      d = s.charCodeAt(u);
    if (56320 <= d && d <= 57343) {
      var v = 1;
      r && r.line == a && r.ch > u && (v = -1), (u += v), u > l && (u -= 2);
    }
    return new o(a, u);
  }
  function Ue(e) {
    var t = {};
    for (var r in e) e.hasOwnProperty(r) && (t[r] = e[r]);
    return t;
  }
  function J(e, t, r) {
    return (
      typeof t == "object" && ((r = t.ch), (t = t.line)),
      new o(e.line + t, e.ch + r)
    );
  }
  function Mr(e, t, r, n) {
    n.operator && (r = "operatorPending");
    for (
      var i, a = [], s = [], l = _e ? t.length - y : 0, u = l;
      u < t.length;
      u++
    ) {
      var d = t[u];
      (r == "insert" && d.context != "insert") ||
        (d.context && d.context != r) ||
        (n.operator && d.type == "action") ||
        !(i = Lr(e, d.keys)) ||
        (i == "partial" && a.push(d), i == "full" && s.push(d));
    }
    return { partial: a.length && a, full: s.length && s };
  }
  function Lr(e, t) {
    let r = t.slice(-11) == "<character>",
      n = t.slice(-10) == "<register>";
    if (r || n) {
      var i = t.length - (r ? 11 : 10),
        a = e.slice(0, i),
        s = t.slice(0, i);
      return a == s && e.length > i
        ? "full"
        : s.indexOf(a) == 0
          ? "partial"
          : !1;
    } else return e == t ? "full" : t.indexOf(e) == 0 ? "partial" : !1;
  }
  function br(e) {
    var t = /^.*(<[^>]+>)$/.exec(e),
      r = t ? t[1] : e.slice(-1);
    if (r.length > 1)
      switch (r) {
        case "<CR>":
        case "<S-CR>":
          r = `
`;
          break;
        case "<Space>":
        case "<S-Space>":
          r = " ";
          break;
        default:
          r = "";
          break;
      }
    return r;
  }
  function St(e, t, r) {
    return function () {
      for (var n = 0; n < r; n++) t(e);
    };
  }
  function H(e) {
    return new o(e.line, e.ch);
  }
  function ue(e, t) {
    return e.ch == t.ch && e.line == t.line;
  }
  function j(e, t) {
    return e.line < t.line || (e.line == t.line && e.ch < t.ch);
  }
  function ie(e, t) {
    return (
      arguments.length > 2 &&
        (t = ie.apply(void 0, Array.prototype.slice.call(arguments, 1))),
      j(e, t) ? e : t
    );
  }
  function Le(e, t) {
    return (
      arguments.length > 2 &&
        (t = Le.apply(void 0, Array.prototype.slice.call(arguments, 1))),
      j(e, t) ? t : e
    );
  }
  function xt(e, t, r) {
    var n = j(e, t),
      i = j(t, r);
    return n && i;
  }
  function X(e, t) {
    return e.getLine(t).length;
  }
  function Ze(e) {
    return e.trim ? e.trim() : e.replace(/^\s+|\s+$/g, "");
  }
  function Tr(e) {
    return e.replace(/([.?*+$\[\]\/\\(){}|\-])/g, "\\$1");
  }
  function Ar(e, t, r) {
    var n = X(e, t),
      i = new Array(r - n + 1).join(" ");
    e.setCursor(new o(t, n)), e.replaceRange(i, e.getCursor());
  }
  function Mt(e, t) {
    var r = [],
      n = e.listSelections(),
      i = H(e.clipPos(t)),
      a = !ue(t, i),
      s = e.getCursor("head"),
      l = Or(n, s),
      u = ue(n[l].head, n[l].anchor),
      d = n.length - 1,
      v = d - l > l ? d : 0,
      m = n[v].anchor,
      C = Math.min(m.line, i.line),
      g = Math.max(m.line, i.line),
      p = m.ch,
      w = i.ch,
      S = n[v].head.ch - p,
      A = w - p;
    S > 0 && A <= 0
      ? (p++, a || w--)
      : S < 0 && A >= 0
        ? (p--, u || w++)
        : S < 0 && A == -1 && (p--, w++);
    for (var T = C; T <= g; T++) {
      var O = { anchor: new o(T, p), head: new o(T, w) };
      r.push(O);
    }
    return e.setSelections(r), (t.ch = w), (m.ch = p), m;
  }
  function Lt(e, t, r) {
    for (var n = [], i = 0; i < r; i++) {
      var a = J(t, i, 0);
      n.push({ anchor: a, head: a });
    }
    e.setSelections(n, 0);
  }
  function Or(e, t, r) {
    for (var n = 0; n < e.length; n++) {
      var i = r != "head" && ue(e[n].anchor, t),
        a = r != "anchor" && ue(e[n].head, t);
      if (i || a) return n;
    }
    return -1;
  }
  function Er(e, t) {
    var r = t.lastSelection,
      n = function () {
        var a = e.listSelections(),
          s = a[0],
          l = a[a.length - 1],
          u = j(s.anchor, s.head) ? s.anchor : s.head,
          d = j(l.anchor, l.head) ? l.head : l.anchor;
        return [u, d];
      },
      i = function () {
        var a = e.getCursor(),
          s = e.getCursor(),
          l = r.visualBlock;
        if (l) {
          var u = l.width,
            d = l.height;
          s = new o(a.line + d, a.ch + u);
          for (var v = [], m = a.line; m < s.line; m++) {
            var C = new o(m, a.ch),
              g = new o(m, s.ch),
              p = { anchor: C, head: g };
            v.push(p);
          }
          e.setSelections(v);
        } else {
          var w = r.anchorMark.find(),
            S = r.headMark.find(),
            A = S.line - w.line,
            T = S.ch - w.ch;
          (s = { line: s.line + A, ch: A ? s.ch : T + s.ch }),
            r.visualLine &&
              ((a = new o(a.line, 0)), (s = new o(s.line, X(e, s.line)))),
            e.setSelection(a, s);
        }
        return [a, s];
      };
    return t.visualMode ? n() : i();
  }
  function bt(e, t) {
    var r = t.sel.anchor,
      n = t.sel.head;
    t.lastPastedText &&
      ((n = e.posFromIndex(e.indexFromPos(r) + t.lastPastedText.length)),
      (t.lastPastedText = null)),
      (t.lastSelection = {
        anchorMark: e.setBookmark(r),
        headMark: e.setBookmark(n),
        anchor: H(r),
        head: H(n),
        visualMode: t.visualMode,
        visualLine: t.visualLine,
        visualBlock: t.visualBlock,
      });
  }
  function Rr(e, t, r, n) {
    var i = e.state.vim.sel,
      a = n ? t : i.head,
      s = n ? t : i.anchor,
      l;
    return (
      j(r, t) && ((l = r), (r = t), (t = l)),
      j(a, s)
        ? ((a = ie(t, a)), (s = Le(s, r)))
        : ((s = ie(t, s)),
          (a = Le(a, r)),
          (a = J(a, 0, -1)),
          a.ch == -1 &&
            a.line != e.firstLine() &&
            (a = new o(a.line - 1, X(e, a.line - 1)))),
      [s, a]
    );
  }
  function Pe(e, t, r) {
    var n = e.state.vim;
    (t = t || n.sel),
      r || (r = n.visualLine ? "line" : n.visualBlock ? "block" : "char");
    var i = Ye(e, t, r);
    e.setSelections(i.ranges, i.primary);
  }
  function Ye(e, t, r, n) {
    var i = H(t.head),
      a = H(t.anchor);
    if (r == "char") {
      var s = !n && !j(t.head, t.anchor) ? 1 : 0,
        l = j(t.head, t.anchor) ? 1 : 0;
      return (
        (i = J(t.head, 0, s)),
        (a = J(t.anchor, 0, l)),
        { ranges: [{ anchor: a, head: i }], primary: 0 }
      );
    } else if (r == "line") {
      if (j(t.head, t.anchor)) (i.ch = 0), (a.ch = X(e, a.line));
      else {
        a.ch = 0;
        var u = e.lastLine();
        i.line > u && (i.line = u), (i.ch = X(e, i.line));
      }
      return { ranges: [{ anchor: a, head: i }], primary: 0 };
    } else if (r == "block") {
      var d = Math.min(a.line, i.line),
        v = a.ch,
        m = Math.max(a.line, i.line),
        C = i.ch;
      v < C ? (C += 1) : (v += 1);
      for (
        var g = m - d + 1, p = i.line == d ? 0 : g - 1, w = [], S = 0;
        S < g;
        S++
      )
        w.push({ anchor: new o(d + S, v), head: new o(d + S, C) });
      return { ranges: w, primary: p };
    }
    throw "never happens";
  }
  function Ir(e) {
    var t = e.getCursor("head");
    return (
      e.getSelection().length == 1 && (t = ie(t, e.getCursor("anchor"))), t
    );
  }
  function ye(e, t) {
    var r = e.state.vim;
    t !== !1 && e.setCursor(te(e, r.sel.head)),
      bt(e, r),
      (r.visualMode = !1),
      (r.visualLine = !1),
      (r.visualBlock = !1),
      r.insertMode || f.signal(e, "vim-mode-change", { mode: "normal" });
  }
  function Br(e, t, r) {
    var n = e.getRange(t, r);
    if (/\n\s*$/.test(n)) {
      var i = n.split(`
`);
      i.pop();
      for (var a = i.pop(); i.length > 0 && a && $(a); a = i.pop())
        r.line--, (r.ch = 0);
      a ? (r.line--, (r.ch = X(e, r.line))) : (r.ch = 0);
    }
  }
  function Nr(e, t, r) {
    (t.ch = 0), (r.ch = 0), r.line++;
  }
  function me(e) {
    if (!e) return 0;
    var t = e.search(/\S/);
    return t == -1 ? e.length : t;
  }
  function et(
    e,
    { inclusive: t, innerWord: r, bigWord: n, noSymbol: i, multiline: a },
    s,
  ) {
    var l = s || Ir(e),
      u = e.getLine(l.line),
      d = u,
      v = l.line,
      m = v,
      C = l.ch,
      g,
      p = i ? I[0] : E[0];
    if (r && /\s/.test(u.charAt(C)))
      p = function (_) {
        return /\s/.test(_);
      };
    else {
      for (; !p(u.charAt(C)); )
        if ((C++, C >= u.length)) {
          if (!a) return null;
          C--, (g = Et(e, l, !0, n, !0));
          break;
        }
      n ? (p = E[0]) : ((p = I[0]), p(u.charAt(C)) || (p = I[1]));
    }
    for (var w = C, S = C; p(u.charAt(S)) && S >= 0; ) S--;
    if ((S++, g))
      (w = g.to), (m = g.line), (d = e.getLine(m)), !d && w == 0 && w++;
    else for (; p(u.charAt(w)) && w < u.length; ) w++;
    if (t) {
      var A = w,
        T = l.ch <= S && /\s/.test(u.charAt(l.ch));
      if (!T) for (; /\s/.test(d.charAt(w)) && w < d.length; ) w++;
      if (A == w || T) {
        for (var O = S; /\s/.test(u.charAt(S - 1)) && S > 0; ) S--;
        !S && !T && (S = O);
      }
    }
    return { start: new o(v, S), end: new o(m, w) };
  }
  function Kr(e, t, r) {
    var n = t;
    if (!f.findMatchingTag || !f.findEnclosingTag) return { start: n, end: n };
    var i = f.findMatchingTag(e, t) || f.findEnclosingTag(e, t);
    return !i || !i.open || !i.close
      ? { start: n, end: n }
      : r
        ? { start: i.open.from, end: i.close.to }
        : { start: i.open.to, end: i.close.from };
  }
  function Tt(e, t, r) {
    ue(t, r) || L.jumpList.add(e, t, r);
  }
  function At(e, t) {
    (L.lastCharacterSearch.increment = e),
      (L.lastCharacterSearch.forward = t.forward),
      (L.lastCharacterSearch.selectedCharacter = t.selectedCharacter);
  }
  var Pr = {
      "(": "bracket",
      ")": "bracket",
      "{": "bracket",
      "}": "bracket",
      "[": "section",
      "]": "section",
      "*": "comment",
      "/": "comment",
      m: "method",
      M: "method",
      "#": "preprocess",
    },
    Ot = {
      bracket: {
        isComplete: function (e) {
          if (e.nextCh === e.symb) {
            if ((e.depth++, e.depth >= 1)) return !0;
          } else e.nextCh === e.reverseSymb && e.depth--;
          return !1;
        },
      },
      section: {
        init: function (e) {
          (e.curMoveThrough = !0),
            (e.symb = (e.forward ? "]" : "[") === e.symb ? "{" : "}");
        },
        isComplete: function (e) {
          return e.index === 0 && e.nextCh === e.symb;
        },
      },
      comment: {
        isComplete: function (e) {
          var t = e.lastCh === "*" && e.nextCh === "/";
          return (e.lastCh = e.nextCh), t;
        },
      },
      method: {
        init: function (e) {
          (e.symb = e.symb === "m" ? "{" : "}"),
            (e.reverseSymb = e.symb === "{" ? "}" : "{");
        },
        isComplete: function (e) {
          return e.nextCh === e.symb;
        },
      },
      preprocess: {
        init: function (e) {
          e.index = 0;
        },
        isComplete: function (e) {
          if (e.nextCh === "#") {
            var t = e.lineText.match(/^#(\w+)/)[1];
            if (t === "endif") {
              if (e.forward && e.depth === 0) return !0;
              e.depth++;
            } else if (t === "if") {
              if (!e.forward && e.depth === 0) return !0;
              e.depth--;
            }
            if (t === "else" && e.depth === 0) return !0;
          }
          return !1;
        },
      },
    };
  function Dr(e, t, r, n) {
    var i = H(e.getCursor()),
      a = r ? 1 : -1,
      s = r ? e.lineCount() : -1,
      l = i.ch,
      u = i.line,
      d = e.getLine(u),
      v = {
        lineText: d,
        nextCh: d.charAt(l),
        lastCh: null,
        index: l,
        symb: n,
        reverseSymb: (r ? { ")": "(", "}": "{" } : { "(": ")", "{": "}" })[n],
        forward: r,
        depth: 0,
        curMoveThrough: !1,
      },
      m = Pr[n];
    if (!m) return i;
    var C = Ot[m].init,
      g = Ot[m].isComplete;
    for (C && C(v); u !== s && t; ) {
      if (
        ((v.index += a), (v.nextCh = v.lineText.charAt(v.index)), !v.nextCh)
      ) {
        if (((u += a), (v.lineText = e.getLine(u) || ""), a > 0)) v.index = 0;
        else {
          var p = v.lineText.length;
          v.index = p > 0 ? p - 1 : 0;
        }
        v.nextCh = v.lineText.charAt(v.index);
      }
      g(v) && ((i.line = u), (i.ch = v.index), t--);
    }
    return v.nextCh || v.curMoveThrough ? new o(u, v.index) : i;
  }
  function Et(e, t, r, n, i) {
    var a = t.line,
      s = t.ch,
      l = e.getLine(a),
      u = r ? 1 : -1,
      d = n ? E : I;
    if (i && l == "") {
      if (((a += u), (l = e.getLine(a)), !oe(e, a))) return null;
      s = r ? 0 : l.length;
    }
    for (;;) {
      if (i && l == "") return { from: 0, to: 0, line: a };
      for (var v = u > 0 ? l.length : -1, m = v, C = v; s != v; ) {
        for (var g = !1, p = 0; p < d.length && !g; ++p)
          if (d[p](l.charAt(s))) {
            for (m = s; s != v && d[p](l.charAt(s)); ) s += u;
            if (((C = s), (g = m != C), m == t.ch && a == t.line && C == m + u))
              continue;
            return { from: Math.min(m, C + 1), to: Math.max(m, C), line: a };
          }
        g || (s += u);
      }
      if (((a += u), !oe(e, a))) return null;
      (l = e.getLine(a)), (s = u > 0 ? 0 : l.length);
    }
  }
  function _r(e, t, r, n, i, a) {
    var s = H(t),
      l = [];
    ((n && !i) || (!n && i)) && r++;
    for (var u = !(n && i), d = 0; d < r; d++) {
      var v = Et(e, t, n, a, u);
      if (!v) {
        var m = X(e, e.lastLine());
        l.push(
          n
            ? { line: e.lastLine(), from: m, to: m }
            : { line: 0, from: 0, to: 0 },
        );
        break;
      }
      l.push(v), (t = new o(v.line, n ? v.to - 1 : v.from));
    }
    var C = l.length != r,
      g = l[0],
      p = l.pop();
    return n && !i
      ? (!C && (g.from != s.ch || g.line != s.line) && (p = l.pop()),
        p && new o(p.line, p.from))
      : n && i
        ? p && new o(p.line, p.to - 1)
        : !n && i
          ? (!C && (g.to != s.ch || g.line != s.line) && (p = l.pop()),
            p && new o(p.line, p.to))
          : p && new o(p.line, p.from);
  }
  function Rt(e, t, r, n, i) {
    var a = t,
      s = new o(a.line + r.repeat - 1, 1 / 0),
      l = e.clipPos(s);
    return (
      l.ch--,
      i || ((n.lastHPos = 1 / 0), (n.lastHSPos = e.charCoords(l, "div").left)),
      s
    );
  }
  function tt(e, t, r, n, i) {
    if (n) {
      for (var a = i || e.getCursor(), s = a.ch, l, u = 0; u < t; u++) {
        var d = e.getLine(a.line);
        if (((l = Hr(s, d, n, r, !0)), l == -1)) return;
        s = l;
      }
      if (l != null) return new o(e.getCursor().line, l);
    }
  }
  function Fr(e, t) {
    var r = e.getCursor().line;
    return te(e, new o(r, t - 1));
  }
  function xe(e, t, r, n) {
    (!ze(r, V) && !U.test(r)) ||
      (t.marks[r] && t.marks[r].clear(), (t.marks[r] = e.setBookmark(n)));
  }
  function Hr(e, t, r, n, i) {
    var a;
    return (
      n
        ? ((a = t.indexOf(r, e + 1)), a != -1 && !i && (a -= 1))
        : ((a = t.lastIndexOf(r, e - 1)), a != -1 && !i && (a += 1)),
      a
    );
  }
  function It(e, t, r, n, i) {
    var a = t.line,
      s = e.firstLine(),
      l = e.lastLine(),
      u,
      d,
      v = a;
    function m(S) {
      return !e.getLine(S);
    }
    function C(S, A, T) {
      return T ? m(S) != m(S + A) : !m(S) && m(S + A);
    }
    if (n) {
      for (; s <= v && v <= l && r > 0; ) C(v, n) && r--, (v += n);
      return { start: new o(v, 0), end: t };
    }
    var g = e.state.vim;
    if (g.visualLine && C(a, 1, !0)) {
      var p = g.sel.anchor;
      C(p.line, -1, !0) && (!i || p.line != a) && (a += 1);
    }
    var w = m(a);
    for (v = a; v <= l && r; v++) C(v, 1, !0) && (!i || m(v) != w) && r--;
    for (
      d = new o(v, 0), v > l && !w ? (w = !0) : (i = !1), v = a;
      v > s && !((!i || m(v) == w || v == a) && C(v, -1, !0));
      v--
    );
    return (u = new o(v, 0)), { start: u, end: d };
  }
  function Bt(e, t, r, n, i) {
    function a(d) {
      d.pos + d.dir < 0 || d.pos + d.dir >= d.line.length
        ? (d.line = null)
        : (d.pos += d.dir);
    }
    function s(d, v, m, C) {
      var g = d.getLine(v),
        p = { line: g, ln: v, pos: m, dir: C };
      if (p.line === "") return { ln: p.ln, pos: p.pos };
      var w = p.pos;
      for (a(p); p.line !== null; ) {
        if (((w = p.pos), pe(p.line[p.pos])))
          if (i) {
            for (a(p); p.line !== null && $(p.line[p.pos]); ) (w = p.pos), a(p);
            return { ln: p.ln, pos: w + 1 };
          } else return { ln: p.ln, pos: p.pos + 1 };
        a(p);
      }
      return { ln: p.ln, pos: w + 1 };
    }
    function l(d, v, m, C) {
      var g = d.getLine(v),
        p = { line: g, ln: v, pos: m, dir: C };
      if (p.line === "") return { ln: p.ln, pos: p.pos };
      var w = p.pos;
      for (a(p); p.line !== null; ) {
        if (!$(p.line[p.pos]) && !pe(p.line[p.pos])) w = p.pos;
        else if (pe(p.line[p.pos]))
          return i
            ? $(p.line[p.pos + 1])
              ? { ln: p.ln, pos: p.pos + 1 }
              : { ln: p.ln, pos: w }
            : { ln: p.ln, pos: w };
        a(p);
      }
      return (
        (p.line = g),
        i && $(p.line[p.pos]) ? { ln: p.ln, pos: p.pos } : { ln: p.ln, pos: w }
      );
    }
    for (var u = { ln: t.line, pos: t.ch }; r > 0; )
      n < 0 ? (u = l(e, u.ln, u.pos, n)) : (u = s(e, u.ln, u.pos, n)), r--;
    return new o(u.ln, u.pos);
  }
  function Vr(e, t, r, n) {
    function i(u, d) {
      if (d.pos + d.dir < 0 || d.pos + d.dir >= d.line.length) {
        if (((d.ln += d.dir), !oe(u, d.ln))) {
          (d.line = null), (d.ln = null), (d.pos = null);
          return;
        }
        (d.line = u.getLine(d.ln)), (d.pos = d.dir > 0 ? 0 : d.line.length - 1);
      } else d.pos += d.dir;
    }
    function a(u, d, v, m) {
      var S = u.getLine(d),
        C = S === "",
        g = { line: S, ln: d, pos: v, dir: m },
        p = { ln: g.ln, pos: g.pos },
        w = g.line === "";
      for (i(u, g); g.line !== null; ) {
        if (((p.ln = g.ln), (p.pos = g.pos), g.line === "" && !w))
          return { ln: g.ln, pos: g.pos };
        if (C && g.line !== "" && !$(g.line[g.pos]))
          return { ln: g.ln, pos: g.pos };
        pe(g.line[g.pos]) &&
          !C &&
          (g.pos === g.line.length - 1 || $(g.line[g.pos + 1])) &&
          (C = !0),
          i(u, g);
      }
      var S = u.getLine(p.ln);
      p.pos = 0;
      for (var A = S.length - 1; A >= 0; --A)
        if (!$(S[A])) {
          p.pos = A;
          break;
        }
      return p;
    }
    function s(u, d, v, m) {
      var w = u.getLine(d),
        C = { line: w, ln: d, pos: v, dir: m },
        g = { ln: C.ln, pos: null },
        p = C.line === "";
      for (i(u, C); C.line !== null; ) {
        if (C.line === "" && !p)
          return g.pos !== null ? g : { ln: C.ln, pos: C.pos };
        if (
          pe(C.line[C.pos]) &&
          g.pos !== null &&
          !(C.ln === g.ln && C.pos + 1 === g.pos)
        )
          return g;
        C.line !== "" &&
          !$(C.line[C.pos]) &&
          ((p = !1), (g = { ln: C.ln, pos: C.pos })),
          i(u, C);
      }
      var w = u.getLine(g.ln);
      g.pos = 0;
      for (var S = 0; S < w.length; ++S)
        if (!$(w[S])) {
          g.pos = S;
          break;
        }
      return g;
    }
    for (var l = { ln: t.line, pos: t.ch }; r > 0; )
      n < 0 ? (l = s(e, l.ln, l.pos, n)) : (l = a(e, l.ln, l.pos, n)), r--;
    return new o(l.ln, l.pos);
  }
  function Nt(e, t, r, n) {
    var i = t,
      a = {
        "(": /[()]/,
        ")": /[()]/,
        "[": /[[\]]/,
        "]": /[[\]]/,
        "{": /[{}]/,
        "}": /[{}]/,
        "<": /[<>]/,
        ">": /[<>]/,
      }[r],
      s = {
        "(": "(",
        ")": "(",
        "[": "[",
        "]": "[",
        "{": "{",
        "}": "{",
        "<": "<",
        ">": "<",
      }[r],
      l = e.getLine(i.line).charAt(i.ch),
      u = l === s ? 1 : 0,
      d = e.scanForBracket(new o(i.line, i.ch + u), -1, void 0, {
        bracketRegex: a,
      }),
      v = e.scanForBracket(new o(i.line, i.ch + u), 1, void 0, {
        bracketRegex: a,
      });
    if (!d || !v) return null;
    var m = d.pos,
      C = v.pos;
    if ((m.line == C.line && m.ch > C.ch) || m.line > C.line) {
      var g = m;
      (m = C), (C = g);
    }
    return n ? (C.ch += 1) : (m.ch += 1), { start: m, end: C };
  }
  function Wr(e, t, r, n) {
    var i = H(t),
      a = e.getLine(i.line),
      s = a.split(""),
      l,
      u,
      d,
      v,
      m = s.indexOf(r);
    if (i.ch < m) i.ch = m;
    else if (m < i.ch && s[i.ch] == r) {
      var C = /string/.test(e.getTokenTypeAt(J(t, 0, 1))),
        g = /string/.test(e.getTokenTypeAt(t)),
        p = C && !g;
      p || ((u = i.ch), --i.ch);
    }
    if (s[i.ch] == r && !u) l = i.ch + 1;
    else for (d = i.ch; d > -1 && !l; d--) s[d] == r && (l = d + 1);
    if (l && !u)
      for (d = l, v = s.length; d < v && !u; d++) s[d] == r && (u = d);
    return !l || !u
      ? { start: i, end: i }
      : (n && (--l, ++u), { start: new o(i.line, l), end: new o(i.line, u) });
  }
  Re("pcre", !0, "boolean");
  class $r {
    getQuery() {
      return L.query;
    }
    setQuery(t) {
      L.query = t;
    }
    getOverlay() {
      return this.searchOverlay;
    }
    setOverlay(t) {
      this.searchOverlay = t;
    }
    isReversed() {
      return L.isReversed;
    }
    setReversed(t) {
      L.isReversed = t;
    }
    getScrollbarAnnotate() {
      return this.annotate;
    }
    setScrollbarAnnotate(t) {
      this.annotate = t;
    }
  }
  function he(e) {
    var t = e.state.vim;
    return t.searchState_ || (t.searchState_ = new $r());
  }
  function jr(e) {
    return Kt(e, "/");
  }
  function Ur(e) {
    return Pt(e, "/");
  }
  function Kt(e, t) {
    var r = Pt(e, t) || [];
    if (!r.length) return [];
    var n = [];
    if (r[0] === 0) {
      for (var i = 0; i < r.length; i++)
        typeof r[i] == "number" && n.push(e.substring(r[i] + 1, r[i + 1]));
      return n;
    }
  }
  function Pt(e, t) {
    t || (t = "/");
    for (var r = !1, n = [], i = 0; i < e.length; i++) {
      var a = e.charAt(i);
      !r && a == t && n.push(i), (r = !r && a == "\\");
    }
    return n;
  }
  function Qr(e) {
    for (var t = "|(){", r = "}", n = !1, i = [], a = -1; a < e.length; a++) {
      var s = e.charAt(a) || "",
        l = e.charAt(a + 1) || "",
        u = l && t.indexOf(l) != -1;
      n
        ? ((s !== "\\" || !u) && i.push(s), (n = !1))
        : s === "\\"
          ? ((n = !0),
            l && r.indexOf(l) != -1 && (u = !0),
            (!u || l === "\\") && i.push(s))
          : (i.push(s), u && l !== "\\" && i.push("\\"));
    }
    return i.join("");
  }
  var Dt = {
    "\\n": `
`,
    "\\r": "\r",
    "\\t": "	",
  };
  function Jr(e) {
    for (var t = !1, r = [], n = -1; n < e.length; n++) {
      var i = e.charAt(n) || "",
        a = e.charAt(n + 1) || "";
      Dt[i + a]
        ? (r.push(Dt[i + a]), n++)
        : t
          ? (r.push(i), (t = !1))
          : i === "\\"
            ? ((t = !0),
              ke(a) || a === "$"
                ? r.push("$")
                : a !== "/" && a !== "\\" && r.push("\\"))
            : (i === "$" && r.push("$"), r.push(i), a === "/" && r.push("\\"));
    }
    return r.join("");
  }
  var _t = {
    "\\/": "/",
    "\\\\": "\\",
    "\\n": `
`,
    "\\r": "\r",
    "\\t": "	",
    "\\&": "&",
  };
  function zr(e) {
    for (var t = new f.StringStream(e), r = []; !t.eol(); ) {
      for (; t.peek() && t.peek() != "\\"; ) r.push(t.next());
      var n = !1;
      for (var i in _t)
        if (t.match(i, !0)) {
          (n = !0), r.push(_t[i]);
          break;
        }
      n || r.push(t.next());
    }
    return r.join("");
  }
  function qr(e, t, r) {
    var n = L.registerController.getRegister("/");
    if ((n.setText(e), e instanceof RegExp)) return e;
    var i = Ur(e),
      a,
      s;
    if (!i.length) a = e;
    else {
      a = e.substring(0, i[0]);
      var l = e.substring(i[0]);
      s = l.indexOf("i") != -1;
    }
    if (!a) return null;
    Me("pcre") || (a = Qr(a)), r && (t = /^[^A-Z]*$/.test(a));
    var u = new RegExp(a, t || s ? "im" : "m");
    return u;
  }
  function be(e) {
    typeof e == "string" && (e = document.createElement(e));
    for (var t, r = 1; r < arguments.length; r++)
      if ((t = arguments[r]))
        if (
          (typeof t != "object" && (t = document.createTextNode(t)), t.nodeType)
        )
          e.appendChild(t);
        else
          for (var n in t)
            Object.prototype.hasOwnProperty.call(t, n) &&
              (n[0] === "$"
                ? (e.style[n.slice(1)] = t[n])
                : e.setAttribute(n, t[n]));
    return e;
  }
  function D(e, t) {
    var r = be(
      "div",
      { $color: "red", $whiteSpace: "pre", class: "cm-vim-message" },
      t,
    );
    e.openNotification
      ? e.openNotification(r, { bottom: !0, duration: 5e3 })
      : alert(r.innerText);
  }
  function Gr(e, t) {
    return be(
      "div",
      { $display: "flex" },
      be(
        "span",
        { $fontFamily: "monospace", $whiteSpace: "pre", $flex: 1 },
        e,
        be("input", {
          type: "text",
          autocorrect: "off",
          autocapitalize: "off",
          spellcheck: "false",
          $width: "100%",
        }),
      ),
      t && be("span", { $color: "#888" }, t),
    );
  }
  function Ve(e, t) {
    if (Be.length) {
      t.value || (t.value = ""), (Q = t);
      return;
    }
    var r = Gr(t.prefix, t.desc);
    if (e.openDialog)
      e.openDialog(r, t.onClose, {
        onKeyDown: t.onKeyDown,
        onKeyUp: t.onKeyUp,
        bottom: !0,
        selectValueOnOpen: !1,
        value: t.value,
      });
    else {
      var n = "";
      typeof t.prefix != "string" && t.prefix && (n += t.prefix.textContent),
        t.desc && (n += " " + t.desc),
        t.onClose(prompt(n, ""));
    }
  }
  function Xr(e, t) {
    if (e instanceof RegExp && t instanceof RegExp) {
      for (
        var r = ["global", "multiline", "ignoreCase", "source"], n = 0;
        n < r.length;
        n++
      ) {
        var i = r[n];
        if (e[i] !== t[i]) return !1;
      }
      return !0;
    }
    return !1;
  }
  function We(e, t, r, n) {
    if (t) {
      var i = he(e),
        a = qr(t, !!r, !!n);
      if (a) return Ft(e, a), Xr(a, i.getQuery()) || i.setQuery(a), a;
    }
  }
  function Zr(e) {
    if (e.source.charAt(0) == "^") var t = !0;
    return {
      token: function (r) {
        if (t && !r.sol()) {
          r.skipToEnd();
          return;
        }
        var n = r.match(e, !1);
        if (n)
          return n[0].length == 0
            ? (r.next(), "searching")
            : !r.sol() && (r.backUp(1), !e.exec(r.next() + n[0]))
              ? (r.next(), null)
              : (r.match(e), "searching");
        for (; !r.eol() && (r.next(), !r.match(e, !1)); );
      },
      query: e,
    };
  }
  var $e = 0;
  function Ft(e, t) {
    clearTimeout($e);
    var r = he(e);
    (r.highlightTimeout = $e),
      ($e = setTimeout(function () {
        if (e.state.vim) {
          var n = he(e);
          n.highlightTimeout = null;
          var i = n.getOverlay();
          (!i || t != i.query) &&
            (i && e.removeOverlay(i),
            (i = Zr(t)),
            e.addOverlay(i),
            e.showMatchesOnScrollbar &&
              (n.getScrollbarAnnotate() && n.getScrollbarAnnotate().clear(),
              n.setScrollbarAnnotate(e.showMatchesOnScrollbar(t))),
            n.setOverlay(i));
        }
      }, 50));
  }
  function Ht(e, t, r, n) {
    return e.operation(function () {
      n === void 0 && (n = 1);
      for (
        var i = e.getCursor(), a = e.getSearchCursor(r, i), s = 0;
        s < n;
        s++
      ) {
        var l = a.find(t);
        if (s == 0 && l && ue(a.from(), i)) {
          var u = t ? a.from() : a.to();
          (l = a.find(t)),
            l &&
              !l[0] &&
              ue(a.from(), u) &&
              e.getLine(u.line).length == u.ch &&
              (l = a.find(t));
        }
        if (
          !l &&
          ((a = e.getSearchCursor(
            r,
            t ? new o(e.lastLine()) : new o(e.firstLine(), 0),
          )),
          !a.find(t))
        )
          return;
      }
      return a.from();
    });
  }
  function Yr(e, t, r, n, i) {
    return e.operation(function () {
      n === void 0 && (n = 1);
      var a = e.getCursor(),
        s = e.getSearchCursor(r, a),
        l = s.find(!t);
      !i.visualMode && l && ue(s.from(), a) && s.find(!t);
      for (var u = 0; u < n; u++)
        if (
          ((l = s.find(t)),
          !l &&
            ((s = e.getSearchCursor(
              r,
              t ? new o(e.lastLine()) : new o(e.firstLine(), 0),
            )),
            !s.find(t)))
        )
          return;
      return [s.from(), s.to()];
    });
  }
  function rt(e) {
    var t = he(e);
    t.highlightTimeout &&
      (clearTimeout(t.highlightTimeout), (t.highlightTimeout = null)),
      e.removeOverlay(he(e).getOverlay()),
      t.setOverlay(null),
      t.getScrollbarAnnotate() &&
        (t.getScrollbarAnnotate().clear(), t.setScrollbarAnnotate(null));
  }
  function en(e, t, r) {
    return (
      typeof e != "number" && (e = e.line),
      t instanceof Array
        ? ze(e, t)
        : typeof r == "number"
          ? e >= t && e <= r
          : e == t
    );
  }
  function nt(e) {
    var t = e.getScrollInfo(),
      r = 6,
      n = 10,
      i = e.coordsChar({ left: 0, top: r + t.top }, "local"),
      a = t.clientHeight - n + t.top,
      s = e.coordsChar({ left: 0, top: a }, "local");
    return { top: i.line, bottom: s.line };
  }
  function Qe(e, t, r) {
    if (r == "'" || r == "`") return L.jumpList.find(e, -1) || new o(0, 0);
    if (r == ".") return Vt(e);
    var n = t.marks[r];
    return n && n.find();
  }
  function Vt(e) {
    if (e.getLastEditEnd) return e.getLastEditEnd();
    for (var t = e.doc.history.done, r = t.length; r--; )
      if (t[r].changes) return H(t[r].changes[0].to);
  }
  class tn {
    constructor() {
      this.commandMap_, this.buildCommandMap_();
    }
    processCommand(t, r, n) {
      var i = this;
      t.operation(function () {
        (t.curOp.isVimOp = !0), i._processCommand(t, r, n);
      });
    }
    _processCommand(t, r, n) {
      var i = t.state.vim,
        a = L.registerController.getRegister(":"),
        s = a.toString(),
        l = new f.StringStream(r);
      a.setText(r);
      var u = n || {};
      u.input = r;
      try {
        this.parseInput_(t, l, u);
      } catch (m) {
        throw (D(t, m + ""), m);
      }
      i.visualMode && ye(t);
      var d, v;
      if (!u.commandName) u.line !== void 0 && (v = "move");
      else if (((d = this.matchCommand_(u.commandName)), d)) {
        if (
          ((v = d.name),
          d.excludeFromCommandHistory && a.setText(s),
          this.parseCommandArgs_(l, u, d),
          d.type == "exToKey")
        ) {
          Fe(t, d.toKeys, d);
          return;
        } else if (d.type == "exToEx") {
          this.processCommand(t, d.toInput);
          return;
        }
      }
      if (!v) {
        D(t, 'Not an editor command ":' + r + '"');
        return;
      }
      try {
        Wt[v](t, u), (!d || !d.possiblyAsync) && u.callback && u.callback();
      } catch (m) {
        throw (D(t, m + ""), m);
      }
    }
    parseInput_(t, r, n) {
      r.eatWhile(":"),
        r.eat("%")
          ? ((n.line = t.firstLine()), (n.lineEnd = t.lastLine()))
          : ((n.line = this.parseLineSpec_(t, r)),
            n.line !== void 0 &&
              r.eat(",") &&
              (n.lineEnd = this.parseLineSpec_(t, r))),
        n.line == null
          ? t.state.vim.visualMode
            ? ((n.selectionLine = Qe(t, t.state.vim, "<")?.line),
              (n.selectionLineEnd = Qe(t, t.state.vim, ">")?.line))
            : (n.selectionLine = t.getCursor().line)
          : ((n.selectionLine = n.line), (n.selectionLineEnd = n.lineEnd));
      var i = r.match(/^(\w+|!!|@@|[!#&*<=>@~])/);
      return i ? (n.commandName = i[1]) : (n.commandName = r.match(/.*/)[0]), n;
    }
    parseLineSpec_(t, r) {
      var n = r.match(/^(\d+)/);
      if (n) return parseInt(n[1], 10) - 1;
      switch (r.next()) {
        case ".":
          return this.parseLineSpecOffset_(r, t.getCursor().line);
        case "$":
          return this.parseLineSpecOffset_(r, t.lastLine());
        case "'":
          var i = r.next(),
            a = Qe(t, t.state.vim, i);
          if (!a) throw new Error("Mark not set");
          return this.parseLineSpecOffset_(r, a.line);
        case "-":
        case "+":
          return r.backUp(1), this.parseLineSpecOffset_(r, t.getCursor().line);
        default:
          r.backUp(1);
          return;
      }
    }
    parseLineSpecOffset_(t, r) {
      var n = t.match(/^([+-])?(\d+)/);
      if (n) {
        var i = parseInt(n[2], 10);
        n[1] == "-" ? (r -= i) : (r += i);
      }
      return r;
    }
    parseCommandArgs_(t, r, n) {
      if (!t.eol()) {
        r.argString = t.match(/.*/)[0];
        var i = n.argDelimiter || /\s+/,
          a = Ze(r.argString).split(i);
        a.length && a[0] && (r.args = a);
      }
    }
    matchCommand_(t) {
      for (var r = t.length; r > 0; r--) {
        var n = t.substring(0, r);
        if (this.commandMap_[n]) {
          var i = this.commandMap_[n];
          if (i.name.indexOf(t) === 0) return i;
        }
      }
      return null;
    }
    buildCommandMap_() {
      this.commandMap_ = {};
      for (var t = 0; t < k.length; t++) {
        var r = k[t],
          n = r.shortName || r.name;
        this.commandMap_[n] = r;
      }
    }
    map(t, r, n, i) {
      if (t != ":" && t.charAt(0) == ":") {
        if (n) throw Error("Mode not supported for ex mappings");
        var a = t.substring(1);
        r != ":" && r.charAt(0) == ":"
          ? (this.commandMap_[a] = {
              name: a,
              type: "exToEx",
              toInput: r.substring(1),
              user: !0,
            })
          : (this.commandMap_[a] = {
              name: a,
              type: "exToKey",
              toKeys: r,
              user: !0,
            });
      } else {
        var s = { keys: t, type: "keyToKey", toKeys: r, noremap: !!i };
        n && (s.context = n), h.unshift(s);
      }
    }
    unmap(t, r) {
      if (t != ":" && t.charAt(0) == ":") {
        if (r) throw Error("Mode not supported for ex mappings");
        var n = t.substring(1);
        if (this.commandMap_[n] && this.commandMap_[n].user)
          return delete this.commandMap_[n], !0;
      } else
        for (var i = t, a = 0; a < h.length; a++)
          if (i == h[a].keys && h[a].context === r) return h.splice(a, 1), !0;
    }
  }
  var Wt = {
      colorscheme: function (e, t) {
        if (!t.args || t.args.length < 1) {
          D(e, e.getOption("theme"));
          return;
        }
        e.setOption("theme", t.args[0]);
      },
      map: function (e, t, r, n) {
        var i = t.args;
        if (!i || i.length < 2) {
          e && D(e, "Invalid mapping: " + t.input);
          return;
        }
        de.map(i[0], i[1], r, n);
      },
      imap: function (e, t) {
        this.map(e, t, "insert");
      },
      nmap: function (e, t) {
        this.map(e, t, "normal");
      },
      vmap: function (e, t) {
        this.map(e, t, "visual");
      },
      omap: function (e, t) {
        this.map(e, t, "operatorPending");
      },
      noremap: function (e, t) {
        this.map(e, t, void 0, !0);
      },
      inoremap: function (e, t) {
        this.map(e, t, "insert", !0);
      },
      nnoremap: function (e, t) {
        this.map(e, t, "normal", !0);
      },
      vnoremap: function (e, t) {
        this.map(e, t, "visual", !0);
      },
      onoremap: function (e, t) {
        this.map(e, t, "operatorPending", !0);
      },
      unmap: function (e, t, r) {
        var n = t.args;
        (!n || n.length < 1 || !de.unmap(n[0], r)) &&
          e &&
          D(e, "No such mapping: " + t.input);
      },
      mapclear: function (e, t) {
        le.mapclear();
      },
      imapclear: function (e, t) {
        le.mapclear("insert");
      },
      nmapclear: function (e, t) {
        le.mapclear("normal");
      },
      vmapclear: function (e, t) {
        le.mapclear("visual");
      },
      omapclear: function (e, t) {
        le.mapclear("operatorPending");
      },
      move: function (e, t) {
        Ae.processCommand(e, e.state.vim, {
          keys: "",
          type: "motion",
          motion: "moveToLineOrEdgeOfDocument",
          motionArgs: { forward: !1, explicitRepeat: !0, linewise: !0 },
          repeatOverride: t.line + 1,
        });
      },
      set: function (e, t) {
        var r = t.args,
          n = t.setCfg || {};
        if (!r || r.length < 1) {
          e && D(e, "Invalid mapping: " + t.input);
          return;
        }
        var i = r[0].split("="),
          a = i.shift() || "",
          s = i.length > 0 ? i.join("=") : void 0,
          l = !1,
          u = !1;
        if (a.charAt(a.length - 1) == "?") {
          if (s) throw Error("Trailing characters: " + t.argString);
          (a = a.substring(0, a.length - 1)), (l = !0);
        } else
          a.charAt(a.length - 1) == "!" &&
            ((a = a.substring(0, a.length - 1)), (u = !0));
        s === void 0 &&
          a.substring(0, 2) == "no" &&
          ((a = a.substring(2)), (s = !1));
        var d = we[a] && we[a].type == "boolean";
        if (
          (d && (u ? (s = !Me(a, e, n)) : s == null && (s = !0)),
          (!d && s === void 0) || l)
        ) {
          var v = Me(a, e, n);
          v instanceof Error
            ? D(e, v.message)
            : v === !0 || v === !1
              ? D(e, " " + (v ? "" : "no") + a)
              : D(e, "  " + a + "=" + v);
        } else {
          var m = qe(a, s, e, n);
          m instanceof Error && D(e, m.message);
        }
      },
      setlocal: function (e, t) {
        (t.setCfg = { scope: "local" }), this.set(e, t);
      },
      setglobal: function (e, t) {
        (t.setCfg = { scope: "global" }), this.set(e, t);
      },
      registers: function (e, t) {
        var r = t.args,
          n = L.registerController.registers,
          i = `----------Registers----------

`;
        if (r)
          for (var l = r.join(""), u = 0; u < l.length; u++) {
            var a = l.charAt(u);
            if (L.registerController.isValidRegister(a)) {
              var d = n[a] || new ge();
              i +=
                '"' +
                a +
                "    " +
                d.toString() +
                `
`;
            }
          }
        else
          for (var a in n) {
            var s = n[a].toString();
            s.length &&
              (i +=
                '"' +
                a +
                "    " +
                s +
                `
`);
          }
        D(e, i);
      },
      sort: function (e, t) {
        var r, n, i, a, s;
        function l() {
          if (t.argString) {
            var B = new f.StringStream(t.argString);
            if ((B.eat("!") && (r = !0), B.eol())) return;
            if (!B.eatSpace()) return "Invalid arguments";
            var N = B.match(/([dinuox]+)?\s*(\/.+\/)?\s*/);
            if (!N || !B.eol()) return "Invalid arguments";
            if (N[1]) {
              (n = N[1].indexOf("i") != -1), (i = N[1].indexOf("u") != -1);
              var re = N[1].indexOf("d") != -1 || N[1].indexOf("n") != -1,
                Y = N[1].indexOf("x") != -1,
                q = N[1].indexOf("o") != -1;
              if (Number(re) + Number(Y) + Number(q) > 1)
                return "Invalid arguments";
              a = (re && "decimal") || (Y && "hex") || (q && "octal");
            }
            N[2] &&
              (s = new RegExp(N[2].substr(1, N[2].length - 2), n ? "i" : ""));
          }
        }
        var u = l();
        if (u) {
          D(e, u + ": " + t.argString);
          return;
        }
        var d = t.line || e.firstLine(),
          v = t.lineEnd || t.line || e.lastLine();
        if (d == v) return;
        var m = new o(d, 0),
          C = new o(v, X(e, v)),
          g = e.getRange(m, C).split(`
`),
          p =
            a == "decimal"
              ? /(-?)([\d]+)/
              : a == "hex"
                ? /(-?)(?:0x)?([0-9a-f]+)/i
                : a == "octal"
                  ? /([0-7]+)/
                  : null,
          w = a == "decimal" ? 10 : a == "hex" ? 16 : a == "octal" ? 8 : void 0,
          S = [],
          A = [];
        if (a || s)
          for (var T = 0; T < g.length; T++) {
            var O = s ? g[T].match(s) : null;
            O && O[0] != ""
              ? S.push(O)
              : p && p.exec(g[T])
                ? S.push(g[T])
                : A.push(g[T]);
          }
        else A = g;
        function _(B, N) {
          if (r) {
            var re;
            (re = B), (B = N), (N = re);
          }
          n && ((B = B.toLowerCase()), (N = N.toLowerCase()));
          var Y = p && p.exec(B),
            q = p && p.exec(N);
          if (!Y || !q) return B < N ? -1 : 1;
          var Ce = parseInt((Y[1] + Y[2]).toLowerCase(), w),
            ot = parseInt((q[1] + q[2]).toLowerCase(), w);
          return Ce - ot;
        }
        function ee(B, N) {
          if (r) {
            var re;
            (re = B), (B = N), (N = re);
          }
          return (
            n && ((B[0] = B[0].toLowerCase()), (N[0] = N[0].toLowerCase())),
            B[0] < N[0] ? -1 : 1
          );
        }
        if ((S.sort(s ? ee : _), s))
          for (var T = 0; T < S.length; T++) S[T] = S[T].input;
        else a || A.sort(_);
        if (((g = r ? S.concat(A) : A.concat(S)), i)) {
          var z = g,
            Z;
          g = [];
          for (var T = 0; T < z.length; T++)
            z[T] != Z && g.push(z[T]), (Z = z[T]);
        }
        e.replaceRange(
          g.join(`
`),
          m,
          C,
        );
      },
      vglobal: function (e, t) {
        this.global(e, t);
      },
      normal: function (e, t) {
        var r = t.argString;
        if (
          (r && r[0] == "!" && ((r = r.slice(1)), (_e = !0)),
          (r = r.trimStart()),
          !r)
        ) {
          D(e, "Argument is required.");
          return;
        }
        var n = t.line;
        if (typeof n == "number")
          for (var i = isNaN(t.lineEnd) ? n : t.lineEnd, a = n; a <= i; a++)
            e.setCursor(a, 0),
              Fe(e, t.argString.trimStart()),
              e.state.vim.insertMode && Te(e, !0);
        else
          Fe(e, t.argString.trimStart()), e.state.vim.insertMode && Te(e, !0);
      },
      global: function (e, t) {
        var r = t.argString;
        if (!r) {
          D(e, "Regular Expression missing from global");
          return;
        }
        var n = t.commandName[0] === "v";
        r[0] === "!" &&
          t.commandName[0] === "g" &&
          ((n = !0), (r = r.slice(1)));
        var i = t.line !== void 0 ? t.line : e.firstLine(),
          a = t.lineEnd || t.line || e.lastLine(),
          s = jr(r),
          l = r,
          u = "";
        if (
          (s && s.length && ((l = s[0]), (u = s.slice(1, s.length).join("/"))),
          l)
        )
          try {
            We(e, l, !0, !0);
          } catch {
            D(e, "Invalid regex: " + l);
            return;
          }
        for (var d = he(e).getQuery(), v = [], m = i; m <= a; m++) {
          var C = e.getLine(m),
            g = d.test(C);
          g !== n && v.push(u ? e.getLineHandle(m) : C);
        }
        if (!u) {
          D(
            e,
            v.join(`
`),
          );
          return;
        }
        var p = 0,
          w = function () {
            if (p < v.length) {
              var S = v[p++],
                A = e.getLineNumber(S);
              if (A == null) {
                w();
                return;
              }
              var T = A + 1 + u;
              de.processCommand(e, T, { callback: w });
            } else e.releaseLineHandles && e.releaseLineHandles();
          };
        w();
      },
      substitute: function (e, t) {
        if (!e.getSearchCursor)
          throw new Error(
            "Search feature not available. Requires searchcursor.js or any other getSearchCursor implementation.",
          );
        var r = t.argString,
          n = r ? Kt(r, r[0]) : [],
          i = "",
          a = "",
          s,
          l,
          u,
          d = !1,
          v = !1;
        if (n && n.length)
          (i = n[0]),
            Me("pcre") && i !== "" && (i = new RegExp(i).source),
            (a = n[1]),
            a !== void 0 &&
              (Me("pcre")
                ? (a = zr(a.replace(/([^\\])&/g, "$1$$&")))
                : (a = Jr(a)),
              (L.lastSubstituteReplacePart = a)),
            (s = n[2] ? n[2].split(" ") : []);
        else if (r && r.length) {
          D(e, "Substitutions should be of the form :s/pattern/replace/");
          return;
        }
        if (
          (s &&
            ((l = s[0]),
            (u = parseInt(s[1])),
            l &&
              (l.indexOf("c") != -1 && (d = !0),
              l.indexOf("g") != -1 && (v = !0),
              Me("pcre")
                ? (i = i + "/" + l)
                : (i = i.replace(/\//g, "\\/") + "/" + l))),
          i)
        )
          try {
            We(e, i, !0, !0);
          } catch {
            D(e, "Invalid regex: " + i);
            return;
          }
        if (((a = a || L.lastSubstituteReplacePart), a === void 0)) {
          D(e, "No previous substitute regular expression");
          return;
        }
        var m = he(e),
          C = m.getQuery(),
          g = t.line !== void 0 ? t.line : e.getCursor().line,
          p = t.lineEnd || g;
        g == e.firstLine() && p == e.lastLine() && (p = 1 / 0),
          u && ((g = p), (p = g + u - 1));
        var w = te(e, new o(g, 0)),
          S = e.getSearchCursor(C, w);
        rn(e, d, v, g, p, S, C, a, t.callback);
      },
      startinsert: function (e, t) {
        Fe(e, t.argString == "!" ? "A" : "i", {});
      },
      redo: f.commands.redo,
      undo: f.commands.undo,
      write: function (e) {
        f.commands.save ? f.commands.save(e) : e.save && e.save();
      },
      nohlsearch: function (e) {
        rt(e);
      },
      yank: function (e) {
        var t = H(e.getCursor()),
          r = t.line,
          n = e.getLine(r);
        L.registerController.pushText("0", "yank", n, !0, !0);
      },
      delete: function (e, t) {
        var r = t.selectionLine,
          n = isNaN(t.selectionLineEnd) ? r : t.selectionLineEnd;
        Xe.delete(e, { linewise: !0 }, [
          { anchor: new o(r, 0), head: new o(n + 1, 0) },
        ]);
      },
      join: function (e, t) {
        var r = t.selectionLine,
          n = isNaN(t.selectionLineEnd) ? r : t.selectionLineEnd;
        e.setCursor(new o(r, 0)),
          Ke.joinLines(e, { repeat: n - r }, e.state.vim);
      },
      delmarks: function (e, t) {
        if (!t.argString || !Ze(t.argString)) {
          D(e, "Argument required");
          return;
        }
        for (
          var r = e.state.vim, n = new f.StringStream(Ze(t.argString));
          !n.eol();

        ) {
          n.eatSpace();
          var i = n.pos;
          if (!n.match(/[a-zA-Z]/, !1)) {
            D(e, "Invalid argument: " + t.argString.substring(i));
            return;
          }
          var a = n.next();
          if (n.match("-", !0)) {
            if (!n.match(/[a-zA-Z]/, !1)) {
              D(e, "Invalid argument: " + t.argString.substring(i));
              return;
            }
            var s = a,
              l = n.next();
            if (s && l && ne(s) == ne(l)) {
              var u = s.charCodeAt(0),
                d = l.charCodeAt(0);
              if (u >= d) {
                D(e, "Invalid argument: " + t.argString.substring(i));
                return;
              }
              for (var v = 0; v <= d - u; v++) {
                var m = String.fromCharCode(u + v);
                delete r.marks[m];
              }
            } else {
              D(e, "Invalid argument: " + s + "-");
              return;
            }
          } else a && delete r.marks[a];
        }
      },
    },
    de = new tn();
  function rn(e, t, r, n, i, a, s, l, u) {
    e.state.vim.exMode = !0;
    var d = !1,
      v,
      m,
      C;
    function g() {
      e.operation(function () {
        for (; !d; ) p(), S();
        A();
      });
    }
    function p() {
      var O = e.getRange(a.from(), a.to()),
        _ = O.replace(s, l),
        ee = a.to().line;
      a.replace(_), (m = a.to().line), (i += m - ee), (C = m < ee);
    }
    function w() {
      var O = v && H(a.to()),
        _ = a.findNext();
      return _ && !_[0] && O && ue(a.from(), O) && (_ = a.findNext()), _;
    }
    function S() {
      for (; w() && en(a.from(), n, i); )
        if (!(!r && a.from().line == m && !C)) {
          e.scrollIntoView(a.from(), 30),
            e.setSelection(a.from(), a.to()),
            (v = a.from()),
            (d = !1);
          return;
        }
      d = !0;
    }
    function A(O) {
      if ((O && O(), e.focus(), v)) {
        e.setCursor(v);
        var _ = e.state.vim;
        (_.exMode = !1), (_.lastHPos = _.lastHSPos = v.ch);
      }
      u && u();
    }
    function T(O, _, ee) {
      f.e_stop(O);
      var z = He(O);
      switch (z) {
        case "y":
          p(), S();
          break;
        case "n":
          S();
          break;
        case "a":
          var Z = u;
          (u = void 0), e.operation(g), (u = Z);
          break;
        case "l":
          p();
        case "q":
        case "<Esc>":
        case "<C-c>":
        case "<C-[>":
          A(ee);
          break;
      }
      return d && A(ee), !0;
    }
    if ((S(), d)) {
      D(e, "No matches for " + s.source);
      return;
    }
    if (!t) {
      g(), u && u();
      return;
    }
    Ve(e, {
      prefix: be("span", "replace with ", be("strong", l), " (y/n/a/q/l)"),
      onKeyDown: T,
    });
  }
  function Te(e, t) {
    var r = e.state.vim,
      n = L.macroModeState,
      i = L.registerController.getRegister("."),
      a = n.isPlaying,
      s = n.lastInsertModeChanges;
    a ||
      (e.off("change", jt),
      r.insertEnd && r.insertEnd.clear(),
      (r.insertEnd = void 0),
      f.off(e.getInputField(), "keydown", Jt)),
      !a &&
        r.insertModeRepeat > 1 &&
        (zt(e, r, r.insertModeRepeat - 1, !0),
        (r.lastEditInputState.repeatOverride = r.insertModeRepeat)),
      delete r.insertModeRepeat,
      (r.insertMode = !1),
      t || e.setCursor(e.getCursor().line, e.getCursor().ch - 1),
      e.setOption("keyMap", "vim"),
      e.setOption("disableInput", !0),
      e.toggleOverwrite(!1),
      i.setText(s.changes.join("")),
      f.signal(e, "vim-mode-change", { mode: "normal" }),
      n.isRecording && sn(n);
  }
  function $t(e) {
    h.unshift(e);
  }
  function nn(e, t, r, n, i) {
    var a = { keys: e, type: t };
    (a[t] = r), (a[t + "Args"] = n);
    for (var s in i) a[s] = i[s];
    $t(a);
  }
  Re("insertModeEscKeysTimeout", 200, "number");
  function an(e, t, r, n) {
    var i = L.registerController.getRegister(n);
    if (n == ":") {
      i.keyBuffer[0] && de.processCommand(e, i.keyBuffer[0]),
        (r.isPlaying = !1);
      return;
    }
    var a = i.keyBuffer,
      s = 0;
    (r.isPlaying = !0), (r.replaySearchQueries = i.searchQueries.slice(0));
    for (var l = 0; l < a.length; l++)
      for (var u = a[l], d, v, m = /<(?:[CSMA]-)*\w+>|./gi; (d = m.exec(u)); )
        if (((v = d[0]), le.handleKey(e, v, "macro"), t.insertMode)) {
          var C = i.insertModeChanges[s++].changes;
          (L.macroModeState.lastInsertModeChanges.changes = C),
            Gt(e, C, 1),
            Te(e);
        }
    r.isPlaying = !1;
  }
  function on(e, t) {
    if (!e.isPlaying) {
      var r = e.latestRegister,
        n = L.registerController.getRegister(r);
      n && n.pushText(t);
    }
  }
  function sn(e) {
    if (!e.isPlaying) {
      var t = e.latestRegister,
        r = L.registerController.getRegister(t);
      r &&
        r.pushInsertModeChanges &&
        r.pushInsertModeChanges(e.lastInsertModeChanges);
    }
  }
  function ln(e, t) {
    if (!e.isPlaying) {
      var r = e.latestRegister,
        n = L.registerController.getRegister(r);
      n && n.pushSearchQuery && n.pushSearchQuery(t);
    }
  }
  function jt(e, t) {
    var r = L.macroModeState,
      n = r.lastInsertModeChanges;
    if (!r.isPlaying)
      for (var i = e.state.vim; t; ) {
        if (((n.expectCursorActivityForChange = !0), n.ignoreCount > 1))
          n.ignoreCount--;
        else if (
          t.origin == "+input" ||
          t.origin == "paste" ||
          t.origin === void 0
        ) {
          var a = e.listSelections().length;
          a > 1 && (n.ignoreCount = a);
          var s = t.text.join(`
`);
          if ((n.maybeReset && ((n.changes = []), (n.maybeReset = !1)), s))
            if (e.state.overwrite && !/\n/.test(s)) n.changes.push([s]);
            else {
              if (s.length > 1) {
                var l = i && i.insertEnd && i.insertEnd.find(),
                  u = e.getCursor();
                if (l && l.line == u.line) {
                  var d = l.ch - u.ch;
                  d > 0 && d < s.length && (n.changes.push([s, d]), (s = ""));
                }
              }
              s && n.changes.push(s);
            }
        }
        t = t.next;
      }
  }
  function Ut(e) {
    var t = e.state.vim;
    if (t.insertMode) {
      var r = L.macroModeState;
      if (r.isPlaying) return;
      var n = r.lastInsertModeChanges;
      n.expectCursorActivityForChange
        ? (n.expectCursorActivityForChange = !1)
        : ((n.maybeReset = !0),
          t.insertEnd && t.insertEnd.clear(),
          (t.insertEnd = e.setBookmark(e.getCursor(), { insertLeft: !0 })));
    } else e.curOp?.isVimOp || Qt(e, t);
  }
  function Qt(e, t) {
    var r = e.getCursor("anchor"),
      n = e.getCursor("head");
    if (
      (t.visualMode && !e.somethingSelected()
        ? ye(e, !1)
        : !t.visualMode &&
          !t.insertMode &&
          e.somethingSelected() &&
          ((t.visualMode = !0),
          (t.visualLine = !1),
          f.signal(e, "vim-mode-change", { mode: "visual" })),
      t.visualMode)
    ) {
      var i = j(n, r) ? 0 : -1,
        a = j(n, r) ? -1 : 0;
      (n = J(n, 0, i)),
        (r = J(r, 0, a)),
        (t.sel = { anchor: r, head: n }),
        xe(e, t, "<", ie(n, r)),
        xe(e, t, ">", Le(n, r));
    } else t.insertMode || (t.lastHPos = e.getCursor().ch);
  }
  function it(e, t) {
    (this.keyName = e),
      (this.key = t.key),
      (this.ctrlKey = t.ctrlKey),
      (this.altKey = t.altKey),
      (this.metaKey = t.metaKey),
      (this.shiftKey = t.shiftKey);
  }
  function Jt(e) {
    var t = L.macroModeState,
      r = t.lastInsertModeChanges,
      n = f.keyName ? f.keyName(e) : e.key;
    n &&
      (n.indexOf("Delete") != -1 || n.indexOf("Backspace") != -1) &&
      (r.maybeReset && ((r.changes = []), (r.maybeReset = !1)),
      r.changes.push(new it(n, e)));
  }
  function zt(e, t, r, n) {
    var i = L.macroModeState;
    i.isPlaying = !0;
    var a = t.lastEditActionCommand,
      s = t.inputState;
    function l() {
      a ? Ae.processAction(e, t, a) : Ae.evalInput(e, t);
    }
    function u(v) {
      if (i.lastInsertModeChanges.changes.length > 0) {
        v = t.lastEditActionCommand ? v : 1;
        var m = i.lastInsertModeChanges;
        Gt(e, m.changes, v);
      }
    }
    if (((t.inputState = t.lastEditInputState), a && a.interlaceInsertRepeat))
      for (var d = 0; d < r; d++) l(), u(1);
    else n || l(), u(r);
    (t.inputState = s), t.insertMode && !n && Te(e), (i.isPlaying = !1);
  }
  function qt(e, t) {
    f.lookupKey(t, "vim-insert", function (n) {
      return typeof n == "string" ? f.commands[n](e) : n(e), !0;
    });
  }
  function Gt(e, t, r) {
    var n = e.getCursor("head"),
      i = L.macroModeState.lastInsertModeChanges.visualBlock;
    i && (Lt(e, n, i + 1), (r = e.listSelections().length), e.setCursor(n));
    for (var a = 0; a < r; a++) {
      i && e.setCursor(J(n, a, 0));
      for (var s = 0; s < t.length; s++) {
        var l = t[s];
        if (l instanceof it) qt(e, l.keyName);
        else if (typeof l == "string") e.replaceSelection(l);
        else {
          var u = e.getCursor(),
            d = J(u, 0, l[0].length - (l[1] || 0));
          e.replaceRange(l[0], u, l[1] ? u : d), e.setCursor(d);
        }
      }
    }
    i && e.setCursor(J(n, 0, 1));
  }
  function at(e) {
    var t = new e.constructor();
    return (
      Object.keys(e).forEach(function (r) {
        if (r != "insertEnd") {
          var n = e[r];
          Array.isArray(n)
            ? (n = n.slice())
            : n &&
              typeof n == "object" &&
              n.constructor != Object &&
              (n = at(n)),
            (t[r] = n);
        }
      }),
      e.sel &&
        (t.sel = {
          head: e.sel.head && H(e.sel.head),
          anchor: e.sel.anchor && H(e.sel.anchor),
        }),
      t
    );
  }
  function un(e, t, r) {
    var a = Ie(e),
      n = e,
      i = !1,
      a = le.maybeInitVimState_(n),
      s = a.visualBlock || a.wasInVisualBlock,
      l = n.isInMultiSelectMode();
    if (
      (a.wasInVisualBlock && !l
        ? (a.wasInVisualBlock = !1)
        : l && a.visualBlock && (a.wasInVisualBlock = !0),
      t == "<Esc>" &&
        !a.insertMode &&
        !a.visualMode &&
        l &&
        a.status == "<Esc>")
    )
      G(n);
    else if (s || !l || n.inVirtualSelectionMode) i = le.handleKey(n, t, r);
    else {
      var u = at(a),
        d = a.inputState.changeQueueList || [];
      n.operation(function () {
        n.curOp && (n.curOp.isVimOp = !0);
        var v = 0;
        n.forEachSelection(function () {
          n.state.vim.inputState.changeQueue = d[v];
          var m = n.getCursor("head"),
            C = n.getCursor("anchor"),
            g = j(m, C) ? 0 : -1,
            p = j(m, C) ? -1 : 0;
          (m = J(m, 0, g)),
            (C = J(C, 0, p)),
            (n.state.vim.sel.head = m),
            (n.state.vim.sel.anchor = C),
            (i = le.handleKey(n, t, r)),
            n.virtualSelection &&
              ((d[v] = n.state.vim.inputState.changeQueue),
              (n.state.vim = at(u))),
            v++;
        }),
          n.curOp?.cursorActivity && !i && (n.curOp.cursorActivity = !1),
          (n.state.vim = a),
          (a.inputState.changeQueueList = d),
          (a.inputState.changeQueue = null);
      }, !0);
    }
    return (
      i &&
        !a.visualMode &&
        !a.insert &&
        a.visualMode != n.somethingSelected() &&
        Qt(n, a),
      i
    );
  }
  return gt(), le;
}
function ae(f, o) {
  var c = o.ch,
    h = o.line + 1;
  h < 1 && ((h = 1), (c = 0)),
    h > f.lines && ((h = f.lines), (c = Number.MAX_VALUE));
  var y = f.line(h);
  return Math.min(y.from + Math.max(0, c), y.to);
}
function fe(f, o) {
  let c = f.lineAt(o);
  return { line: c.number - 1, ch: o - c.from };
}
var ce = class {
  constructor(o, c) {
    (this.line = o), (this.ch = c);
  }
};
function or(f, o, c) {
  if (f.addEventListener) f.addEventListener(o, c, !1);
  else {
    var h = f._handlers || (f._handlers = {});
    h[o] = (h[o] || []).concat(c);
  }
}
function sr(f, o, c) {
  if (f.removeEventListener) f.removeEventListener(o, c, !1);
  else {
    var h = f._handlers,
      y = h && h[o];
    if (y) {
      var k = y.indexOf(c);
      k > -1 && (h[o] = y.slice(0, k).concat(y.slice(k + 1)));
    }
  }
}
function lr(f, o, ...c) {
  var h,
    y = (h = f._handlers) === null || h === void 0 ? void 0 : h[o];
  if (y) for (var k = 0; k < y.length; ++k) y[k](...c);
}
function Yt(f, ...o) {
  if (f) for (var c = 0; c < f.length; ++c) f[c](...o);
}
var ft;
try {
  ft = new RegExp("[\\w\\p{Alphabetic}\\p{Number}_]", "u");
} catch {
  ft = /[\w]/;
}
function je(f, o) {
  var c = f.cm6;
  if (!c.state.readOnly) {
    var h = "input.type.compose";
    if (
      (f.curOp && (f.curOp.lastChange || (h = "input.type.compose.start")),
      o.annotations)
    )
      try {
        o.annotations.some(function (y) {
          y.value == "input" && (y.value = h);
        });
      } catch (y) {
        console.error(y);
      }
    else o.userEvent = h;
    return c.dispatch(o);
  }
}
function er(f, o) {
  var c;
  f.curOp && (f.curOp.$changeStart = void 0), (o ? On : En)(f.cm6);
  let h = (c = f.curOp) === null || c === void 0 ? void 0 : c.$changeStart;
  h != null && f.cm6.dispatch({ selection: { anchor: h } });
}
var In = {},
  R = class f {
    constructor(o) {
      (this.state = {}),
        (this.marks = Object.create(null)),
        (this.$mid = 0),
        (this.options = {}),
        (this._handlers = {}),
        (this.$lastChangeEndOffset = 0),
        (this.virtualSelection = null),
        (this.cm6 = o),
        (this.onChange = this.onChange.bind(this)),
        (this.onSelectionChange = this.onSelectionChange.bind(this));
    }
    openDialog(o, c, h) {
      return Nn(this, o, c, h);
    }
    openNotification(o, c) {
      return Bn(this, o, c);
    }
    on(o, c) {
      or(this, o, c);
    }
    off(o, c) {
      sr(this, o, c);
    }
    signal(o, c, h) {
      lr(this, o, c, h);
    }
    indexFromPos(o) {
      return ae(this.cm6.state.doc, o);
    }
    posFromIndex(o) {
      return fe(this.cm6.state.doc, o);
    }
    foldCode(o) {
      let c = this.cm6,
        h = c.state.selection.ranges,
        y = this.cm6.state.doc,
        k = ae(y, o),
        x = ve.create([ve.range(k, k)], 0).ranges;
      (c.state.selection.ranges = x), pn(c), (c.state.selection.ranges = h);
    }
    firstLine() {
      return 0;
    }
    lastLine() {
      return this.cm6.state.doc.lines - 1;
    }
    lineCount() {
      return this.cm6.state.doc.lines;
    }
    setCursor(o, c) {
      typeof o == "object" && ((c = o.ch), (o = o.line));
      var h = ae(this.cm6.state.doc, { line: o, ch: c || 0 });
      this.cm6.dispatch(
        { selection: { anchor: h } },
        { scrollIntoView: !this.curOp },
      ),
        this.curOp && !this.curOp.isVimOp && this.onBeforeEndOperation();
    }
    getCursor(o) {
      var c = this.cm6.state.selection.main,
        h =
          o == "head" || !o
            ? c.head
            : o == "anchor"
              ? c.anchor
              : o == "start"
                ? c.from
                : o == "end"
                  ? c.to
                  : null;
      if (h == null) throw new Error("Invalid cursor type");
      return this.posFromIndex(h);
    }
    listSelections() {
      var o = this.cm6.state.doc;
      return this.cm6.state.selection.ranges.map((c) => ({
        anchor: fe(o, c.anchor),
        head: fe(o, c.head),
      }));
    }
    setSelections(o, c) {
      var h = this.cm6.state.doc,
        y = o.map((k) => {
          var x = ae(h, k.head),
            M = ae(h, k.anchor);
          return x == M ? ve.cursor(x, 1) : ve.range(M, x);
        });
      this.cm6.dispatch({ selection: ve.create(y, c) });
    }
    setSelection(o, c, h) {
      this.setSelections([{ anchor: o, head: c }], 0),
        h && h.origin == "*mouse" && this.onBeforeEndOperation();
    }
    getLine(o) {
      var c = this.cm6.state.doc;
      return o < 0 || o >= c.lines ? "" : this.cm6.state.doc.line(o + 1).text;
    }
    getLineHandle(o) {
      return (
        this.$lineHandleChanges || (this.$lineHandleChanges = []),
        { row: o, index: this.indexFromPos(new ce(o, 0)) }
      );
    }
    getLineNumber(o) {
      var c = this.$lineHandleChanges;
      if (!c) return null;
      for (var h = o.index, y = 0; y < c.length; y++)
        if (((h = c[y].changes.mapPos(h, 1, rr.TrackAfter)), h == null))
          return null;
      var k = this.posFromIndex(h);
      return k.ch == 0 ? k.line : null;
    }
    releaseLineHandles() {
      this.$lineHandleChanges = void 0;
    }
    getRange(o, c) {
      var h = this.cm6.state.doc;
      return this.cm6.state.sliceDoc(ae(h, o), ae(h, c));
    }
    replaceRange(o, c, h, y) {
      h || (h = c);
      var k = this.cm6.state.doc,
        x = ae(k, c),
        M = ae(k, h);
      je(this, { changes: { from: x, to: M, insert: o } });
    }
    replaceSelection(o) {
      je(this, this.cm6.state.replaceSelection(o));
    }
    replaceSelections(o) {
      var c = this.cm6.state.selection.ranges,
        h = c.map((y, k) => ({ from: y.from, to: y.to, insert: o[k] || "" }));
      je(this, { changes: h });
    }
    getSelection() {
      return this.getSelections().join(`
`);
    }
    getSelections() {
      var o = this.cm6;
      return o.state.selection.ranges.map((c) =>
        o.state.sliceDoc(c.from, c.to),
      );
    }
    somethingSelected() {
      return this.cm6.state.selection.ranges.some((o) => !o.empty);
    }
    getInputField() {
      return this.cm6.contentDOM;
    }
    clipPos(o) {
      var c = this.cm6.state.doc,
        h = o.ch,
        y = o.line + 1;
      y < 1 && ((y = 1), (h = 0)),
        y > c.lines && ((y = c.lines), (h = Number.MAX_VALUE));
      var k = c.line(y);
      return (h = Math.min(Math.max(0, h), k.to - k.from)), new ce(y - 1, h);
    }
    getValue() {
      return this.cm6.state.doc.toString();
    }
    setValue(o) {
      var c = this.cm6;
      return c.dispatch({
        changes: { from: 0, to: c.state.doc.length, insert: o },
        selection: ve.range(0, 0),
      });
    }
    focus() {
      return this.cm6.focus();
    }
    blur() {
      return this.cm6.contentDOM.blur();
    }
    defaultTextHeight() {
      return this.cm6.defaultLineHeight;
    }
    findMatchingBracket(o, c) {
      var h = this.cm6.state,
        y = ae(h.doc, o),
        k = Xt(h, y + 1, -1);
      return k && k.end
        ? { to: fe(h.doc, k.end.from) }
        : ((k = Xt(h, y, 1)),
          k && k.end ? { to: fe(h.doc, k.end.from) } : { to: void 0 });
    }
    scanForBracket(o, c, h, y) {
      return Dn(this, o, c, h, y);
    }
    indentLine(o, c) {
      c ? this.indentMore() : this.indentLess();
    }
    indentMore() {
      wn(this.cm6);
    }
    indentLess() {
      Sn(this.cm6);
    }
    execCommand(o) {
      if (o == "indentAuto") f.commands.indentAuto(this);
      else if (o == "goLineLeft") xn(this.cm6);
      else if (o == "goLineRight") {
        Mn(this.cm6);
        let c = this.cm6.state,
          h = c.selection.main.head;
        h < c.doc.length &&
          c.sliceDoc(h, h + 1) !==
            `
` &&
          Ln(this.cm6);
      } else console.log(o + " is not implemented");
    }
    setBookmark(o, c) {
      var h = c?.insertLeft ? 1 : -1,
        y = this.indexFromPos(o),
        k = new ct(this, y, h);
      return k;
    }
    addOverlay({ query: o }) {
      let c = new Cn({
        regexp: !0,
        search: o.source,
        caseSensitive: !/i/.test(o.flags),
      });
      if (c.valid) {
        (c.forVim = !0), (this.cm6Query = c);
        let h = ut.of(c);
        return this.cm6.dispatch({ effects: h }), c;
      }
    }
    removeOverlay(o) {
      if (!this.cm6Query) return;
      this.cm6Query.forVim = !1;
      let c = ut.of(this.cm6Query);
      this.cm6.dispatch({ effects: c });
    }
    getSearchCursor(o, c) {
      var h = this,
        y = null,
        k = null;
      c.ch == null && (c.ch = Number.MAX_VALUE);
      var x = ae(h.cm6.state.doc, c),
        M = o.source.replace(
          /(\\.|{(?:\d+(?:,\d*)?|,\d+)})|[{}]/g,
          function (E, V) {
            return V || "\\" + E;
          },
        );
      function b(E, V = 0, K = E.length) {
        return new kn(E, M, { ignoreCase: o.ignoreCase }, V, K);
      }
      function P(E) {
        var V = h.cm6.state.doc;
        if (E > V.length) return null;
        let K = b(V, E).next();
        return K.done ? null : K.value;
      }
      var F = 1e4;
      function I(E, V) {
        var K = h.cm6.state.doc;
        for (let U = 1; ; U++) {
          let W = Math.max(E, V - U * F),
            oe = b(K, W, V),
            ne = null;
          for (; !oe.next().done; ) ne = oe.value;
          if (ne && (W == E || ne.from > W + 10)) return ne;
          if (W == E) return null;
        }
      }
      return {
        findNext: function () {
          return this.find(!1);
        },
        findPrevious: function () {
          return this.find(!0);
        },
        find: function (E) {
          var V = h.cm6.state.doc;
          if (E) {
            let K = y ? (y.from == y.to ? y.to - 1 : y.from) : x;
            y = I(0, K);
          } else {
            let K = y ? (y.from == y.to ? y.to + 1 : y.to) : x;
            y = P(K);
          }
          return (
            (k = y && { from: fe(V, y.from), to: fe(V, y.to), match: y.match }),
            y && y.match
          );
        },
        from: function () {
          return k?.from;
        },
        to: function () {
          return k?.to;
        },
        replace: function (E) {
          y &&
            (je(h, { changes: { from: y.from, to: y.to, insert: E } }),
            (y.to = y.from + E.length),
            k && (k.to = fe(h.cm6.state.doc, y.to)));
        },
      };
    }
    findPosV(o, c, h, y) {
      let { cm6: k } = this,
        x = k.state.doc,
        M = h == "page" ? k.dom.clientHeight : 0,
        b = ae(x, o),
        P = ve.cursor(b, 1, void 0, y),
        F = Math.round(Math.abs(c));
      for (let E = 0; E < F; E++)
        h == "page"
          ? (P = k.moveVertically(P, c > 0, M))
          : h == "line" && (P = k.moveVertically(P, c > 0));
      let I = fe(x, P.head);
      return (
        ((c < 0 && P.head == 0 && y != 0 && o.line == 0 && o.ch != 0) ||
          (c > 0 && P.head == x.length && I.ch != y && o.line == I.line)) &&
          (I.hitSide = !0),
        I
      );
    }
    charCoords(o, c) {
      var h = this.cm6.contentDOM.getBoundingClientRect(),
        y = ae(this.cm6.state.doc, o),
        k = this.cm6.coordsAtPos(y),
        x = -h.top;
      return {
        left: (k?.left || 0) - h.left,
        top: (k?.top || 0) + x,
        bottom: (k?.bottom || 0) + x,
      };
    }
    coordsChar(o, c) {
      var h = this.cm6.contentDOM.getBoundingClientRect(),
        y = this.cm6.posAtCoords({ x: o.left + h.left, y: o.top + h.top }) || 0;
      return fe(this.cm6.state.doc, y);
    }
    getScrollInfo() {
      var o = this.cm6.scrollDOM;
      return {
        left: o.scrollLeft,
        top: o.scrollTop,
        height: o.scrollHeight,
        width: o.scrollWidth,
        clientHeight: o.clientHeight,
        clientWidth: o.clientWidth,
      };
    }
    scrollTo(o, c) {
      o != null && (this.cm6.scrollDOM.scrollLeft = o),
        c != null && (this.cm6.scrollDOM.scrollTop = c);
    }
    scrollIntoView(o, c) {
      if (o) {
        var h = this.indexFromPos(o);
        this.cm6.dispatch({ effects: Je.scrollIntoView(h) });
      } else this.cm6.dispatch({ scrollIntoView: !0, userEvent: "scroll" });
    }
    getWrapperElement() {
      return this.cm6.dom;
    }
    getMode() {
      return { name: this.getOption("mode") };
    }
    setSize(o, c) {
      (this.cm6.dom.style.width = o + 4 + "px"),
        (this.cm6.dom.style.height = c + "px"),
        this.refresh();
    }
    refresh() {
      this.cm6.measure();
    }
    destroy() {
      this.removeOverlay();
    }
    getLastEditEnd() {
      return this.posFromIndex(this.$lastChangeEndOffset);
    }
    onChange(o) {
      this.$lineHandleChanges && this.$lineHandleChanges.push(o);
      for (let h in this.marks) this.marks[h].update(o.changes);
      this.virtualSelection &&
        (this.virtualSelection.ranges = this.virtualSelection.ranges.map((h) =>
          h.map(o.changes),
        ));
      var c = (this.curOp = this.curOp || {});
      o.changes.iterChanges((h, y, k, x, M) => {
        (c.$changeStart == null || c.$changeStart > k) && (c.$changeStart = k),
          (this.$lastChangeEndOffset = x);
        var b = { text: M.toJSON() };
        c.lastChange
          ? (c.lastChange.next = c.lastChange = b)
          : (c.lastChange = c.change = b);
      }, !0),
        c.changeHandlers ||
          (c.changeHandlers =
            this._handlers.change && this._handlers.change.slice());
    }
    onSelectionChange() {
      var o = (this.curOp = this.curOp || {});
      o.cursorActivityHandlers ||
        (o.cursorActivityHandlers =
          this._handlers.cursorActivity &&
          this._handlers.cursorActivity.slice()),
        (this.curOp.cursorActivity = !0);
    }
    operation(o, c) {
      this.curOp || (this.curOp = { $d: 0 }), this.curOp.$d++;
      try {
        var h = o();
      } finally {
        this.curOp &&
          (this.curOp.$d--, this.curOp.$d || this.onBeforeEndOperation());
      }
      return h;
    }
    onBeforeEndOperation() {
      var o = this.curOp,
        c = !1;
      o &&
        (o.change && Yt(o.changeHandlers, this, o.change),
        o &&
          o.cursorActivity &&
          (Yt(o.cursorActivityHandlers, this, null), o.isVimOp && (c = !0)),
        (this.curOp = null)),
        c && this.scrollIntoView();
    }
    moveH(o, c) {
      if (c == "char") {
        var h = this.getCursor();
        this.setCursor(h.line, h.ch + o);
      }
    }
    setOption(o, c) {
      switch (o) {
        case "keyMap":
          this.state.keyMap = c;
          break;
        case "textwidth":
          this.state.textwidth = c;
          break;
      }
    }
    getOption(o) {
      switch (o) {
        case "firstLineNumber":
          return 1;
        case "tabSize":
          return this.cm6.state.tabSize || 4;
        case "readOnly":
          return this.cm6.state.readOnly;
        case "indentWithTabs":
          return this.cm6.state.facet(Zt) == "	";
        case "indentUnit":
          return this.cm6.state.facet(Zt).length || 2;
        case "textwidth":
          return this.state.textwidth;
        case "keyMap":
          return this.state.keyMap || "vim";
      }
    }
    toggleOverwrite(o) {
      this.state.overwrite = o;
    }
    getTokenTypeAt(o) {
      var c,
        h = this.indexFromPos(o),
        y = nr(this.cm6.state, h),
        k = y?.resolve(h),
        x = ((c = k?.type) === null || c === void 0 ? void 0 : c.name) || "";
      return /comment/i.test(x) ? "comment" : /string/i.test(x) ? "string" : "";
    }
    overWriteSelection(o) {
      var c = this.cm6.state.doc,
        h = this.cm6.state.selection,
        y = h.ranges.map((k) => {
          if (k.empty) {
            var x = k.to < c.length ? c.sliceString(k.from, k.to + 1) : "";
            if (x && !/\n/.test(x)) return ve.range(k.from, k.to + 1);
          }
          return k;
        });
      this.cm6.dispatch({ selection: ve.create(y, h.mainIndex) }),
        this.replaceSelection(o);
    }
    isInMultiSelectMode() {
      return this.cm6.state.selection.ranges.length > 1;
    }
    virtualSelectionMode() {
      return !!this.virtualSelection;
    }
    forEachSelection(o) {
      var c = this.cm6.state.selection;
      this.virtualSelection = ve.create(c.ranges, c.mainIndex);
      for (var h = 0; h < this.virtualSelection.ranges.length; h++) {
        var y = this.virtualSelection.ranges[h];
        y &&
          (this.cm6.dispatch({ selection: ve.create([y]) }),
          o(),
          (this.virtualSelection.ranges[h] =
            this.cm6.state.selection.ranges[0]));
      }
      this.cm6.dispatch({ selection: this.virtualSelection }),
        (this.virtualSelection = null);
    }
    hardWrap(o) {
      return Hn(this, o);
    }
  };
R.isMac = typeof navigator < "u" && /Mac/.test(navigator.platform);
R.Pos = ce;
R.StringStream = gn;
R.commands = {
  cursorCharLeft: function (f) {
    bn(f.cm6);
  },
  redo: function (f) {
    er(f, !1);
  },
  undo: function (f) {
    er(f, !0);
  },
  newlineAndIndent: function (f) {
    Tn({ state: f.cm6.state, dispatch: (o) => je(f, o) });
  },
  indentAuto: function (f) {
    An(f.cm6);
  },
  newlineAndIndentContinueComment: void 0,
  save: void 0,
};
R.isWordChar = function (f) {
  return ft.test(f);
};
R.keys = In;
R.addClass = function (f, o) {};
R.rmClass = function (f, o) {};
R.e_preventDefault = function (f) {
  f.preventDefault();
};
R.e_stop = function (f) {
  var o, c;
  (o = f?.stopPropagation) === null || o === void 0 || o.call(f),
    (c = f?.preventDefault) === null || c === void 0 || c.call(f);
};
R.lookupKey = function (o, c, h) {
  var y = R.keys[o];
  y && h(y);
};
R.on = or;
R.off = sr;
R.signal = lr;
R.findMatchingTag = _n;
R.findEnclosingTag = Fn;
R.keyName = void 0;
function ur(f, o, c) {
  var h = document.createElement("div");
  return h.appendChild(o), h;
}
function fr(f, o) {
  f.state.currentNotificationClose && f.state.currentNotificationClose(),
    (f.state.currentNotificationClose = o);
}
function Bn(f, o, c) {
  fr(f, M);
  var h = ur(f, o, c && c.bottom),
    y = !1,
    k,
    x = c && typeof c.duration < "u" ? c.duration : 5e3;
  function M() {
    y || ((y = !0), clearTimeout(k), h.remove(), hr(f, h));
  }
  return (
    (h.onclick = function (b) {
      b.preventDefault(), M();
    }),
    cr(f, h),
    x && (k = setTimeout(M, x)),
    M
  );
}
function cr(f, o) {
  var c = f.state.dialog;
  (f.state.dialog = o),
    o &&
      c !== o &&
      (c && c.contains(document.activeElement) && f.focus(),
      c && c.parentElement
        ? c.parentElement.replaceChild(o, c)
        : c && c.remove(),
      R.signal(f, "dialog"));
}
function hr(f, o) {
  f.state.dialog == o && ((f.state.dialog = null), R.signal(f, "dialog"));
}
function Nn(f, o, c, h) {
  h || (h = {}), fr(f, void 0);
  var y = ur(f, o, h.bottom),
    k = !1;
  cr(f, y);
  function x(b) {
    if (typeof b == "string") M.value = b;
    else {
      if (k) return;
      (k = !0),
        hr(f, y),
        f.state.dialog || f.focus(),
        h.onClose && h.onClose(y);
    }
  }
  var M = y.getElementsByTagName("input")[0];
  return (
    M &&
      (h.value &&
        ((M.value = h.value), h.selectValueOnOpen !== !1 && M.select()),
      h.onInput &&
        R.on(M, "input", function (b) {
          h.onInput(b, M.value, x);
        }),
      h.onKeyUp &&
        R.on(M, "keyup", function (b) {
          h.onKeyUp(b, M.value, x);
        }),
      R.on(M, "keydown", function (b) {
        (h && h.onKeyDown && h.onKeyDown(b, M.value, x)) ||
          (b.keyCode == 13 && c(M.value),
          (b.keyCode == 27 || (h.closeOnEnter !== !1 && b.keyCode == 13)) &&
            (M.blur(), R.e_stop(b), x()));
      }),
      h.closeOnBlur !== !1 &&
        R.on(M, "blur", function () {
          setTimeout(function () {
            document.activeElement !== M && x();
          });
        }),
      M.focus()),
    x
  );
}
var Kn = {
  "(": ")>",
  ")": "(<",
  "[": "]>",
  "]": "[<",
  "{": "}>",
  "}": "{<",
  "<": ">>",
  ">": "<<",
};
function Pn(f) {
  return (f && f.bracketRegex) || /[(){}[\]]/;
}
function Dn(f, o, c, h, y) {
  for (
    var k = (y && y.maxScanLineLength) || 1e4,
      x = (y && y.maxScanLines) || 1e3,
      M = [],
      b = Pn(y),
      P =
        c > 0
          ? Math.min(o.line + x, f.lastLine() + 1)
          : Math.max(f.firstLine() - 1, o.line - x),
      F = o.line;
    F != P;
    F += c
  ) {
    var I = f.getLine(F);
    if (I) {
      var E = c > 0 ? 0 : I.length - 1,
        V = c > 0 ? I.length : -1;
      if (!(I.length > k))
        for (F == o.line && (E = o.ch - (c < 0 ? 1 : 0)); E != V; E += c) {
          var K = I.charAt(E);
          if (b.test(K)) {
            var U = Kn[K];
            if (U && (U.charAt(1) == ">") == c > 0) M.push(K);
            else if (M.length) M.pop();
            else return { pos: new ce(F, E), ch: K };
          }
        }
    }
  }
  return F - c == (c > 0 ? f.lastLine() : f.firstLine()) ? !1 : null;
}
function _n(f, o) {}
function Fn(f, o) {
  var c,
    h,
    y = f.cm6.state,
    k = f.indexFromPos(o);
  if (k < y.doc.length) {
    var x = y.sliceDoc(k, k + 1);
    x == "<" && k++;
  }
  for (var M = nr(y, k), b = M?.resolve(k) || null; b; ) {
    if (
      ((c = b.firstChild) === null || c === void 0 ? void 0 : c.type.name) ==
        "OpenTag" &&
      ((h = b.lastChild) === null || h === void 0 ? void 0 : h.type.name) ==
        "CloseTag"
    )
      return { open: tr(y.doc, b.firstChild), close: tr(y.doc, b.lastChild) };
    b = b.parent;
  }
}
function tr(f, o) {
  return { from: fe(f, o.from), to: fe(f, o.to) };
}
var ct = class {
  constructor(o, c, h) {
    (this.cm = o),
      (this.id = o.$mid++),
      (this.offset = c),
      (this.assoc = h),
      (o.marks[this.id] = this);
  }
  clear() {
    delete this.cm.marks[this.id];
  }
  find() {
    return this.offset == null ? null : this.cm.posFromIndex(this.offset);
  }
  update(o) {
    this.offset != null &&
      (this.offset = o.mapPos(this.offset, this.assoc, rr.TrackDel));
  }
};
function Hn(f, o) {
  for (
    var c,
      h = o.column || f.getOption("textwidth") || 80,
      y = o.allowMerge != !1,
      k = Math.min(o.from, o.to),
      x = Math.max(o.from, o.to);
    k <= x;

  ) {
    var M = f.getLine(k);
    if (M.length > h) {
      var b = K(M, h, 5);
      if (b) {
        var P = (c = /^\s*/.exec(M)) === null || c === void 0 ? void 0 : c[0];
        f.replaceRange(
          `
` + P,
          new ce(k, b.start),
          new ce(k, b.end),
        );
      }
      x++;
    } else if (y && /\S/.test(M) && k != x) {
      var F = f.getLine(k + 1);
      if (F && /\S/.test(F)) {
        var I = M.replace(/\s+$/, ""),
          E = F.replace(/^\s+/, ""),
          V = I + " " + E,
          b = K(V, h, 5);
        (b && b.start > I.length) || V.length < h
          ? (f.replaceRange(
              " ",
              new ce(k, I.length),
              new ce(k + 1, F.length - E.length),
            ),
            k--,
            x--)
          : I.length < M.length &&
            f.replaceRange("", new ce(k, I.length), new ce(k, M.length));
      }
    }
    k++;
  }
  return k;
  function K(U, W, oe) {
    if (!(U.length < W)) {
      var ne = U.slice(0, W),
        Ee = U.slice(W),
        ke = /^(?:(\s+)|(\S+)(\s+))/.exec(Ee),
        se = /(?:(\s+)|(\s+)(\S+))$/.exec(ne),
        $ = 0,
        pe = 0;
      if (
        (se && !se[2] && (($ = W - se[1].length), (pe = W)),
        ke && !ke[2] && ($ || ($ = W), (pe = W + ke[1].length)),
        $)
      )
        return { start: $, end: pe };
      if (se && se[2] && se.index > oe)
        return { start: se.index, end: se.index + se[2].length };
      if (ke && ke[2])
        return ($ = W + ke[2].length), { start: $, end: $ + ke[3].length };
    }
  }
}
var ht =
    ir.getDrawSelectionConfig ||
    (function () {
      let f = { cursorBlinkRate: 1200 };
      return function () {
        return f;
      };
    })(),
  dt = class {
    constructor(o, c, h, y, k, x, M, b, P, F) {
      (this.left = o),
        (this.top = c),
        (this.height = h),
        (this.fontFamily = y),
        (this.fontSize = k),
        (this.fontWeight = x),
        (this.color = M),
        (this.className = b),
        (this.letter = P),
        (this.partial = F);
    }
    draw() {
      let o = document.createElement("div");
      return (o.className = this.className), this.adjust(o), o;
    }
    adjust(o) {
      (o.style.left = this.left + "px"),
        (o.style.top = this.top + "px"),
        (o.style.height = this.height + "px"),
        (o.style.lineHeight = this.height + "px"),
        (o.style.fontFamily = this.fontFamily),
        (o.style.fontSize = this.fontSize),
        (o.style.fontWeight = this.fontWeight),
        (o.style.color = this.partial ? "transparent" : this.color),
        (o.className = this.className),
        (o.textContent = this.letter);
    }
    eq(o) {
      return (
        this.left == o.left &&
        this.top == o.top &&
        this.height == o.height &&
        this.fontFamily == o.fontFamily &&
        this.fontSize == o.fontSize &&
        this.fontWeight == o.fontWeight &&
        this.color == o.color &&
        this.className == o.className &&
        this.letter == o.letter
      );
    }
  },
  vt = class {
    constructor(o, c) {
      (this.view = o),
        (this.rangePieces = []),
        (this.cursors = []),
        (this.cm = c),
        (this.measureReq = {
          read: this.readPos.bind(this),
          write: this.drawSel.bind(this),
        }),
        (this.cursorLayer = o.scrollDOM.appendChild(
          document.createElement("div"),
        )),
        (this.cursorLayer.className = "cm-cursorLayer cm-vimCursorLayer"),
        this.cursorLayer.setAttribute("aria-hidden", "true"),
        o.requestMeasure(this.measureReq),
        this.setBlinkRate();
    }
    setBlinkRate() {
      let c = ht(this.cm.cm6.state).cursorBlinkRate;
      this.cursorLayer.style.animationDuration = c + "ms";
    }
    update(o) {
      (o.selectionSet || o.geometryChanged || o.viewportChanged) &&
        (this.view.requestMeasure(this.measureReq),
        (this.cursorLayer.style.animationName =
          this.cursorLayer.style.animationName == "cm-blink"
            ? "cm-blink2"
            : "cm-blink")),
        Vn(o) && this.setBlinkRate();
    }
    scheduleRedraw() {
      this.view.requestMeasure(this.measureReq);
    }
    readPos() {
      let { state: o } = this.view,
        c = [];
      // VITRAIL CHANGES FOR DISABLING EDITABLE STATE
      if (this.view.state.facet(Je.editable)) {
        for (let h of o.selection.ranges) {
          let y = h == o.selection.main,
            k = Un(this.cm, this.view, h, y);
          k && c.push(k);
        }
      }
      return { cursors: c };
    }
    drawSel({ cursors: o }) {
      if (
        o.length != this.cursors.length ||
        o.some((c, h) => !c.eq(this.cursors[h]))
      ) {
        let c = this.cursorLayer.children;
        if (c.length !== o.length) {
          this.cursorLayer.textContent = "";
          for (let h of o) this.cursorLayer.appendChild(h.draw());
        } else o.forEach((h, y) => h.adjust(c[y]));
        this.cursors = o;
      }
    }
    destroy() {
      this.cursorLayer.remove();
    }
  };
function Vn(f) {
  return ht(f.startState) != ht(f.state);
}
var Wn = {
    // VITRAIL CHANGES FOR NESTED EDITORS
    ".cm-vimMode > .cm-content > .cm-line": {
      "& :not(:focus)::selection": {
        backgroundColor: "transparent !important",
      },
      "&::selection": { backgroundColor: "transparent !important" },
      caretColor: "transparent !important",
    },
    ".cm-fat-cursor": {
      position: "absolute",
      background: "#ff9696",
      border: "none",
      whiteSpace: "pre",
    },
    "&:not(.cm-focused) > .cm-scroller > .cm-cursorLayer > .cm-fat-cursor": {
      background: "none",
      // outline: "solid 1px #ff9696",
      color: "transparent !important",
    },
  },
  $n = cn.highest(Je.theme(Wn));
function jn(f) {
  let o = f.scrollDOM.getBoundingClientRect();
  return {
    left:
      (f.textDirection == yn.LTR ? o.left : o.right - f.scrollDOM.clientWidth) -
      f.scrollDOM.scrollLeft,
    top: o.top - f.scrollDOM.scrollTop,
  };
}
function Un(f, o, c, h) {
  var y, k;
  let x = c.head,
    M = !1,
    b = 1,
    P = f.state.vim;
  if (P && (!P.insertMode || f.state.overwrite)) {
    if (((M = !0), P.visualBlock && !h)) return null;
    c.anchor < c.head && x--,
      f.state.overwrite ? (b = 0.2) : P.status && (b = 0.5);
  }
  if (M) {
    let I = x < o.state.doc.length && o.state.sliceDoc(x, x + 1);
    I &&
      /[\uDC00-\uDFFF]/.test(I) &&
      x > 1 &&
      (x--, (I = o.state.sliceDoc(x, x + 1)));
    let E = o.coordsAtPos(x, 1);
    if (!E) return null;
    let V = jn(o),
      K = o.domAtPos(x),
      U = K ? K.node : o.contentDOM;
    for (; K && K.node instanceof HTMLElement; )
      (U = K.node), (K = { node: K.node.childNodes[K.offset], offset: 0 });
    if (!(U instanceof HTMLElement)) {
      if (!U.parentNode) return null;
      U = U.parentNode;
    }
    let W = getComputedStyle(U),
      oe = E.left,
      ne =
        (k = (y = o).coordsForChar) === null || k === void 0
          ? void 0
          : k.call(y, x);
    if (
      (ne && (oe = ne.left),
      !I ||
        I ==
          `
` ||
        I == "\r")
    )
      I = "\xA0";
    else if (I == "	") {
      I = "\xA0";
      var F = o.coordsAtPos(x + 1, -1);
      F && (oe = F.left - (F.left - E.left) / parseInt(W.tabSize));
    } else
      /[\uD800-\uDBFF]/.test(I) &&
        x < o.state.doc.length - 1 &&
        (I += o.state.sliceDoc(x + 1, x + 2));
    let Ee = E.bottom - E.top;
    return new dt(
      oe - V.left,
      E.top - V.top + Ee * (1 - b),
      Ee * b,
      W.fontFamily,
      W.fontSize,
      W.fontWeight,
      W.color,
      h
        ? "cm-fat-cursor cm-cursor-primary"
        : "cm-fat-cursor cm-cursor-secondary",
      I,
      b != 1,
    );
  } else return null;
}
var Qn =
    typeof navigator < "u" &&
    /linux/i.test(navigator.platform) &&
    / Gecko\/\d+/.exec(navigator.userAgent),
  Oe = Rn(R),
  Jn = 250,
  zn = Je.baseTheme({
    // VITRAIL FIX FOR NESTED EDITORS
    ".cm-vimMode > .cm-cursorLayer:not(.cm-vimCursorLayer)": {
      display: "none",
    },
    ".cm-vim-panel": {
      padding: "0px 10px",
      fontFamily: "monospace",
      minHeight: "1.3em",
    },
    ".cm-vim-panel input": {
      border: "none",
      outline: "none",
      backgroundColor: "inherit",
    },
    "&light .cm-searchMatch": { backgroundColor: "#ffff0054" },
    "&dark .cm-searchMatch": { backgroundColor: "#00ffff8a" },
  }),
  qn = mn.fromClass(
    class {
      constructor(f) {
        (this.status = ""),
          (this.query = null),
          (this.decorations = lt.none),
          (this.waitForCopy = !1),
          (this.lastKeydown = ""),
          (this.useNextTextInput = !1),
          (this.compositionText = ""),
          (this.view = f);
        let o = (this.cm = new R(f));
        Oe.enterVimMode(this.cm),
          (this.view.cm = this.cm),
          (this.cm.state.vimPlugin = this),
          (this.blockCursor = new vt(f, o)),
          this.updateClass(),
          this.cm.on("vim-command-done", () => {
            o.state.vim && (o.state.vim.status = ""),
              this.blockCursor.scheduleRedraw(),
              this.updateStatus();
          }),
          this.cm.on("vim-mode-change", (c) => {
            o.state.vim &&
              ((o.state.vim.mode = c.mode),
              c.subMode && (o.state.vim.mode += " block"),
              (o.state.vim.status = ""),
              this.blockCursor.scheduleRedraw(),
              this.updateClass(),
              this.updateStatus());
          }),
          this.cm.on("dialog", () => {
            this.cm.state.statusbar
              ? this.updateStatus()
              : f.dispatch({ effects: dr.of(!!this.cm.state.dialog) });
          }),
          (this.dom = document.createElement("span")),
          (this.dom.style.cssText =
            "position: absolute; right: 10px; top: 1px"),
          (this.statusButton = document.createElement("span")),
          (this.statusButton.onclick = (c) => {
            Oe.handleKey(this.cm, "<Esc>", "user"), this.cm.focus();
          }),
          (this.statusButton.style.cssText = "cursor: pointer");
      }
      update(f) {
        var o;
        if (
          ((f.viewportChanged || f.docChanged) &&
            this.query &&
            this.highlight(this.query),
          f.docChanged && this.cm.onChange(f),
          f.selectionSet && this.cm.onSelectionChange(),
          f.viewportChanged,
          this.cm.curOp &&
            !this.cm.curOp.isVimOp &&
            this.cm.onBeforeEndOperation(),
          f.transactions)
        ) {
          for (let c of f.transactions)
            for (let h of c.effects)
              if (h.is(ut))
                if (
                  !((o = h.value) === null || o === void 0 ? void 0 : o.forVim)
                )
                  this.highlight(null);
                else {
                  let k = h.value.create();
                  this.highlight(k);
                }
        }
        this.blockCursor.update(f);
      }
      updateClass() {
        let f = this.cm.state;
        !f.vim || (f.vim.insertMode && !f.overwrite)
          ? this.view.scrollDOM.classList.remove("cm-vimMode")
          : this.view.scrollDOM.classList.add("cm-vimMode");
      }
      updateStatus() {
        let f = this.cm.state.statusbar,
          o = this.cm.state.vim;
        if (!f || !o) return;
        let c = this.cm.state.dialog;
        if (c) c.parentElement != f && ((f.textContent = ""), f.appendChild(c));
        else {
          f.textContent = "";
          var h = (o.mode || "normal").toUpperCase();
          o.insertModeReturn && (h += "(C-O)"),
            (this.statusButton.textContent = `--${h}--`),
            f.appendChild(this.statusButton);
        }
        (this.dom.textContent = o.status), f.appendChild(this.dom);
      }
      destroy() {
        Oe.leaveVimMode(this.cm),
          this.updateClass(),
          this.blockCursor.destroy(),
          delete this.view.cm;
      }
      highlight(f) {
        if (((this.query = f), !f)) return (this.decorations = lt.none);
        let { view: o } = this,
          c = new hn();
        for (let h = 0, y = o.visibleRanges, k = y.length; h < k; h++) {
          let { from: x, to: M } = y[h];
          for (; h < k - 1 && M > y[h + 1].from - 2 * Jn; ) M = y[++h].to;
          f.highlight(o.state, x, M, (b, P) => {
            c.add(b, P, Xn);
          });
        }
        return (this.decorations = c.finish());
      }
      handleKey(f, o) {
        let c = this.cm,
          h = c.state.vim;
        if (!h) return;
        let y = Oe.vimKeyFromEvent(f, h);
        if (
          (R.signal(this.cm, "inputEvent", { type: "handleKey", key: y }), !y)
        )
          return;
        if (y == "<Esc>" && !h.insertMode && !h.visualMode && this.query) {
          let M = h.searchState_;
          M && (c.removeOverlay(M.getOverlay()), M.setOverlay(null));
        }
        if (y === "<C-c>" && !R.isMac && c.somethingSelected())
          return (this.waitForCopy = !0), !0;
        h.status = (h.status || "") + y;
        let x = Oe.multiSelectHandleKey(c, y, "user");
        return (
          (h = Oe.maybeInitVimState_(c)),
          !x &&
            h.insertMode &&
            c.state.overwrite &&
            (f.key && f.key.length == 1 && !/\n/.test(f.key)
              ? ((x = !0), c.overWriteSelection(f.key))
              : f.key == "Backspace" &&
                ((x = !0), R.commands.cursorCharLeft(c))),
          x &&
            (R.signal(this.cm, "vim-keypress", y),
            f.preventDefault(),
            f.stopPropagation(),
            this.blockCursor.scheduleRedraw()),
          this.updateStatus(),
          !!x
        );
      }
    },
    {
      eventHandlers: {
        copy: function (f, o) {
          this.waitForCopy &&
            ((this.waitForCopy = !1),
            Promise.resolve().then(() => {
              var c = this.cm,
                h = c.state.vim;
              h &&
                (h.insertMode
                  ? c.setSelection(c.getCursor(), c.getCursor())
                  : c.operation(() => {
                      c.curOp && (c.curOp.isVimOp = !0),
                        Oe.handleKey(c, "<Esc>", "user");
                    }));
            }));
        },
        compositionstart: function (f, o) {
          (this.useNextTextInput = !0), R.signal(this.cm, "inputEvent", f);
        },
        compositionupdate: function (f, o) {
          R.signal(this.cm, "inputEvent", f);
        },
        compositionend: function (f, o) {
          R.signal(this.cm, "inputEvent", f);
        },
        keypress: function (f, o) {
          R.signal(this.cm, "inputEvent", f),
            this.lastKeydown == "Dead" && this.handleKey(f, o);
        },
        keydown: function (f, o) {
          R.signal(this.cm, "inputEvent", f),
            (this.lastKeydown = f.key),
            this.lastKeydown == "Unidentified" ||
            this.lastKeydown == "Process" ||
            this.lastKeydown == "Dead"
              ? (this.useNextTextInput = !0)
              : ((this.useNextTextInput = !1), this.handleKey(f, o));
        },
      },
      provide: () => [
        Je.inputHandler.of((f, o, c, h) => {
          var y,
            k,
            x = ti(f);
          if (!x) return !1;
          var M = (y = x.state) === null || y === void 0 ? void 0 : y.vim,
            b = x.state.vimPlugin;
          if (
            M &&
            !M.insertMode &&
            !(!((k = x.curOp) === null || k === void 0) && k.isVimOp)
          ) {
            if (h === "\0\0") return !0;
            if (
              (R.signal(x, "inputEvent", {
                type: "text",
                text: h,
                from: o,
                to: c,
              }),
              h.length == 1 && b.useNextTextInput)
            ) {
              if (M.expectLiteralNext && f.composing)
                return (b.compositionText = h), !1;
              if (b.compositionText) {
                var P = b.compositionText;
                b.compositionText = "";
                var F = f.state.selection.main.head,
                  I = f.state.sliceDoc(F - P.length, F);
                if (P === I) {
                  var E = x.getCursor();
                  x.replaceRange("", x.posFromIndex(F - P.length), E);
                }
              }
              return (
                b.handleKey({
                  key: h,
                  preventDefault: () => {},
                  stopPropagation: () => {},
                }),
                Gn(f),
                !0
              );
            }
          }
          return !1;
        }),
      ],
      decorations: (f) => f.decorations,
    },
  );
function Gn(f) {
  var o = f.scrollDOM.parentElement;
  if (o) {
    if (Qn) {
      (f.contentDOM.textContent = "\0\0"),
        f.contentDOM.dispatchEvent(new CustomEvent("compositionend"));
      return;
    }
    var c = f.scrollDOM.nextSibling,
      h = window.getSelection(),
      y = h && {
        anchorNode: h.anchorNode,
        anchorOffset: h.anchorOffset,
        focusNode: h.focusNode,
        focusOffset: h.focusOffset,
      };
    f.scrollDOM.remove(), o.insertBefore(f.scrollDOM, c);
    try {
      y &&
        h &&
        (h.setPosition(y.anchorNode, y.anchorOffset),
        y.focusNode && h.extend(y.focusNode, y.focusOffset));
    } catch (k) {
      console.error(k);
    }
    f.focus(), f.contentDOM.dispatchEvent(new CustomEvent("compositionend"));
  }
}
var Xn = lt.mark({ class: "cm-searchMatch" }),
  dr = dn.define(),
  Zn = vn.define({
    create: () => !1,
    update(f, o) {
      for (let c of o.effects) c.is(dr) && (f = c.value);
      return f;
    },
    provide: (f) => ar.from(f, (o) => (o ? Yn : null)),
  });
function Yn(f) {
  let o = document.createElement("div");
  o.className = "cm-vim-panel";
  let c = f.cm;
  return c.state.dialog && o.appendChild(c.state.dialog), { top: !1, dom: o };
}
function ei(f) {
  let o = document.createElement("div");
  o.className = "cm-vim-panel";
  let c = f.cm;
  return (c.state.statusbar = o), c.state.vimPlugin.updateStatus(), { dom: o };
}
function li(f = {}) {
  return [zn, qn, $n, f.status ? ar.of(ei) : Zn];
}
function ti(f) {
  return f.cm || null;
}
export { R as CodeMirror, Oe as Vim, ti as getCM, li as vim };
