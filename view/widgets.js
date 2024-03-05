import "../external/preact-debug.js";
import { h, render } from "../external/preact.mjs";
import {
  focusWithoutScroll,
  nextHash,
  orParentThat,
  parentWithTag,
  rangeEqual,
} from "../utils.js";
import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "../external/preact-hooks.mjs";
import { useMemo } from "../external/preact-hooks.mjs";
import { SBList } from "../core/model.js";
import { SandblocksExtensionInstance } from "./extension-instance.js";
import { markAsEditableElement, nodeIsEditable } from "../core/focus.js";

export { h, render, Component } from "../external/preact.mjs";
export const li = (...children) => h("li", {}, ...children);
export const ul = (...children) => h("ul", {}, ...children);
export const div = (...children) => h("div", {}, ...children);
export const el = (cls, ...children) => h("div", { class: cls }, ...children);
export const table = (...children) => h("table", {}, ...children);
export const button = (label, onclick, autofocus) =>
  h("button", { onclick, autofocus }, label);
export const tr = (...children) => h("tr", {}, ...children);
export const td = (...children) => h("td", {}, ...children);
export const shard = (node, props = {}) => {
  if (!node.editor) throw new Error("node has become disconnected");
  return h(node.editor.constructor.shardTag, {
    node,
    key: node.id,
    editor: node.editor,
    ...props,
  });
};
function StickyShard({ node, ...props }) {
  useEffect(() => {
    const editor = node.editor;
    editor.markSticky(node, true);
    return () => editor.markSticky(node, false);
  }, [node]);
  return shard(node, props);
}
export const stickyShard = (node, props = {}) =>
  h(StickyShard, { node, ...props });
export const shardList = (list) => {
  const node = new SBList(list);
  return h(node.editor.shardTag, { initNode: [node], key: node.id });
};
export const icon = (name) =>
  h(
    "span",
    {
      class: "material-symbols-outlined",
      style: { fontSize: "inherit", verticalAlign: "bottom" },
    },
    name
  );

