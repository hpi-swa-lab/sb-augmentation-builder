import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";
import { editor } from "../../view/widgets.js";

const html = htm.bind(h);

export default function Design({ design }) {
  return html`
    <div style=${{ border: "1px solid black" }}>
      ${editor({
        sourceString: design.value,
        language: "javascript",
        extensions: ["base:base", "javascript:base"],
        onChange: (e) => (design.value = e),
      })}
    </div>
  `;
}
