import { Extension } from "../core/extension.js";
import { config } from "../core/config.js";
import {
  Widget,
  ul,
  li,
  shard,
  div,
  Replacement,
  editor,
  h,
  shardList,
  ensureReplacementPreact,
  createWidgetPreact,
} from "../view/widgets.js";
import {} from "../view/widget-utils.js";
import { markAsEditableElement } from "../core/focus.js";
import { useEffect } from "../external/preact-hooks.mjs";
import { languageFor } from "../core/languages.js";
import { last, randomId } from "../utils.js";

export const objectToMap = (obj) =>
  Object.fromEntries(
    obj.childBlocks
      .filter((c) => c.type === "pair")
      // FIXME is key is a string, unquote
      .map((x) => [x.atField("key").text, x.atField("value")])
  );

customElements.define(
  "sb-outline",
  class extends Widget {
    connectedCallback() {
      this.style.display = "flex";
      this.style.flexDirection = "column";
    }

    noteProcessed(trigger, source) {
      if (trigger !== "replacement") return;

      const DECL_TYPES = ["class_declaration", "function_declaration"];
      this.render(
        div(
          "Outline",
          ul(
            source.root.children
              .filter((x) => DECL_TYPES.includes(x.type))
              .map((x) =>
                li(
                  shard(x.atField("name")),
                  ul(
                    x
                      .atField("body")
                      .children.filter((c) => c.type === "method_definition")
                      .map((x) => li(shard(x.atField("name"))))
                  )
                )
              )
          )
        )
      );
    }
  }
);

