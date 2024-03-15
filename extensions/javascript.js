import { Extension } from "../core/extension.js";
import { Shard } from "../core/replacement.js";
import { h } from "../external/preact.mjs";

export const table = new Extension().registerReplacement({
  queryDepth: 3,
  name: "sb-js-table",
  query: [
    (x) => x.type === "array",
    (x) => x.childBlocks.length > 0,
    (x) =>
      x.childBlocks.every(
        (ea) =>
          ea.type == "array" &&
          ea.childBlocks.length === x.childBlocks[0].childBlocks.length,
      ),
  ],
  component: ({ node }) =>
    h(
      "table",
      {
        style: `
            display: inline-block;
            border: 1px solid red`,
      },
      node.childBlocks.map((array) =>
        h(
          "tr",
          { style: "border: 2px solid blue" },
          array.childBlocks.map((ea) =>
            h("td", { style: "border: 1px solid red" }, h(Shard, { node: ea })),
          ),
        ),
      ),
    ),
});

export const testValueShow = new Extension().registerReplacement({
  query: [
    (x) => x.compatibleWith("expression"),
    (x) => x.sourceString.length < 10,
  ],
  queryDepth: 1,
  component: ({ node }) =>
    h(
      "span",
      { style: { display: "inline-flex", flexDirection: "column" } },
      h(Shard, { node }),
      h("span", { style: { fontSize: "0.8em" } }, node.type),
    ),
  name: "sb-js-test-value-show",
});

export const testValueHover = new Extension().registerEventListener({
  name: "sb-js-test-value-hover",
  query: [(x) => x.type === "number"],
  queryDepth: 1,
  event: "mouseenter",
  callback: (e, shard, node) => {
    shard.withDom(node, (dom) => {
      dom.addEventListener("mouseenter", () => {
        const rect = dom.getBoundingClientRect();
        const tooltip = document.createElement("div");
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "white";
        tooltip.style.border = "1px solid black";
        tooltip.style.padding = "1em";
        tooltip.style.zIndex = 9999999999999;
        tooltip.textContent = node.text;
        tooltip.style.top = rect.bottom + "px";
        tooltip.style.left = rect.left + "px";
        document.body.appendChild(tooltip);
        dom.addEventListener("mouseleave", () => tooltip.remove());
      });
    });
  },
});

function toggle(e) {
  e.stopPropagation();
  const node = e.currentTarget.node;
  node.replaceWith(node.type === "true" ? "false" : "true");
}

export const base = new Extension()
  .registerMarker({
    query: [(x) => x.type === "true" || x.type === "false"],
    name: "sb-js-boolean",
    queryDepth: 1,
    attach: (shard, node) =>
      shard.withDom(node, (dom) => dom.addEventListener("dblclick", toggle)),
    detach: (shard, node) =>
      shard.withDom(node, (dom) => dom.removeEventListener("dblclick", toggle)),
  })

  // syntax highlighting
  .registerSyntax("constant", [
    (x) =>
      [
        "identifier",
        "shorthand_property_identifier",
        "shorthand_property_identifier_pattern",
      ].includes(x.type),
    (x) => !!x.text.match(/^[A-Z_][A-Z\d_]+$/),
  ])
  .registerSyntax("constructor", [
    (x) => x.type === "identifier",
    (x) => !!x.text.match(/^[A-Z]$/),
  ])
  .registerSyntax("variable", [(x) => x.type === "identifier"])
  .registerSyntax("property", [(x) => x.type === "property_identifier"])
  .registerSyntax("variable builtin", [
    (x) => x.type === "this" || x.type === "super",
  ])
  .registerSyntax("constant builtin", [
    (x) => ["true", "false", "null", "undefined"].includes(x.type),
  ])
  .registerSyntax("comment", [(x) => x.type === "comment"])
  .registerSyntax("string", [
    (x) => ["string", "template_string"].includes(x.type),
  ])
  .registerSyntax("string special", [(x) => x.type === "regex"])
  .registerSyntax("number", [(x) => x.type === "number"])
  .registerSyntax("punctuation bracket", [
    (x) => ["(", ")", "[", "]", "{", "}"].includes(x.text),
  ])
  .registerSyntax("operator", [
    (x) =>
      [
        "-",
        "--",
        "-=",
        "+",
        "++",
        "+=",
        "*",
        "*=",
        "**",
        "**=",
        "/",
        "/=",
        "%",
        "%=",
        "<",
        "<=",
        "<<",
        "<<=",
        "=",
        "==",
        "===",
        "!",
        "!=",
        "!==",
        "=>",
        ">",
        ">=",
        ">>",
        ">>=",
        ">>>",
        ">>>=",
        "~",
        "^",
        "&",
        "|",
        "^=",
        "&=",
        "|=",
        "&&",
        "||",
        "??",
        "&&=",
        "||=",
        "??=",
      ].includes(x.text),
  ])
  .registerSyntax("keyword", [
    (x) =>
      [
        "as",
        "async",
        "await",
        "break",
        "case",
        "catch",
        "class",
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "else",
        "export",
        "extends",
        "finally",
        "for",
        "from",
        "function",
        "get",
        "if",
        "import",
        "in",
        "instanceof",
        "let",
        "new",
        "of",
        "return",
        "set",
        "static",
        "switch",
        "target",
        "throw",
        "try",
        "typeof",
        "var",
        "void",
        "while",
        "with",
        "yield",
      ].includes(x.text),
  ]);
