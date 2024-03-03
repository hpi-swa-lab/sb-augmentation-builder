import { Extension } from "../core/extension.js";

export const base = new Extension()
  .registerSyntax("string", [(x) => x.type === "string"])
  .registerSyntax("number", [(x) => x.type === "number"])
  .registerSyntax(
    "string special key",
    [(x) => x.field === "key", (x) => x.parent?.type === "pair"],
    2
  )
  .registerSyntax("escape", [(x) => x.type === "escape_sequence"])
  .registerSyntax("comment", [(x) => x.type === "comment"])
  .registerSyntax("constant builtin", [
    (x) => ["true", "false", "null"].includes(x.type),
  ]);