customElements.define(
  "sb-js-language-box",
  class extends Replacement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>
      :host {
        border: 1px solid #ccc;
        padding: 0.25rem;
        display: inline-block;
        border-radius: 4px;
      }
      </style><slot></slot>`;
    }

    update(source) {
      this.render(
        div(
          div(
            h("img", {
              width: 16,
              src: `${config.baseURL}/assets/smalltalk.png`,
              style: "margin-right: 0.25rem;",
            }),
            shard(source.atField("arguments").childBlock(0))
          ),
          editor({
            extensions: ["smalltalk:base"],
            sourceString: source
              .atField("arguments")
              .childBlock(1)
              .childBlock(0).text,
            language: "smalltalk",
          })
        )
      );
    }
  }
);

export const textEntryTest = new Extension().registerShortcut(
  "browseIt",
  (x, view, e) => {
    const widget = createWidgetPreact(e, "sb-text-entry-test", () =>
      h("input", { ref: markAsEditableElement })
    );
    view.after(widget);
    widget.childNodes[0].focus();
  }
);

export function asyncDo(str) {
  const s = document.createElement("script");
  s.setAttribute("type", "module");
  s.textContent = str;
  document.head.appendChild(s);
  queueMicrotask(() => s.remove());
}

// mount str as script into the head to allow imports and async code.
// also modify the last expression such that it will be reported as
// result of the evaluation.
export async function asyncEval(str) {
  const reportName = `jsEval${randomId()}`;
  const module = await languageFor("javascript").parseOffscreen(str);
  if (last(module.childBlocks).type === "expression_statement") {
    last(module.childBlocks)
      .childBlock(0)
      .wrapWith(`window.${reportName}(`, ")");
  }
  return new Promise((resolve) => {
    window[reportName] = resolve;
    asyncDo(module.sourceString);
  });
}

export const print = new Extension().registerShortcut(
  "printIt",
  async (x, view, e) => {
    const widget = e.createWidget("sb-print-result");
    const value = await asyncEval(x.editor.selectedText);

    let str;
    if (value === undefined) str = "undefined";
    else if (value === null) str = "null";
    else str = value.toString();

    widget.result = str;
    view.after(widget);
    widget.focus();
  }
);

export const outline = new Extension().registerExtensionConnected((e) => [
  (x) => x.type === "program",
  (x) => x.editor.appendChild(e.createWidget("sb-outline")),
]);

export const multilingual = new Extension().registerReplacement((e) => [
  (x) => x.type === "call_expression",
  (x) => x.atField("function").text === "sqCompile",
  (x) => e.ensureReplacement(x, "sb-js-language-box"),
]);

export const alwaysTrue = new Extension().registerType((e) => [
  (x) => x.type === "true" || x.type === "false",
  (x) => x.replaceWith("true"),
]);

export const smileys = new Extension().registerReplacement((e) => [
  (x) => x.type === "lexical_declaration",
  (x) =>
    ensureReplacementPreact(
      e,
      x,
      "sb-js-lexical-declaration-smiley",
      ({ node }) => {
        useEffect(() => {
          console.log("mounted");
        }, []);
        let type = node.childNode(0);
        return h(
          "span",
          { style: "border: 1px solid green" },
          h(
            "span",
            {
              onclick: () =>
                type.replaceWith(type.text === "let" ? "const" : "let"),
            },
            type.text === "let" ? "😀" : "😇"
          ),
          shardList(node.children.slice(1))
        );
      }
    ),
]);

export const highlightNode = new Extension()
  .registerShortcut(
    "highlightIt",
    (x, view, e) => {
      // Demo: ephemeral vs stable
      // e.ensureClass(x, "search-result")
      x.wrapWith(`["sbHighlight",`, `][1]`);
    },
    [(x) => x.orParentCompatibleWith("expression")]
  )
  .registerReplacement((e) => [
    (x) => x.type === "subscript_expression",
    (x) => x.childBlock(0).type === "array",
    (x) => x.childBlock(0).childBlock(0).sourceString === '"sbHighlight"',
    (x) => e.ensureReplacement(x, "sb-js-highlight"),
  ]);

customElements.define(
  "sb-js-highlight",
  class extends Replacement {
    update(source) {
      this.render(
        h(
          "span",
          { style: { backgroundColor: "#ff0" } },
          shard(source.childBlock(0).childBlock(1))
        )
      );
    }
  }
);

customElements.define(
  "sb-js-dataurl-image",
  class extends Replacement {
    update(source) {
      this.render(
        h(
          "div",
          {
            style: `
            position: relative;
            display: inline-block; 
            white-space: wrap;
            border: 1px solid gray
          `,
          },
          h("img", {
            src: source.childBlock(0).text,
            style: ``,
            onclick: async (evt) => {
              var imageEditor = await lively.create("lively-image-editor");
              var img = evt.target;
              var parent = img.parentElement;
              img.remove();
              parent.appendChild(imageEditor);
              imageEditor.style.minWidth = "200px";
              lively.setPosition(imageEditor, lively.pt(0, -40));
              imageEditor.addEventListener("saved-to-target", () => {
                parent.appendChild(img);
                imageEditor.remove();
                debugger;
                // #TODO bug here... throws errror
                source.childBlock(0).replaceWith("" + img.src);
              });
              imageEditor.setTarget(img);
            },
          })
        )
      );
    }
  }
);

export const dataurlimage = new Extension().registerReplacement((e) => [
  (x) => x.type === "string",
  (x) => !!x.childBlock(0).text.match(/^data\:image\/png/),
  (x) => e.ensureReplacement(x, "sb-js-dataurl-image"),
]);

customElements.define(
  "sb-js-colorstring",
  class extends Replacement {
    update(source) {
      this.render([
        h("div", {
          style: `
            display: inline-block; 
            background: ${source.childBlock(0).text}; 
            position: relative;
            width: 20px; 
            white-space: wrap;
            height: 20px; 
            border: 1px solid red`,
          onclick: async (evt) => {
            var chooser = await lively.create("lively-crayoncolors");
            lively.setPosition(chooser, lively.pt(0, 0));
            evt.target.appendChild(chooser);
            chooser.addEventListener("color-choosen", () => {
              source.childBlock(0).replaceWith(chooser.value);
              chooser.remove();
            });
            chooser.onChooseCustomColor();
          },
        }),
        shard(source.children[1]),
      ]);
    }
  }
);

export const colorstrings = new Extension().registerReplacement((e) => [
  (x) => x.type === "string",
  (x) => !!x.children[1].text.match(/^rgba?\(.*\)$/),

  (x) => e.ensureReplacement(x, "sb-js-colorstring"),
]);

customElements.define(
  "sb-js-table",
  class extends Replacement {
    update(source) {
      this.render(
        h(
          "table",
          {
            style: `
            display: inline-block;
            border: 1px solid red`,
          },
          source.childBlocks.map((array) =>
            h(
              "tr",
              { style: "border: 2px solid blue" },
              array.childBlocks.map((ea) =>
                h("td", { style: "border: 1px solid red" }, shard(ea))
              )
            )
          )
        )
      );
    }
  }
);

export const table = new Extension().registerReplacement((e) => [
  (x) => x.type === "array",
  (x) => x.childBlocks.length > 0,
  (x) =>
    x.childBlocks.every(
      (ea) =>
        ea.type == "array" &&
        ea.childBlocks.length === x.childBlocks[0].childBlocks.length
    ),
  (x) => e.ensureReplacement(x, "sb-js-table"),
]);

export const base = new Extension()
  .registerDoubleClick((e) => [
    (x) => x.type === "true" || x.type === "false",
    (x) => x.replaceWith(x.type === "true" ? "false" : "true"),
  ])

  // syntax highlighting
  .registerAlways((e) => [
    (x) =>
      [
        "identifier",
        "shorthand_property_identifier",
        "shorthand_property_identifier_pattern",
      ].includes(x.type),
    (x) => !!x.text.match(/^[A-Z_][A-Z\d_]+$/),
    (x) => e.applySyntaxHighlighting(x, "constant"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "identifier",
    (x) => !!x.text.match(/^[A-Z]$/),
    (x) => e.applySyntaxHighlighting(x, "constructor"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "identifier",
    (x) => e.applySyntaxHighlighting(x, "variable"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "property_identifier",
    (x) => e.applySyntaxHighlighting(x, "property"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "this" || x.type === "super",
    (x) => e.applySyntaxHighlighting(x, "variable", "builtin"),
  ])
  .registerAlways((e) => [
    (x) => ["true", "false", "null", "undefined"].includes(x.type),
    (x) => e.applySyntaxHighlighting(x, "constant", "builtin"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "comment",
    (x) => e.applySyntaxHighlighting(x, "comment"),
  ])
  .registerAlways((e) => [
    (x) => ["string", "template_string"].includes(x.type),
    (x) => e.applySyntaxHighlighting(x, "string"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "regex",
    (x) => e.applySyntaxHighlighting(x, "string", "special"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "number",
    (x) => e.applySyntaxHighlighting(x, "number"),
  ])
  .registerAlways((e) => [
    (x) => ["(", ")", "[", "]", "{", "}"].includes(x.text),
    (x) => e.applySyntaxHighlighting(x, "punctuation", "bracket"),
  ])
  .registerAlways((e) => [
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
  .registerAlways((e) => [
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
  ]);
