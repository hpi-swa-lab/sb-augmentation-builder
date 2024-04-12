import { Extension, ExtensionInstance } from "../core/extension.js";
import { languageFor } from "../core/languages.js";
import { markAsEditableElement, SBSelection } from "../core/focus.js";


import {debugPrint} from "src/client/debug.js"

import {
  parentWithTag,
  rangeContains,
} from "../utils.js";


/* globals queueMicrotask */

export class CodeMirrorExtensionInstance extends ExtensionInstance {
  
  constructor(...args) {
    super(...args)
    this.attachedDataPerTrigger = new Map();
    this.queuedUpdates = [];
    this.widgets = [];
    this.replacementMap = new Map()
  }
  
  shardsForNodeDo(node, cb) {
    for (const shard of node.editor.allShards) {
      if (rangeContains(shard.range, node.range))
        cb(shard)
    }
  }


  ensureReplacement(node, tag, props) {
    this.shardsForNodeDo(node, async shard => {
      const pos = [shard.livelyCM.posFromIndex(node.range[0]), 
          shard.livelyCM.posFromIndex(node.range[1])]
      const currentMarks = shard.livelyCM.editor.findMarksAt(pos[0]).filter(m => m.replacedWith)
      
      // FIXME need to handle multiple marks?
      console.assert(currentMarks.length <= 1);
      
      if (currentMarks.length > 0) {
        const currentReplacement = currentMarks[0].replacedWith.childNodes[0]
        console.assert(currentReplacement.tagName === tag.toUpperCase());
        Object.assign(currentReplacement, props ?? {});
        currentReplacement.update(node);
        this.newReplacements.add(currentReplacement)
        return;
      }
      
      let replacement
      if (!replacement) {
        replacement = shard.livelyCM.wrapWidgetSync(tag, ...pos)
        Object.assign(replacement, props ?? {});
        replacement.init()
      }
      Object.assign(replacement, props ?? {});
      
     replacement.update(node)
      this.newReplacements.add(replacement);
   })
  }

  attachData(node, identifier, add, remove, update = null) {
    
  }
  
  processStickyReplacements(node) {
   
  }
  
  destroyReplacement(replacement) {
    replacement.marker.clear()
  }
}


export class SCMShard extends HTMLElement {
  connectedCallback() {
    markAsEditableElement(this)
  }
  
  get editor() {
    return parentWithTag(this, "SCM-EDITOR");
  }
  
  get range() {
    return this.source.range;
  }
  
  set initNode([node]) {
    this.update(node)
  }
  
  async update(node) {
    this.source = node
    if (!this.livelyCM) {
      await this.initEditor(node);
    }
    
    if (node.sourceString !== this.livelyCM.value) {
      this.nextSource = node.sourceString
      this.livelyCM.value = node.sourceString
    }
  }
  
