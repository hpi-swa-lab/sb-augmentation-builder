import { useState, useEffect, useRef } from "../external/preact-hooks.mjs";
import { focusWithoutScroll, matchesKey, orParentThat } from "../utils.js";
import { preferences } from "../core/preferences.js";
import { h, button, registerPreactElement, render } from "../view/widgets.js";
import { List } from "./list.js";
import { getPreferenceOr } from "./preference-window.js";

preferences.set("mouseOverForFocus", true);

function wantsMouseOverFocus(e) {
  return (
    e.getAttribute("focusable") ||
    (e.tagName === "INPUT" && e.type === "text") ||
    e.tagName === "TEXTAREA"
  );
}

let globalMousePos = { x: 0, y: 0 };
document.addEventListener("mousemove", (e) => {
  globalMousePos = { x: e.clientX, y: e.clientY };
  getPreferenceOr("mouseOverForFocus") && updateFocus(e.target);
});

function updateFocus(target) {
  target ??= document.elementFromPoint(globalMousePos.x, globalMousePos.y);
  while (target?.shadowRoot) {
    const inner = target.shadowRoot.elementFromPoint(
      globalMousePos.x,
      globalMousePos.y,
    );
    if (!inner || inner === target) break;
    target = inner;
  }

  let active = document.activeElement;
  while (active?.shadowRoot) {
    const inner = active.shadowRoot.activeElement;
    if (inner) active = inner;
    else break;
  }

  const f = orParentThat(target, wantsMouseOverFocus);
  if (
    f &&
    f !== active
    //  !orParentThat(active, (p) => p === f)
  ) {
    focusWithoutScroll(f);
  }
}

export function openComponentInWindow(component, props, windowProps) {
  const window = document.createElement("sb-window");
  window.props = windowProps ?? {};
  const result = h(component, { ...props, window });
  render(result, window);
  document.body.appendChild(window);
  // HACKED: find an official way to access built component
  return [result.__c, window];
}

