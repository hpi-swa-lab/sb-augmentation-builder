import { useState } from "../../external/preact-hooks.mjs";
import { mapSeparated } from "../../utils.js";
import { h } from "../widgets.js";
import { Shard } from "../../core/replacement.js";

// Note: needs a parent with .sb-insert-button-container css class
export function ShardArray({ elements, onInsert }) {
  let i = 0;
  const nextProps = () => {
    let index = i++;
    return { key: `insert-${i}`, onClick: () => onInsert(index) };
  };

  return [
    h(AddButton, nextProps()),
    mapSeparated(
      elements,
      (c) => h(DeletableNode, { node: c, key: c?.id }, h(Shard, { node: c })),
      () => h(AddButton, nextProps()),
    ),
    elements.length > 0 && h(AddButton, nextProps()),
  ];
}

export function AddButton({ onClick, right }) {
  return h(
    "span",
    { class: "sb-insert-button-anchor" },
    h(
      "button",
      { onClick, class: `sb-insert-button ${right ? "right" : ""}` },
      "+",
    ),
  );
}

export function InsertList({ elements, view, onInsert }) {
  return mapSeparated(elements, view, () =>
    h(AddButton, { onClick: onInsert }),
  );
}

export function DeletableNode({ node, children }) {
  const [hover, setHover] = useState(false);
  return h(
    "span",
    {
      onmouseenter: () => setHover(true),
      onmouseleave: () => setHover(false),
      class: "sb-deletable-shard",
    },
    children,
    hover &&
      h(
        "button",
        {
          class: "sb-delete-button",
          onClick: () => node.removeFull(),
          title: "Delete",
        },
        "x",
      ),
  );
}
