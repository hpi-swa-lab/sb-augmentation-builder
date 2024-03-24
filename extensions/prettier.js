import { Extension } from "../core/extension.js";
import { ToggleableMutationObserver } from "../utils.js";

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

function extensionWith(parser, deps, config) {
  return new Extension().registerCustom(
    "preSave",
    async (editor, sourceString) => {
      const result = await tryFormat(
        sourceString,
        editor.selectionRange[0],
        editor.context.path,
        parser,
        deps,
        config,
      );
      if (result) {
        const { formatted, cursorOffset } = result;
        const delta = cursorOffset - editor.selectionRange[0];
        if (formatted !== editor.sourceString)
          ToggleableMutationObserver.ignoreMutation(() =>
            editor.applyChanges([
              {
                from: 0,
                to: editor.node.range[1],
                insert: formatted,
                selectionRange: [
                  editor.selectionRange[0] + delta,
                  editor.selectionRange[1] + delta,
                ],
              },
            ]),
          );
      }
    },
  );
}

export const javascript = extensionWith("babel", [
  "https://esm.sh/prettier@3.1.1/plugins/estree",
  "https://esm.sh/prettier@3.1.1/plugins/babel",
]);
export const typescript = extensionWith("typescript", [
  "https://esm.sh/prettier@3.1.1/plugins/estree",
  "https://esm.sh/prettier@3.1.1/plugins/typescript",
]);
