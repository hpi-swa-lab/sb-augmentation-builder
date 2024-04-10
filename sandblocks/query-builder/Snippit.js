import htm from "../../external/htm.mjs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useContext,
} from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";

const html = htm.bind(h);

export default function Snippit({ code, tree, selectedNodes, nodeClicked }) {
  const TreeNode = ({ node, depth, nodeClicked, selectedNodes }) => {
    const margin = depth == 0 ? "0px" : "30px";
    const bg_color = selectedNodes.has(node._id) ? "coral" : "white";

    if (node._children != null) {
      return html` <div
        style=${{
          "margin-left": margin,
        }}
      >
        <div
          style=${{ display: "flex", "background-color": bg_color }}
          onClick=${() => nodeClicked(node._id)}
        >
          <p>${node._type}</p>
          <p style=${{ color: "LightGray", "margin-left": "10px" }}>
            (id: ${node._id})
          </p>
        </div>
        ${node._children.map(
          (child) =>
            Object.hasOwn(child, "_type") &&
            child._named &&
            !Object.hasOwn(child, "_text") &&
            html`<${TreeNode}
              node=${child}
              depth=${depth + 1}
              nodeClicked=${nodeClicked}
              selectedNodes=${selectedNodes}
            />`,
        )}
      </div>`;
    } else {
      return html``;
    }
  };

  const TreeRepresentation = ({ tree, nodeClicked, selectedNodes }) => {
    if (tree != null) {
      return html` ${tree._children.map((child) => {
        return html`<${TreeNode}
          node=${child}
          depth=${0}
          nodeClicked=${nodeClicked}
          selectedNodes=${selectedNodes}
        />`;
      })}`;
    } else {
      return html``;
    }
  };

  return html`
    <div>
      ${code.split(/\r?\n/).map((line) => {
        console.log(line);
        return html`<pre><mark>${line}</mark></pre>`;
      })}
    </div>
    <h1>CST</h1>
    <div style=${{ overflow: "auto", "max-height": "300px" }}>
      <${TreeRepresentation}
        tree=${tree}
        nodeClicked=${nodeClicked}
        selectedNodes=${selectedNodes}
      />
    </div>
  `;
}