function _Editor({ inlineExtensions, editorRef, ...props }) {
  const i = useMemo(
    () =>
      inlineExtensions?.map((e) => e.instance(SandblocksExtensionInstance)) ??
      [],
    // use array directly for content-compare
    inlineExtensions ?? []
  );
  return h("sb-editor", { ...props, inlineExtensions: i, ref: editorRef });
}
export const editor = ({
  extensions,
  sourceString,
  onSave,
  onChange,
  ...props
}) =>
  h(_Editor, {
    extensions: extensions.join(" "),
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
  const [value, setValue] = useState(localStorage.getItem(key) ?? initialValue);
  useEffect(() => {
    localStorage.setItem(key, value);
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

export function useJSONComparedState(initialState) {
  return useComparableState(
    initialState,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  );
}

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

export class Replacement extends Widget {
  shards = [];

  constructor() {
    super();
    this.hash = nextHash();
  }

  handleClick(e) {
    if (e.button === 0 && e.altKey) {
      this.uninstallAndMark();
      e.preventDefault();
      e.stopPropagation();
    } else if (
      e.button === 0 &&
      this.selectable &&
      orParentThat(e.target, (p) => nodeIsEditable(p)) === this
    ) {
      this.editor.selectRange(...this.range);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  isReplacementAllowed(tagName) {
    // only confirm that we may stay being this replacement but
    // don't allow another replacement to take our place
    return this.tagName === tagName.toUpperCase();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.handleClick);
  }

  uninstallAndMark() {
    this.uninstall((e) => e.setAllowReplacement(this.tagName, false));
  }

  uninstall(prepareCb = null) {
    const source = this.source.toHTMLExpanded();
    prepareCb?.(source);
    this.editor.changeDOM(() => this.replaceWith(source));
    return source;
  }

  update(source) {
    for (const [locator, shard] of this.shards) {
      const node = locator(source);
      if (!node) throw new Error("shard locator returned null");
      if (node !== shard.source) {
        shard.update(node);
      }
    }
  }

  get isNodeReplacement() {
    return true;
  }

  get range() {
    return this.source.range;
  }

  get node() {
    return this.source;
  }

  set node(n) {
    this.source = n;
    this.update(n);
  }

  init(source) {
    // subclasses may perform initialization here, such as creating shards
  }

  destroy(e) {
    // TODO reuse shards instead of re-creating the entire subtree by
    // passing a map of node=>view to toHTML
    e.destroyReplacement(this);
  }

  createShard(locator) {
    const shard = document.createElement("sb-shard");
    this.shards.push([locator, shard]);
    return shard;
  }

  get sourceString() {
    return this.node.sourceString;
  }

  set selectable(v) {
    if (v) {
      markAsEditableElement(this);
      this.setAttribute("sb-editable-part", "true");
      this.setAttribute("focusable", "true");
      this.setAttribute("tabindex", -1);
    }
    this._selectable = v;
  }
  get selectable() {
    return this._selectable;
  }

  // see AttachOp>>apply()
  insertNode(node, index) {}

  // selection protocol
  sbSelectRange(range, testOnly) {
    if (rangeEqual(this.range, range)) return this;
    else return null;
  }
  sbSelectedEditablePart() {
    return this.isConnected ? this : null;
  }
  sbNoteFocusChange(received) {
    this.classList.toggle("sb-replacement-selected", received);
  }
  sbSelectAtBoundary(view, delta) {
    this.focus();
    return { view: this, range: this.range };
  }
  sbIsMoveAtBoundary(delta) {
    return true;
  }
  focus() {
    this.editor.selectRange(...this.range, false);
    focusWithoutScroll(this, () => super.focus());
  }
  sbCandidateForRange(range) {
    return rangeEqual(this.range, range)
      ? {
          view: this,
          rect: this.getBoundingClientRect(),
          range: this.range,
        }
      : null;
  }
  sbUpdateRange() {}
}

function ensureReplacementTagDefined(tag) {
  if (!customElements.get(tag)) {
    customElements.define(
      tag,
      class extends Replacement {
        update(node) {
          // needs to be a stable reference, otherwise we keep rebuilding the
          // entire replacement
          this._component ??= (...args) => this.component(...args);

          if (["key", "id"].some((k) => k in (this.props ?? {})))
            throw new Error("used a prop name reserved for preact components");

          this.render(
            h(this._component, { node, replacement: this, ...this.props })
          );
        }
      }
    );
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
      ref: markAsEditableElement,
      oninput: (e) => expandCallback(`${prefix}${e.target.value}${suffix}`),
    }),
    suffix
  );
}

// Define a replacement by providing a Preact component
// instead of just the name of a custom element. Note that
// this function will define a custom element for you.
//
// The component receives the node and the replacement as props.
export function ensureReplacementPreact(
  extension,
  node,
  tag,
  component,
  props,
  options
) {
  ensureReplacementTagDefined(tag);
  extension.ensureReplacement(node, tag, { props, component, ...options });
}

// convenience wrapper around ensureReplacementPreact, can be
// placed directly in a script chain. Either takes a single node
// or a node and props tuple.
export function replacement(e, name, component, options) {
  return (args) => {
    let node, props;
    if (Array.isArray(args)) {
      node = args[0];
      props = args[1];
    } else {
      node = args;
      props = {};
    }
    return ensureReplacementPreact(e, node, name, component, props, options);
  };
}

export function installReplacementPreact(
  extension,
  node,
  tag,
  component,
  props
) {
  ensureReplacementTagDefined(tag);
  extension.installReplacement(node, tag, { props, component });
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
  shouldReRender = null
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
      }
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
          this.shadowRoot
        );
      }

      disconnectedCallback() {
        render(null, this.shadowRoot);
      }
    }
  );
}

// an empty replacement that can we use to hide elements
customElements.define("sb-hidden", class extends Replacement {});
