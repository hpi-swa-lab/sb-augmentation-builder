import { SBNode } from "../core/model.js";
import { useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { createPlaceholder } from "../vitrail/placeholder.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";

export function NodeArray({
  container,
  items,
  nodeFromItem,
  view,
  style,
  insertItem,
  baseIndex,

  wrap,
  add,
  remove,
  buttonPos = ["top", "bottom"],
}) {
  nodeFromItem ??= (it) =>
    it?.node ? it.node.orParentThat((p) => p.parent === container) : it;
  items ??= container.childBlocks;

  style = { display: "flex", flexDirection: "column", ...style };
  insertItem ??= () => createPlaceholder("expression");
  view ??= (it: any, ref, onmouseleave, onmousemove) =>
    h(VitrailPane, {
      nodes: [nodeFromItem(it)],
      ref,
      onmouseleave,
      onmousemove,
    });
  wrap ??= (it) => h("div", { style }, it);
  add ??= (position, ref, onclick, onmouseleave) =>
    h(
      "div",
      {
        ref,
        onclick,
        onmouseleave,
        style: {
          width: "1rem",
          height: "1rem",
          background: "#555",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: "1",
          color: "#fff",
          cursor: "pointer",
          position: position ? "fixed" : "static",
          top: position?.[1],
          left: position?.[0],
        },
      },
      "+",
    );
  remove ??= (position, ref, onclick, onmouseleave) =>
    h("div", {
      ref,
      onclick,
      onmouseleave,
      style: {
        width: "1rem",
        height: "1rem",
        background: "#FF0000",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: "1",
        color: "#fff",
        cursor: "pointer",
        position: position ? "fixed" : "static",
        top: position?.[1],
        left: position?.[0],
      },
    });

  baseIndex ??=
    items.length > 0
      ? container.childBlocks.indexOf(nodeFromItem(items[0]))
      : 0;
  const insert = async (index: number) => {
    const item = await insertItem(baseIndex + index);
    if (item) container.insert(item, "expression", baseIndex + index);
  };

  return wrap(
    items.length === 0
      ? add(null, null, () => insert(0))
      : items.map((it, index) => {
          const node = nodeFromItem(it);
          return h(_NodeArrayItem, {
            onInsert: (atEnd) => insert(index + (atEnd ? 1 : 0)),
            onRemove: () => {
              let nodeToDelete = nodeFromItem(items[index]);
              if (container.childBlocks.length == 1) {
                container.removeFull();
              } else {
                while (nodeToDelete.parent.id != container.id) {
                  nodeToDelete = nodeToDelete.parent;
                }
                nodeToDelete.removeFull();
              }
            },
            item: it,
            key: node,
            view,
            add,
            remove,
            buttonPos,
          });
        }),
  );
}

function _NodeArrayItem({
  onInsert,
  onRemove,
  item,
  view,
  add,
  remove,
  buttonPos,
}) {
  const hoverStart = useSignal(false);
  const hoverEnd = useSignal(false);
  const hoverNode = useSignal(false);
  const showAddPointTop = useSignal(null);
  const showAddPointBottom = useSignal(null);
  const showAddPointStart = useSignal(null);
  const showAddPointEnd = useSignal(null);
  const showRemovePoint = useSignal(null);

  const ref = useRef();
  const addRefTop = useRef();
  const addRefBottom = useRef();
  const addRefStart = useRef();
  const addRefEnd = useRef();
  const removeRef = useRef();

  useSignalEffect(() => {
    //if (hoverStart.value || hoverEnd.value) {
    if (hoverNode.value) {
      const rect = ref.current.getBoundingClientRect();
      showAddPointTop.value = [rect.left + 9, rect.top - 13];
      showAddPointBottom.value = [rect.left + 9, rect.top + rect.height];
      showAddPointStart.value = [rect.left - 9, rect.bottom - rect.height / 2];
      showAddPointEnd.value = [rect.right, rect.bottom - rect.height / 2];
      showRemovePoint.value = [rect.left + rect.width - 10, rect.top - 5];
    } else {
      showAddPointTop.value = null;
      showRemovePoint.value = null;
      showAddPointStart.value = null;
      showAddPointEnd.value = null;
      showAddPointBottom.value = null;
    }
  });

  const hideHalo = () => {
    hoverEnd.value = false;
    hoverStart.value = false;
    hoverNode.value = false;
  };

  //TODO: padding is useless, because onmouseleave overwrites this
  const hoverPadding = 100;

  return [
    buttonPos.includes("top")
      ? showAddPointTop.value &&
        add(showAddPointTop.value, addRefTop, () => onInsert(false), hideHalo)
      : null,
    buttonPos.includes("bottom")
      ? showAddPointBottom.value &&
        add(
          showAddPointBottom.value,
          addRefBottom,
          () => onInsert(true),
          hideHalo,
        )
      : null,
    buttonPos.includes("start")
      ? showAddPointStart.value &&
        add(
          showAddPointStart.value,
          addRefStart,
          () => onInsert(false),
          hideHalo,
        )
      : null,
    buttonPos.includes("end")
      ? showAddPointEnd.value &&
        add(showAddPointEnd.value, addRefEnd, () => onInsert(true), hideHalo)
      : null,
    showRemovePoint.value &&
      remove(showRemovePoint.value, removeRef, () => onRemove(), hideHalo),
    view(
      item,
      ref,
      (e) => {
        const box = ref.current.getBoundingClientRect();
        hoverStart.value = e.clientY < box.top + box.height * 0.9;
        hoverEnd.value = e.clientY > box.top + box.height * 0.1;
        hoverNode.value =
          e.clientY > box.top - hoverPadding &&
          e.clientY < box.top + box.height + hoverPadding &&
          e.clientX > box.left - hoverPadding &&
          e.clientX < box.left + box.width + hoverPadding;
      },
      (e) => {
        if (
          (addRefTop.current && addRefTop.current.contains(e.relatedTarget)) ||
          (addRefBottom.current &&
            addRefBottom.current.contains(e.relatedTarget)) ||
          (addRefStart.current &&
            addRefStart.current.contains(e.relatedTarget)) ||
          (addRefEnd.current && addRefEnd.current.contains(e.relatedTarget)) ||
          (removeRef.current && removeRef.current.contains(e.relatedTarget))
        )
          return;
        hideHalo();
      },
    ),
  ];
}
