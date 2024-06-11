# Hello CodeMirror!

<script>
  import { languageFor } from "../core/languages.js";  
  import {
    all,
    metaexec,
    optional,
    spawnArray,
  } from "../sandblocks/query-builder/functionQueries.js";

  import {
    VitrailPaneWithWhitespace,
    useValidateKeepReplacement,
  } from "./vitrail.ts";

  import {setConfig} from "../core/config.js"

  import { h } from "../external/preact.mjs";

  var baseDir = lively.query(this, "lively-container").getDir()
  setConfig({baseURL: baseDir + '../'})


  import {addVitrailToLivelyEditor} from './lively.js';

</script>

<script>

try {
  


let source = `var x = sbWatch(3 + 4,"id1") + 1


let a = 3 + 4, c = 3
const b = a + 1

var color = 'rgba(100,10,10,0.5)'

var foo = 'not a color'

var table = [[1,22],['x' + 4, 'hello']]


var table = [[1,'rgb(0,100,0)'],['x' + 4, [['hello', 1]]]]

var iconURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAApCAYAAACBZ/9xAAAAAXNSR0IArs4c6QAAAjpJREFUaEPtmD1PVUEQhp8RP4ihpLQztthIQQwVhEQTK7WmQaMd9PwHqDTBxMIWEjoSC6WhszGxNNrSYGUI8jlkYU84l4C7Z3fPyb3J0FDszLszz87smbuC/Z0REONwTsBA+EowEAai91KwirCKsIq48kNprWGtYa1RtjUU3gq8z5lMFX4COwITOTolfBvfEQ4A8A44FLidE4SCev+XAms5Wrm+KSA+AzN+Pm/sXw9Y4cSP+f+APcD9XxT4mJtYU//GiSh8Ax75jVTgRtNNK3uFF8DqJf99geFUzVS/FBArwKtqQ8n84aawDjzjHKhrlQ8Cb1ITSvVrDMJtpOBgPAXGBbZTN+8nvyQQ/ZRAqVgMhE2WHU+WCo+BWYHXpcq4DZ1WW0NhA3jiA/8qMNVGEiU02wbhpsXnPtDfAvdLBN2GRqsg/Ke2GqN/CIyFklDYBH4JzIVsS653CWJLYPJ/wSvMA0vAgcCdkomGtPoNxHfgIXAiMBQKvuR6FyCO/fj8SWA2UBGV7ZHArZKJhrS6ALEL3AUWBJYDIBrdJ6Hkmqx3AcJdfvcEHoQCq71PdP6FSQKhcOTL3fkfC9wMJRmzXgPxR2A0xqeUTSqI6kGlHocra3fJJUMZRBAHXCR8Hcyzfo99uFH4C4x4sl8EpkuddoxOUkVUwgr7XNzuWVr1YHMfe2ISv2xTLHg/RR669vBwkrUHHsRVJ+EfaKMPKbaVogUjDZNPLVJ/YMwMhD8qA2EgervWKsIqorciTgH3uWcq52494wAAAABJRU5ErkJggg=="


function func() {
}

`

const editor = await (<lively-code-mirror style="width:400px; height: 500px; display: block"></lively-code-mirror>)

editor.value = source

const query = (query, extract) => (it) => it.query(query, extract);

const watch = {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      all(
        [
          query("sbWatch($expr, $id)"),
          all(
            [(it) => it.id, capture("id")],
            [(it) => it.expr, capture("expr")],
          ),
        ],
        [capture("nodes")],
      ),
    ]),
  view: ({ id, expr, replacement }) => {
    useValidateKeepReplacement(replacement);
    return h(
      "span",
      {
        style: {
          padding: "3px",
          borderRadius: "5px",
          display: "inline-block",
          background: "#333",
        },
      },
      h(VitrailPaneWithWhitespace, { nodes: [expr] }),
    );
  },
};


const smileys =  {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>  metaexec(x, (capture) => [
    x => x.type === "lexical_declaration",
    x => x.childNode(0),
    all(
      [
        x => [x],
        capture("nodes"),
      ],
      [
        x => x.text,
        capture("type"),
      ])
  ]),
  view: ({ type, nodes }) => {
    return h(
      "span",
      {
        onclick: () =>
          nodes[0].replaceWith(type === "let" ? "const" : "let"),
      },
      type === "let" ? "let 😀" : "const 😇"
    )
  }
};

const colorstring =  {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>  metaexec(x, (capture) => [
    x => x.type === "string",
    x => x.childBlock(0),
    x => !!x.text.match(/^rgba?\(.*\)$/),
    all(
      [
        x => [x],
        capture("nodes"),
      ],
      [
        x => x.text,
        capture("value"),
      ])
  ]),
  view: ({ type, nodes }) => {
    return h("div", {
          style: `
            display: inline-block; 
            background: ` + nodes[0].text +`; 
            width: 20px; 
            position: relative;
            white-space: wrap;
            height: 20px; 
            border: 1px solid red`,
          onclick: async (evt) => {
            var chooser = await (<lively-crayoncolors></lively-crayoncolors>);
            document.body.appendChild(chooser);
            lively.setClientPosition(chooser, lively.getClientPosition(evt.target))
            chooser.addEventListener("color-choosen", () => {
              chooser.remove();
              nodes[0].replaceWith(chooser.value);
            });
            chooser.onChooseCustomColor();
          },        
        }) //  VitrailPaneWithWhitespace ?
  }
}



await addVitrailToLivelyEditor(editor, [watch, smileys, colorstring]) // 

var pane = <div style="border:1px solid ">{editor}</div>

} catch(e) {
  debugger
}

pane
</script>
