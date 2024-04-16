# Sandblocks Text

<script>
import  {setConfig} from "./core/config.js"
import * as editor from "./sandblocks/editor/editor.js"
  
var baseDir = lively.query(this, "lively-container").getDir()
setConfig({baseURL: baseDir})
  
  
  // Editor.init()

// javascript:base javascript:dataurlimage javascript:table javascript:smileys javascript:colorstrings base:base base:identifierSuggestions editorConfig:base javascript:highlightNode

  var ui = await (<sb-editor
    language="javascript"
    extensions="javascript:base javascript:table watch:javascript base:base base:identifierSuggestions"
    text={`console.log(sbWatch(hello, 12398482))

let a = 3 + 4, c = 3
const b = a + 1

var color = 'rgba(100,10,10,0.5)'

var foo = 'not a color'

var table = [[1,22],['x' + 4, 'hello']]


var table = [[1,'rgb(0,100,0)'],['x' + 4, [['hello', 1]]]]

var iconURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAApCAYAAACBZ/9xAAAAAXNSR0IArs4c6QAAAjpJREFUaEPtmD1PVUEQhp8RP4ihpLQztthIQQwVhEQTK7WmQaMd9PwHqDTBxMIWEjoSC6WhszGxNNrSYGUI8jlkYU84l4C7Z3fPyb3J0FDszLszz87smbuC/Z0REONwTsBA+EowEAai91KwirCKsIq48kNprWGtYa1RtjUU3gq8z5lMFX4COwITOTolfBvfEQ4A8A44FLidE4SCev+XAms5Wrm+KSA+AzN+Pm/sXw9Y4cSP+f+APcD9XxT4mJtYU//GiSh8Ax75jVTgRtNNK3uFF8DqJf99geFUzVS/FBArwKtqQ8n84aawDjzjHKhrlQ8Cb1ITSvVrDMJtpOBgPAXGBbZTN+8nvyQQ/ZRAqVgMhE2WHU+WCo+BWYHXpcq4DZ1WW0NhA3jiA/8qMNVGEiU02wbhpsXnPtDfAvdLBN2GRqsg/Ke2GqN/CIyFklDYBH4JzIVsS653CWJLYPJ/wSvMA0vAgcCdkomGtPoNxHfgIXAiMBQKvuR6FyCO/fj8SWA2UBGV7ZHArZKJhrS6ALEL3AUWBJYDIBrdJ6Hkmqx3AcJdfvcEHoQCq71PdP6FSQKhcOTL3fkfC9wMJRmzXgPxR2A0xqeUTSqI6kGlHocra3fJJUMZRBAHXCR8Hcyzfo99uFH4C4x4sl8EpkuddoxOUkVUwgr7XNzuWVr1YHMfe2ISv2xTLHg/RR669vBwkrUHHsRVJ+EfaKMPKbaVogUjDZNPLVJ/YMwMhD8qA2EgervWKsIqorciTgH3uWcq52494wAAAABJRU5ErkJggg=="


function a() {
}`}></sb-editor>)
  
  
  let style = <link href={baseDir + "./view/editor-style.css"} rel="stylesheet" />
  let pane = <div>{style}{ui}</div> 
  pane
</script>
