import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";

const html = htm.bind(h);

export default function Query({ query, setQuery }) {
  return html`
    <div>
      <h1>Query</h1>
      <textarea
        width="100%"
        value=${query}
        onChange=${(e) => setQuery(e.target.value)}
      >
      </textarea>
    </div>
  `;
}
