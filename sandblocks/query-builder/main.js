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
import Snippit from "./Snippit.js";

const html = htm.bind(h);

const CodeCST = ({ pos, setPos, snippits, addSnippit, nodeClicked }) => {
  console.log("pos: " + pos);
  console.log("sinppits.length: " + snippits.length);

  const prevButtonClick = () => {
    if (pos != 0) {
      setPos(pos - 1);
    }
  };

  const nextButtonClick = () => {
    console.log("pos: " + pos);
    console.log("length: " + snippits.length);
    if (pos >= snippits.length - 1) {
      addSnippit();
    }
    setPos(pos + 1);
  };

  const prevButton =
    pos <= 0
      ? html`<button onClick=${prevButtonClick} disabled>⬅️</button>`
      : html`<button onClick=${prevButtonClick}>⬅️</button>`;

  return html` <div class="column">
    <div>
      <div style=${{ display: "flex" }}>
        <h1>Code</h1>
        ${prevButton}
        <p>${pos + 1} / ${snippits.length}</p>
        <button onClick=${nextButtonClick}>
          ${pos >= snippits.length - 1 ? "➕" : "➡️"}
        </button>
      </div>
      ${snippits.map((snippit, index) => {
        if (index == pos) {
          return html`<${Snippit}
            code=${snippit.code}
            tree=${snippit.tree}
            grammar=${snippit.grammar}
            selectedNodes=${snippit.selectedNodes}
            nodeClicked=${nodeClicked}
          />`;
        }
      })}
    </div>
  </div>`;
};

export function QueryBuilder() {
  const typescript = languageFor("typescript");
  const [pos, setPos] = useState(-1);
  const [snippits, setSnippits] = useState([]);

  useAsyncEffect(async () => {
    await typescript.ready();
  }, []);

  const nodeClicked = (id) => {
    console.log("NodeClicked with id: " + id);
    setSnippits((snippits) =>
      snippits.map((snippit, index) => {
        console.log("index: " + index);
        console.log(snippit);
        if (index == pos) {
          if (snippit.selectedNodes.has(id)) {
            snippit.selectedNodes = new Set(
              [...snippit.selectedNodes].filter((x) => x !== id),
            );
          } else {
            snippit.selectedNodes = new Set([...snippit.selectedNodes, id]);
          }
        }
        console.log(snippit);
        return snippit;
      }),
    );
  };
  //const nodeClicked = (id) => console.log("id: " + id + " clicked");

  const addSnippit = () => {
    const tree = typescript.parse("const x = 1");
    setSnippits((snippits) => [
      ...snippits,
      {
        code: "const x = 1",
        tree: tree,
        selectedNodes: new Set(),
        nodeClicked: nodeClicked,
      },
    ]);
  };

  return html`
    <body>
      <div style="display: flex">
        <${CodeCST}
          pos=${pos}
          setPos=${setPos}
          snippits=${snippits}
          addSnippit=${addSnippit}
          nodeClicked=${nodeClicked}
        />
      </div>
    </body>
  `;
}
