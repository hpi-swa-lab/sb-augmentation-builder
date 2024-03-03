import { exec, sequenceMatch } from "../utils.js";
import { config } from "./config.js";

// An extension groups a set of functionality, such as syntax highlighting,
// shortcuts, or key modifiers. Extensions are only instantiated once. They
// store their runtime data in separate ExtensionInstances, per editor.
//
// Life Cycle / Hooks
// ## Changes
// - modelUpdate(changes: DiffOp[], stringChanges: string, root: Node, oldSource: string, newSource: string)
// - viewUpdate(shard, changes: ViewDiffOp[], stringChanges: string, root: Node, oldSource: string, newSource: string)
// - keyStroke(change: Change, oldSource: string, root: Node)
//
// ## Local Events (dispatched to parents of selection, stop propagating once handled)
// - shortcut(node)
// - doubleClick(node)
//
// ## Global Events
// - caretMove(range: [from, to])
// - preSave(root: Node): Promise<void>
// - save(root: Node)
// - selection(node, previousNode)
//
// ## Extension
// - extensionConnected(root: Node)
// - extensionDisconnected(root: Node)
export class Extension {
  static extensionRegistry = new Map();
  static packageLoaders = new Map();

  static clearRegistry() {
    this.extensionRegistry = new Map();
    this.packageLoaders = new Map();
  }

  static async get(name) {
    let extension = this.extensionRegistry.get(name);
    if (!extension) {
      const [pkg, extName] = name.split(":");
      if (!pkg || !extName) throw new Error(`Invalid extension name ${name}`);
      if (
        [...this.extensionRegistry.keys()].some(
          (ext) => ext.split(":")[0] === pkg,
        )
      )
        throw new Error(
          `Package ${pkg} does not include an extension named ${extName}`,
        );
      const p = this._loadPackage(name);
      this.packageLoaders.set(pkg, p);
      await p;
      extension = this.extensionRegistry.get(name);
    }
    if (!extension) {
      throw new Error(`No extension registered for ${name}`);
    }
    return extension;
  }

  static async _loadPackage(name) {
    const [pkg, extName] = name.split(":");
    if (this.packageLoaders.has(pkg)) return this.packageLoaders.get(pkg);

    const extensions = await import(
      pkg.includes("/")
        ? `${config.baseURL}${pkg}.js`
        : `../extensions/${pkg}.js`
    );
    for (const [name, ext] of Object.entries(extensions)) {
      if (!(ext instanceof Extension)) continue;
      ext.name = `${pkg}:${name}`;
      this.extensionRegistry.set(ext.name, ext);
    }

    if (!this.extensionRegistry.has(name))
      throw new Error(
        `Package ${pkg} does not include an extension named ${extName}`,
      );
  }

  replacements = [];
  markers = [];

  constructor() {}

  copyTo(other) {
    for (const prop of Object.getOwnPropertyNames(this)) {
      other[prop] = this[prop];
    }
  }

  instance(concreteClass) {
    return new concreteClass(this);
  }

  registerReplacement(r) {
    this.replacements.push(r);
    return this;
  }

  registerMarker(r) {
    this.markers.push(r);
    return this;
  }

  registerSyntax(cls, query, queryDepth = 1) {
    return this.registerMarker({
      query,
      name: `syntax:${cls}`,
      queryDepth,
      attach: (shard, node) => shard.cssClass(node, cls, true),
      detach: (shard, node) => shard.cssClass(node, cls, false),
    });
  }
}

export function needsSelection(x) {
  return !!x.editor?.selected;
}

export class ExtensionInstance {
  attachedData = new Set();
  markedViews = new Set();

  attachData(node, identifier, viewAdd) {
    node.viewsDo((view) => {
      const hash = `${view.hash}:${identifier}`;
      console.assert(!this.attachedData.has(hash));
      this.attachedData.add(hash);
      viewAdd(view);
    });
  }

  detachData(node, identifier, viewRemove) {
    node.viewsDo((view) => {
      const hash = `${view.hash}:${identifier}`;
      console.assert(this.attachedData.has(hash));
      this.attachedData.delete(hash);
      viewRemove(view);
    });
  }

  markView(view, mark) {
    this.markedViews.add(`${view.hash}:${mark}`);
  }

  isViewMarked(view, mark) {
    return this.markedViews.has(`${view.hash}:${mark}`);
  }

  constructor(extension) {
    this.extension = extension;
  }

  // notification just before changes are applied to the text
  changesApplied(changes, oldSource, newSource, root, diff) {
    this.extension._processFilter(
      "changesApplied",
      changes,
      oldSource,
      newSource,
      root,
      diff,
    );
  }

  async processAsync(trigger, node) {
    for (const query of this.extension.queries.get(trigger) ?? []) {
      const res = exec(node, ...query(this));
      if (res?.then) await res;
    }
  }

  addSuggestionsAndFilter(node, candidates) {
    const query = node.text.toLowerCase();
    const exactMatches = candidates
      .filter((w) => w.label.toLowerCase().startsWith(query))
      .sort((a, b) => a.label.length - b.label.length);
    const fuzzyMatches = candidates
      .filter((w) => !exactMatches.includes(w) && sequenceMatch(query, w.label))
      .sort((a, b) => a.label.length - b.label.length);
    this.addSuggestions(
      node,
      [...exactMatches, ...fuzzyMatches]
        .slice(0, 10)
        .filter((w) => w.label.toLowerCase() !== query),
    );
  }

  // subclassResponsibility
  installReplacement(view, tag, props) {}
  ensureReplacement(node, tag, props) {}
  attachData(node, identifier, add, remove, update = null) {}
  addSuggestions(node, suggestions) {}
}
