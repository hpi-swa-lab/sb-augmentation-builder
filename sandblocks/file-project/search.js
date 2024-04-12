import { render, h } from "../../view/widgets.js";
import { List } from "../list.js";
import { useState, useMemo } from "../../external/preact-hooks.mjs";
import { openComponentInWindow } from "../window.js";
import { FileEditor } from "./file-editor.js";

function Search({ project, onClose }) {
  const items = useMemo(() => project.allSources, [project]);
  const [selected, setSelected] = useState(items[0]);

  return [
    h(
      "style",
      {},
      `
    	sb-search {
          position: absolute;
          top: 0;
          width: 500px;
          margin-left: -200px;
          left: 50%;
          z-index: 10000;
          background: #f5f5f5;
          color: #000;
          padding: 0.25rem;
          border-radius: 0.25rem;
          white-space: nowrap;
          user-select: none;
          font-family: monospace;
          line-height: 1.5;
          box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
          border: 1px solid #aaa;
        }
    `,
    ),
    h(List, {
      items,
      labelFunc: (a) => a.path.slice(project.path.length + 1),
      selected,
      setSelected,
      fuzzy: true,
      height: "400px",
      onConfirm: (item) => {
        onClose();
        openComponentInWindow(FileEditor, { project, path: item.path });
      },
    }),
  ];
}

customElements.define(
  "sb-search",
  class extends HTMLElement {
    project;
    constructor() {
      super();
    }
    connectedCallback() {
      render(
        h(Search, { project: this.project, onClose: () => this.remove() }),
        this,
      );
      this.querySelector("[focusable]").focus();
      this.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.remove();
        }
      });
    }
  },
);
