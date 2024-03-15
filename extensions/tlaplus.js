import { Extension } from "../core/extension.js";
import { h } from "../external/preact.mjs";

export const latex = new Extension().registerReplacement({
  query: [(x) => x.type === "cup"],
  queryDepth: 1,
  component: ({ node }) => h("span", {}, "∪"),
  name: "tla-latex-cup",
});

export const nextStateDisplay = new Extension().registerReplacement({
  query: [
    (x) => x.type === "operator_definition",
    (x) =>
      x.atField("name").text.startsWith("TP") ||
      x.atField("name").text.startsWith("RM") ||
      x.atField("name").text.startsWith("TM"),
  ],
  queryDepth: 2,
  component: ({ node, renderContent }) => renderContent?.({ node }),
  name: "tla-next-state-display",
});

export const syntaxExplain = new Extension().registerEventListener({
  name: "tla-syntax-explain-theorem",
  event: "mouseenter",
  query: [(x) => x.type === "theorem"],
  queryDepth: 1,
  callback: (e, shard, node, dom) => {
    console.log(dom);
    const rect = dom.getBoundingClientRect();
    const tooltip = document.createElement("div");
    tooltip.style.position = "fixed";
    tooltip.style.backgroundColor = "white";
    tooltip.style.border = "1px solid black";
    tooltip.style.padding = "1em";
    tooltip.style.zIndex = 9999999999999;
    tooltip.textContent = "A theorem explaining the thing.";
    tooltip.style.top = rect.bottom + "px";
    tooltip.style.left = rect.left + "px";
    document.body.appendChild(tooltip);
    dom.addEventListener("mouseleave", () => tooltip.remove());
  },
});

