import { h } from "../external/preact.mjs";
import {
  all,
  captureAll,
  debugHistory,
  first,
  log,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { BUTTON_PLACEMENT, NodeArray } from "./node-array.ts";
import { Codicon } from "../view/widgets.js";
import {
  VitrailPane,
  VitrailPaneWithWhitespace,
  usePaneProps,
  useValidateNoError,
} from "../vitrail/vitrail.ts";
import { choose } from "./window.js";
import { createPlaceholder } from "../vitrail/placeholder.ts";
import {
  TextArea,
  bindPlainString,
  bindSourceString,
} from "../sandblocks/query-builder/bindings.ts";
import { computed, useSignal } from "../external/preact-signals.mjs";
import { useMemo } from "../external/preact-hooks.mjs";
import { languageFor } from "../core/languages.js";
import { Explorer } from "./explorer.ts";
import { outline } from "./outline.ts";

const history = computed(() => {
  //console.log(debugHistory.value.get(1));
  return debugHistory.value ? debugHistory.value : new Map();
});

const connectionHeight = "0.75rem";

async function insertItem() {
  return (
    await choose([
      { label: "Capture", text: `capture("")` },
      { label: "Mark for Replace", text: `capture("nodes")` },
      { label: "Run Code", text: `(it) => ${createPlaceholder("it")}` },
      { label: "Match Code", text: `query("")` },
      { label: "Match Type", text: `type("")` },
      { label: "Match RegEx", text: `it => //i.exec(it)` },
      { label: "Extract", text: `(it) => it.field` },
      { label: "Flow: All", text: `all([], [])` },
      { label: "Flow: First", text: `first([], [])` },
      {
        label: "Flow: Array",
        text: `spawnArray((node) => metaexec(node, (capture) => []))`,
      },
      {
        label: "Flow: Optional",
        text: `optional([(it) => it])`,
      },
      { label: "Flow: Also", text: `also([(it) => it])` },
    ])
  )?.text;
}

async function insertPipelineWithItem() {
  const test = await insertItem();
  return "[" + test + "]";
}

export const queryBuilder = (model) => {
  return {
    type: "replace" as const,
    matcherDepth: Infinity,
    model,
    rerender: () => true,
    match: (node) => {
      const res = metaexec(node, (capture) => [
        query("metaexec($input, ($capture) => $pipeline)"),
        (it) => it.pipeline,
        capture("pipeline"),
        (it) => it.childBlocks,
        spawnArray([(it) => getPipelineStep(it)]),
        capture("steps"),
      ]);
      if (res) {
        return { pipeline: res.pipeline, steps: calcIds(res.steps) };
      } else {
        return res;
      }
    },
    view: ({ steps, pipeline, nodes }) => {
      useValidateNoError(nodes);

      const { debugId } = usePaneProps();

      return h(NodeArray, {
        container: pipeline,
        items: steps,
        insertItem,
        wrap: (it) =>
          h(
            "div",
            {
              focusable: true,
              style: { display: "flex", flexDirection: "column" },
            },
            it,
          ),
        view: (step, ref, onmousemove, onmouseleave) =>
          h(PipelineStep, {
            debugId,
            step,
            containerRef: ref,
            onmousemove,
            onmouseleave,
          }),
      });
    },
  };
};

const PipelineSteps = {
  ALL: "all",
  FIRST: "first",
  FUNCTION: "function",
  PLAIN: "plain",
  SPAWN_ARRAY: "spawnArray",
  CAPTURE: "capture",
  PIPELINE: "pipeline",
  QUERY: "query",
  QUERY_DEEP: "queryDeep",
  EXTRACT: "extract",
  TYPE: "type",
  OPTIONAL: "optional",
  ALSO: "also",
};

function getPipelineStep(node) {
  return metaexec(node, (capture) => [
    capture("node"),
    first(
      [
        query("($any) => $any.$field"),
        (it) => {
          ["(", ")", "[", "]"].every(
            (elem) => !it.field.sourceString.includes(elem),
          );
        },
        bindSourceString,
        capture("field"),
        () => PipelineSteps.EXTRACT,
        capture("stepType"),
      ],
      [
        query("$type($_steps)"),
        all(
          [
            first(
              [
                (it) => it.type.text === "all",
                () => PipelineSteps.ALL,
                capture("stepType"),
              ],
              [
                (it) => it.type.text === "first",
                () => PipelineSteps.FIRST,
                capture("stepType"),
              ],
            ),
          ],
          [
            (it) => it.steps,
            (it) => it.childBlocks,
            spawnArray([(it) => getPipelineStep(it)]),
            capture("steps"),
          ],
        ),
      ],
      [
        query("capture($name)"),
        (it) => it.name,
        bindPlainString,
        capture("name"),
        () => PipelineSteps.CAPTURE,
        capture("stepType"),
      ],
      [
        first([query("type($type)")], [query("(it) => it.type === $type")]),
        (it) => it.type,
        bindPlainString,
        capture("type"),
        () => PipelineSteps.TYPE,
        capture("stepType"),
      ],
      [
        query("optional([$_steps])"),
        all(
          [(it) => it.steps, getPipelineStep, capture("steps")],
          [() => PipelineSteps.OPTIONAL, capture("stepType")],
        ),
        (_) => true,
      ],
      [
        query("also([$_steps])"),
        //log("also"),
        all(
          [(it) => it.steps, getPipelineStep, capture("steps")],
          [() => PipelineSteps.ALSO, capture("stepType")],
        ),
        (_) => true,
      ],
      [
        query("spawnArray([$_steps], (?$matchAll:false?))"),
        all(
          [(it) => it.matchAll, capture("matchAll")],
          [(it) => it.steps, getPipelineStep, capture("steps")],
          [() => PipelineSteps.SPAWN_ARRAY, capture("stepType")],
        ),
        (_) => true,
      ],
      [
        query(`queryDeep($query, (?"$_extract"?))`),
        //log("queryDeep"),
        all(
          [(it) => it.query, bindPlainString, capture("query")],
          [(it) => it.extract, capture("extract")],
        ),
        () => PipelineSteps.QUERY_DEEP,
        capture("stepType"),
      ],
      [
        query(`query($query, (?"$_extract"?))`),
        all(
          [(it) => it.query, bindPlainString, capture("query")],
          [(it) => it.extract, capture("extract")],
        ),
        () => PipelineSteps.QUERY,
        capture("stepType"),
      ],

      [
        query("spawnArray($call, (?$matchAll:false?))"),
        captureAll(capture),
        () => PipelineSteps.SPAWN_ARRAY,
        capture("stepType"),
      ],
      [
        query("[$$$steps]"),
        (it) => it.steps,
        spawnArray([(it) => getPipelineStep(it)]),
        capture("steps"),
        () => PipelineSteps.PIPELINE,
        capture("stepType"),
      ],
      [
        query("($arg) => $body"),
        () => PipelineSteps.FUNCTION,
        capture("stepType"),
      ],
      [() => PipelineSteps.PLAIN, capture("stepType")],
    ),
  ]);
}

function StepExtract({ field }) {
  return [
    h(Codicon, { name: "export", style: { marginRight: "0.25rem" } }),
    h(TextArea, field),
  ];
}

function StepFunction({ node }) {
  console.assert(node.atField("body"));
  return h(VitrailPaneWithWhitespace, {
    nodes: [node.atField("body")],
    ignoreLeft: true,
  });
}

function StepPlain({ node }) {
  return h(VitrailPaneWithWhitespace, {
    nodes: [node],
    ignoreLeft: true,
  });
}

function StepType({ type }) {
  return [h(Codicon, { name: "grabber" }), h(TextArea, type)];
}

function StepQuery({ query, extract, deep = false }) {
  const expanded = useSignal(false);

  return h(
    "div",
    {},
    h(
      "div",
      { style: { display: "flex", gap: "0.25rem" } },
      deep
        ? h(Codicon, { name: "go-to-search" })
        : h(Codicon, { name: "search" }),
      h(TextArea, {
        ...query,
        textStyle: { color: "#990000", fontStyle: "italic" },
      }),
      h(
        "div",
        {
          style: { cursor: "pointer" },
          onclick: () => (expanded.value = !expanded.value),
        },
        h(Codicon, { name: expanded.value ? "chevron-up" : "chevron-down" }),
      ),
    ),
    expanded.value && h(StepQueryInspector, { query, extract }),
  );
}

function StepQueryInspector({ query, extract }) {
  function Node({ node, depth }) {
    return [
      "  ".repeat(depth),
      h(
        "span",
        {
          style: {
            cursor: "pointer",
            textDecoration: "underline",
            fontWeight:
              extract.childBlock(0)?.text === node.type ? "bold" : "normal",
          },
          onClick: () => extract.replaceWith(`"${node.type}"`),
        },
        node.type,
      ),
      "\n",
      ...node.childBlocks.map((it) => h(Node, { node: it, depth: depth + 1 })),
    ];
  }

  const tree = useMemo(() =>
    languageFor("typescript").parseExpression(query.text),
  );
  return h("pre", {}, h(Node, { node: tree, depth: 0 }));
}

function StepCapture({ name }) {
  return [
    h(Codicon, { name: "bookmark" }),
    h(TextArea, { ...name, textStyle: { color: "#990000" } }),
  ];
}

function StepSpawnArray({ call, steps, matchAll, debugId }) {
  return [
    h(
      "div",
      {},
      h(
        "div",
        {
          style: { display: "flex" },
          onClick: () =>
            matchAll.replaceWith(matchAll.text === "true" ? "false" : "true"),
        },
        h(Codicon, {
          name: matchAll.text === "true" ? "checklist" : "list-unordered",
        }),
        matchAll.text === "true" ? " Match all" : " Process and filter all",
      ),
      call
        ? h(VitrailPane, { nodes: [call] })
        : h(PipelineStep, { step: steps, debugId }),
    ),
  ];
}

function Optional({ steps, debugId }) {
  return [
    h(
      "div",
      {},
      h(
        "div",
        {
          style: { display: "flex" },
        },
        h(Codicon, {
          name: "question",
        }),
        "Optional",
      ),
      h(PipelineStep, { step: steps, debugId }),
    ),
  ];
}

function Also({ steps, debugId }) {
  return [
    h(
      "div",
      {},
      h(
        "div",
        {
          style: { display: "flex" },
        },
        h(Codicon, {
          name: "debug-step-over",
        }),
        "Also",
      ),
      h(PipelineStep, { step: steps, debugId }),
    ),
  ];
}

function PipelineStep({
  step,
  debugId,
  containerRef,
  onmousemove,
  onmouseleave,
}) {
  // console.log("StepType");
  // console.log(step.step.stepType);
  // console.log(step);
  //console.log("DebugId in step: " + debugId);

  const first = step.node.parent.childBlocks[0]?.id == step.node.id;
  const last =
    step.node.parent.childBlocks[step.node.parent.childBlocks.length - 1]?.id ==
    step.node.id;

  if (step.stepType == PipelineSteps.FIRST) {
    return h(NodeArray, {
      container: step.node.atField("arguments"),
      items: step.steps,
      insertItem: insertPipelineWithItem,
      buttonPos: [BUTTON_PLACEMENT.START, BUTTON_PLACEMENT.END],
      wrap: (it) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              marginLeft: "0rem",
              marginRight: "1rem",
            },
            id: "outerDivFirst",
            ref: containerRef,
            onmousemove,
            onmouseleave,
          },
          h(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "row",
                marginLeft: "1rem",
                borderTop: "0px solid black",
              },
            },
            it,
          ),
          h("div", {
            style: {
              borderLeft: "2px solid black",
              height: connectionHeight,
              marginLeft: "1rem",
            },
          }),
        ),
      //h("div", {
      //  style: {
      //    marginLeft: "1rem",
      //    height:connectionHeight,
      //    borderLeft: "2px solid black",
      //  },
      //}),

      view: (step, containerRef, onmousemove, onmouseleave) => {
        const lastStep =
          step.node.parent?.childBlocks?.map((it) => it.id)[
            step.node.parent?.childBlocks?.length - 1
          ] == step.node.id;
        return h(
          "div",
          {
            style: { display: "flex", flexDirection: "column" },
            id: "pipeline",
            ref: containerRef,
            onmouseleave,
            onmousemove,
          },
          h(PipelineStep, {
            debugId,
            step,
            containerRef,
            onmousemove,
            onmouseleave,
          }),
          h("div", {
            style: {
              flexGrow: 1,
              height: connectionHeight,
              borderLeft: "2px solid black",
              marginLeft: "1rem",
            },
          }),
          !lastStep
            ? h("div", { style: { borderBottom: "2px solid black" } })
            : h("div", {
                style: {
                  borderBottom: "2px solid black",
                  width: "calc(1rem + 1px)",
                },
              }),
        );
      },
    });
  }

  if (step.stepType == PipelineSteps.ALL) {
    return h(NodeArray, {
      container: step.node.atField("arguments"),
      items: step.steps,
      insertItem: insertPipelineWithItem,
      buttonPos: [BUTTON_PLACEMENT.START, BUTTON_PLACEMENT.END],
      wrap: (it) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              marginLeft: "1rem",
              marginRight: "1rem",
              //borderTop: "2px solid black",
            },
          },
          it,
        ),
      view: (step, containerRef, onmousemove, onmouseleave) =>
        h(
          "div",
          {
            ref: containerRef,
            onmouseleave,
            onmousemove,
          },
          h(PipelineStep, {
            debugId,
            step,
            containerRef,
            onmousemove,
            onmouseleave,
          }),
        ),
    });
  }

  if (step.stepType == PipelineSteps.PIPELINE)
    return h(NodeArray, {
      container: step.node,
      items: step.steps,
      insertItem,
      wrap: (it) =>
        h(
          "div",
          {
            style: { display: "flex", flexDirection: "column" },
            ref: containerRef,
            onmousemove,
            onmouseleave,
          },
          last
            ? h("div", {
                style: {
                  borderTop: "2px solid black",
                  height: "0px",
                  width: first ? "0rem" : "1rem",
                },
              })
            : h("div", {
                style: {
                  borderTop: "2px solid black",
                  height: "0px",
                },
              }),
          first && last
            ? null
            : h("div", {
                style: {
                  borderLeft: "2px solid black",
                  marginLeft: "1rem",
                  height: connectionHeight,
                },
              }),
          it,
        ),
      view: (step, containerRef, onmousemove, onmouseleave) =>
        h(PipelineStep, {
          debugId,
          step,
          containerRef,
          onmousemove,
          onmouseleave,
        }),
    });

  function viewForLeaf() {
    switch (step.stepType) {
      case PipelineSteps.CAPTURE:
        return h(StepCapture, step);
      case PipelineSteps.SPAWN_ARRAY:
        return h(StepSpawnArray, { ...step, debugId });
      case PipelineSteps.EXTRACT:
        return h(StepExtract, step);
      case PipelineSteps.FUNCTION:
        return h(StepFunction, step);
      case PipelineSteps.PLAIN:
        return h(StepPlain, step);
      case PipelineSteps.QUERY:
        return h(StepQuery, step);
      case PipelineSteps.QUERY_DEEP:
        return h(StepQuery, { ...step, deep: true });
      case PipelineSteps.TYPE:
        return h(StepType, step);
      case PipelineSteps.OPTIONAL:
        return h(Optional, { ...step, debugId });
      case PipelineSteps.ALSO:
        return h(Also, { ...step, debugId });
      default:
        return h(VitrailPaneWithWhitespace, {
          nodes: [step.node],
          ignoreLeft: true,
        });
    }
  }

  const actions = (obj, path) => {
    const a: { label: string; action: () => void }[] = [];

    if (path === "/" && Array.isArray(obj))
      a.push({
        label: "Iterate",
        action: () =>
          step.node.insertAfter("spawnArray((node) => [])", "expression"),
      });

    if (path === "//type")
      a.push({
        label: "Assert This Type",
        action: () =>
          step.node.insertAfter(`(it) => it.type === "${obj}"`, "expression"),
      });

    let childIndex = path.match(/\/\/children\/(\d+)/);
    if (childIndex) {
      a.push({
        label: `Child at index ${childIndex[1]}`,
        action: () =>
          step.node.insertAfter(
            `(it) => it.children[${childIndex[1]}]`,
            "expression",
          ),
      });
      if (obj.field)
        a.push({
          label: `Child at field "${obj.field}"`,
          action: () =>
            step.node.insertAfter(
              `(it) => it.atField("${obj.field}")`,
              "expression",
            ),
        });
    }

    if (path.match(/\/\/[^\/]+/)) {
      a.push({
        label: "Extract",
        action: () =>
          step.node.insertAfter(
            `(it) => it.${path.slice(2).replace("/", ".")}`,
            "expression",
          ),
      });
    }

    return a;
  };
  const debugObjectExists =
    history.value.has(debugId) &&
    history.value
      .get(debugId)
      .map((it) => JSON.stringify(it.id))
      .includes(JSON.stringify(step.id));
  const debugObject = history.value
    .get(debugId)
    ?.find((elem) => JSON.stringify(elem.id) == JSON.stringify(step.id))?.it;
  return h(
    "div",
    { style: { border: "0px red dotted", paddingRight: "10px" } },
    h(
      "div",
      {
        style: { display: "inline-block", padding: "0px" },
        onmouseleave,
        onmousemove,
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          {
            ref: containerRef,
            style: {
              border: "2px solid black",
              display: "inline-block",
              padding: "0.25rem",
            },
          },
          //h("div", {}, step.id ? `id: ${step.id.toString()}` : "NO ID"),

          h(
            "div",
            { style: { display: "flex", gap: "0.25rem" } },
            viewForLeaf(),
          ),
        ),
        debugObjectExists
          ? h(
              "div",
              {
                style: {
                  border: !debugObject ? "2px solid red" : "2px solid green",
                  display: "inline-block",
                  textAlign: !debugObject ? "center" : "left",
                  padding: "0.25rem",
                },
              },
              debugObject
                ? debugObject === true
                  ? "✅"
                  : h(Explorer, {
                      obj: debugObject,
                      allCollapsed: true,
                      actionsForItem: async (obj, path) => {
                        const list = actions(obj, path);
                        if (list.length > 0) (await choose(list))?.action();
                      },
                    })
                : objectToString(debugObject, 2, true),
            )
          : null,
      ),
    ),
    !last
      ? h("div", {
          style: {
            borderLeft: "2px solid black",
            marginLeft: "1rem",
            height: connectionHeight,
          },
        })
      : null,
  );
}

