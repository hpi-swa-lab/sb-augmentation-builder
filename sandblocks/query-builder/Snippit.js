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

function findMatchingNodes(root, nodeClicked, type) {
  //console.log(root._type + " == " + type);
  if (root != null && Object.hasOwn(root, "_type") && root._type == type) {
    nodeClicked(root._id);
  }

  if (root != null && Object.hasOwn(root, "_children")) {
    root._children.forEach((child) => {
      findMatchingNodes(child, nodeClicked, type);
    });
  }
}

export default function Snippit({
  code,
  tree,
  selectedNodes,
  nodeClicked,
  query,
}) {
  useEffect(() => {
    //console.log("Search for: " + query);
    findMatchingNodes(tree, nodeClicked, query);
  }, [tree, query]);

  const SingleNode = ({ node, nodeSelected, nodeClicked }) => {
    const bg_color = nodeSelected ? "coral" : "white";

    return html`<div
      style=${{ display: "flex", "background-color": bg_color }}
      onClick=${() => {}}
    >
      <p
        style=${{
          "margin-top": "0px",
          "margin-bottom": "0px",
        }}
      >
        ${node._type}
      </p>
      <p
        style=${{
          color: "LightGray",
          "margin-left": "10px",
          "margin-top": "0px",
          "margin-bottom": "0px",
        }}
      >
        (id: ${node._id})
      </p>
    </div>`;
  };

  const TreeNode = ({ node, depth, nodeClicked, selectedNodes }) => {
    const margin = depth == 0 ? "0px" : "30px";

    if (node._children != null) {
      return html` <div
        style=${{
          "margin-left": margin,
          "margin-top": "0px",
          "margin-bottom": "0px",
        }}
      >
        <${SingleNode}
          node=${node}
          nodeSelected=${selectedNodes.has(node._id)}
          nodeClicked=${nodeClicked}
        />
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
        return html`<pre>${line}</pre>`;
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
