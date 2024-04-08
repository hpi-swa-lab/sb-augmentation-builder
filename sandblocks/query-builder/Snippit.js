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


export default function Snippit({code, languageGrammar}) {
    const [tree, setTree] = useState()
    const [selectedNodes, setSelectedNodes] = useState([])

    useEffect(() => {
        setTree(languageGrammar.parse(code))
    })


    const TreeNode = ({node, depth, nodeClicked, selectedNodes}) => {

        const margin = depth == 0 ? "0px" : "30px"
        const bg_color = selectedNodes.has(node._id) ? "coral" : "white"

        //console.log("margin: " + margin + " | bg_color: " + bg_color  + " | node_type: " + node._type)
        if(node._children != null) {
            return html `
                <div 
                style=${{
                    "margin-left": margin,
                }}
                >
                <p style=${{"background-color": bg_color}} onClick=${() => nodeClicked(node._id)}>${node._type}</p>
                ${node._children.map(child => 
                    html`<${TreeNode} 
                            node=${child}
                            depth=${depth + 1}
                            nodeClicked=${nodeClicked}
                            selectedNodes=${selectedNodes}
                        />`
                    )
                }
                </div>`
        } else {
            return html``
        }
    }

    const TreeRepresentation = ({tree, nodeClicked, selectedNodes}) => {
        if(tree != null) {
        return html`
            ${tree._children.map(child => {
            console.log("SelectedNodes: " + Array.from(selectedNodes).join(' '))
            console.log("_id: " + child._id)
            return html`<${TreeNode} node=${child} depth=${0} nodeClicked=${nodeClicked} selectedNodes=${selectedNodes}/>`
            }
            )}`
        } else {
        return html``
        }
    }


    const nodeClicked = (id) => {
            console.log("Clicked: " + id)
            if(selectedNodes.has(id)) {
            setSelectedNodes(prev => new Set([...prev].filter(x => x !== id)))
            } else {
            setSelectedNodes(prev => new Set([...prev, id]))
            }
            console.log("SelectedNodes: " + Array.from(selectedNodes).join(' '))
        }

    return html`
        <textarea 
            id="input"
            name="input"
            rows="10"
            cols="70"
            value=${code}
            />
        </div>
        <div class="row">
            <${TreeRepresentation} tree=${tree} nodeClicked=${nodeClicked} selectedNodes=${selectedNodes}/>
        </div>
    `

}