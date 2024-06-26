import { h } from "../external/preact.mjs";
import {
  captureAll,
  debugIt,
  first,
  metaexec,
  query,
  replace,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { NodeArray } from "./node-array.ts";
import { Codicon } from "../view/widgets.js";
import { VitrailPane } from "../vitrail/vitrail.ts";

export const queryBuilder = (model) => ({
  matcherDepth: 8,
  model,
  rerender: () => true,
  match: (node) =>
    metaexec(node, (capture) => [
      replace(capture),
      (it) => it.findQuery("metaexec($input, ($capture) => $pipeline)"),
      (it) => it.pipeline,
      capture("pipeline"),
      (it) => it.childBlocks,
      spawnArray(getPipelineStep),
      capture("steps"),
    ]),
  view: ({ steps, pipeline }) => {
    return h(NodeArray, {
      container: pipeline,
      items: steps,
      wrap: (it) =>
        h("div", { style: { display: "flex", flexDirection: "column" } }, it),
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

  return [PipelineSteps.ALL, PipelineSteps.FIRST].includes(stepType)
    ? h(NodeArray, {
        container: node,
        items: steps,
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
              id: stepType,
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
          {
            id: "NodeList",
            style: { border: "1px red dotted", paddingRight: "10px" },
          },
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
                style: { border: "2px solid black", display: "inline-block" },
              },
              h(
                "div",
                {},
                stepType === PipelineSteps.REPLACE
                  ? [
                      h(Codicon, {
                        name: "replace-all",
                        style: { fontSize: "1.75rem", marginRight: "0.25rem" },
                      }),
                      "Replace",
                    ]
                  : h(VitrailPane, { nodes: [node] }),
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
