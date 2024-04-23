import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";
import { editor } from "../../view/widgets.js";
import Tree from "./Tree.js";
const html = htm.bind(h);

export default function CodeCST({ pos, codes, tree, selectedNodeIDs }) {
  const prevButtonClick = () => {
    pos.value = Math.max(pos.value - 1, 0);
  };

  const nextButtonClick = () => {
    if (pos == codes.value.length - 1) {
      codes.value = [...codes.value, ""];
    }
    pos.value++;
  };

  const updateCode = (newCode) => {
    codes.value = codes.value.map((code, index) => {
      if (index == pos) {
        return newCode;
      } else {
        return code;
      }
    });
  };

  const prevButton =
    pos <= 0
      ? html`<button onClick=${prevButtonClick} disabled>⬅️</button>`
      : html`<button onClick=${prevButtonClick}>⬅️</button>`;

  const nextButton =
    pos >= codes.length - 1
      ? html`<button onClick=${nextButtonClick}>➕</button>`
      : html`<button onClick=${nextButtonClick}>➡️</button>`;

  return html` <div style=${{ width: "100%", "flex-flow": "column" }}>
    <div>
      <div style=${{ display: "flex", width: "100%", flex: "0 1 auto" }}>
        ${prevButton}
        <p>${pos.value + 1} / ${codes.value.length}</p>
        ${nextButton}
      </div>
      <div style=${{ width: "100%" }}>
        ${editor({
          sourceString: codes.value[pos],
          language: "javascript",
          extensions: ["base:base", "javascript:base"],
          onChange: (e) => updateCode(e),
        })}
        ${tree.value !== null
          ? html`<${Tree} tree=${tree} selectedNodeIDs=${selectedNodeIDs} />`
          : html``}
      </div>
    </div>
  </div>`;
}