export function Window({
  root,
  children,
  initialTitle,
  initialPosition,
  initialSize,
  doNotStartAttached,
  fullscreen,
}) {
  initialSize ??= { x: 500, y: 200 };
  const [position, setPosition] = useState(
    initialPosition ?? {
      x: globalMousePos.x - initialSize.x / 2,
      y: globalMousePos.y - initialSize.y / 2,
    },
  );
  const [title, setTitle] = useState(initialTitle ?? "");
  const [size, setSize] = useState(initialSize);
  const [initialPlacement, setInitialPlacement] = useState(!doNotStartAttached);

  const windowRef = useRef(null);
  const okToCloseRef = useRef(() => true);

  const close = async () => {
    if (!(await okToCloseRef.current())) return;
    root.remove();
    updateFocus();
  };

  const raise = () => {
    const all = [...document.querySelectorAll("sb-window")].sort(
      (a, b) => a.style.zIndex - b.style.zIndex,
    );
    all.splice(all.indexOf(root), 1);
    all.push(root);
    all.forEach((w, i) => (w.style.zIndex = 100 + i));
  };

  useEffect(() => {
    raise();
    const focus = root.querySelector("[autofocus]");
    let position;
    if (focus) {
      focus.focus();
      const my = windowRef.current.getBoundingClientRect();
      const their = focus.getBoundingClientRect();
      position = {
        x: globalMousePos.x - (their.x - my.x) - their.width / 2,
        y: globalMousePos.y - (their.y - my.y) - their.height / 2,
      };
    } else if (initialSize.x === "auto") {
      position = {
        x: globalMousePos.x - windowRef.current.offsetWidth / 2,
        y: globalMousePos.y - windowRef.current.offsetHeight / 2,
      };
    }

    if (position) {
      setPosition({
        x: Math.max(0, position.x),
        y: Math.max(0, position.y),
      });
    }
  }, []);

  root.size = size;
  root.position = position;
  root.setTitle = setTitle;
  root.close = close;
  root.raise = raise;
  root.setOkToClose = (f) => (okToCloseRef.current = f);

  return [
    h(
      "style",
      {},
      `
.sb-window {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid #ccc;
  position: absolute;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}
.sb-window.fullscreen {
  width: 100vw !important;
  height: 100vh !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  border: none;
  box-shadow: none;
  box-sizing: border-box;
}
.sb-window.fullscreen .sb-window-bar {
  display: none;
}
.sb-window.fullscreen .sb-window-resize {
  display: none;
}

.sb-window-bar {
  background-color: #ccc;
  cursor: move;
  padding: 2px;
  display: flex;
  gap: 0.25rem;
}

.sb-window-resize {
  width: 16px;
  height: 16px;
  position: absolute;
  bottom: -8px;
  right: -8px;
  background-color: #ccc;
  cursor: nwse-resize;
}

.sb-window-resize-initial {
  width: 16px;
  height: 16px;
  position: absolute;
  left: calc(50% - 8px);
  top: calc(50% - 8px);
  cursor: nwse-resize;
  z-index: 999999999;
}

.sb-window-content {
  /* overflow: auto; */
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
}`,
    ),
    h(
      "div",
      {
        ref: windowRef,
        class: "sb-window " + (fullscreen ? "fullscreen" : ""),
        style: {
          left: position.x,
          top: position.y,
          width: size.x,
          height: size.y,
        },
        onKeyDown: (e) => {
          if (matchesKey(e, "Ctrl-e")) {
            close();
            e.preventDefault();
            e.stopPropagation();
          }
        },
        onMouseDown: raise,
      },
      [
        h(
          MoveHandle,
          {
            class: "sb-window-bar",
            startAttached: !doNotStartAttached,
            onMove: (delta) =>
              setPosition((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
          },
          [button("x", close), title],
        ),
        h("div", { class: "sb-window-content" }, children, h("slot")),
        initialPlacement &&
          h(MoveHandle, {
            class: "sb-window-resize-initial",
            onFinish: () => setInitialPlacement(false),
            onMove: (delta) =>
              setSize((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
          }),
        h(MoveHandle, {
          class: "sb-window-resize",
          onMove: (delta) =>
            setSize((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
        }),
      ],
    ),
  ];
}

registerPreactElement("sb-window", Window);

function MoveHandle({ onMove, onFinish, children, startAttached, ...props }) {
  const [moving, setMoving] = useState(startAttached ?? false);

  const lastPosRef = useRef(globalMousePos);

  useEffect(() => {
    if (moving) {
      const moveHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onMove({
          x: e.clientX - lastPosRef.current.x,
          y: +e.clientY - lastPosRef.current.y,
        });
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      };
      const upHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFinish?.();
        setMoving(false);
      };
      document.addEventListener("mousemove", moveHandler);
      document.addEventListener("mouseup", upHandler);
      // also connect a down handler to stop moving after a `startAttached`
      document.addEventListener("mousedown", upHandler);
      return () => {
        document.removeEventListener("mousemove", moveHandler);
        document.removeEventListener("mouseup", upHandler);
        document.removeEventListener("mousedown", upHandler);
      };
    }
  }, [moving]);

  return h(
    "div",
    {
      onmousedown: (e) => {
        if (e.button !== 0) return;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        setMoving(true);
      },
      ...props,
    },
    children,
  );
}

export function confirmUnsavedChanges() {
  return new Promise((resolve) => {
    openComponentInWindow(
      Dialog,
      {
        body: "Discard unsaved changes?",
        actions: [
          ["Discard", () => resolve(true), true],
          ["Cancel", () => resolve(false)],
        ],
        cancelActionIndex: 1,
      },
      { doNotStartAttached: true, initialSize: { x: "auto", y: "auto" } },
    );
  });
}

export function choose(items, labelFunc) {
  labelFunc ??= (i) => (typeof i === "string" ? i : i.label);
  return new Promise((resolve) => {
    openComponentInWindow(
      Choose,
      { items, labelFunc, resolve },
      { doNotStartAttached: true, initialSize: { x: 200, y: "auto" } },
    );
  });
}

function Choose({ items, labelFunc, resolve, window }) {
  const [selected, setSelected] = useState(items[0]);

  return h(Dialog, {
    window,
    body: h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
      h("div", {}, "Choose an item:"),
      h(
        "div",
        {},
        h(List, {
          autofocus: true,
          selected,
          setSelected,
          items,
          labelFunc,
          onConfirm: (i) => {
            window.close();
            resolve(i);
          },
          height: "10rem",
        }),
      ),
    ),
    actions: [
      ["Cancel", () => resolve(null)],
      ["Confirm", () => resolve(selected)],
    ],
    cancelActionIndex: 0,
  });
}

export function Dialog({ body, actions, cancelActionIndex, window }) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        gap: "1rem",
        padding: "1rem",
      },
      onkeydown:
        cancelActionIndex !== undefined &&
        ((e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            window.close();
            actions[cancelActionIndex][1]();
          }
        }),
    },
    [
      body,
      h(
        "div",
        {
          style: { display: "flex", gap: "1rem" },
        },
        actions.map(([label, action, autofocus]) =>
          button(
            label,
            () => {
              window.close();
              action();
            },
            autofocus,
          ),
        ),
      ),
    ],
  );
}
