import { useEffect, useState } from "../external/preact-hooks.mjs";
import { socket, withSocket } from "./host.js";
import {
  all,
  debugIt,
  metaexec,
  query,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { randomId } from "../utils.js";
import { html } from "../view/widgets.js";
import {
  VitrailPaneWithWhitespace,
  useValidateKeepReplacement,
} from "../vitrail/vitrail.ts";

// function makeWatchExtension(config) {
//   return new Extension()
//     .registerReplacement({
//       query: new SBMatcher( config.model, [(x) => x.query(config.query)], config.queryDepth,),
//       name: "sb-watch",
//       component: Watch,
//     })
//     .registerShortcut("wrapWithWatch", (x) => {
//       let current = x;
//       for (let i = 0; i < config.exprNesting; i++) current = current?.parent;
//
//       if (current?.matches(config.query)) {
//         current.viewsDo(
//           (view) => view.tagName === "SB-WATCH" && (view.sticky = false),
//         );
//         current.replaceWith(x.sourceString);
//       } else {
//         config.wrap(x, randomId());
//       }
//     });
// }

// export const javascriptInline = makeWatchExtension({
//   model: languageFor("javascript"),
//   query: `sbWatch($expr, $identifier)`,
//   queryDepth: 3,
//   exprNesting: 2,
//   wrap: (x, id) => x.wrapWith("sbWatch(", `, ${id})`),
// });
//
// export const javascript = makeWatchExtension({
//   model: languageFor("javascript"),
//   exprNesting: 4,
// });

export function wrapWithWatch(node) {
  const url = `${window.location.origin}/sb-watch`;
  const headers = `headers: {"Content-Type": "application/json"}`;
  const opts = `{method: "POST", body: JSON.stringify({id: ${randomId()}, e}), ${headers},}`;
  node.wrapWith(`["sbWatch",((e) => (fetch("${url}", ${opts}), e))(`, `),][1]`);
}

export const watch = (model) => ({
  type: "replace" as const,
  model,
  rerender: () => true,
  match: (n) =>
    metaexec(n, (capture) => [
      replace(capture),
      query(
        `["sbWatch",
    ((e) => (
      fetch("https://localhost:3000/sb-watch", {
        method: "POST",
        body: JSON.stringify({ id: $identifier, e }),
        headers: { "Content-Type": "application/json" },
      }), e))($$$expressions),][1]`,
      ),
      all(
        [
          (it) => it.identifier,
          (it) => parseInt(it.text, 10),
          capture("watchId"),
        ],
        [(it) => it.expressions, capture("expressions")],
      ),
    ]),
  matcherDepth: 15,
  view: ({ replacement, watchId, expressions }) => {
    const [count, setCount] = useState(0);
    const [lastValue, setLastValue] = useState("");

    useValidateKeepReplacement(replacement);

    useEffect(() => {
      (window as any).sbWatch.registry.set(watchId, replacement);

      replacement.reportValue = (value) => {
        setCount((c) => c + 1);
        setLastValue(value.toString());
      };

      return () => {
        (window as any).sbWatch.registry.delete(watchId);
      };
    }, [replacement, watchId]);

    return html`<div
      style=${{
        padding: "0.25rem",
        background: "#333",
        display: "inline-block",
        borderRadius: "4px",
      }}
    >
      <${VitrailPaneWithWhitespace}
        nodes=${expressions}
        style=${{
          padding: "0.1rem",
          background: "#fff",
          display: "inline-block",
        }}
      />
      <div style=${{ color: "#fff", display: "flex", marginTop: "0.25rem" }}>
        <div
          style=${{
            padding: "0.1rem 0.4rem",
            marginRight: "0.25rem",
            background: "#999",
            borderRadius: "100px",
          }}
        >
          ${count}
        </div>
        ${lastValue}
      </div>
    </div>`;
  },
});

withSocket((socket) =>
  socket.on("sb-watch", ({ id, e }) => (window as any).sbWatch(e, id)),
);
(window as any).sbWatch = function (value, id) {
  (window as any).sbWatch.registry.get(id)?.reportValue(value);
  return value;
};
(window as any).sbWatch.registry = new Map();
