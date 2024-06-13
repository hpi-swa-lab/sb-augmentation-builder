# Hello CM5


<script>
    import { config } from "../core/config.js";

    config.baseURL = "https://lively-kernel.org/lively4/sandblocks-text/";

    import { addVitrailToLivelyEditor } from "./lively.js";
    import { watch, colorstring } from "./demo.ts";
    const el = <div id="editor5"></div>


    const css = document.createElement("style")
    
    css.textContent = await fetch("https://lively-kernel.org/lively4/sandblocks-text/external/codemirror.css").then(r => r.text())

    await lively.loadJavaScriptThroughDOM("cm5", config.baseURL + "/external/codemirror5.js")


    lively.sleep(0).then(() => {
      const cm = CodeMirror(el, { value: `
        // CodeMirror.version: ${ CodeMirror.version}
        3 + sbWatch(123, 'a');
        function () { a + "rgba(100,0,200,0.5)"} 
      `});
      el.editor = cm;
      console.log(addVitrailToLivelyEditor(el, [watch, colorstring]));
  });
  
  
  (<div>{css}{el}</div>)
</script>