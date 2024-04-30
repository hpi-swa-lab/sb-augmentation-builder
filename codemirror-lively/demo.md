# Hello CodeMirror!

<script>
  import {setConfig} from "../core/config.js"
  import {Extension} from "../core/extension.js"
  import { SBMatcher } from "../core/model.js";
  import { languageFor } from "../core/languages.js";

  import { h } from "../external/preact.js";

  var baseDir = lively.query(this, "lively-container").getDir()
  setConfig({baseURL: baseDir + '../'})
  Extension.clearRegistry();
</script>

<script>

import {} from './editor.js';

let source = `var a = 3 + 4`


const editor = await (<scml-editor text={source} style="width:400px"></scml-editor>)

const ext =  new Extension().registerReplacement({
      name: "test-hiding-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "number",
      ]),
      rerender: () => true,
      component: ({ node }) =>
        h("span", { style: { "background-color": "red" } }, node.text),
    });

editor.extensions = [ext]


editor
</script>
