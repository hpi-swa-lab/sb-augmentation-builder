import {
  TreeSitterComposedLanguage,
  TreeSitterLanguage,
} from "./tree-sitter.js";

const languages = [];

export function registerLanguage(language) {
  languages.push(language);
}

export function languageFor(name) {
  return languages.find((language) => language.name === name);
}

export function languageForExtension(extension) {
  return languages.find((language) => language.extensions.includes(extension));
}

export function languageForPath(path) {
  const extension = path.split(".").pop();
  return languageForExtension(extension);
}

registerLanguage(
  new TreeSitterLanguage({
    repo: "tree-sitter/tree-sitter-javascript",
    branch: "0c0b18de798a90cd22819cec4802a27b914e395c",
    extensions: ["js"],
    defaultExtensions: [
      "lsp:base",
      "lsp:browse",
      "lsp:diagnostics",
      "base:identifierSuggestions",
      "prettier:javascript",
      "watch:javascript",
      "javascript:print",
      "javascript:base",
    ],
  })
);

const typescript = {
  name: "typescript",
  repo: "tree-sitter/tree-sitter-typescript",
  branch: "d847898fec3fe596798c9fda55cb8c05a799001a",
  path: "/typescript/",
  extensions: ["ts"],
  defaultExtensions: [
    "typescript:base",
    "lsp:base",
    "lsp:browse",
    "lsp:diagnostics",
    "lsp:suggestions",
    // "base:identifierSuggestions",
    "prettier:typescript",
  ],
};

registerLanguage(new TreeSitterLanguage(typescript));
registerLanguage(
  new TreeSitterLanguage({
    ...typescript,
    name: "tsx",
    path: "/tsx/",
    extensions: ["tsx"],
  })
);

registerLanguage(
  new TreeSitterLanguage({
    repo: "tree-sitter/tree-sitter-css",
    branch: "98c7b3dceb24f1ee17f1322f3947e55638251c37",
    extensions: ["css"],
    defaultExtensions: ["css:base", "base:identifierSuggestions"],
  })
);

registerLanguage(
  new TreeSitterLanguage({
    repo: "tree-sitter/tree-sitter-json",
    branch: "3fef30de8aee74600f25ec2e319b62a1a870d51e",
    extensions: ["json"],
    defaultExtensions: ["json:base", "base:identifierSuggestions"],
  })
);

registerLanguage(
  new TreeSitterLanguage({
    repo: "tom95/tree-sitter-smalltalk",
    branch: "fd6a5a256f831f0882b435d976c9baab04fb9e2b",
    extensions: ["st"],
    defaultExtensions: ["base:identifierSuggestions"],
  })
);

registerLanguage(
  new TreeSitterLanguage({
    repo: "tlaplus-community/tree-sitter-tlaplus",
    branch: "c5fae9e4ad9f483fb6232a8688a2c940be6b496b",
    extensions: ["tla"],
    defaultExtensions: ["base:identifierSuggestions"],
  })
);

registerLanguage(
  new TreeSitterComposedLanguage({
    name: "markdown",
    extensions: ["md"],
    defaultExtensions: [
      "markdown:base",
      "markdown:inline",
      "markdown:taskList",
      "base:identifierSuggestions",
    ],
    baseLanguage: new TreeSitterLanguage({
      repo: "MDeiml/tree-sitter-markdown",
      branch: "f9820b2db958228f9be339b67d2de874d065866e",
      path: "/tree-sitter-markdown/",
      name: "markdown",
    }),
    nestedLanguage: new TreeSitterLanguage({
      repo: "MDeiml/tree-sitter-markdown",
      branch: "f9820b2db958228f9be339b67d2de874d065866e",
      path: "/tree-sitter-markdown-inline/",
      name: "markdown_inline",
    }),
    matcher: (node) => node.type === "inline",
  })
);
