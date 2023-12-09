import { Extension, Widget } from "../extension.js";
import { exec } from "../utils.js";

class SBOutline extends Widget {
  mapping = new Map();

  connectedCallback() {
    this.style.display = "flex";
    this.style.flexDirection = "column";
  }

  noteProcessed(trigger, source) {
    if (trigger !== "always" || source.type !== "program") return;

    const newMapping = new Map();
    const DECL_TYPES = ["class_declaration", "function_declaration"];
    exec(
      source,
      (x) => x.children,
      (l) => l.filter((x) => DECL_TYPES.includes(x.type)),
      (l) => l.map((x) => x.atField("name")),
      (l) =>
        l.forEach((x, i) => {
          let shard = this.mapping.get(x);
          if (!shard) {
            shard = x.createShard();
            this.insertBefore(shard, this.children[i + 1]);
          }
          newMapping.set(x, shard);
        })
    );
    for (const [node, shard] of this.mapping.entries()) {
      if (!newMapping.has(node)) {
        shard.remove();
      }
    }
    this.mapping = newMapping;
  }
}
customElements.define("sb-outline", SBOutline);

Extension.register(
  "javascriptOutline",
  new Extension().registerQuery("open", (e) => [
    (x) => true,
    (x) => x.type === "program",
    (x) => {
      x.editor.shadowRoot.appendChild(e.createWidget("sb-outline"));
    },
  ])
);

Extension.register(
  "javascriptBase",
  new Extension()
    .registerQuery("doubleClick", (e) => [
      (x) => x.type === "true" || x.type === "false",
      (x) => x.replaceWith(x.type === "true" ? "false" : "true"),
    ])

    // syntax highlighting
    .registerQuery("always", (e) => [
      (x) =>
        [
          "identifier",
          "shorthand_property_identifier",
          "shorthand_property_identifier_pattern",
        ].includes(x.type),
      (x) => !!x.text.match(/^[A-Z_][A-Z\d_]+$/),
      (x) => e.applySyntaxHighlighting(x, "constant"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "identifier",
      (x) => !!x.text.match(/^[A-Z]$/),
      (x) => e.applySyntaxHighlighting(x, "constructor"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "identifier",
      (x) => e.applySyntaxHighlighting(x, "variable"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "property_identifier",
      (x) => e.applySyntaxHighlighting(x, "property"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "this" || x.type === "super",
      (x) => e.applySyntaxHighlighting(x, "variable", "builtin"),
    ])
    .registerQuery("always", (e) => [
      (x) => ["true", "false", "null", "undefined"].includes(x.type),
      (x) => e.applySyntaxHighlighting(x, "constant", "builtin"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "comment",
      (x) => e.applySyntaxHighlighting(x, "comment"),
    ])
    .registerQuery("always", (e) => [
      (x) => ["string", "template_string"].includes(x.type),
      (x) => e.applySyntaxHighlighting(x, "string"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "regex",
      (x) => e.applySyntaxHighlighting(x, "string", "special"),
    ])
    .registerQuery("always", (e) => [
      (x) => x.type === "number",
      (x) => e.applySyntaxHighlighting(x, "number"),
    ])
    .registerQuery("always", (e) => [
      (x) => ["(", ")", "[", "]", "{", "}"].includes(x.text),
      (x) => e.applySyntaxHighlighting(x, "punctuation", "bracket"),
    ])
    .registerQuery("always", (e) => [
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
      (x) => e.applySyntaxHighlighting(x, "operator"),
    ])
    .registerQuery("always", (e) => [
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
      (x) => e.applySyntaxHighlighting(x, "keyword"),
    ])
);
