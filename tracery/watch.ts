import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../external/preact-hooks.mjs";
import { withSocket } from "./host.js";
import {
  all,
  debugIt,
  match,
  metaexec,
  nodesWithWhitespace,
  query,
  replace,
} from "../sandblocks/query-builder/functionQueries.js";
import { randomId } from "../utils.js";
import { h, html } from "../view/widgets.js";
import {
  Augmentation,
  SelectionInteraction,
  VitrailPane,
  useTagNode,
  useValidateKeepReplacement,
} from "../vitrail/vitrail.ts";
import { objectToString } from "./query-builder.ts";
import { SBNode } from "../core/model.js";
import { useSignal } from "../external/preact-signals.mjs";
import { Explorer } from "./explorer.ts";
import { languageFor } from "../core/languages.js";

export function wrapWithWatch(node) {
  const url = `${window.location.origin}/sb-watch`;
  const headers = `headers: {"Content-Type": "application/json"}`;
  const opts = `{method: "POST", body: JSON.stringify({id: ${randomId()}, e}), ${headers},}`;
  node.wrapWith(`["sbWatch",((e) => (fetch("${url}", ${opts}), e))(`, `),][1]`);
}

export const watch = (model) => ({
  type: "replace" as const,
  model,
  match: match((capture) => [
    query(`["sbWatch", $expression][1]`),
    (it) => it.expression,
    capture("expression"),
    nodesWithWhitespace,
    capture("expressions"),
  ]),
  matcherDepth: 15,
  view: ({ replacement, expressions, expression }) => {
    const [count, setCount] = useState(0);
    const [lastValue, setLastValue] = useState("");

    useRuntimeValues(expression, (value) => {
      setCount((c) => c + 1);
      setLastValue(objectToString(value));
    });
    useValidateKeepReplacement(replacement);

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

const jsQuery = `["viWatch", ((e) => (
  fetch("https://localhost:3000/sb-watch", {
    method: "POST",
    body: JSON.stringify({ id: $identifier, e }),
    headers: { "Content-Type": "application/json" },
  }), e))($$$expressions),][1]`;

export const invisibleWatchRewrite = (model) => ({
  name: "invisible-watch",
  type: "rewrite" as const,
  model,
  match: (node) => (node.hasTag("viWatch") ? { node } : null),
  view: ({ node }) => {
    const id = node.getTagData("viWatch");
    const port = 7921;

    if (
      node.language === languageFor("javascript") ||
      node.language === languageFor("typescript")
    ) {
      const url = `${window.location.origin}/sb-watch`;
      const headers = `headers: {"Content-Type": "application/json"}`;
      const opts = `{method: "POST", body: JSON.stringify({id: ${id}, e}), ${headers},}`;
      node.wrapWith(
        `["viWatch",((e) => (fetch("${url}", ${opts}), e))(`,
        `),][1]`,
      );
    } else if (node.language === languageFor("python")) {
      node.wrapWith(
        `(lambda e: ((lambda s: (
          s.connect(("localhost", ${port})),
          s.send(__import__("json").dumps({"id":${id},"e":e},default=str).encode()),
          s.close())
        )(__import__("socket").socket()), e))(`,
        ")[1]",
      );
    }
  },
});

export function useRuntimeValues(node: SBNode, onValue: (value: any) => void) {
  const id = useMemo(() => randomId(), []);

  useTagNode(node, "viWatch", id);
  useEffect(() => {
    (window as any).sbWatch.registry.set(id, onValue);
    return () => (window as any).sbWatch.registry.delete(id);
  }, [id, onValue]);
}

export const testLogs = (model) =>
  <Augmentation<any>>{
    name: "test-logs",
    type: "insert" as const,
    insertPosition: "end",
    match: (node) =>
      metaexec(node, (capture) => [
        query("console.log($expression, $$$rest)"),
        (it) => it.expression,
        replace(capture),
      ]),
    matcherDepth: 3,
    model,
    view: ({ nodes }) => {
      const lastValue = useSignal("");
      useRuntimeValues(nodes[0], (v) => (lastValue.value = v));
      return lastValue.value
        ? h(Explorer, {
            obj: lastValue.value,
            style: { display: "inline-block" },
          })
        : null;
    },
  };

withSocket((socket) =>
  socket.on("sb-watch", ({ id, e }) => (window as any).sbWatch(e, id)),
);
(window as any).sbWatch = function (value, id) {
  (window as any).sbWatch.registry.get(id)?.(value);
  return value;
};
(window as any).sbWatch.registry = new Map();
