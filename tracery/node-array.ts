import { SBNode } from "../core/model.js";
import { useRef } from "../external/preact-hooks.mjs";
import { useSignal, useSignalEffect } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import { Portal } from "../view/portal.ts";
import { createPlaceholder } from "../vitrail/placeholder.ts";
import { VitrailPane } from "../vitrail/vitrail.ts";

type JSX = any;

export interface NodeArrayProps<T> {
  // node that contains the items
  container: SBNode;
  // list of items, can be but don't have to be nodes
  items?: T[];
  // how to obtain a node from an item
  nodeFromItem?: (item: T) => SBNode;

  // turn an item into a view
  view?: (item: T, ref, onmousemove, onmouseleave) => JSX;
  // style applied to the default view, if used
  style?: { [prop: string]: any };

  // return source text for the item to be created, used by the default insert
  insertItem?: (index: number) => string;
  // grammar type of item to be inserted, used by the default insert
  insertType?: string;
  // first index of the item nodes in the container's childBlocks, used by the default insert
  baseIndex?: number;
  // overrides the insert action entirely, replacing the above fields
  insert?: (index: number) => Promise<void>;
  // overrides the delete action entirely
  remove?: (item: T, node: SBNode, index: number) => void;

  // create a view for the container
  wrap?: (view: JSX) => JSX;
  // create an add button
  viewInsert?: (
    position: [number, number] | null,
    ref,
    onclick,
    onmouseleave,
  ) => JSX;
  // create a remove button
  viewRemove?: (
    position: [number, number] | null,
    ref,
    onclick,
    onmouseleave,
  ) => JSX;
  // specify where the buttons are placed
  buttonPos?: ["top", "bottom"];
}

export function NodeArray<T extends object>({
  container,
  items,
  nodeFromItem,
  view,
  style,
  insertItem,
  insertType,
  insert,
  remove,
  baseIndex,
  wrap,
  viewInsert,
  viewRemove,
  buttonPos,
}: NodeArrayProps<T>) {
  buttonPos ??= ["top", "bottom"];
  nodeFromItem ??= (it) =>
    "node" in it
      ? (it.node as SBNode).orParentThat((p) => p.parent === container)
      : it;
  items ??= container.childBlocks as T[];

  style = { display: "flex", flexDirection: "column", ...style };
  insertType ??= "expression";
  insertItem ??= () => createPlaceholder(insertType);
  view ??= (it: any, ref, onmouseleave, onmousemove) =>
    h(VitrailPane, {
      nodes: [nodeFromItem(it)],
      ref,
      onmouseleave,
      onmousemove,
    });
  wrap ??= (it) => h("div", { style }, it);
  viewInsert ??= (position, ref, onclick, onmouseleave) =>
    h(
      Portal,
      { into: document.body },
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
            zIndex: 99999999,
          },
        },
        "+",
      ),
    );
  viewRemove ??= (position, ref, onclick, onmouseleave) =>
    h(
      Portal,
      { into: document.body },
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
          zIndex: 99999999,
        },
      }),
    );

  baseIndex ??=
    items.length > 0
      ? container.childBlocks.indexOf(nodeFromItem(items[0]))
      : 0;

  const _insert =
    insert ??
    (async (index: number) => {
      const item = await insertItem(baseIndex + index);
      if (item) container.insert(item, insertType, baseIndex + index);
    });
  const _remove =
    remove ??
    ((item: T, node: SBNode, index: number) => {
      if (container.childBlocks.length == 1) {
        container.removeFull();
      } else {
        while (node.parent && node.parent.id != container.id) {
          node = node.parent;
        }
        node.removeFull();
      }
    });

  return wrap(
    items.length === 0
      ? viewInsert(
          null,
          null,
          () => _insert(0),
          () => {},
        )
      : items.map((it, index) => {
          const node = nodeFromItem(it);
          return h(_NodeArrayItem, {
            onInsert: (atEnd) => _insert(index + (atEnd ? 1 : 0)),
            onRemove: () =>
              _remove(items[index], nodeFromItem(items[index]), index),
            item: it,
            key: node,
            view,
            add: viewInsert,
            remove: viewRemove,
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
      showAddPointEnd.value = [
        rect.left + rect.width - 10,
        rect.bottom - rect.height / 2,
      ];
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
    buttonPos.includes(BUTTON_PLACEMENT.TOP)
      ? showAddPointTop.value &&
        add(showAddPointTop.value, addRefTop, () => onInsert(false), hideHalo)
      : null,
    buttonPos.includes(BUTTON_PLACEMENT.BOTTOM)
      ? showAddPointBottom.value &&
        add(
          showAddPointBottom.value,
          addRefBottom,
          () => onInsert(true),
          hideHalo,
        )
      : null,
    buttonPos.includes(BUTTON_PLACEMENT.START)
      ? showAddPointStart.value &&
        add(
          showAddPointStart.value,
          addRefStart,
          () => onInsert(false),
          hideHalo,
        )
      : null,
    buttonPos.includes(BUTTON_PLACEMENT.END)
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
export const BUTTON_PLACEMENT = {
  START: "start",
  END: "end",
  TOP: "top",
  BOTTOM: "bottom",
};