export function objectToString(
  obj,
  depth = 1,
  first = false,
  hidePrivate = true,
) {
  if (obj == null) {
    return "❌";
  }

  if (obj == true) {
    return "✅";
  }

  if (Array.isArray(obj)) {
    return (
      "[" + obj.map((it) => objectToString(it, depth, first, hidePrivate)) + "]"
    );
  }

  if (obj.sourceString !== undefined) {
    return obj.sourceString;
  }

  if (obj.toString() != "[object Object]") {
    return obj.toString();
  }

  const keys = Object.keys(obj)
    .filter((key) => (hidePrivate ? key[0] != "_" : true))
    .filter((key) => key != "id");

  return (
    (keys.length > 1 && !first ? "(" : "") +
    keys
      .map((key) =>
        depth > 0
          ? `${key}: ${objectToString(obj[key], depth - 1)}`
          : `${key}: ${
              obj[key].sourceString === undefined
                ? obj[key]
                : obj[key].sourceString
            }`,
      )
      .map((string) => string + ", ")
      .toString()
      .slice(0, -2) +
    (keys.length > 1 && !first ? ")" : "")
  );
}

function calcIds(pipeline, start = []) {
  if (pipeline) {
    let index = 0;
    pipeline.forEach((step) => {
      step["id"] = [...start, index];
      if (step.stepType == PipelineSteps.ALSO) {
        //debugger;
      }
      if (
        [
          PipelineSteps.ALL,
          PipelineSteps.FIRST,
          PipelineSteps.PIPELINE,
        ].includes(step.stepType)
      ) {
        calcIds(step.steps, step["id"]);
      }

      if (
        [
          PipelineSteps.SPAWN_ARRAY,
          PipelineSteps.ALSO,
          PipelineSteps.OPTIONAL,
        ].includes(step.stepType) &&
        step.steps
      ) {
        step.steps["id"] = [...start, index, 0];
        calcIds(step.steps.steps, step.steps["id"]);
      }
      index++;
    });
    return pipeline;
  } else {
    return pipeline;
  }
}
