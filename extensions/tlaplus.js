import { Extension } from "../core/extension.js";
import { h } from "../external/preact.mjs";
import { Shard } from "../core/replacement.js";

const createUnicodeReplacement = (sbNodeType, unicodeSymbol, explanation) => {
  return new Extension().registerReplacement({
    query: [(x) => x.type === sbNodeType],
    queryDepth: 1,
    component: () => h("span", { title: explanation }, unicodeSymbol),
    name: `tla-latex-${sbNodeType}`,
  });
};

export const cup = createUnicodeReplacement(
  "cup",
  "∪",
  "Union combines two sets into one set.\n\nFor example, {1, 2} ∪ {2, 3} = {1, 2, 3}.",
);
export const bulletConj = createUnicodeReplacement(
  "bullet_conj",
  "∧",
  "Conjunction combines two logical statements into one statement.\n\nFor example, P ∧ Q is true if and only if both P and Q are true.",
);
export const bulletDisj = createUnicodeReplacement(
  "bullet_disj",
  "∨",
  "Disjunction combines two logical statements into one statement.\n\nFor example, P ∨ Q is true if and only if at least one of P and Q is true.",
);
export const lor = createUnicodeReplacement(
  "lor",
  "∨",
  "Logical OR combines two logical statements into one statement.\n\nFor example, P ∨ Q is true if and only if at least one of P and Q is true.",
);
export const land = createUnicodeReplacement(
  "land",
  "∧",
  "Logical AND combines two logical statements into one statement.\n\nFor example, P ∧ Q is true if and only if both P and Q are true.",
);
export const always = createUnicodeReplacement(
  "always",
  "□",
  "Always is a temporal operator that asserts that a property holds at all times.\n\nFor example, □P asserts that P is always true.",
);
export const diamond = createUnicodeReplacement(
  "diamond",
  "◇",
  "Diamond is a temporal operator that asserts that a property holds at some time.\n\nFor example, ◇P asserts that P is true at some point in time.",
);
export const implies = createUnicodeReplacement(
  "implies",
  "⇒",
  "Implies is a logical operator that asserts that if the left-hand side is true, then the right-hand side must also be true.\n\nFor example, P ⇒ Q asserts that if P is true, then Q must also be true. It is equivalent to ¬P ∨ Q.",
);
export const setIn = createUnicodeReplacement(
  "set_in",
  "∈",
  "In asserts that an element is a member of a set.\n\nFor example, 1 ∈ {1, 2} asserts that 1 is an element of the set {1, 2}.",
);
export const notin = createUnicodeReplacement(
  "notin",
  "∉",
  "Not in asserts that an element is not a member of a set.\n\nFor example, 3 ∉ {1, 2} asserts that 3 is not an element of the set {1, 2}.",
);
export const setsubseteq = createUnicodeReplacement(
  "subseteq",
  "⊆",
  "Subset or equal to asserts that one set is a subset of another set, including the case where the sets are equal.\n\nFor example, {1} ⊆ {1, 2} asserts that the set {1} is a subset of the set {1, 2}.",
);
export const setsubset = createUnicodeReplacement(
  "subset",
  "⊂",
  "Subset asserts that one set is a subset of another set, excluding the case where the sets are equal.\n\nFor example, {1} ⊂ {1, 2} asserts that the set {1} is a proper subset of the set {1, 2}.",
);
export const mapsTo = createUnicodeReplacement(
  "maps_to",
  "→",
  "This gives the set of all functions from one set to another.\n\nFor example, [{1, 2} → {3, 4}] is the set of all functions that map 1 to 3 or 4, and 2 to 3 or 4.",
);
export const allMapTo = createUnicodeReplacement(
  "all_map_to",
  "↦",
  'This defines a function or record. The left-hand side is the domain. If it is a symbol, it is interpreted as a string.\n\nFor example, [x ∈ {1, 2}  ↦ x + 1] is the function that adds 1 to its input.\n\nThe other case is a record:\nFor example, [type ↦ "working"] is a record with the key "type", mapping to "working".',
);
export const defEq = createUnicodeReplacement(
  "def_eq",
  "≜",
  "This is a definition. It asserts that the left-hand side is defined to be the right-hand side.\n\nFor example, x ≜ 1 asserts that x is defined to be 1.",
);
export const exists = createUnicodeReplacement(
  "exists",
  "∃",
  "Exists asserts that there exists at least one element in a set that satisfies a property.\n\nFor example, ∃x ∈ {1, 2} : x > 1 asserts that there exists an element x in the set {1, 2} such that x is greater than 1.",
);
export const forall = createUnicodeReplacement(
  "forall",
  "∀",
  "For all asserts that every element in a set satisfies a property.\n\nFor example, ∀x ∈ {1, 2} : x > 0 asserts that every element x in the set {1, 2} is greater than 0.",
);
export const tlain = createUnicodeReplacement(
  "in",
  "∈",
  "In asserts that an element is a member of a set.\n\nFor example, 1 ∈ {1, 2} asserts that 1 is an element of the set {1, 2}.",
);

export const except = new Extension().registerReplacement({
  query: [(x) => x.type === "except"],
  queryDepth: 1,
  component: ({ node }) =>
    h(
      "span",
      {
        title:
          'EXCEPT is used to modify a function by changing the value of one or more of its arguments, while copying all except the changed ones.\n\nFor example, if we define f == [x \\in {1, 2} |-> "init"], which would represent a function like {1 |-> "init", 2 |-> "init"}, we can then use EXCEPT to change the value of 1 to "changed" and copying the rest by writing [f EXCEPT ![1] = "changed"].',
      },
      h(Shard, { node }),
    ),
  name: "tla-except",
});

export const unchanged = new Extension().registerReplacement({
  query: [(x) => x.type === "unchanged"],
  queryDepth: 1,
  component: ({ node }) =>
    h(
      "span",
      {
        title:
          "UCHANGED is used to assert that a variable does not change its value.\n\nFor example, UCHANGED x asserts that the value of x does not change after running this action.",
      },
      h(Shard, { node }),
    ),
  name: "tla-unchanged",
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

export const constantsDisplay = new Extension().registerReplacement({
  query: [
    (x) => x?.parent?.type === "constant_declaration",
  ],
  queryDepth: 1,
  component: ({ node, renderContent }) => renderContent?.({ node }),
  name: "tla-constants-display",
});

const validType = (x) =>
  ["identifier", "string", "identifier_ref"].includes(x.type);

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
