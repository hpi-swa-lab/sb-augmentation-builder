import { Extension } from "../core/extension.js";
import { Slot, useStickyReplacementValidator } from "../core/replacement.js";
import { useEffect, useState } from "../external/preact-hooks.mjs";
import { socket } from "../sandblocks/host.js";
import { randomId } from "../utils.js";
import { html } from "../view/widgets.js";

function makeWatchExtension(config) {
  return new Extension()
    .registerReplacement({
      query: [(x) => x.query(config.query)],
      queryDepth: config.queryDepth,
      name: "sb-watch",
      component: Watch,
    })
    .registerShortcut("wrapWithWatch", (x) => {
      let current = x;
      for (let i = 0; i < config.exprNesting; i++) current = current?.parent;

      if (current?.matches(config.query)) {
        current.viewsDo(
          (view) => view.tagName === "SB-WATCH" && (view.sticky = false),
        );
        current.replaceWith(x.sourceString);
      } else {
        config.wrap(x, randomId());
      }
    });
}

export const javascriptInline = makeWatchExtension({
  query: `sbWatch($expr, $identifier)`,
  queryDepth: 3,
  exprNesting: 2,
  wrap: (x, id) => x.wrapWith("sbWatch(", `, ${id})`),
});

export const javascript = makeWatchExtension({
  query: `["sbWatch",
    ((e) => (
      fetch("http://localhost:3000/sb-watch", {
        method: "POST",
        body: JSON.stringify({ id: $identifier, e }),
        headers: { "Content-Type": "application/json" },
      }), e))($expr),][1]`,
  exprNesting: 4,
  queryDepth: 15,
  wrap: (x, id) => {
    const url = `${window.location.origin}/sb-watch`;
    const headers = `headers: {"Content-Type": "application/json"}`;
    const opts = `{method: "POST", body: JSON.stringify({id: ${id}, e}), ${headers},}`;
    x.wrapWith(`["sbWatch",((e) => (fetch("${url}", ${opts}), e))(`, `),][1]`);
  },
});

function Watch({ replacement }) {
  const { expr, identifier } = replacement.node.exec(...replacement.query);
  const watchId = parseInt(identifier.text, 10);
  const [count, setCount] = useState(0);
  const [lastValue, setLastValue] = useState("");

  useStickyReplacementValidator(replacement);

  useEffect(() => {
    window.sbWatch.registry.set(watchId, replacement);

    replacement.reportValue = (value) => {
      setCount((c) => c + 1);
      setLastValue(value.toString());
    };

    return () => {
      window.sbWatch.registry.delete(watchId);
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
    <${Slot}
      sticky=${true}
      node=${expr}
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
}

socket?.on("sb-watch", ({ id, e }) => window.sbWatch(e, id));
window.sbWatch = function (value, id) {
  sbWatch.registry.get(id)?.reportValue(value);
  return value;
};
window.sbWatch.registry = new Map();
