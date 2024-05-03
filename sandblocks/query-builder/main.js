import { languageFor } from "../../core/languages.js";
import htm from "../../external/htm.mjs";
import { useComputed, useSignal } from "../../external/preact-signals.mjs";
import { h } from "../../external/preact.mjs";
import { useAsyncEffect } from "../../view/widgets.js";
import Query from "./Query.js";
import Design from "./Design.js";
import Preview from "./Preview.js";
import Tab from "./Tab.js";
import CodeCST from "./Code.js";
const html = htm.bind(h);

export const QueryType = {
  AstGrep: "astgrep",
  Type: "type",
};

export function QueryBuilder() {
  const typescript = languageFor("typescript");

  useAsyncEffect(async () => {
    await typescript.ready();
  });

  const codes = useSignal([""]);
  const pos = useSignal(0);
  const design = useSignal("");
  const currentlySelectedCode = useComputed(() => codes.value[pos.value]);
  const tree = useComputed(() => {
    try {
      return typescript.parseSync(currentlySelectedCode.value);
    } catch (e) {
      return null;
    }
  });

  const query = useSignal({
    queryType: QueryType.AstGrep,
    queryString: "",
  });

  const selectedNodes = useComputed(() => {
    //console.log(
    //  "Updateing selected nodes for query: " + query.value.queryString,
    //);
    if (query.value.queryString == "") {
      return [];
    }
    switch (query.value.queryType) {
      case QueryType.AstGrep:
        try {
          const matches = tree.value.findQuery(query.value.queryString);
          if (matches != null) {
            return Object.keys(matches)
              .filter((x) => x != "root")
              .map((name) => matches[name]);
          } else {
            return [];
          }
        } catch (e) {
          return [];
        }
    }
  });

  const selectedNodeIDs = useComputed(() =>
    selectedNodes.value.map((node) => node.id),
  );

  return html`
    <body style=${{ height: "100%" }}>
      <div
        style=${{
          display: "flex",
          "column-gap": "10px",
          height: "100%",
        }}
      >
        <${Tab}
          title="Code"
          content=${html`<${CodeCST}
            pos=${pos}
            codes=${codes}
            tree=${tree}
            selectedNodeIDs=${selectedNodeIDs}
          />`}
        />
        <${Tab} title="Query" content=${html`<${Query} query=${query} />`} />
        <${Tab}
          title="Design"
          content=${html`<${Design} design=${design} />`}
        />
        <${Tab}
          title="Preview"
          content=${html`<${Preview}
            design=${design}
            selectedNodes=${selectedNodes}
          />`}
        />
      </div>
    </body>
  `;
}