  async initEditor(node) {
    this.livelyCM = await (<lively-code-mirror 
                             style="display:inline-block; border: 1px solid gray" 
                             class={node == node.root ? "" : "shard"}></lively-code-mirror>)
    if(node.isRoot) {
      this.livelyCM.style.width = "100%"
      this.livelyCM.style.height = "100%"
    }

    this.livelyCM.addEventListener("change", (e) => {
      if (!this.editor || this.nextSource === this.livelyCM.value) return;
      this.editor.replaceTextFromTyping({
        range: this.range,
        text: this.livelyCM.value,
      });
    });
    
    this.livelyCM.addEventListener("keydown", (e) => {
      let innerShard = e.composedPath().find(ea => ea.localName == "scm-shard")
      if (innerShard === this) {
        // console.log("" + debugPrint(this)  + ">>keydown " + e.key)

        let delta = null
        if (e.key === "ArrowLeft") {
          // console.log(debugPrint(this) + ">>sbIsMoveAtBoundary(-1) " + this.sbIsMoveAtBoundary(-1))
          if (this.sbIsMoveAtBoundary(-1)) {
            delta = -1
          }

        } else if (e.key === "ArrowRight") {
          // console.log(debugPrint(this) + ">>sbIsMoveAtBoundary(1)" + this.sbIsMoveAtBoundary(1))
          if (this.sbIsMoveAtBoundary(1)) {
            delta = 1
          }        
        } 

        if (delta !== null) {
          // #TODO very complicated.... 

          if (innerShard === this) {
              e.preventDefault()
              e.stopPropagation()          
              
              console.log("" + debugPrint(this)  + ">>keydown moveToNext delta: " + delta)
              
              this.editor.selection.moveToNext(this.editor, delta);            
            } 
          }  
        } else {
          // Me and my editor should not handle it... but the inner shard....
          // so we do nothing...
            
        } 
      
    }, true);

    this.livelyCM.editor.on("beforeSelectionChange", (cm, e, sel) => {
      if (!this.editor || e.origin !== '+move') return;
      let delta = Math.sign(cm.indexFromPos(e.ranges[0].head) - cm.indexFromPos(cm.getCursor("from")));
      console.log(debugPrint(this) +">>beforeSelectionChange delta: " + delta)

      // if we hit a boundary, codemirror reports this via hitSide but does not move the ranges
      if (delta === 0) {
        console.assert(e.ranges[0].head.hitSide);
        delta = cm.indexFromPos(e.ranges[0].head) === 0 ? -1 : 1;
      }

      if (e.ranges[0].head.hitSide || this.sbIsMoveAtBoundary(delta)) {
        this.editor.selection.moveToNext(this.editor, delta);
      } else {
        this.editor.selection.informChange(this, 
                                           [cm.indexFromPos(cm.getCursor("from")),
                                            cm.indexFromPos(cm.getCursor("to"))]);
      }
    });

    this.appendChild(this.livelyCM)
  }

  sbSelectedEditablePart() {
    const cm = this.livelyCM.editor
    const cursor = cm.getCursor("from")
    const el = CodeMirror.posToDOM(cm, cursor)
    return el.node
  }
  
  sbSelectRange([start, end]){
    // #TODO currently we are ignoring end 
    const cm = this.livelyCM.editor
    const markWithWidget = cm.findMarksAt(cm.posFromIndex(start)).some(m => !!m.replacedWith)
    if (markWithWidget) {
      return null  // we cannot select ourself 
    }
    return this
  }
  
  sbSelectAtBoundary(view, atStart){
    
    
    // #TODO needs to instead cancel event and dispatch immediately
    
    // lively.showElement(view).innerHTML = ""
    // debugger

    this.livelyCM.editor.focus()

    // setTimeout(() => {
    //   this.livelyCM.editor.focus()
    // }, 300) // 300

    

    
    const rect = view.getBoundingClientRect();
    
    lively.showElement(view)
    debugger
    const pos = this.livelyCM.editor.coordsChar({ left: atStart ? rect.left : rect.right, top: rect.top }, "window");
    
    
    console.log(debugPrint(this) + ">> sbSelectAtBoundary pos: " + JSON.stringify(pos)  )
    
    // this.livelyCM.editor.focus();
    this.livelyCM.editor.setCursor(pos);
    
    
    
    return {view, range: atStart ? [this.range[0], this.range[0]] : [this.range[1], this.range[1]]}
  }
  
  sbIsMoveAtBoundary(delta){
    const cm = this.livelyCM.editor
    let cursorPos = cm.indexFromPos(cm.getCursor("from"))
    // is the next (delta>0) or previous (delta<0) a marker widget?
    
    if (delta < 0 && cursorPos === 0) return true
    if (delta > 0 && cursorPos === cm.getValue().length) return true
    
    console.log(debugPrint(this) +">>sbIsMoveAtBoundary  cursorPos " + cursorPos + " delta: " +  delta)
    
    let isMoveAtBoundary = cm.findMarksAt(cm.posFromIndex(cursorPos + delta)).some(m => !!m.replacedWith)
    return !!isMoveAtBoundary
  }
  
  sbCandidateForRange(range) {
    throw ": {view, rect} | null"
  }
}

