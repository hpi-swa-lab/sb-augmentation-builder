import { languageFor } from "../core/languages.js";
import { SBBlock, SBNode, extractType } from "../core/model.js";
import { useMemo } from "../external/preact-hooks.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  metaexec,
  type,
  all,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { ModelEditor, Vitrail, VitrailPane } from "../vitrail/vitrail.ts";
import { openNodesInWindow } from "./editor.ts";
import { openBrowser } from "./browser.ts";
import { FileProject } from "./project.js";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

function queryOrCreate(query, extract) {
  return (it) => {
    const match = it.findQuery(query, extract);
    if (match) return match;

    const n = extract(
      it.language.removeQueryMarkers(it.language.parseExpression(query)),
    );
    n._editor = new MaybeEditor(it.editor, it, n);
    n._language = it.language;
    return n.findQuery(query, extract);
  };
}

export async function openNewAugmentation(
  project: FileProject,
  example: string,
  node: SBNode,
) {
  const name = prompt("Name of the augmentation");
  const template = `import { languageFor } from "../core/languages.js";
import { metaexec, all, } from "../sandblocks/query-builder/functionQueries.js";

export const ${name} = {
  matcherDepth: Infinity,
  model: languageFor("${node.language.name}"),
  examples: [${JSON.stringify(example)}],
  match: (it) => metaexec(it, (capture) => []),
  view: ({ nodes }) => h("div", {}, "Augmentation"),
  rerender: () => true,
}`;
  await project.createFile(name + ".ts", template);
  openBrowser(project, {
    initialSelection: {
      topLevel: name,
      path: project.path + "/" + name + ".ts",
    },
  });
}

(window as any).languageFor = languageFor;
export const augmentationBuilder = (model) => ({
  matcherDepth: 8,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      type("object"),
      all(
        [objectField("matcherDepth"), capture("depth")],
        [objectField("match"), capture("match")],
        [objectField("view"), capture("view")],
        [
          queryOrCreate("({examples: [$_array]})", extractType("pair")),
          (it) => it.array,
          capture("examples"),
        ],
      ),
    ]),
  view: ({ examples, nodes: [node] }) => {
    const augmentation = useMemo(() => {
      try {
        return eval(`const a = ${node.sourceString}; a`);
      } catch (e) {
        console.log("Failed to eval augmentation", e);
      }
    }, [node.sourceString]);
    return h(
      "div",
      { style: { display: "flex", border: "1px solid #333" } },
      h(
        "div",
        {},
        "Augmentation",
        h(
          "button",
          {
            onClick: () =>
              openNodesInWindow([node], {
                fetchAugmentations: () => [augmentationBuilder(node.language)],
              }),
          },
          "Open",
        ),
        h(VitrailPane, { nodes: [node] }),
      ),
      h(
        "table",
        { style: { width: 400 } },
        h(
          "tr",
          { style: { height: "1rem" } },
          h("td", {}, "Examples"),
          h("td", {}, "Preview"),
        ),
        h(NodeArray, {
          container: examples,
          wrap: (it) => it,
          view: (it, ref, onmousemove, onmouseleave) => {
            const e = bindPlainString(it);
            return h(
              "tr",
              { ref, onmousemove, onmouseleave },
              h("td", {}, h(TextArea, { ...e, style: { width: "100%" } })),
              h(
                "td",
                {},
                h(CodeMirrorWithVitrail, {
                  // FIXME currently destroys and recreates the entire editor.
                  // can we do it incrementally?
                  key: node.sourceString,
                  value: e.text,
                  augmentations: [augmentation],
                }),
              ),
            );
          },
        }),
      ),
    );
  },
});

class MaybeEditor implements ModelEditor {
  editor: Vitrail<any>;
  parent: SBBlock;
  template: SBBlock;

  constructor(editor: Vitrail<any>, parent: SBBlock, template: SBBlock) {
    this.editor = editor;
    this.parent = parent;
    this.template = template;
  }

  // TODO
  transaction(cb: () => void): void {}

  insertTextFromCommand(position: number, text: string) {
    this.parent.insert(this.template.sourceString, this.template.type, 0);
    this.editor.insertTextFromCommand(position, text);
  }

  replaceTextFromCommand(range: [number, number], text: string, opts: any) {
    this.editor.replaceTextFromCommand(range, text, opts);
  }
}

class SBNullNode extends SBBlock {
  template: SBBlock;
  templateRoot: SBBlock;

  get type() {
    return this.template._type;
  }
  get field() {
    return this.template._field;
  }
  get range() {
    return this.template._range;
  }
  get named() {
    return this.template._named;
  }

  constructor(template: SBBlock, templateRoot?: SBBlock) {
    super();
    this.template = template;
    this.templateRoot = templateRoot ?? template;
    this._children = (template._children ?? []).map(
      (it) => new SBNullNode(it, this.templateRoot),
    );
  }
}
