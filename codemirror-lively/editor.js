import {
  last,
  orParentThat,
  rangeContains,
  rangeIntersects,
  rangeShift,
} from "../utils.js";



import { BaseEditor } from "../core/editor.js";
import { BaseShard } from "../core/shard.js";

export class CodeMirrorLively extends BaseEditor {
  
  static shardTag = "scml-shard"
  
}


export class CodeMirrorLivelyShard extends BaseShard {
  replacementsMap = new Map();

  async initView() {
    this.livelyCodeMirror = await (<lively-code-mirror></lively-code-mirror>)
    this.appendChild(this.livelyCodeMirror)
  }
  
  get cm() {
    return this.livelyCodeMirror.editor
  }
  
  
  positionForIndex(index) {
     return { element: this, elementOffset: index - this.range[0], index };
  }
  
  _applyTextChanges(changes) {
    let anyChange = false;
    for (const change of changes.filter(
      (c) =>
        c.sourceShard !== this && rangeContains(this.range, [c.from, c.from]),
    )) {
      anyChange = true;
      
      let from = this.cm.posFromIndex(change.from - this.range[0])
      let to = this.cm.posFromIndex(change.to - this.range[0])
      this.cm.replaceRange(change.insert, from, to)
      
      // this.cm.dispatch({
      //   userEvent: "sync",
      //   changes: [
      //     {
      //       from: change.from - this.range[0],
      //       to: change.to - this.range[0],
      //       insert: change.insert,
      //     },
      //   ],
      // });
    }

    return anyChange;
  }
  
  
  applyChanges(editBuffers, changes) {
    this._applyTextChanges(changes);

    for (const editBuffer of editBuffers) {
      this.updateReplacements(editBuffer);
      this.updateMarkers(editBuffer);
    }

    // #TODO needed?
    // this.cm.dispatch({ userEvent: "sync" });
  }
  
  isShowing(node) {
    // #TODO
    return true
  }
  

  get replacements() {
    return [...this.replacementsMap.values()];
  }

  installReplacement(node, extension) {
    let comp = this.buildReplacementFor(node, extension)
    this.replacementsMap.set(node, comp);
    
    
    
    const pos = [this.cm.posFromIndex(node.range[0]), 
          this.cm.posFromIndex(node.range[1])]
    
    this.cm.doc.markText(pos[0], pos[1], {
      replacedWith: comp
    });
    
  }

  uninstallReplacement(node) {
    this.replacementsMap.delete(node);
  }
  
  getReplacementFor(node) {
    return this.replacementsMap.get(node);
  }
}



customElements.define("scml-editor", CodeMirrorLively)

customElements.define("scml-shard", CodeMirrorLivelyShard)

