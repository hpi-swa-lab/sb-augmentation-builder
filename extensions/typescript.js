import { Extension } from "../core/extension.js";
import { StdioTransport, registerLsp } from "./lsp.js";
import { base as jsBase } from "./javascript.js";

export const lsp = new Extension();
registerLsp(
  lsp,
  "tsLSP",
  (project) =>
    new StdioTransport("typescript-language-server", ["--stdio"], project.path),
);

export const base = new Extension()
  .copyFrom(jsBase)
  // (type_identifier) @type
  .registerSyntax("type", [(x) => x.type === "type_identifier"])
  // (predefined_type) @type.builtin
  .registerSyntax("type builin", [(x) => x.type === "predefined_type"])
  // ((identifier) @type
  //  (#match? @type "^[A-Z]"))
  .registerSyntax("type", [
    (x) => x.type === "identifier",
    (x) => !!x.text.match(/^[A-Z]$/),
  ])
  // (type_arguments
  //   "<" @punctuation.bracket
  //   ">" @punctuation.bracket)
  .registerSyntax(
    "bracket",
    [
      (x) => x.parent?.type === "type_arguments",
      (x) => x.text === "<" || x.text === ">",
    ],
    2,
  )
  .registerSyntax(
    "variable parameter",
    [
      (x) =>
        x.parent?.type === "required_parameter" ||
        x.parent?.type === "optional_parameter",
      (x) => x.type === "identifier",
    ],
    2,
  )
  // [ "abstract"
  //   "declare"
  //   "enum"
  //   "export"
  //   "implements"
  //   "interface"
  //   "keyof"
  //   "namespace"
  //   "private"
  //   "protected"
  //   "public"
  //   "type"
  //   "readonly"
  //   "override"
  //   "satisfies"
  // ] @keyword
  .registerSyntax("keyword", [
    (x) =>
      [
        "abstract",
        "declare",
        "enum",
        "export",
        "implements",
        "interface",
        "keyof",
        "namespace",
        "private",
        "protected",
        "public",
        "type",
        "readonly",
        "override",
        "satisfies",
      ].includes(x.text),
  ]);
