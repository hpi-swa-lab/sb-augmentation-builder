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
  //const [tree, setTree] = useState();

  //useEffect(() => {
  //  setTree(grammar.parse(code));
  //  console.log("set tree");
  //}, []);

  const TreeNode = ({ node, depth, nodeClicked, selectedNodes }) => {
    const margin = depth == 0 ? "0px" : "30px";
    const bg_color = selectedNodes.has(node._id) ? "coral" : "white";

    //console.log("margin: " + margin + " | bg_color: " + bg_color  + " | node_type: " + node._type)
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
        //console.log("SelectedNodes: " + Array.from(selectedNodes).join(" "));
        //console.log("_id: " + child._id);
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

  /*const nodeClicked = (id) => {
    console.log("Clicked: " + id);
    if (selectedNodes.has(id)) {
      //setSelectedNodes((prev) => new Set([...prev].filter((x) => x !== id)));
      selectedNodes = new Set([...selectedNodes].filter((x) => x !== id));
    } else {
      //setSelectedNodes((prev) => new Set([...prev, id]));
      selectedNodes = new Set([...selectedNodes, id]);
    }
    console.log("SelectedNodes: " + Array.from(selectedNodes).join(" "));
  };
  */

  return html`
    <textarea id="input" name="input" rows="10" cols="70" value=${code} />
    <div class="row">
      <${TreeRepresentation}
        tree=${tree}
        nodeClicked=${nodeClicked}
        selectedNodes=${selectedNodes}
      />
    </div>
  `;
}
