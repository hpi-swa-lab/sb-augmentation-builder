import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";
import { editor } from "../../view/widgets.js";
import { QueryType } from "./main.js";

const html = htm.bind(h);

export default function Query({ query }) {
  return html`
    <div>
      <select
        onChange=${(e) => {
          query.value = {
            ...query.value,
            queryType: QueryType[e.target.value],
          };
        }}
        selected=${query.value.queryType}
      >
        ${Object.keys(QueryType).map((type) => {
          return html`<option value="${type}">${type}</option>`;
        })}
      </select>
      ${editor({
        sourceString: query.value.queryString,
        language: "javascript",
        extensions: ["base:base", "javascript:base"],
        onChange: (e) => {
          query.value = { ...query.value, queryString: e };
        },
      })}
    </div>
  `;
}
