import { h } from "../external/preact.mjs";
import {
  captureAll,
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
} from "../sandblocks/query-builder/bindings.ts";

async function insertItem() {
  return (
    await choose([
      { label: "Type Match", text: `type("")` },
      { label: "Function", text: `it => ${createPlaceholder("it")}` },
      { label: "Capture", text: `capture("")` },
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
          steps: spawnArray(getPipelineStep)(it.childBlocks),
          stepType: PipelineSteps.ALL,
        }),
      ],
      [
        query("first($_STEPS)"),
        (it) => it.STEPS,
        (it) => ({
          node: it,
          steps: spawnArray(getPipelineStep)(it.childBlocks),
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
          steps: spawnArray(getPipelineStep)(it.childBlocks),
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
    captureAll(capture),
  ]);
}

function PipelineStep({
  step: { stepType, node, steps },
  containerRef,
  onmousemove,
  onmouseleave,
}) {
  // console.log("StepType");
  // console.log(step.step.stepType);
  // console.log(step);
  // useValidator(step.step.node.language, step.steps.steps);

  function viewForLeaf() {
    switch (stepType) {
      case PipelineSteps.REPLACE:
        return [
          h(Codicon, {
            name: "replace-all",
            style: { marginRight: "0.25rem" },
          }),
          "Replace",
        ];
      case PipelineSteps.CAPTURE:
        return [
          h(Codicon, { name: "bookmark", style: { marginRight: "0.25rem" } }),
          h(TextArea, bindPlainString(node)),
        ];
      default:
        return h(VitrailPaneWithWhitespace, {
          nodes: [node],
          ignoreLeft: true,
        });
    }
  }

  return [PipelineSteps.ALL, PipelineSteps.FIRST].includes(stepType)
    ? h(NodeArray, {
        container: node,
        items: steps,
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
      })
    : stepType == PipelineSteps.PIPELINE
      ? h(NodeArray, {
          container: node,
          items: steps,
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
        })
      : h(
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
              h("div", {}, viewForLeaf()),
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
