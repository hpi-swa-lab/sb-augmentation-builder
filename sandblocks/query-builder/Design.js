import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";

const html = htm.bind(h);

export default function Design({ design, setDesign }) {
  return html`
    <div>
      <h1>Design</h1>
      <textarea
        width="100%"
        value=${design}
        onkeyup=${(e) => setDesign(e.target.value)}
      >
      </textarea>
    </div>
  `;
}
