import htm from "../../external/htm.mjs";
import { h, render, createElement } from "../../external/preact.mjs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useContext,
} from "../../external/preact-hooks.mjs";

const html = htm.bind(h);

export default function Preview({ previewCode, selectedNodes }) {
  let evaledCode = null;
  const selectedNodesList = [...selectedNodes];
  const [pos, setPos] = useState(-1);

  if (pos >= selectedNodesList.length) {
    setPos(selectedNodesList.length - 1);
  }

  const updatePos = (step) => {
    if (step > 0) {
      setPos((pos) => Math.min(selectedNodesList.length - 1, pos + step));
    } else {
      setPos((pos) => Math.max(0, pos + step));
    }
  };

  let id = "no matches";
  console.log("selectedNodes:");
  console.log(selectedNodesList);

  if (selectedNodesList.length > 0) {
    id = selectedNodesList[pos];
  }

  console.log("id: " + id);
  //const selectedNodesCopy = selectedNodes;
  //const test = eval(
  //  "function test() {\nconst x = 'test'\nreturn html`<div>${x}</div>`\n}\ntest()",
  //);

  try {
    evaledCode = eval("console.log(id)\nhtml`<div>" + previewCode + "</div>`");
  } catch (error) {
    console.info(error);
    evaledCode = eval(
      "function test() {return html`<div>Invalid Input</div>`\n}\ntest()",
    );
  }

  useEffect(() => {
    const root = document.getElementById("root");
    render(evaledCode, root);
  });

  return html`
    <div>
      <div
        style=${{
          display: "flex",
        }}
      >
        <h1>Preview</h1>
        <button onClick=${() => updatePos(-1)}>⬅️</button>
        <p>${pos + 1}/${selectedNodesList.length}</p>
        <button onClick=${() => updatePos(1)}>➡️</button>
      </div>
      <div>
        <div id="root"></div>
      </div>
    </div>
  `;
}
