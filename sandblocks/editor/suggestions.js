import { effect, signal } from "../../external/preact-signals-core.mjs";
import { clamp, getSelection } from "../../utils.js";
import { html, icon, render, useReRender } from "../../view/widgets.js";

function Suggestions({ items, active, root, use }) {
  const reRender = useReRender();

  effect(() => {
    const item = active.value;
    if (item && !item.detail && item.fetchDetail && !item.fetchingDetail) {
      item.fetchingDetail = true;
      item.fetchDetail().then((detail) => {
        item.detail = detail;
        reRender();
      });
    }
  });

  effect(() => {
    // got to read the value to ensure the correct subscription, since we
    // otherwise are only implicitly accessing the active element though the
    // DOM.
    active.value;

    // scroll to entry
    const entry = root.querySelector(".active");
    if (entry) {
      const rect = entry.getBoundingClientRect();
      const parentRect = entry.parentElement.getBoundingClientRect();
      if (rect.top < parentRect.top) {
        entry.scrollIntoView({ block: "start" });
      } else if (rect.bottom > parentRect.bottom) {
        entry.scrollIntoView({ block: "end" });
      }
    }
  });

  return items.value.map((item) => {
    const isActive = item === active.value;
    return html`<div
      class="${isActive ? "active" : ""}"
      onClick=${() => use(item)}
    >
      ${icon(item.icon ?? "code")} ${item.label ?? item.insertText}
      ${isActive &&
      html`<span class="detail" title=${item.detail}>
        ${item.detail?.replace(/\n/g, " ")}
      </span>`}
    </div>`;
  });
}

customElements.define(
  "sb-suggestions",
  class extends HTMLElement {
    active = signal(null);
    items = signal([]);
    anchor = signal(null);

    connectedCallback() {
      render(
        html`<${Suggestions}
          items=${this.items}
          active=${this.active}
          root=${this}
          use=${(i) => this.use(i)}
        />`,
        this,
      );
    }

    // node selection in the editor changed
    onSelectionChange(selected) {
      if (selected !== this.anchor.value) this.remove();
    }

    canMove(delta) {
      const index = this.items.value.indexOf(this.active.value);
      if (index === -1) return false;
      return index + delta >= 0 && index + delta < this.items.value.length;
    }

    moveSelected(delta) {
      const index = this.items.value.indexOf(this.active.value);
      if (index === -1) return;
      const newIndex = clamp(index + delta, 0, this.items.value.length - 1);
      this.active.value = this.items.value[newIndex];
    }

    clear() {
      this.active.value = null;
      this.items.value = [];
      this.remove();
    }

    use(item) {
      item ??= this.active.value;
      if (item.use) item.use(this.anchor.value.node);
      else this.anchor.value.node.replaceWith(item.insertText ?? item.label);
    }

    add(view, list) {
      if (list.length === 0) return;

      this.anchor.value = view;
      this.items.value = [...this.items.value, ...list];

      const index = this.items.value.indexOf(this.active.value);
      this.active.value =
        this.items.value[clamp(index, 0, this.items.value.length - 1)];

      this.show();
    }

    show() {
      const rect =
        getSelection().getRangeAt(0).getClientRects()[0] ??
        this.anchor.value.getBoundingClientRect();
      this.style.top = `${rect.bottom + 5}px`;
      this.style.left = `${rect.left}px`;
      document.body.appendChild(this);
    }
  },
);
