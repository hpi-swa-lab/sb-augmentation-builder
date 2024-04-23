import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";

const html = htm.bind(h);

export default function Tree({ tree, selectedNodeIDs }) {
  //console.log(selectedNodeIDs.value);
  const SingleNode = ({ node, nodeSelected }) => {
    //console.log("selected: " + nodeSelected);
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

  const TreeNode = ({ node, depth, selectedNodeIDs }) => {
    const margin = depth == 0 ? "0px" : "30px";
    //console.log("TreeNode:");
    //console.log(selectedNodeIDs.value);

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
          nodeSelected=${selectedNodeIDs.value.includes(node._id)}
        />
        ${node._children.map(
          (child) =>
            Object.hasOwn(child, "_type") &&
            child._named &&
            !Object.hasOwn(child, "_text") &&
            html`<${TreeNode}
              node=${child}
              depth=${depth + 1}
              selectedNodeIDs=${selectedNodeIDs}
            />`,
        )}
      </div>`;
    } else {
      return html``;
    }
  };

  const TreeRepresentation = ({ tree, selectedNodeIDs }) => {
    if (tree != null) {
      return html` ${tree.value._children.map((child) => {
        return html`<${TreeNode}
          node=${child}
          depth=${0}
          selectedNodeIDs=${selectedNodeIDs}
        />`;
      })}`;
    } else {
      return html``;
    }
  };

  return html`
    <div style=${{ overflow: "auto", width: "100%", flex: "0 1 auto" }}>
      <${TreeRepresentation} tree=${tree} selectedNodeIDs=${selectedNodeIDs} />
    </div>
  `;
}
