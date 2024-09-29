import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "../external/preact-hooks.mjs";
import { socket, withSocket } from "./host.js";
import {
  all,
  debugIt,
  metaexec,
  nodesWithWhitespace,
  query,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { randomId } from "../utils.js";
import { h, html } from "../view/widgets.js";
import {
  Augmentation,
  VitrailPane,
  useValidateKeepReplacement,
} from "../vitrail/vitrail.ts";
import { objectToString } from "./query-builder.ts";
import { SBNode } from "../core/model.js";

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
        [(it) => it.expressions, nodesWithWhitespace, capture("expressions")],
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
        setLastValue(objectToString(value));
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
        margin: "0 0.15rem",
      }}
    >
      <${VitrailPane}
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

export const invisibleWatch = (model) => ({
  name: "invisible-watch",
  type: "replace" as const,
  model,
  rerender: () => true,
  match: (n) =>
    metaexec(n, (capture) => [
      replace(capture),
      query(
        `["viWatch",
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
        [(it) => it.expressions, nodesWithWhitespace, capture("expressions")],
      ),
    ]),
  matcherDepth: 15,
  view: ({ replacement, watchId, expressions }) => {
    useValidateKeepReplacement(replacement);

    useEffect(() => {
      (window as any).sbWatch.registry.set(watchId, replacement);
      replacement.reportValue = (value) => {};
      return () => {
        (window as any).sbWatch.registry.delete(watchId);
      };
    }, [replacement, watchId]);

    return h(VitrailPane, { nodes: expressions, className: "no-padding" });
  },
});

export function useRuntimeValues(node: SBNode, onValue: (value: any) => void) {
  const watchNode = useRef(null);
  const id = useMemo(() => randomId(), []);

  useEffect(() => {
    (window as any).sbWatch.registry.set(id, { reportValue: onValue });
    return () => (window as any).sbWatch.registry.delete(id);
  }, [id, onValue]);

  useEffect(() => {
    if (watchNode.current === node) return;
    queueMicrotask(() => {
      const url = `${window.location.origin}/sb-watch`;
      const headers = `headers: {"Content-Type": "application/json"}`;
      const opts = `{method: "POST", body: JSON.stringify({id: ${id}, e}), ${headers},}`;
      watchNode.current = node.wrapWith(
        `["viWatch",((e) => (fetch("${url}", ${opts}), e))(`,
        `),][1]`,
      );
    });
    return () =>
      queueMicrotask(() => watchNode.current?.replaceWith(node.sourceString));
  }, [id]);

  return watchNode.current;
}

export const testLogs = (model) => ({
  name: "test-logs",
  type: "insert" as const,
  match: (node) =>
    metaexec(node, (capture) => [
      query("console.log($expression, $$$rest)"),
      (it) => it.expression,
      replace(capture),
    ]),
  matcherDepth: 3,
  model,
  view: ({ nodes }) => {
    useRuntimeValues(nodes[0], (v) => console.log(v));
    return h("span", {}, "Log");
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
