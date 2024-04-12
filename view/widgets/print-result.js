import { ToggleableMutationObserver } from "../../utils.js";
import { Widget } from "../widgets.js";

customElements.define(
  "sb-print-result",
  class extends Widget {
    connectedCallback() {
      this.style.display = "inline-block";
      this.style.padding = "0.25rem";
      this.style.background = "#333";
      this.style.color = "#fff";
      this.style.marginLeft = "0.25rem";
      this.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          this.close();
        }
      });
      this.addEventListener("click", (e) => this.close());
      this.setAttribute("contenteditable", "false");
      this.setAttribute("tabindex", "-1");
    }

    set result(value) {
      let str;
      if (value === undefined) str = "undefined";
      else if (value === null) str = "null";
      else str = value.toString();
      this.innerHTML = str;
    }

    close() {
      this.shard.focus();
      ToggleableMutationObserver.ignoreMutation(() => this.remove());
    }
  }
);
