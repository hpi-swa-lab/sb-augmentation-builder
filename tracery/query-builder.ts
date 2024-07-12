import { h } from "../external/preact.mjs";
import {
  all,
  captureAll,
  debugHistory,
  first,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { Codicon } from "../view/widgets.js";
import {
  VitrailContext,
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
import {
  computed,
  useComputed,
  useSignal,
} from "../external/preact-signals.mjs";
import { useContext, useMemo } from "../external/preact-hooks.mjs";
import { languageFor } from "../core/languages.js";
import { Explorer } from "./explorer.ts";

const history = computed(() => {
  //console.log(debugHistory.value.get(1));
  return debugHistory.value ? debugHistory.value : new Map();
});

async function insertItem() {
  return (
    await choose([
      { label: "Capture", text: `capture("")` },
      { label: "Mark for Replace", text: `capture("nodes")` },
      { label: "Run Code", text: `(it) => ${createPlaceholder("it")}` },
      { label: "Match Code", text: `query("")` },
      { label: "Extract", text: `(it) => it.field` },
      { label: "Flow: All", text: `all([], [])` },
      { label: "Flow: First", text: `first([], [])` },
      {
        label: "Flow: Array",
        text: `spawnArray((node) => metaexec(node, (capture) => []))`,
      },
    ])
  )?.text;
}

export const queryBuilder = (model) => {
  return {
    matcherDepth: Infinity,
    model,
    rerender: () => true,
    match: (node) => {
      const res = metaexec(node, (capture) => [
        query("metaexec($input, ($capture) => $pipeline)"),
        (it) => it.pipeline,
        capture("pipeline"),
        (it) => it.childBlocks,
        spawnArray(getPipelineStep),
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
  SPAWN_ARRAY: "spawnArray",
  CAPTURE: "capture",
  PIPELINE: "pipeline",
  QUERY: "query",
  EXTRACT: "extract",
};

function getPipelineStep(node) {
  return metaexec(node, (capture) => [
    capture("node"),
    first(
      [
        query("($any) => $any.$field"),
        (it) => it.field,
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
            spawnArray(getPipelineStep),
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
        spawnArray(getPipelineStep),
        capture("steps"),
        () => PipelineSteps.PIPELINE,
        capture("stepType"),
      ],
      [() => PipelineSteps.FUNCTION, capture("stepType")],
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
  return h(VitrailPaneWithWhitespace, {
    nodes: [node],
    ignoreLeft: true,
  });
}

function StepQuery({ query, extract }) {
  const expanded = useSignal(false);

  return h(
    "div",
    {},
    h(
      "div",
      { style: { display: "flex", gap: "0.25rem" } },
      h(Codicon, { name: "surround-with" }),
      h(TextArea, {
        ...query,
        style: { color: "#990000", fontStyle: "italic" },
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
  return [h(Codicon, { name: "bookmark" }), h(TextArea, name)];
}

function StepSpawnArray({ call, matchAll }) {
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
      h(VitrailPane, { nodes: [call] }),
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

  if ([PipelineSteps.ALL, PipelineSteps.FIRST].includes(step.stepType))
    return h(NodeArray, {
      container: step.node,
      items: step.steps,
      insertItem,
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
          },
          it,
        ),
      view: (step) =>
        h(PipelineStep, {
          debugId,
          step,
          containerRef,
          onmousemove,
          onmouseleave,
        }),
    });

  if (step.stepType == PipelineSteps.PIPELINE)
    return h(NodeArray, {
      container: step.node,
      items: step.steps,
      insertItem,
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
        return h(StepSpawnArray, step);
      case PipelineSteps.EXTRACT:
        return h(StepExtract, step);
      case PipelineSteps.FUNCTION:
        return h(StepFunction, step);
      case PipelineSteps.QUERY:
        return h(StepQuery, step);
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
          step.node.insertAfter(
            "spawnArray((node) => metaexec(node, (capture) => []))",
            "expression",
          ),
      });

    if (path.match(/\/\/[A-Za-z]+/))
      a.push({
        label: "Extract",
        action: () =>
          step.node.insertAfter(`(it) => it.${path.slice(2)}`, "expression"),
      });

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
          //h("div", {}, `id: ${step.id.toString()}`),

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
                ? h(Explorer, {
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
    h("div", {
      style: {
        borderLeft: "2px solid black",
        marginLeft: "1rem",
        height: "2rem",
      },
    }),
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
      if (
        [
          PipelineSteps.ALL,
          PipelineSteps.FIRST,
          PipelineSteps.PIPELINE,
        ].includes(step.stepType)
      ) {
        calcIds(step.steps, step["id"]);
      }
      index++;
    });
    return pipeline;
  } else {
    return pipeline;
  }
}
