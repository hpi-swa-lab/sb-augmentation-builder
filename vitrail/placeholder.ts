import { languageFor } from "../core/languages.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  first,
  languageSpecific,
  metaexec,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { markInputEditableForNode } from "../view/focus.ts";
import {
  SelectionInteraction,
  changesIntendToDeleteNode,
  useValidateKeepReplacement,
  useValidator,
} from "./vitrail.ts";

export function createPlaceholder(label: string) {
  return "__VI_PLACEHOLDER_" + label.replace(/ /g, "_");
}

export const placeholder = (model) => ({
  model,
  matcherDepth: 1,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      first([
        languageSpecific(
          ["javascript", "typescript"],
          (it) => it.type === "identifier",
          (it) => it.text.startsWith("__VI_PLACEHOLDER"),
          replace(capture),
        ),
      ]),
    ]),
  selectionInteraction: SelectionInteraction.Skip,
  view: ({ nodes, replacement }) => {
    const text = useMemo(() => nodes[0].text, []);

    useValidateKeepReplacement(replacement);
    // prevent changes after the placeholder from changing our label
    useValidator(
      languageFor("javascript"),
      (_root, _diff, changes) =>
        changesIntendToDeleteNode(changes, nodes[0]) || nodes[0].text === text,
      [nodes[0].text],
    );

    return h("input", {
      ref: markInputEditableForNode(nodes[0].range),
      placeholder: nodes[0].text
        .substring("__VI_PLACEHOLDER_".length)
        .replace(/_/g, " "),
      oninput: (e) => nodes[0].replaceWith(e.target.value, [nodes[0]]),
    });
  },
});
