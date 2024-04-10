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
import Query from "./Query.js";
import Snippit from "./Snippit.js";
import Design from "./Design.js";
import Preview from "./Preview.js";

const html = htm.bind(h);

const CodeCST = ({ pos, setPos, snippits, addSnippit, nodeClicked }) => {
  const [addNew, setAddNew] = useState(pos == -1);
  const [newCode, setNewCode] = useState("");

  const prevButtonClick = () => {
    setAddNew(false);
    if (pos > 0) {
      setPos(pos - 1);
    }
  };

  const nextButtonClick = () => {
    if (addNew) {
      addSnippit(newCode);
      setAddNew(false);
      setNewCode("");
      setPos(pos + 1);
    } else {
      if (pos == snippits.length - 1) {
        setAddNew(true);
      } else {
        setPos(pos + 1);
      }
    }
  };

  const prevButton =
    pos <= 0 && !addNew
      ? html`<button onClick=${prevButtonClick} disabled>⬅️</button>`
      : html`<button onClick=${prevButtonClick}>⬅️</button>`;

  const nextButton = addNew
    ? html`<button onClick=${nextButtonClick}>✅</button>`
    : pos >= snippits.length - 1
      ? html`<button onClick=${nextButtonClick}>➕</button>`
      : html`<button onClick=${nextButtonClick}>➡️</button>`;

  return html` <div class="column">
    <div>
      <div style=${{ display: "flex" }}>
        <h1>Code</h1>
        ${prevButton}
        <p>${pos + 1} / ${snippits.length}</p>
        ${nextButton}
      </div>
      ${addNew
        ? html`<div>
            <h2>Add new Snippit</h2>
            <textarea
              rows="10"
              cols="50"
              value=${newCode}
              onChange=${(e) => setNewCode(e.target.value)}
            >
            </textarea>
          </div>`
        : html`<div>
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
          </div>`}
    </div>
  </div>`;
};

export function QueryBuilder() {
  const typescript = languageFor("typescript");
  const [pos, setPos] = useState(-1);
  const [snippits, setSnippits] = useState([]);
  const [query, setQuery] = useState("tree");
  const [design, setDesign] = useState("");

  useAsyncEffect(async () => {
    await typescript.ready();
  }, []);

  const nodeClicked = (id) => {
    setSnippits((snippits) =>
      snippits.map((snippit, index) => {
        if (index == pos) {
          if (snippit.selectedNodes.has(id)) {
            snippit.selectedNodes = new Set(
              [...snippit.selectedNodes].filter((x) => x !== id),
            );
          } else {
            snippit.selectedNodes = new Set([...snippit.selectedNodes, id]);
          }
        }
        return snippit;
      }),
    );
  };

  const addSnippit = (code) => {
    //const tree = typescript.parse(code);
    setSnippits((snippits) => [
      ...snippits,
      {
        code: code,
        tree: typescript.parse(code),
        selectedNodes: new Set(),
        nodeClicked: nodeClicked,
      },
    ]);
  };

  return html`
    <body>
      <div
        style=${{
          display: "flex",
          "column-gap": "20px",
        }}
      >
        <div
          style=${{
            "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
            resize: "both",
            overflow: "auto",
            padding: "16px 16px",
            border: "2px solid black",
            "border-radius": "25px",
          }}
        >
          <${CodeCST}
            pos=${pos}
            setPos=${setPos}
            snippits=${snippits}
            addSnippit=${addSnippit}
            nodeClicked=${nodeClicked}
          />
        </div>
        <div
          style=${{
            "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
            resize: "both",

            overflow: "auto",
            padding: "16px 16px",
            border: "2px solid black",
            "border-radius": "25px",
          }}
        >
          <${Query} query=${query} setQuery=${setQuery} />
        </div>
        <div
          style=${{
            "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
            resize: "both",

            overflow: "auto",
            padding: "16px 16px",
            border: "2px solid black",
            "border-radius": "25px",
          }}
        >
          <${Design} design=${design} setDesign=${setDesign} />
        </div>
        <div
          style=${{
            "box-shadow": "0 4px 8px 0 rgba(0,0,0,0.2)",
            resize: "both",

            overflow: "auto",
            padding: "16px 16px",
            border: "2px solid black",
            "border-radius": "25px",
          }}
        >
          <${Preview} previewCode=${design} />
        </div>
      </div>
    </body>
  `;
}
