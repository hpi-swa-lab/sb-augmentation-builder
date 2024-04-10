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

export default function Preview({ previewCode }) {
  let evaledCode = null;

  //const test = eval(
  //  "function test() {\nconst x = 'test'\nreturn html`<div>${x}</div>`\n}\ntest()",
  //);

  try {
    evaledCode = eval(previewCode);
  } catch (error) {
    console.error(error);
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
      <h1>Preview</h1>
      <div>
        <div id="root"></div>
      </div>
    </div>
  `;
}
