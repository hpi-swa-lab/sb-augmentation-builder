import { Extension, cssClass } from "../core/extension.js";

export const base = new Extension()
  .viewUpdate(cssClass("string", [(x) => x.type === "string"]))
  .viewUpdate(cssClass("number", [(x) => x.type === "number"]))

  .registerAlways((e) => [
    (x) => x.type === "string",
    (x) => e.applySyntaxHighlighting(x, "string"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "number",
    (x) => e.applySyntaxHighlighting(x, "number"),
  ])
  .registerAlways((e) => [
    (x) => x.field === "key" && x.parent.type === "pair",
    (x) => e.applySyntaxHighlighting(x, "string", "special", "key"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "escape_sequence",
    (x) => e.applySyntaxHighlighting(x, "escape"),
  ])
  .registerAlways((e) => [
    (x) => x.type === "comment",
    (x) => e.applySyntaxHighlighting(x, "comment"),
  ])
  .registerAlways((e) => [
    (x) => ["true", "false", "null"].includes(x.type),
    (x) => e.applySyntaxHighlighting(x, "constant", "builtin"),
  ]);
