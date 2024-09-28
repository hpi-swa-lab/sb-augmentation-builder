import { SBBlock, SBLanguage, SBText } from "../core/model.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { openComponentInWindow } from "./window.js";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import {
  SelectionInteraction,
  useOnSelectReplacement,
  VitrailPane,
} from "../vitrail/vitrail.ts";

type Rules = {
  [id: number]: [RegExp, (...args) => string, "replace" | "beside"];
};

class PotluckModel extends SBLanguage {
  rules: Rules;

  constructor(rules: Rules) {
    super({ name: "potluck", extensions: [], defaultExtensions: [] });
    this.rules = rules;
  }

  _parse(text, _old) {
    const root = new SBBlock("document", null, 0, text.length, true);
    for (const [id, [pattern, _]] of Object.entries(this.rules)) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text))) {
        const [fullMatch, ...captures] = match;
        const start = match.index;
        const end = start + fullMatch.length;
        const block = new SBBlock(`potluck${id}`, null, start, end, true);
        for (const c of captures) {
          const s = fullMatch.indexOf(c) + start;
          block.appendChild(new SBText(c, s, s + c.length));
        }
        root.appendChild(block);
      }
    }
    return root;
  }

  get rootRuleName() {
    return "document";
  }
}

function Potluck() {
  const source = useSignal("");
  const rules: Rules = useMemo(
    () => ({
      0: [/(\d+)g/g, (x) => parseFloat(x) * 2 + "g", "replace"],
      1: [/(\d+)mi/g, (x) => parseFloat(x) * 1.6 + "km", "replace"],
      2: [
        /(\d+)\+(\d+)/g,
        (x, y) => "=" + (parseFloat(x) + parseFloat(y)),
        "beside",
      ],
    }),
    [],
  );
  const model = useMemo(() => new PotluckModel(rules), [rules]);
  const augmentations = useMemo(
    () =>
      Object.entries(rules).map(([id, [_, transform, mode]]) => ({
        type: "replace" as const,
        model,
        match: (node) =>
          node.type === `potluck${id}`
            ? { node, captures: node.children.map((c) => c.text) }
            : null,
        matcherDepth: 1,
        selectionInteraction: SelectionInteraction.StartAndEnd,
        view: ({ node, captures }) => {
          const active = useSignal(false);
          const transformed = h(
            "div",
            {
              style: {
                background: "#333",
                color: "#fff",
                display: "inline-block",
              },
            },
            transform(...captures),
          );
          const both = h(
            "div",
            {
              style: {
                display: "inline-flex",
                flexDirection: mode === "beside" ? "row" : "column",
              },
            },
            h(VitrailPane, { nodes: [node], className: "no-padding" }),
            transformed,
          );
          useOnSelectReplacement(() => (active.value = !active.value));
          return active.value || mode === "beside" ? both : transformed;
        },
      })),
    [model, rules],
  );

  return h(
    "div",
    { style: { display: "flex" } },
    h(CodeMirrorWithVitrail, {
      fetchAugmentations: () => augmentations,
      value: source,
    }),
  );
}

export function openPotluck(props, windowProps) {
  openComponentInWindow(Potluck, props, {
    initialSize: { x: 300, y: 230 },
    ...windowProps,
  });
}
