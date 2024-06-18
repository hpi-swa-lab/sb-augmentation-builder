import { languageFor } from "../core/languages.js";
import { SBBlock, SBNode, extractType } from "../core/model.js";
import { useMemo, useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  metaexec,
  type,
  all,
  replace,
  first,
  debugIt,
  query,
  queryDeep,
} from "../sandblocks/query-builder/functionQueries.js";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { ModelEditor, Vitrail, VitrailPane } from "../vitrail/vitrail.ts";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

function NodeList({ container, view, style, wrap, add }) {
  const nodes = container.childBlocks;
  view ??= (it: SBNode, ref, onmouseleave, onmousemove) =>
    h(VitrailPane, { nodes: [it], ref, onmouseleave, onmousemove });
  wrap ??= (it) => h("div", { style: { display: "flex" } }, it);
  add ??= (position, ref, onclick, onmouseleave) =>
    h(
      "div",
      {
        ref,
        onclick,
        onmouseleave,
        style: {
          width: "1rem",
          height: "1rem",
          background: "#555",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: "1",
          color: "#fff",
          cursor: "pointer",
          position: position ? "fixed" : "static",
          top: position?.[1],
          left: position?.[0],
        },
      },
      "+",
    );
  style = { display: "flex", flexDirection: "column", ...style };

  return wrap(
    nodes.length === 0
      ? add(null, null, () => container.insert("'a'", "expression", 0))
      : nodes.map((it, index) =>
          h(_NodeListItem, {
            onInsert: (atEnd) =>
              container.insert("'a'", "expression", index + (atEnd ? 1 : 0)),
            node: it,
            view,
            add,
          }),
        ),
  );
}

function _NodeListItem({ onInsert, node, view, add }) {
  const hoverStart = useSignal(false);
  const hoverEnd = useSignal(false);
  const showAddPoint = useSignal(null);
  const ref = useRef();
  const addRef = useRef();

  useSignalEffect(() => {
    if (hoverStart.value || hoverEnd.value) {
      const rect = ref.current.getBoundingClientRect();
      showAddPoint.value = [
        rect.x,
        rect.y + rect.height * (hoverStart.value ? 0.05 : 0.95),
      ];
    } else {
      showAddPoint.value = null;
    }
  });

  const hideAdd = () => {
    hoverEnd.value = false;
    hoverStart.value = false;
  };

  return [
    showAddPoint.value &&
      add(showAddPoint.value, addRef, () => onInsert(hoverEnd.value), hideAdd),
    view(
      node,
      ref,
      (e) => {
        const box = ref.current.getBoundingClientRect();
        hoverStart.value = e.clientY < box.top + box.height * 0.1;
        hoverEnd.value = e.clientY > box.top + box.height * 0.9;
      },
      (e) => {
        if (addRef.current && addRef.current.contains(e.relatedTarget)) return;
        hideAdd();
      },
    ),
  ];
}

query("let a = {examples: []}", extractType("pair"));

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

export const augmentationBuilder = {
  matcherDepth: 4,
  model: languageFor("javascript"),
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      type("object"),
      replace(capture),
      all(
        [objectField("matcherDepth"), capture("depth")],
        [objectField("model"), capture("model")],
        [objectField("match"), capture("match")],
        [objectField("view"), capture("view")],
        [
          first(
            [
              queryOrCreate(
                "let a = {examples: [$_array]}",
                extractType("pair"),
              ),
              (it) => it.array,
            ],
            // [ queryDeep("let a = {examples: $value}", extractType("pair")), (it) => it.value, ],
          ),
          capture("examples"),
        ],
      ),
    ]),
  view: ({ examples, nodes: [node] }) => {
    const augmentation = useMemo(
      () => eval(`const a = ${node.sourceString}; a`),
      [node.sourceString],
    );

    return h(
      "div",
      { style: { display: "flex", border: "1px solid #333" } },
      h("div", {}, "Augmentation", h(VitrailPane, { nodes: [node] })),
      h(
        "table",
        { style: { width: 400 } },
        h(
          "tr",
          { style: { height: "1rem" } },
          h("td", {}, "Examples"),
          h("td", {}, "Preview"),
        ),
        h(NodeList, {
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
};

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
    debugger;
    this.parent.insert(this.template.sourceString, this.template.type, 0);
    this.editor.insertTextFromCommand(position, text);
  }

  replaceTextFromCommand(
    range: [number, number],
    text: string,
    intentDeleteNodes?: SBNode[],
  ) {
    this.editor.replaceTextFromCommand(range, text, intentDeleteNodes);
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
