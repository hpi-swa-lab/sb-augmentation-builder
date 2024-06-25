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
  query,
  debugIt,
  spawnArray,
  log,
} from "../sandblocks/query-builder/functionQueries.js";
import { html } from "../view/widgets.js";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { ModelEditor, Vitrail, VitrailPane } from "../vitrail/vitrail.ts";
import { openNodeInWindow } from "./editor.ts";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

function NodeList({ container, view, style, wrap, add }) {
  console.log("container");
  console.log(container);
  const nodes = Array.isArray(container) ? container : container.childBlocks;
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

const PipelineSteps = {
  ALL: "all",
  FIRST: "first",
  FUNCTION: "function",
  SPAWN_ARRAY: "spawnArray",
  CAPTURE: "capture",
  PIPELINE: "pipeline",
  QUERY: "query",
  REPLACE: "replace",
  TYPE: "type",
  OTHER: "other",
};

function getPipelineStep(node) {
  return metaexec(node, (capture) => [
    first(
      [
        query("($any) => $STEP"),
        (it) => it.STEP,
        (it) => ({ node: it, stepType: PipelineSteps.FUNCTION }),
      ],
      [
        query("all($$$STEPS)"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: getPipelineSteps(it),
          stepType: PipelineSteps.ALL,
        }),
      ],
      [
        query("first($$$STEPS)"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: getPipelineSteps(it),
          stepType: PipelineSteps.FIRST,
        }),
      ],
      [
        query("capture($NAME)"),
        (it) => it.NAME,
        (it) => ({ node: it, stepType: PipelineSteps.CAPTURE }),
      ],
      [
        query("query($QUERY)"),
        (it) => it.QUERY,
        (it) => ({ node: it, stepType: PipelineSteps.QUERY }),
      ],
      [
        query("replace($REPLACE)"),
        (it) => it.REPLACE,
        (it) => ({ node: it, stepType: PipelineSteps.REPLACE }),
      ],
      [
        query("type($TYPE)"),
        (it) => it.TYPE,
        (it) => ({ node: it, stepType: PipelineSteps.TYPE }),
      ],
      [
        query("spawnArray($CALL)"),
        (it) => it.CALL,
        (it) => ({ node: it, stepType: PipelineSteps.FUNCTION }),
      ],
      [
        query("[$$$STEPS]"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: getPipelineSteps(it),
          stepType: PipelineSteps.PIPELINE,
        }),
      ],
      [
        (it) => ({
          node: it,
          stepType: PipelineSteps.OTHER,
        }),
      ],
    ),
    capture("step"),
  ]);
}

function getPipelineSteps(node) {
  return metaexec(node, (capture) => [
    first([(it) => Array.isArray(it)], [(it) => it.childBlocks]),
    spawnArray((it) => getPipelineStep(it)),
    capture("steps"),
  ]);
}

(window as any).languageFor = languageFor;
export const augmentationBuilder = (model) => ({
  matcherDepth: 8,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      type("object"),
      replace(capture),
      all(
        [objectField("matcherDepth"), capture("depth")],
        [
          objectField("match"),
          capture("match"),
          (it) =>
            it.findQuery("(node) => metaexec($input, ($capture) => $pipeline)"),
          (it) => getPipelineSteps(it.pipeline),
          (it) => it.steps,
          capture("steps"),
        ],
        [objectField("view"), capture("view")],
        [
          queryOrCreate("let a = {examples: [$_array]}", extractType("pair")),
          (it) => it.array,
          capture("examples"),
        ],
      ),
    ]),
  view: ({ steps, examples, nodes: [node] }) => {
    const augmentation = useMemo(
      () => eval(`const a = ${node.sourceString}; a`),
      [node.sourceString],
    );
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
              openNodeInWindow(node, {
                fetchAugmentations: () => [augmentationBuilder(node.language)],
              }),
          },
          "Open",
        ),
        h(NodeList, {
          container: steps,
          wrap: (it) =>
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              it,
            ),
          view: (step, ref, onmousemove, onmouseleave) =>
            displayPipelineStep(step, ref, onmousemove, onmouseleave),
        }),
        //h(VitrailPane, { nodes: [node] }),
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
});

function displayPipelineStep(step, ref, onmousemove, onmouseleave) {
  return [PipelineSteps.ALL, PipelineSteps.FIRST].includes(step.step.stepType)
    ? h(NodeList, {
        container: step.step.steps.steps,
        wrap: (it) =>
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "row",
                marginLeft: "1rem",
                marginRight: "1rem",
                borderTop: "2px solid black",
              },
              id: step.step.stepType,
            },
            it,
          ),
        view: (step) =>
          displayPipelineStep(step, ref, onmousemove, onmouseleave),
      })
    : step.step.stepType == PipelineSteps.PIPELINE
      ? h(NodeList, {
          container: step.step.steps.steps,
          wrap: (it) =>
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              h("div", {
                style: {
                  borderLeft: "2px solid black",
                  marginLeft: "1rem",
                  height: "2rem",
                },
              }),
              it,
            ),
          view: (step, ref, onmousemove, onmouseleave) =>
            displayPipelineStep(step, ref, onmousemove, onmouseleave),
        })
      : h(
          "div",
          {
            id: "NodeList",
            style: { border: "0px red dotted", paddingRight: "10px" },
          },
          h(
            "div",
            { style: { border: "2px solid black", display: "inline-block" } },
            h(VitrailPane, { nodes: [step.step.node] }),
          ),
          h("div", {
            style: {
              borderLeft: "2px solid black",
              marginLeft: "1rem",
              height: "2rem",
            },
            ref,
            onmouseleave,
            onmousemove,
          }),
        );
}

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
