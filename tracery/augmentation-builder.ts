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
import { codicon, html } from "../view/widgets.js";
import { CodeMirrorWithVitrail } from "../vitrail/codemirror6.ts";
import { ModelEditor, Vitrail, VitrailPane } from "../vitrail/vitrail.ts";
import { openNodeInWindow } from "./editor.ts";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

function NodeList({ container, items, view, style, wrap, add, remove }) {
  // console.log("container");
  // console.log(container);
  // console.log("items");
  // console.log(items);
  const nodes = items ?? container.childBlocks;
  // console.log("nodes");
  // console.log(nodes);
  // console.log("****************************************");
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
  remove ??= (position, ref, onclick, onmouseleave) => {
    //debugger;
    return h("div", {
      ref,
      onclick,
      onmouseleave,
      style: {
        width: "1rem",
        height: "1rem",
        background: "#FF0000",
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
    });
  };
  style = { display: "flex", flexDirection: "column", ...style };

  return wrap(
    nodes.length === 0
      ? add(null, null, () => container.insert("'a'", "expression", 0))
      : nodes.map((it, index) =>
          h(_NodeListItem, {
            onInsert: (atEnd) =>
              container.insert(
                "(it) => it",
                "expression",
                index + (atEnd ? 1 : 0), //Jan (I) changed this and now feels stupid
              ),
            onRemove: () => {
              let nodeToDelete = nodes[index].step.node;
              while (nodeToDelete.parent.id != container.id) {
                nodeToDelete = nodeToDelete.parent;
              }
              nodeToDelete.removeSelf();
            },
            node: it,
            view,
            add,
            remove,
          }),
        ),
  );
}

function _NodeListItem({ onInsert, onRemove, node, view, add, remove }) {
  const hoverStart = useSignal(false);
  const hoverEnd = useSignal(false);
  const hoverNode = useSignal(false);
  const showAddPointTop = useSignal(null);
  const showAddPointBottom = useSignal(null);
  const showRemovePoint = useSignal(null);

  const ref = useRef();
  const addRef = useRef();
  const removeRef = useRef();

  useSignalEffect(() => {
    //if (hoverStart.value || hoverEnd.value) {
    if (hoverNode.value) {
      const rect = ref.current.getBoundingClientRect();
      showAddPointTop.value = [rect.left + 9, rect.top - 13];
      showAddPointBottom.value = [rect.left + 9, rect.top + rect.height];
      showRemovePoint.value = [rect.left + rect.width - 10, rect.top - 5];
    } else {
      showAddPointTop.value = null;
      showRemovePoint.value = null;
      showAddPointBottom.value = null;
    }
  });

  const hideHalo = () => {
    hoverEnd.value = false;
    hoverStart.value = false;
    //hoverNode.value = false;
  };

  const hoverPadding = 100;

  return [
    showAddPointTop.value &&
      add(showAddPointTop.value, addRef, () => onInsert(false), hideHalo),
    showAddPointBottom.value &&
      add(showAddPointBottom.value, addRef, () => onInsert(true), hideHalo),
    showRemovePoint.value &&
      remove(showRemovePoint.value, removeRef, () => onRemove(), hideHalo),
    view(
      node,
      ref,
      (e) => {
        const box = ref.current.getBoundingClientRect();
        hoverStart.value = e.clientY < box.top + box.height * 0.9;
        hoverEnd.value = e.clientY > box.top + box.height * 0.1;
        //FIXME: Why does the hoverPadding has no effect?
        hoverNode.value =
          e.clientY > box.top - hoverPadding &&
          e.clientY < box.top + box.height + hoverPadding &&
          e.clientX > box.left - hoverPadding &&
          e.clientX < box.left + box.width + hoverPadding;
      },
      (e) => {
        if (addRef.current && addRef.current.contains(e.relatedTarget)) return;
        hideHalo();
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
        query("all($_STEPS)"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: getPipelineSteps(it.childBlocks),
          stepType: PipelineSteps.ALL,
        }),
      ],
      [
        query("first($_STEPS)"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: getPipelineSteps(it.childBlocks),
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
        query("[$_STEPS]"),
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
      (it) => it,
      type("object"),
      replace(capture),
      all(
        [objectField("matcherDepth"), capture("depth")],
        [
          objectField("match"),
          capture("match"),
          (it) =>
            it.findQuery("(node) => metaexec($input, ($capture) => $pipeline)"),
          (it) => ({ node: it, steps: getPipelineSteps(it.pipeline) }),
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
    const augmentation = useMemo(() => {
      try {
        eval(`const a = ${node.sourceString}; a`);
      } catch (e) {
        console.log("Failed to eval augmentation", e);
      }
    }, [node.sourceString]);
    return h(
      "div",
      { style: { display: "flex", border: "1px solid #333" }, focusable: true },
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
          container: steps.node.pipeline,
          items: steps.steps.steps,
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
  // console.log("StepType");
  // console.log(step.step.stepType);
  // console.log(step);
  return [PipelineSteps.ALL, PipelineSteps.FIRST].includes(step.step.stepType)
    ? h(NodeList, {
        container: step.step.node,
        items: step.step.steps.steps,
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
          container: step.step.node,
          items: step.step.steps.steps,
          wrap: (it) =>
            h(
              "div",
              { style: { display: "flex", flexDirection: "column" } },
              h(
                "div",
                {},
                h("div", {
                  style: {
                    borderLeft: "2px solid black",
                    marginLeft: "1rem",
                    height: "2rem",
                  },
                }),
              ),
              it,
            ),
          view: (step, ref, onmousemove, onmouseleave) =>
            displayPipelineStep(step, ref, onmousemove, onmouseleave),
        })
      : h(
          "div",
          {
            id: "NodeList",
            style: { border: "1px red dotted", paddingRight: "10px" },
          },
          h(
            "div",
            {
              style: { display: "inline-block" },
              ref,
              onmouseleave,
              onmousemove,
            },
            h(
              "div",
              { style: { border: "2px solid black", display: "inline-block" } },
              h(
                "div",
                {},
                step.step.stepType === PipelineSteps.REPLACE
                  ? [
                      codicon("replace-all", {
                        fontSize: "1.75rem",
                        marginRight: "0.25rem",
                      }),
                      "Replace",
                    ]
                  : h(VitrailPane, { nodes: [step.step.node] }),
              ),
            ),
          ),
          h("div", {
            style: {
              borderLeft: "2px solid black",
              marginLeft: "1rem",
              height: "2rem",
            },
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
