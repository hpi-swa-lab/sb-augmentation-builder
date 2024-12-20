import { SBBlock, SBText } from "../core/model.js";
import { useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { appendCss, truncateString } from "../utils.js";
import { openComponentInWindow } from "./window.js";

export function openExplorer(obj, windowProps?) {
  openComponentInWindow(Explorer, { obj }, windowProps);
}

function printString(obj, maxLength = 20) {
  const print = (obj) => {
    if (obj === null) return "null";
    if (obj === undefined) return "undefined";
    if (typeof obj === "string") return `"${obj}"`;
    if (obj instanceof SBBlock) return `*${obj.type}*`;
    if (obj instanceof SBText) return `"${printString(obj.text)}"`;

    if (Array.isArray(obj))
      return `[${obj.map((o) => printString(o)).join(", ")}]`;
    if (typeof obj === "object") {
      if (!obj.constructor || obj.constructor.name === "Object")
        return `{${truncateString(
          Object.keys(obj).join(", "),
          maxLength - 5,
        )}}`;
      return `[object ${obj.constructor.name}]`;
    }
    return obj.toString();
  };

  return truncateString(print(obj), maxLength);
}

function* iterateProps(obj) {
  if (typeof obj === "string") return;
  if (obj instanceof SBBlock)
    return yield* ["children", "parent", "id", "field", "named", "type"];
  if (obj instanceof SBText)
    return yield* ["text", "parent", "id", "field", "range"];
  for (const key in obj) {
    yield key;
  }
}

export function Explorer({ obj, allCollapsed, actionsForItem, style }) {
  const selected = useSignal("/root");
  const expanded = useSignal(allCollapsed ? [] : ["/root"]);

  function* expandedSequence(expanded, obj, path = "/root") {
    yield path;
    if (expanded.includes(path)) {
      for (const key of iterateProps(obj)) {
        yield* expandedSequence(expanded, obj[key], path + "/" + key);
      }
    }
  }

  function nextSelection() {
    let takeNext = false;
    for (const p of expandedSequence(expanded.value, obj)) {
      if (takeNext) return p;
      if (selected.value === p) takeNext = true;
    }
    return null;
  }

  function previousSelection() {
    let last = null;
    for (const p of expandedSequence(expanded.value, obj)) {
      if (selected.value === p) return last;
      last = p;
    }
    return null;
  }

  return h(
    "div",
    {
      class: "vitrail-explorer",
      style: { overflowY: "auto", maxHeight: "100%", height: "100%", ...style },
      tabIndex: -1,
      focusable: true,
      onkeydown: (e) => {
        if (e.key === "ArrowRight") {
          if (!expanded.value.includes(selected.value))
            expanded.value = [...expanded.value, selected.value];
        } else if (e.key === "ArrowLeft") {
          if (expanded.value.includes(selected.value))
            expanded.value = [
              ...expanded.value.filter((p) => p !== selected.value),
            ];
        } else if (e.key === "ArrowDown") {
          selected.value = nextSelection() ?? selected.value;
        } else if (e.key === "ArrowUp") {
          selected.value = previousSelection() ?? selected.value;
        } else return;
        e.preventDefault();
        e.stopPropagation();
      },
    },
    h(
      "table",
      {
        style: {
          // width: "100%",
          tableLayout: "fixed",
          borderCollapse: "collapse",
        },
      },
      h(ExplorerObject, {
        obj,
        selected,
        parentPath: "",
        name: "",
        expanded,
        depth: 0,
        actionsForItem,
      }),
    ),
  );
}

appendCss(`
.vitrail-explorer tr:hover {
  background: #eee;
}`);

function ExplorerObject({
  obj,
  selected,
  name,
  parentPath,
  expanded,
  depth,
  actionsForItem,
}) {
  const path = parentPath + "/" + name;
  const isExpanded = expanded.value.includes(path);
  const ref = useRef();

  useSignalEffect(() => {
    if (selected.value === path)
      ref.current?.scrollIntoView({ block: "nearest" });
  });

  const children: any[] = [];
  let hasChildren = false;
  if (isExpanded) {
    if (obj.sourceString) {
      children.push(
        h(ExplorerObject, {
          obj: obj.sourceString,
          selected,
          name: "sourceString",
          parentPath: path,
          expanded,
          depth: depth + 1,
          actionsForItem,
        }),
      );
    }
    for (const key of iterateProps(obj)) {
      hasChildren = true;
      children.push(
        h(ExplorerObject, {
          obj: obj[key],
          selected,
          name: key,
          parentPath: path,
          expanded,
          depth: depth + 1,
          actionsForItem,
        }),
      );
    }
  } else {
    for (const _ of iterateProps(obj)) {
      hasChildren = true;
      break;
    }
  }

  return [
    h(
      "tr",
      {
        ref,
        style: selected.value === path ? { background: "#ccc" } : {},
        onclick: () => (selected.value = path),
        oncontextmenu: (e) => {
          e.preventDefault();
          actionsForItem?.(obj, path);
        },
      },
      h(
        "td",
        {
          style: {
            whiteSpace: "nowrap",
            maxWidth: "250px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            paddingRight: "0.25rem",
          },
        },
        h("span", {
          style: { width: depth * 1.5 + "rem", display: "inline-block" },
        }),
        h(
          "span",
          {
            onClick: () =>
              (expanded.value = isExpanded
                ? [...expanded.value.filter((p) => p !== path)]
                : [...expanded.value, path]),
            style: { margin: "0 0.1rem", cursor: "pointer" },
          },
          h(
            "span",
            {
              style: {
                width: "1rem",
                display: "inline-block",
                color: "rgba(0, 0, 0, 0.3)",
              },
            },
            hasChildren ? (isExpanded ? "▼" : "▶") : "|",
          ),
        ),
        name,
      ),
      h(
        "td",
        {
          style: {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        },
        printString(obj),
      ),
    ),
    ...children,
  ];
}
