import { languageFor, languageForPath } from "../core/languages.js";

async function tryFormat(string, cursorOffset, filepath, parser, deps, config) {
  try {
    const prettier = await import("https://esm.sh/prettier@3.1.1/standalone");

    return await prettier.formatWithCursor(string, {
      cursorOffset,
      filepath,
      parser,
      plugins: (await Promise.all(deps.map((x) => import(x)))).map(
        (x) => x.default,
      ),
      arrowParens: "always",
      bracketSpacing: true,
      endOfLine: "lf",
      htmlWhitespaceSensitivity: "css",
      insertPragma: false,
      singleAttributePerLine: false,
      bracketSameLine: false,
      jsxBracketSameLine: false,
      jsxSingleQuote: false,
      printWidth: 80,
      proseWrap: "preserve",
      quoteProps: "as-needed",
      requirePragma: false,
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "all",
      useTabs: false,
      embeddedLanguageFormatting: "auto",
      vueIndentScriptAndStyle: false,
      ...(config ?? {}),
    });
  } catch (error) {
    console.error("[prettier]", error);
    return null;
  }
}

const options = new Map();
options.set(languageFor("javascript"), {
  deps: [
    "https://esm.sh/prettier@3.1.1/plugins/estree",
    "https://esm.sh/prettier@3.1.1/plugins/babel",
  ],
  parser: "babel",
});
options.set(languageFor("typescript"), {
  deps: [
    "https://esm.sh/prettier@3.1.1/plugins/estree",
    "https://esm.sh/prettier@3.1.1/plugins/typescript",
  ],
  parser: "typescript",
});

export async function format(vitrail, path) {
  const lang = languageForPath(path);
  const { deps, parser } = options.get(lang) ?? {};
  const selectionRange = vitrail.getSelection()?.range ?? [0, 0];
  const sourceString = vitrail.sourceString;

  if (!parser) return;

  const result = await tryFormat(
    sourceString,
    selectionRange[0],
    path,
    parser,
    deps,
  );

  if (!result) return;

  const { formatted, cursorOffset } = result;
  const delta = cursorOffset - selectionRange[0];
  if (formatted !== sourceString)
    // TODO would want to specify a preferred element
    vitrail.applyChanges([
      {
        from: 0,
        to: sourceString.length,
        insert: formatted,
        selectionRange: [selectionRange[0] + delta, selectionRange[1] + delta],
      },
    ]);
}
