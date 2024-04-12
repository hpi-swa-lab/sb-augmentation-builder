import "../external/preact-debug.js";
import { h, render } from "../external/preact.mjs";
import { orParentThat, parentWithTag } from "../utils.js";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../external/preact-hooks.mjs";
import { SBList } from "../core/model.js";
import htm from "../../external/htm.mjs";
import { BaseEditor } from "../core/editor.js";

export const html = htm.bind(h);
export { h, render, Component } from "../external/preact.mjs";
export { useState } from "../external/preact-hooks.mjs";
export const li = (...children) => h("li", {}, ...children);
export const ul = (...children) => h("ul", {}, ...children);
export const div = (...children) => h("div", {}, ...children);
export const el = (cls, ...children) => h("div", { class: cls }, ...children);
export const table = (...children) => h("table", {}, ...children);
export const button = (label, onclick, autofocus) =>
  h("button", { onclick, autofocus }, label);
export const tr = (...children) => h("tr", {}, ...children);
export const td = (...children) => h("td", {}, ...children);
export const icon = (name) =>
  h(
    "span",
    {
      class: "material-symbols-outlined",
      style: { fontSize: "inherit", verticalAlign: "bottom" },
    },
    name,
  );

function _Editor({ editorRef, ...props }) {
  return h("sb-editor", { ...props, ref: editorRef });
}
export const editor = ({
  extensions,
  sourceString,
  onSave,
  onChange,
  ...props
}) =>
  h(_Editor, {
    extensions: extensions?.join(" ") ?? "",
    text: sourceString ?? "",
    onsave: (e) => onSave?.(e.detail),
    onchange: (e) => onChange?.(e.detail),
    ...props,
  });

export const useDebouncedEffect = (ms, fn, deps) => {
  useEffect(() => {
    let timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  }, deps);
};

export const useAsyncEffect = (fn, deps) => {
  useEffect(() => {
    fn();
  }, deps);
};
export const useLocalState = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    const current = localStorage.getItem(key);
    if (current && current !== "undefined") return JSON.parse(current);
    return initialValue;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [value]);
  return [value, setValue];
};

/** Normal useState uses Object.is() for comparing values. Here we can provide a custom comparer instead. This is helpful when values are deep objects that should be compared deeply rather than by their indentity to avoid redundant state updates. */
export function useComparableState(initialState, compare) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const setComparableState = (newState) => {
    if (!compare(stateRef.current, newState)) setState(newState);
  };
  return [state, setComparableState];
}

export function useReRender() {
  const [_, setTick] = useState(0);
  return () => setTick((t) => t + 1);
}

export function useJSONComparedState(initialState) {
  return useComparableState(
    initialState,
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
}

function nextEditor(element) {
  return orParentThat(element, (p) => p instanceof BaseEditor);
}

export function markInputEditable(input) {
  if (input.hasAttribute("sb-editable")) return;

  // codemirror sets css that hides the caret
  input.style.cssText += "caret-color: black !important";
  function update() {
    nextEditor(input).onSelectionChange({
      head: { element: input, elementOffset: input.selectionStart },
      anchor: { element: input, elementOffset: input.selectionEnd },
    });
  }
  function move(forward, e) {
    e.preventDefault();
    e.stopPropagation();
    nextEditor(input).moveCursor(forward, e.shiftKey);
  }
  input.resync = update;
  input.cursorPositions = function* () {
    for (let i = 0; i <= input.value.length; i++)
      yield { element: input, elementOffset: i };
  };
  input.select = function ({ head, anchor }) {
    input.focus();
    input.selectionStart = head.elementOffset;
    input.selectionEnd = anchor.elementOffset;
  };

  input.setAttribute("sb-editable", "");
  input.addEventListener("focus", update);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && input.selectionStart === input.value.length)
      move(true, e);
    if (e.key === "ArrowLeft" && input.selectionStart === 0) move(false, e);
    // make sure it doesn't bubble up to replacements or similar
    e.stopPropagation();
  });
}

Element.prototype.cursorPositions = function* () {
  for (const child of this.children) yield* child.cursorPositions();
};

export class Widget extends HTMLElement {
  disconnectedCallback() {
    this.dispatchEvent(new Event("disconnect"));
  }

  connectedCallback() {
    this.setAttribute("contenteditable", "false");
  }

  noteProcessed(trigger, node) {
    // subclasses may perform actions here
  }

  render(vdom) {
    render(vdom, this);
  }

  get editor() {
    return orParentThat(this, (p) => p.tagName === "SB-EDITOR");
  }

  get shard() {
    return parentWithTag(this, "SB-SHARD");
  }

  // polymorphic with Block
  findTextForCursor(cursor) {
    for (const [_, shard] of this.shards) {
      const result = shard.root.findTextForCursor(cursor);
      if (result) return result;
    }
    return null;
  }

  anyTextForCursor() {
    const recurse = (n) => {
      for (const child of n.shadowRoot?.children ?? n.children) {
        if (child.tagName === "SB-TEXT") return child;
        else {
          const ret = recurse(child);
          if (ret) return ret;
        }
      }
    };
    return recurse(this);
  }
}

// can be used in place of a shard. provide a callback that will be called
// once the user starts typing in the field, in which the callback should
// add the necessary code to the source.
export function ExpandToShard({ prefix, suffix, placeholder, expandCallback }) {
  return h(
    "span",
    { style: { display: "inline-flex" } },
    prefix,
    h("input", {
      style: { border: "none" },
      placeholder,
      ref: markInputEditable,
      oninput: (e) => expandCallback(`${prefix}${e.target.value}${suffix}`),
    }),
    suffix,
  );
}

// Define a widget by providing a Preact component.
// You may either provide a shouldReRender function that is called
// whenever a trigger is processed and should return true, if we should
// re-render. Alternatively, if you do not provide a shouldReRender function,
// the component will only be rendered once, when it is first connected.
export function createWidgetPreact(
  extension,
  tag,
  component,
  shouldReRender = null,
) {
  if (!customElements.get(tag)) {
    customElements.define(
      tag,
      class extends Widget {
        connectedCallback() {
          super.connectedCallback();
          if (!shouldReRender) this.updateView({});
        }
        noteProcessed(trigger, node) {
          if (shouldReRender?.(trigger, node))
            this.updateView({ trigger, node });
        }
        updateView(props) {
          this.render(h(component, { ...props, widget: this }));
        }
      },
    );
  }
  return extension.createWidget(tag);
}

// An alternative to https://github.com/preactjs/preact-custom-element
// PreactCustomElement works by copying slotted nodes into the VDOM.
// I think we want to preserve node identity, so the below approach seems
// more promising. (Sidenote: if we want to use PreactCustomElement, we
// will need to patch its VDOM-ization to also copy the node's ownProperties).
export function registerPreactElement(name, preactComponent) {
  customElements.define(
    name,
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
      }

      connectedCallback() {
        render(
          h(preactComponent, { ...this.props, root: this }),
          this.shadowRoot,
        );
      }

      disconnectedCallback() {
        render(null, this.shadowRoot);
      }
    },
  );
}
