import htm from "../../external/htm.mjs";
import { h, render } from "../../external/preact.mjs";
import { useComputed, useSignal } from "../../external/preact-signals.mjs";

const html = htm.bind(h);

export default function Preview({ design, selectedNodes }) {
  const pos = useSignal(0);
  const node = useComputed(() => {
    if (selectedNodes.value.length > pos.value) {
      return selectedNodes.value[pos.value];
    } else {
      return null;
    }
  });

  const updatePos = (step) => {
    if (step > 0) {
      pos.value = Math.min(selectedNodes.value.length - 1, pos.value + step);
    } else {
      pos.value = Math.max(0, pos.value + step);
    }
  };

  let evaledCode = null;
  const root = document.getElementById("root");
  if (root != null) {
    try {
      console.log("Eval: " + design.value);
      evaledCode = eval("html`<div>" + design.value + "</div>`");
      render(evaledCode, root);
    } catch (error) {
      evaledCode = eval("html`<div>Invalid Input</div>`");
      render(evaledCode, root);
    }
  }

  return html`
    <div>
      <div
        style=${{
          display: "flex",
        }}
      >
        <button onClick=${() => updatePos(-1)}>⬅️</button>
        <p>${pos.value + 1}/${selectedNodes.value.length}</p>
        <button onClick=${() => updatePos(1)}>➡️</button>
      </div>
      <div>
        <div id="root"></div>
      </div>
    </div>
  `;
}
