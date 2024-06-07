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

  import { h } from "../external/preact.js";

  var baseDir = lively.query(this, "lively-container").getDir()
  setConfig({baseURL: baseDir + '../'})
</script>

<script>

import {addVitrailToLivelyEditor} from './lively.js';

let source = `var a = sbWatch(3,"id1") + 4`


const editor = await (<lively-code-mirror style="width:400px; height: 500px; display: block"></lively-code-mirror>)

editor.value = source

const query = (query, extract) => (it) => it.query(query, extract);
debugger
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
    // useValidateKeepReplacement(replacement);
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

await addVitrailToLivelyEditor(editor, [watch])

let pane = <div style="border:1px solid ">{editor}</div>

pane
</script>