customElements.define("scm-shard", SCMShard);

export class SCMEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
          <div style="border: 1px solid gray">
          <slot></slot></div>
        `;

      this.extensions = [];

      this.lastText = null;
      this.lastLanguage = null;
      this.lastExtensions = null;
      this.initializing = false;
      this.selection = new SBSelection()
    }

    static observedAttributes = ["text", "language", "extensions"];

    get sbIsEditor() { return true }
    
    get shardTag() {
      return "scm-shard"
    }

    get allShards() {
      // TODO need to collect recursively across shadow DOMs
      return this.querySelectorAll("scm-shard")
    }
  
    async createShardFor(node) {
      const shard = document.createElement("scm-shard");
      shard._editor = this;
      await shard.update(node);
      return shard;
    }

  replaceTextFromTyping({ text, range: [start, end], selectionRange }) {
    const old = this.source.sourceString;
    const newText = old.slice(0, start) + text + old.slice(end)
    this.source.updateModelAndView(newText)
    this.extensionsDo((e) => e.process(["replacement"], this.source));
    
    // #TODO need to update the root codemirror. However, as this overrides
    // the entire source code, we remove all markers (i.e. replacements)
    this.shard.update(this.source)
    
    // TODO these also have to trigger
    // if (this.selected)
    //     this.extensionsDo((e) => e.process(["type"], this.selected.node));
    //   this.extensionsDo((e) =>
    //     e.process(["always"], this.selected?.node ?? this.source)
    //   );
    //   this.extensionsDo((e) =>
    //     e.changesApplied(changes, oldSource, newSource, this.source, diff)
    //   );
  }

    disconnectedCallback() {
      // document.removeEventListener("selectionchange", this.selectionHandler);
      // this.extensionsDo((e) => e.process(["extensionDisconnected"], this.source));
    }

    get source() {
      return this.childNodes[0].source;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this._queued) {
        this._queued = true;
        queueMicrotask(async () => {
          this._queued = false;
          await this.updateEditor();
        });
      }
    }

    extensionsDo(cb) { 
      for (const e of [
        ...this.extensionInstances,
        ...(this.inlineExtensions ?? []),
      ]) {
        cb(e);
      }
    }

    async updateEditor() {
      await this.load(
        this.getAttribute("text"),
        this.getAttribute("language"),
        this.getAttribute("extensions").split(" ").filter(Boolean)
      );
    }

    async load(text, language, extensionNames) {
      if (this.initializing) {
        this.queuedUpdate = arguments;
        return;
      }
      this.initializing = true;

      if (this.shard) {
        this.extensionsDo((e) =>
          e.process(["extensionDisconnected"], this.source)
        );
        this.extensionInstances.forEach((e) => e.destroy());
        this.shard.source.destroy();
        this.shard.remove();
      }

      const [root, ...extensions] = await Promise.all([
        languageFor(language).initModelAndView(text, language, this.root),
        ...extensionNames.map((e) => Extension.get(e)),
      ]);
      
      root._editor = this

      this.shard = await this.createShardFor(root);
      this.appendChild(this.shard);

      this.extensionInstances = extensions.map((e) =>
        e.instance(CodeMirrorExtensionInstance)
      );
      this.extensionsDo((e) => e.process(["extensionConnected"], this.source));
      this.extensionsDo((e) => e.process(["replacement"], this.source));
      this.extensionsDo((e) => e.process(["always"], this.source));
      this.initializing = false;

      if (this.queuedUpdate) {
        let update = this.queuedUpdate;
        this.queuedUpdate = null;
        await this.load(...update);
      }

      queueMicrotask(() => this.dispatchEvent(new CustomEvent("loaded")));
    }

    async loadExtensions(list) {
      const exts = await Promise.all(list.map((name) => Extension.get(name)));
      this.extensions = exts.map((e) => e.instance());

      this.extensions.forEach((e) =>
        e.process(["extensionConnected", "replacement", "always"], this.root)
      );
    }
  }

customElements.define("scm-editor", SCMEditor);
