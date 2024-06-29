import { h } from "../external/preact.mjs";
import {
  all,
  first,
  metaexec,
  query,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { Codicon } from "../view/widgets.js";
import {
  VitrailPaneWithWhitespace,
  useValidateNoError,
} from "../vitrail/vitrail.ts";
import { choose } from "./window.js";
import { createPlaceholder } from "../vitrail/placeholder.ts";
import {
  TextArea,
  bindPlainString,
  bindSourceString,
} from "../sandblocks/query-builder/bindings.ts";
import { useSignal } from "../external/preact-signals.mjs";
import { useMemo } from "../external/preact-hooks.mjs";
import { languageFor } from "../core/languages.js";

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

export const queryBuilder = (model) => ({
  matcherDepth: Infinity,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      query("metaexec($input, ($capture) => $pipeline)"),
      (it) => it.pipeline,
      capture("pipeline"),
      (it) => it.childBlocks,
      spawnArray(getPipelineStep),
      capture("steps"),
    ]),
  view: ({ steps, pipeline, nodes }) => {
    useValidateNoError(nodes);

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
          step,
          containerRef: ref,
          onmousemove,
          onmouseleave,
        }),
    });
  },
});

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
        query("spawnArray($call)"),
        (it) => it.call,
        capture("call"),
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
      h(TextArea, query),
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

function PipelineStep({ step, containerRef, onmousemove, onmouseleave }) {
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
        h(PipelineStep, { step, containerRef, onmousemove, onmouseleave }),
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
        h(PipelineStep, { step, containerRef, onmousemove, onmouseleave }),
    });

  function viewForLeaf() {
    switch (step.stepType) {
      case PipelineSteps.CAPTURE:
        return h(StepCapture, step);
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

  return h(
    "div",
    { style: { border: "1px red dotted", paddingRight: "10px" } },
    h(
      "div",
      {
        style: { display: "inline-block", padding: "0px" },
        onmouseleave,
        onmousemove,
      },
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
        h("div", { style: { display: "flex", gap: "0.25rem" } }, viewForLeaf()),
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
