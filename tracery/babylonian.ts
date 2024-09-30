import { SBNode } from "../core/model.js";
import { h } from "../external/preact.mjs";
import {
  bindPlainString,
  TextArea,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  match,
  query,
} from "../sandblocks/query-builder/functionQueries.js";
import { appendCss, evalModule } from "../utils.js";
import { useAsyncEffect } from "../view/widgets.js";
import {
  Augmentation,
  useOnChange,
  useValidateKeepNodes,
  VitrailPane,
} from "../vitrail/vitrail.ts";

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
      query(`() => ({ sbExample: $name, args: [$_args], self: $self })`),
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
    }: {
      nodes: SBNode[];
      name: any;
      self: SBNode;
      args: SBNode;
    }) => {
      useValidateKeepNodes([args, self]);

      useOnChange(async () => {
        let func = nodes[0].orParentThat(
          (n) => n.type === "function_declaration",
        );
        const name = func?.atField("name")?.text;
        if (!func || !name) return;

        try {
          await evalModule(func, (func) =>
            func.root.insert(
              `${name}(...${args.sourceString})`,
              "statement",
              9e8,
            ),
          );
        } catch (e) {}
      });

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