export const base = new Extension()
  // tla+ keywords
  .registerSyntax("keyword", [
    (x) =>
      [
        "ASSUME",
        "ASSUMPTION",
        "AXIOM",
        "AXIOMS",
        "CASE",
        "CHOOSE",
        "CONSTANT",
        "CONSTANTS",
        "CONSTRAINT",
        "CONSTRAINTS",
        "ELSE",
        "ENABLED",
        "EXCEPT",
        "EXTENDS",
        "IF",
        "IN",
        "INSTANCE",
        "LET",
        "LOCAL",
        "MODULE",
        "OTHER",
        "SF_",
        "SUBSET",
        "SUBSET_OF",
        "THEN",
        "THEOREM",
        "UNCHANGED",
        "UNION",
        "VARIABLE",
        "VARIABLES",
        "WF_",
        "WITH",
      ].includes(x.text),
  ])
  .registerSyntax("keyword", [
    (x) =>
      [
        "address",
        "all_map_to",
        "assign",
        "case_arrow",
        "case_box",
        "def_eq",
        "exists",
        "forall",
        "gets",
        "label_as",
        "maps_to",
        "set_in",
        "temporal_exists",
        "temporal_forall",
      ].includes(x.type),
  ])

  // literals
  .registerSyntax("keyword", [
    (x) =>
      x.type === "format" &&
      ["binary_number", "hex_number", "octal_number"].includes(x.parent?.type),
  ])
  .registerSyntax("number", [
    (x) =>
      x.type === "value" &&
      ["binary_number", "hex_number", "octal_number"].includes(x.parent?.type),
  ])
  .registerSyntax("number", [
    (x) =>
      ["boolean", "int_number", "nat_number", "real_number"].includes(x.type),
  ])
  .registerSyntax("type", [
    (x) =>
      [
        "boolean_set",
        "int_number_set",
        "nat_number_set",
        "real_number_set",
        "string_set",
      ].includes(x.type),
  ])

  // namespaces and includes
  .registerSyntax("module", [
    (x) => x.type === "identifier_ref" && x.parent?.type === "extends",
  ])
  .registerSyntax("module", [
    (x) => x.type === "identifier_ref" && x.parent?.type === "instance",
  ])
  .registerSyntax("module", [
    (x) => x.parent?.type === "module" && x.field === "name",
  ])

  // constants and variables
  .registerSyntax("constant", [
    (x) => x.type === "identifier" && x.parent?.type === "constant_declaration",
  ])
  .registerSyntax(
    "constant",
    [
      (x) =>
        x.field === "name" &&
        x.parent?.type === "operator_declaration" &&
        x.parent?.parent?.type === "constant_declaration",
    ],
    3,
  )
  .registerSyntax(
    "attribute",
    [(x) => x.type === "identifier" && x.previousSiblingNode?.text === "."],
    2,
  )
  .registerSyntax(
    "attribute",
    [(x) => x.type === "identifier" && x.parent?.type === "record_literal"],
    2,
  )
  .registerSyntax(
    "attribute",
    [(x) => x.type === "identifier" && x.parent?.type === "set_of_records"],
    2,
  )
  .registerSyntax(
    "variable builtin",
    [
      (x) =>
        x.type === "identifier" && x.parent?.type === "variable_declaration",
    ],
    2,
  )

  // parameters
  // (choose (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) => x.type === "identifier" && x.parent?.type === "choose",
  ])
  // (choose (tuple_of_identifiers (identifier) @variable.parameter))
  .registerSyntax("variable parameter", [
    (x) => x.type === "identifier" && x.parent?.type === "tuple_of_identifiers",
  ])
  // (lambda (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) => x.type === "identifier" && x.parent?.type === "lambda",
  ])
  // (module_definition (operator_declaration name: (_) @variable.parameter))
  .registerSyntax(
    "variable parameter",
    [
      (x) =>
        x.field === "name" &&
        x.parent?.type === "operator_declaration" &&
        x.parent?.parent?.type === "module_definition",
    ],
    2,
  )
  // (module_definition parameter: (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "module_definition" &&
      x.parent?.field === "parameter",
    (x) => e.applySyntaxHighlighting(x, "variable", "parameter"),
  ])
  // (operator_definition (operator_declaration name: (_) @variable.parameter))
  .registerSyntax("variable parameter", [
    (x) =>
      x.field === "name" &&
      x.parent.type === "operator_declaration" &&
      x.parent?.parent?.type === "operator_definition",
    (x) => e.applySyntaxHighlighting(x, "variable", "parameter"),
  ])
  // (operator_definition parameter: (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "operator_definition" &&
      x.parent?.field === "parameter",
    (x) => e.applySyntaxHighlighting(x, "variable", "parameter"),
  ])
  // (quantifier_bound (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) => x.type === "identifier" && x.parent.type === "quantifier_bound",
  ])
  // (quantifier_bound (tuple_of_identifiers (identifier) @variable.parameter))
  .registerSyntax("variable parameter", [
    (x) => x.type === "identifier" && x.parent.type === "tuple_of_identifiers",
  ])
  // (unbounded_quantification (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) =>
      x.type === "identifier" && x.parent.type === "unbounded_quantification",
  ])

  // Operators, functions, and macros
  // (function_definition name: (identifier) @function)
  .registerSyntax("function", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "function_definition" &&
      x.parent?.field === "name",
  ])
  // (module_definition name: (_) @module)
  .registerSyntax("module", [
    (x) =>
      x.field === "name" &&
      x.parent.type === "module_definition" &&
      x.parent?.field === "name",
  ])
  // (operator_definition name: (_) @operator)
  .registerSyntax("operator", [
    (x) =>
      x.field === "name" &&
      x.parent.type === "operator_definition" &&
      x.parent?.field === "name",
  ])
  // (recursive_declaration (identifier) @operator)
  .registerSyntax("operator", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "recursive_declaration" &&
      x.parent?.field === "name",
  ])
  // (recursive_declaration (operator_declaration name: (_) @operator))
  .registerSyntax(
    "operator",
    [
      (x) =>
        x.field === "name" &&
        x.parent.type === "operator_declaration" &&
        x.parent?.parent?.type === "recursive_declaration",
    ],
    2,
  )

  .registerSyntax("punctuation delimiter", [
    (x) => ["(", ")", "[", "]", "{", "}"].includes(x.text),
  ])
  .registerSyntax("punctuation delimiter", [
    (x) =>
      ["langle_bracket", "rangle_bracket", "rangle_bracket_sub"].includes(
        x.type,
      ),
  ])

  .registerSyntax("punctuation delimiter", [
    (x) =>
      ["bullet_conj", "bullet_disj", "prev_func_val", "placeholder"].includes(
        x.type,
      ),
  ])
  .registerSyntax("punctuation delimiter", [
    (x) => [",", ":", ".", "!", ";"].includes(x.text),
  ])

  // ; Proofs
  // (assume_prove (new (identifier) @variable.parameter))
  .registerSyntax("variable parameter", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "assume_prove" &&
      x.parent?.field === "new",
    (x) => e.applySyntaxHighlighting(x, "variable", "parameter"),
  ])
  // (assume_prove (new (operator_declaration name: (_) @variable.parameter)))
  .registerSyntax(
    "variable parameter",
    [
      (x) =>
        x.field === "name" &&
        x.parent.type === "operator_declaration" &&
        x.parent?.parent?.type === "assume_prove" &&
        x.parent?.parent?.field === "new",
    ],
    2,
  )
  // (assumption name: (identifier) @constant)
  .registerSyntax(
    "constant",
    [
      (x) =>
        x.field === "name" &&
        x.parent.type === "assumption" &&
        x.parent?.field === "name",
    ],
    2,
  )
  // (pick_proof_step (identifier) @variable.parameter)
  .registerSyntax(
    "variable parameter",
    [
      (x) =>
        x.type === "identifier" &&
        x.parent.type === "pick_proof_step" &&
        x.parent?.field === "parameter",
    ],
    2,
  )
  // (proof_step_id "<" @punctuation.bracket)
  .registerSyntax("punctuation bracket", [(x) => x.type === "proof_step_id"])
  // (proof_step_id (level) @tag)
  .registerSyntax("tag", [
    (x) => x.type === "proof_step_id" && x.field === "level",
  ])
  // (proof_step_id (name) @tag)
  .registerSyntax("tag", [
    (x) => x.type === "proof_step_id" && x.field === "name",
  ])
  // (proof_step_id ">" @punctuation.bracket)
  .registerSyntax("punctuation bracket", [(x) => x.type === "proof_step_id"])
  // (proof_step_ref "<" @punctuation.bracket)
  .registerSyntax("punctuation bracket", [(x) => x.type === "proof_step_ref"])
  // (proof_step_ref (level) @tag)
  .registerSyntax("tag", [
    (x) => x.type === "proof_step_ref" && x.field === "level",
  ])
  // (proof_step_ref (name) @tag)
  .registerSyntax("tag", [
    (x) => x.type === "proof_step_ref" && x.field === "name",
    (x) => e.applySyntaxHighlighting(x, "tag"),
  ])
  // (proof_step_ref ">" @punctuation.bracket)
  .registerSyntax("punctuation bracket", [(x) => x.type === "proof_step_ref"])
  // (take_proof_step (identifier) @variable.parameter)
  .registerSyntax("variable parameter", [
    (x) =>
      x.type === "identifier" &&
      x.parent.type === "take_proof_step" &&
      x.parent?.field === "parameter",
    (x) => e.applySyntaxHighlighting(x, "variable", "parameter"),
  ])
  // (theorem name: (identifier) @constant)
  .registerSyntax("constant", [
    (x) =>
      x.field === "name" &&
      x.parent.type === "theorem" &&
      x.parent?.field === "name",
  ])
  // ; Comments and tags
  // (block_comment "(*" @comment)
  .registerSyntax("comment", [
    (x) => x.parent?.type === "block_comment" && x.text === "(*",
  ])
  // (block_comment "*)" @comment)
  .registerSyntax("comment", [
    (x) => x.parent?.type === "block_comment" && x.text === "*)",
  ])
  // (block_comment_text) @comment
  .registerSyntax("comment", [(x) => x.type === "block_comment_text"])
  // (comment) @comment
  .registerSyntax("comment", [(x) => x.type === "comment"])
  // (single_line) @comment
  .registerSyntax("comment", [(x) => x.type === "single_line"])
  // (_ label: (identifier) @tag)
  .registerSyntax("tag", [
    (x) => x.type === "identifier" && x.field === "label",
  ])
  // (label name: (_) @tag)
  .registerSyntax(
    "tag",
    [(x) => x.field === "name" && x.parent.type === "label"],
    2,
  );

// TODO
// ; Put these last so they are overridden by everything else
// (bound_infix_op symbol: (_) @function.builtin)
// (bound_nonfix_op symbol: (_) @function.builtin)
// (bound_postfix_op symbol: (_) @function.builtin)
// (bound_prefix_op symbol: (_) @function.builtin)
// ((prefix_op_symbol) @function.builtin)
// ((infix_op_symbol) @function.builtin)
// ((postfix_op_symbol) @function.builtin)
//
// ; Reference highlighting
// (identifier_ref) @variable.reference
// ((prefix_op_symbol) @variable.reference)
// (bound_prefix_op symbol: (_) @variable.reference)
// ((infix_op_symbol) @variable.reference)
// (bound_infix_op symbol: (_) @variable.reference)
// ((postfix_op_symbol) @variable.reference)
// (bound_postfix_op symbol: (_) @variable.reference)
// (bound_nonfix_op symbol: (_) @variable.reference)
