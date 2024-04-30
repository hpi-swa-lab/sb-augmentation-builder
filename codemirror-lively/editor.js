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
  

  clearSuggestions() {
    // #TODO
  }
}


export class CodeMirrorLivelyShard extends BaseShard {
  replacementsMap = new Map();

  async initView() {
    let node = this.nodes[0]
    this.livelyCodeMirror = await (<lively-code-mirror 
                                     style="display:inline-block; border: 1px solid gray"
                                     class={node == node.root ? "" : "shard"}
                                     ></lively-code-mirror>)
    
    this.livelyCodeMirror.addEventListener("change", (e) => {
      if (!this.editor || this.nextSource === this.livelyCodeMirror.value) return;
      
      this._onChange(e)
    });
    
    this.appendChild(this.livelyCodeMirror)
  }
  
  get cm() {
    return this.livelyCodeMirror.editor
  }
  
  positionForIndex(index) {
     return { element: this, elementOffset: index - this.range[0], index };
  }

  _onChange(e) {
    if (this.isMyChange) return 
    
    const changes = [];
    const fromA = this.cm.indexFromPos(e.detail.from)
    const toA = this.cm.indexFromPos(e.detail.to)
    const change = {
          from: fromA + this.range[0],
          to: toA + this.range[0],
          insert: e.detail.text.join(""),
          sourceShard: this,
    }
    changes.push(change);
    
    this.onTextChanges(changes);
    
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
      
      this.isMyChange = true
      this.cm.replaceRange(change.insert, from, to)
      this.isMyChange = false
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
    
    comp.marker = this.cm.doc.markText(pos[0], pos[1], {
      replacedWith: comp
    });
    
  }

  updateReplacements(editBuffer) {
    super.updateReplacements(editBuffer);

    for(let comp of this.replacements) { 
      const pos = [
        this.cm.posFromIndex(comp.range[0]), 
        this.cm.posFromIndex(comp.range[1])]
    
      comp.marker.clear()
      comp.marker = this.cm.doc.markText(pos[0], pos[1], {
        replacedWith: comp
      });
    }
  }

  uninstallReplacement(node) {
    this.replacementsMap.delete(node);
  }
  
  getReplacementFor(node) {
    return this.replacementsMap.get(node);
  }

  *iterVisibleRanges() {
    let current = this.range[0];
    for(let iter of this.replacements.map(r => r.range)) {
      yield [current, iter[0]];
      current = iter[1]
    }
    yield [current, this.range[1]];
  }

  select(selection) {
    // #TODO
  }

}



customElements.define("scml-editor", CodeMirrorLively)

customElements.define("scml-shard", CodeMirrorLivelyShard)

