import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  all,
  captureAll,
  match,
  nodesWithWhitespace,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import {
  Augmentation,
  SelectionInteraction,
  useOnSelectReplacement,
  useValidateKeepNodes,
  useValidateKeepReplacement,
  VitrailPane,
  VitrailPaneWithWhitespace,
} from "../vitrail/vitrail.ts";
import { useRuntimeValues } from "./watch.ts";

export const slider = (model) =>
  <Augmentation<any>>{
    type: "replace" as const,
    name: "slider",
    model,
    match: match((capture) => [
      query(`["slider", $min, $max, $step, $value][4]`),
      all(
        [(it) => it.min.text, parseFloat, capture("min")],
        [(it) => it.max.text, parseFloat, capture("max")],
        [(it) => it.step.text, parseFloat, capture("step")],
        [(it) => it.value, capture("value")],
      ),
    ]),
    view: ({ min, max, step, value }) => {
      return h(
        "span",
        {},
        h("input", {
          type: "range",
          min,
          max,
          step,
          value: parseFloat(value.text),
          oninput: (e) => value.replaceWith(e.target.value),
        }),
        ` (${value.text})`,
      );
    },
  };

export const color = (model) =>
  <Augmentation<any>>{
    type: "replace" as const,
    name: "color",
    model,
    match: match((capture) => [
      query(`["color", $r, $g, $b, $a]`),
      all(
        [(it) => it.r, nodesWithWhitespace, capture("r")],
        [(it) => it.g, nodesWithWhitespace, capture("g")],
        [(it) => it.b, nodesWithWhitespace, capture("b")],
      ),
    ]),
    view: ({ r, g, b, replacement }) => {
      useValidateKeepReplacement(replacement);

      const red = useSignal(0);
      const green = useSignal(0);
      const blue = useSignal(0);

      function storeNum(signal, val) {
        signal.value = isNaN(val) ? 0 : val;
      }

      useRuntimeValues(r, (val) => storeNum(red, val));
      useRuntimeValues(g, (val) => storeNum(green, val));
      useRuntimeValues(b, (val) => storeNum(blue, val));

      return h(
        "span",
        {
          style: {
            display: "inline-flex",
            padding: "0.5rem",
            borderRadius: "0.5rem",
            background: "#eee",
          },
        },
        h(
          "div",
          {},
          h("div", {}, "R:", h(VitrailPane, { nodes: r })),
          h("div", {}, "G:", h(VitrailPane, { nodes: g })),
          h("div", {}, "B:", h(VitrailPane, { nodes: b })),
        ),
        h("input", {
          style: { marginLeft: "0.25rem" },
          type: "color",
          value: `#${[red, green, blue]
            .map((v) => v.value.toString(16).padStart(2, "0"))
            .join("")}`,
          // oninput: (e) => value.replaceWith(e.target.value),
        }),
      );
    },
  };

export const spreadsheet = (model) =>
  <Augmentation<any>>{
    type: "replace" as const,
    name: "spreadsheet-value",
    model,
    selectionInteraction: SelectionInteraction.StartAndEnd,
    match: match((capture) => [
      query(`["formula", $value][1]`),
      captureAll(capture),
    ]),
    view: ({ value, replacement }) => {
      useValidateKeepReplacement(replacement);

      const expanded = useSignal(false);

      const cellValue = useSignal("<waiting>");
      useOnSelectReplacement(() => (expanded.value = !expanded.value));
      useRuntimeValues(value, (val) => (cellValue.value = val));

      return expanded.value
        ? h(VitrailPane, {
            nodes: [value],
            hostOptions: { onBlur: () => (expanded.value = false) },
          })
        : h("span", {}, cellValue.value);
    },
  };
