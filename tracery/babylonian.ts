import { languageFor } from "../core/languages.js";
import { SBNode } from "../core/model.js";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  bindPlainString,
  TextArea,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  also,
  debugIt,
  first,
  languageSpecific,
  match,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import { appendCss, evalModule } from "../utils.js";
import { useDebouncedEffect } from "../view/widgets.js";
import {
  Augmentation,
  useOnChange,
  useValidateKeepNodes,
  VitrailPane,
} from "../vitrail/vitrail.ts";
import { Process } from "./host.js";

appendCss(`.babylonian-param > .cm-editor, textarea.babylonian-param {
  border-radius: 0.4rem;
  color: #000;
}`);

export const babylonian = (model) =>
  <Augmentation<any>>{
    type: "replace" as const,
    name: "babylonian-example",
    model,
    match: match((capture) => [
      first(
        [
          languageSpecific(
            [languageFor("javascript"), languageFor("typescript")],
            query(`() => ({ sbExample: $name, args: [$_args], self: $self })`),
            also([
              () => (n) => n.type === "function_declaration",
              capture("funcSelector"),
            ]),
            also([
              () => async (name: string, func: SBNode, args: SBNode) =>
                await evalModule(func, (func) =>
                  func.root.insert(
                    `${name}(...${args.sourceString})`,
                    "statement",
                    9e8,
                  ),
                ),
              capture("runModule"),
            ]),
          ),
        ],
        [
          languageSpecific(
            [languageFor("python")],
            query(
              `lambda: { "sbExample": $name, "args": [$_args], "self": $self }`,
            ),
            also([
              () => (n) => n.type === "function_definition",
              capture("funcSelector"),
            ]),
            also([
              () => async (name: string, func: SBNode, args: SBNode) =>
                await func.editor.materializeRewritesDuring(
                  (editor) =>
                    editor.models
                      .get(languageFor("python"))
                      .insert(
                        `${name}(*${args.sourceString})`,
                        "_statement",
                        9e8,
                      ),
                  async (editor) =>
                    await Process.complete(
                      "python",
                      [`"${editor.props.value.path}"`],
                      editor.props.value.project.path,
                    ),
                  [func],
                  undefined,
                  true,
                ),
              capture("runModule"),
            ]),
          ),
        ],
      ),
      all(
        [(it) => it.name, bindPlainString, capture("name")],
        [(it) => it.args, capture("args")],
        [(it) => it.self, capture("self")],
      ),
    ]),
    view: ({
      nodes,
      name,
      args,
      self,
      funcSelector,
      runModule,
    }: {
      nodes: SBNode[];
      name: any;
      self: SBNode;
      args: SBNode;
      funcSelector: (n: SBNode) => boolean;
      runModule: (name: string, func: SBNode, args: SBNode) => Promise<void>;
    }) => {
      const counter = useSignal(0);
      useValidateKeepNodes([args, self]);

      useDebouncedEffect(
        500,
        async () => {
          let func = nodes[0].orParentThat(funcSelector);
          const name = func?.atField("name")?.text;
          if (func && name) {
            try {
              await runModule(name, func, args);
            } catch (e) {
              console.log(e);
            }
          }
        },
        [counter.value],
      );

      useOnChange(() => counter.value++);

      return h(
        "span",
        {
          style: {
            display: "inline-block",
            background: "#333",
            color: "#fff",
            padding: "0.25rem",
            borderRadius: "0.4rem",
          },
        },
        "Example: ",
        h(TextArea, {
          ...name,
          className: "babylonian-param",
          textStyle: { padding: "4px" },
        }),
        " Self: ",
        h(VitrailPane, { nodes: [self], className: "babylonian-param" }),
        " Args: ",
        h(VitrailPane, { nodes: [args], className: "babylonian-param" }),
      );
    },
  };
