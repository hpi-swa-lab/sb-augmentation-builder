
import { Extension } from "../../core/extension.js";
import { openComponentInWindow } from "../../sandblocks/window.js";
import { h, replacement, useDebouncedEffect, useJSONComparedState, Component } from "../../view/widgets.js";
import { AutoSizeTextArea } from "../../view/widgets/auto-size-text-area.js";
import { cascadedConstructorShardsFor, } from "../smalltalk.js";
import { makeUUID } from "../../utils.js";
import {
  OragleAlternationModule,
  OragleLeafModule,
  OragleSequenceModule,
  OragleScriptModule,
  OragleProject,
  OragleProjectMetrics,
  OutputWindow
} from "./components.js";
import { parseSqArray, formatPrice } from "./utils.js"

// TODO: remove global state - memory leak!
const allOutputWindows = {};
const allProjects = {};

const cssLink = document.createElement("link");
cssLink.setAttribute("rel", "stylesheet");
cssLink.setAttribute("href", "extensions/oragle/oragle.css");
document.head.appendChild(cssLink);

export const base = new Extension()

  // String as a textarea: supports copy-paste without escaping
  .registerReplacement((event) => [
    (x) => x.type === "string",
    replacement(event, "oragle-string", ({ replacement }) =>
      // TODO need to translate range select requests by delimiters and escapes
      h(AutoSizeTextArea, {
        node: replacement.node,
        value: replacement.node.sourceString.slice(1, -1).replace(/''/g, "'"),
        onChange: (event) =>
          replacement.node.replaceWith(
            "'" + event.target.value.replace(/'/g, "''") + "'"
          ),
      })
    ),
  ])

  .registerReplacement((e) => [
    (x) =>
      cascadedConstructorShardsFor(x, "OragleProject", {
        // TODO @ tom: avoid naming clashes with default props (we wanted to capture instvar named 'id' or 'key' here, but it clashes with default props)
        uuid: { mode: "literal", default: makeUUID() },
        label: { prefix: "'", placeholder: "label", suffix: "'" },
        rootModule: { default: `OragleSequenceModule new uuid: '${makeUUID()}'` },
        defaultNumberOfOutputs: { mode: "literal", default: 1 },
      }),
    replacement(e, "oragle-project", ({ uuid, label, rootModule, defaultNumberOfOutputs, replacement }) => {
      const [bufferedMetrics, setMetrics] = useJSONComparedState(null);

      const projectId = uuid.get().replace(/'/g, "");

      const editorShard = replacement.editor?.children[0];
      const editorSourceString = editorShard?.sourceString;

      useDebouncedEffect(
        500,
        async () => {
          const editorShard = replacement.editor?.children[0];
          const editorSourceString = editorShard?.sourceString;

          // trim initial selector and optional pragmas
          const input = editorSourceString.replace(/^[^\s]+/, "").replace(/<[^>]+>/, "").trim();

          const promptsObj = await sqQuery(
            `| project |
              project := Compiler evaluate: '${sqEscapeString(input)}'.
              project expand.
          `,
            {
              "[]": {
                input: "input",
                defaultNumberOfOutputs: "defaultNumberOfOutputs",
                priceToGenerateOutputs: ["maxCents"],
              },
            }
          );

          const prompts = parseSqArray(promptsObj);

          const totalPrice = prompts.reduce(
            (acc, prompt) => acc + prompt.priceToGenerateOutputs.maxCents,
            0
          );

          const metrics = {
            numberOfPrompts: prompts.length,
            // single number if all prompts have the same number of outputs, otherwise `null`
            defaultNumberOfOutputs: prompts.every(
              (prompt) => prompt.defaultNumberOfOutputs === prompts[0].defaultNumberOfOutputs
            ) ? prompts[0]?.defaultNumberOfOutputs
              : null,
            totalPrice: totalPrice,
            totalPriceFormatted: formatPrice(totalPrice),
          };

          setMetrics(metrics);
        },
        [editorSourceString]
      );

      // check if we're still up-to-date
      const metrics = bufferedMetrics;

      // WORKAROUND: lifecycle of replacements is too short
      const outputWindows = allOutputWindows[projectId] ??= [];

      // Project object definition
      // TODO: Refactor this
      const project = allProjects[projectId] = {
        outputWindows: () => {
          for (let i = outputWindows.length - 1; i >= 0; i--) {
            const [component, window] = outputWindows[i];
            if (!document.body.contains(window)) {
              outputWindows.splice(i, 1);
            }
          }

          return outputWindows;
        },

        assureOutputWindow: () => {
          if (project.outputWindows().length) return;

          return project.openOutputWindow();
        },

        setIsUpdating: (isUpdating) => {
          project.outputWindows().forEach(([component, window]) => component.setIsUpdating(isUpdating));
        },

        openOutputWindow: () => {
          const [component, window] = openComponentInWindow(
            OutputWindow,
            { projectId },
            {
              doNotStartAttached: true,
              initialPosition: { x: 210, y: 10 },
              initialSize: { x: 300, y: 400 },
            }
          );
          outputWindows.push([component, window]);
          return [component, window];
        },

        updateOutputWindows: async () => {
          await Promise.all(outputWindows.map(([component, window]) => component.update()))
        },
      };

      replacement.project = project;

      return h(
        OragleProject,
        { node: replacement.node, type: "OragleProject" },
        OragleProjectMetrics({ label, project, metrics, rootModule, defaultNumberOfOutputs, replacement })
      );
    }),
  ])

  .registerReplacement((e) => [
    (x) =>
      cascadedConstructorShardsFor(x, "OragleSequenceModule", {
        uuid: { mode: "literal", default: makeUUID() },
        separator: { prefix: "'", placeholder: "separator", suffix: "'" },
        label: { prefix: "'", placeholder: "label", suffix: "'" },
        children: { mode: "array" },
      }),
    replacement(e, "oragle-sequence-module", OragleSequenceModule),
  ])

  .registerReplacement((e) => [
    (x) =>
      cascadedConstructorShardsFor(x, "OragleScriptModule", {
        uuid: { mode: "literal", default: makeUUID() },
        children: { mode: "array" },
      }),
    replacement(e, "oragle-script-module", OragleScriptModule),
  ])

  .registerReplacement((e) => [
    (x) =>
      cascadedConstructorShardsFor(x, "OragleAlternation", {
        uuid: { mode: "literal", default: makeUUID() },
        children: { mode: "array" },
      }),
    replacement(e, "oragle-alternation-module", OragleAlternationModule),
  ])

  .registerReplacement((e) => [
    (x) =>
      cascadedConstructorShardsFor(x, "OragleLeafModule", {
        uuid: { mode: "literal", default: makeUUID() },
        label: { prefix: "'", suffix: "'", placeholder: "label" },
        content: { prefix: "'", suffix: "'", placeholder: "content" },
        state: { mode: "literal", default: "#enabled" },
      }),
    replacement(e, "oragle-leaf-module", OragleLeafModule, { selectable: true }),
  ]);
