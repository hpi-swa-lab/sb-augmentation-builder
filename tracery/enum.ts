import { signal, useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { Codicon } from "../view/widgets.js";
export function StringEnum({ node, options, view, wrap }) {
  const dropDownVisible = useSignal(false);
  wrap ??= (it) => h("div", {}, it);
  view ??= (it) =>
    h(
      "div",
      {
        style: {
          padding: "0.5rem",
          borderBottom: "1px solid gray",
        },
      },
      it,
    );
  options ??= [];
  return wrap(
    h(
      "div",
      {
        style: {
          boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
        },
      },
      h(
        "div",
        {
          onclick: () => (dropDownVisible.value = !dropDownVisible.value),
        },
        node.sourceString.replaceAll('"', ""),
        h(Codicon, {
          name: dropDownVisible.value ? "chevron-up" : "chevron-down",
          style: { width: "1rem" },
        }),
      ),
      dropDownVisible.value
        ? options.map((option) =>
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                },
                onclick: () => {
                  node.replaceWith(`"${option}"`, "expression");
                  dropDownVisible.value = !dropDownVisible.value;
                },
              },
              view(option),
            ),
          )
        : null,
    ),
  );
}
