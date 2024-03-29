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
  static nextMarkerId = 0;
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
  shortcuts = {};
  selection = [];
  caret = [];
  changesApplied = [];
  connected = [];
  disconnected = [];
  changeFilter = [];
  doubleClick = [];
  _custom = {};

  constructor() {}

  copyTo(other) {
    for (const prop of Object.getOwnPropertyNames(this)) {
      other[prop] = this[prop];
    }
  }

  copyFrom(other) {
    for (const prop of Object.getOwnPropertyNames(other)) {
      if (Array.isArray(other[prop])) this[prop].push(...other[prop]);
      else if (typeof other[prop] === "object")
        this[prop] = { ...this[prop], ...other[prop] };
    }
    return this;
  }

  instance(concreteClass) {
    return new concreteClass(this);
  }

  custom(type) {
    return this._custom[type] ?? [];
  }

  registerReplacement(r) {
    this.replacements.push(r);
    return this;
  }

  registerMarker(r) {
    r.name = `${r.name}:${this.constructor.nextMarkerId++}`;
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

  registerCss(cls, query, queryDepth = 1) {
    return this.registerMarker({
      query,
      name: `css:${cls}`,
      queryDepth,
      attach: (shard, node) => shard.cssClass(node, cls, true),
      detach: (shard, node) => shard.cssClass(node, cls, false),
    });
  }

  registerEventListener({ name, query, queryDepth, event, callback }) {
    return this.registerMarker({
      query,
      name,
      queryDepth,
      attach: (shard, node) => {
        const cb = (e) => callback(e, shard, node, dom);
        shard.withDom(node, (dom) => dom.addEventListener(event, cb));
        return { cb };
      },
      detach: (shard, node, { cb }) =>
        shard.withDom(node, (dom) => dom.removeEventListener(event, cb)),
    });
  }

  registerShortcut(name, callback, filterQuery = [], priority = 0) {
    this.shortcuts[name] = [callback, filterQuery, priority];
    return this;
  }

  registerSelection(func) {
    this.selection.push(func);
    return this;
  }

  registerCaret(func) {
    this.caret.push(func);
    return this;
  }

  registerChangeFilter(func) {
    this.changeFilter.push(func);
    return this;
  }

  registerCustom(type, func) {
    (this._custom[type] ??= []).push(func);
    return this;
  }

  registerChangesApplied(func) {
    this.changesApplied.push(func);
    return this;
  }

  registerExtensionConnected(func) {
    this.connected.push(func);
    return this;
  }

  registerExtensionDisconnected(func) {
    this.disconnected.push(func);
    return this;
  }

  registerDoubleClick(func) {
    this.doubleClick.push(func);
    return this;
  }
}
