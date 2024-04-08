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

  function printTreeRec(tree, depth) {
    console.log("depth",depth)
    let spacer = ""
    for (let i = 0; i < depth; i++) {
      spacer += "  "
    } 
  
    console.log("buffer", "" + spacer + tree._type + "\n")
    let buffer = "" + spacer + tree._type + "\n"
    tree._children.forEach(child => {
      if(Object.hasOwn(child,'_type') && child._named && !Object.hasOwn(child,'_text')) {
        buffer += printTreeRec(child,depth + 1)
      }
    })
    console.log("buffer", )
    return buffer
  }





const CodeCST = ({pos, setPos, snippits, addSnippit}) => {
    console.log("pos: " + pos)
    console.log("sinppits.length: " + snippits.length)

    const prevButtonClick = () => {
      if(pos != 0) {
        setPos(pos - 1)
      }
    }

    const nextButtonClick = () => {
      if(pos != snippits.length) {
        setPos(pos + 1)
      }
    }

    let currentSnippit = null

    if(snippits.length > 0) {
      currentSnippit = snippits[pos]
    }


  return html`
    <div class="column">
      <div style=${{display: "flex"}}>
        <h1>Code</h1>
        <div style=${{display: "flex"}}>
          <button onClick=${prevButtonClick}>⬅️</button>
          <button onClick=${nextButtonClick}>${pos != snippits.length ? "➡️" : "➕"}</button>
        </div>
        ${currentSnippit != null ? html`<${Snippit} code=${currentSnippit.code} grammar=${currentSnippit.grammar}/>` : html``}
      </div>
    </div>`
};


export function QueryBuilder() {
  const typescript = languageFor("typescript");
  //const [inputContent, setInputContent] = useState(''); 
  //const [queryPatternContent, setQueryPatternContent] = useState(''); 
  //const [queryConditionContent, setQueryConditionContent] = useState(''); 
  //const [tree, setTreeContent] = useState()
  const [pos,setPos] = useState(0)
  //const [treeString,setTreeStringContent] = useState("")
  const [selectedNodes, setSelectedNodes] = useState(new Set())
  const [snippits, setSnippits] = useState([])

  const onInputChange = useCallback((e) => {
    //console.log("Input", e);
    //let tree = typescript.parse(e)
    //setTreeContent(tree)
    //console.log(tree;
    //setTreeStringContent(printTreeRec(tree,0))s
    //setInputContent(e)
  }, []);

  useAsyncEffect(async () => {
    await typescript.ready();
    setSnippits((snippits) => [...snippits, {code: "const x = 1", grammar: typescript}])
    console.log("Set Example")
  //  console.log(typescript.parse(`const x = 1;`));
  }, []);

  const addSnippits = (snippits) => {
    setSnippits()
  }

  return html`
    <body>
      <div style="display: flex">
        <${CodeCST}
        pos=${pos}
        setPos=${setPos}
        snippits=${snippits}
        addSnippits=${addSnippits}
        />
      </div>
    </body>
  `;
}
