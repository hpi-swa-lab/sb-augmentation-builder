# Hello CodeMirror!

<script>
  import {Parser} from "src/client/tree-sitter.js"
  window.TreeSitter = Parser
  import md5 from "./../external/md5.js"
   
  ""
</script>

<script>
  let editor = await (<lively-code-mirror></lively-code-mirror>)
  editor.value = `a
b
c
d
e
  
  `

  editor
</script>

Hello


<script>
  import {setConfig} from "../core/config.js"
  import {Extension} from "../core/extension.js"

  var baseDir = lively.query(this, "lively-container").getDir()
  setConfig({baseURL: baseDir + '../'})
  Extension.clearRegistry();
</script>

<script>

import {} from './scm-editor.js';

let source = `a
b
c

`

// foo();
// let a = 231

// if(x < 5) {
//   foo()
// }
// function foo() {
//   return 4

// }


await (<scm-editor text={source} language="javascript" extensions="javascript:base javascript:smileys"></scm-editor>)

</script>
