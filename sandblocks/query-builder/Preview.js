import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";

const html = htm.bind(h);

export default function Preview({ previewCode }) {
  return html`
    <div>
      <h1>Preview</h1>
      <div
        dangerouslySetInnerHTML=${{
          __html: previewCode,
        }}
      ></div>
    </div>
  `;
}
