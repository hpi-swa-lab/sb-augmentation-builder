import { languageFor } from "../../core/languages.js";
import htm from "../../external/htm.mjs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useContext,
} from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";
import { useAsyncEffect } from "../../view/widgets.js";

const html = htm.bind(h);

export function QueryBuilder() {
  const typescript = languageFor("typescript");

  useAsyncEffect(async () => {
    await typescript.ready();
    console.log(typescript.parse(`const x = 1;`));
  }, []);

  return html`<h1>Query Builder</h1>`;
}
