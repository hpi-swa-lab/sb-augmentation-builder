import { options, Component } from "../external/preact.mjs";
import { Extension } from "./core/extension.js";

const instances = {};
const idMapping = {};

const oldVnode = options.vnode;
options.vnode = (vnode) => {
  const id = idMapping[vnode.type];
  if (id) (instances[id] ??= []).push(vnode);
  oldVnode?.(vnode);
};

const oldUnmount = options.unmount;
options.unmount = (vnode) => {
  const id = idMapping[vnode.type];
  if (id) {
    const list = instances[id];
    list.splice(list.indexOf(vnode), 1);
  }
  oldUnmount?.(vnode);
};

const oldDiffed = options.diffed;
options.diffed = (vnode) => {
  const id = idMapping[vnode.type];
  const vnodes = instances[id];
  if (vnodes) {
    const matchingDom = vnodes.filter((p) => p.__c === vnode.__c);
    if (matchingDom.length > 1)
      vnodes.splice(
        vnodes.findIndex((p) => p === matchingDom[0]),
        1,
      );
  }
  oldDiffed?.(vnode);
};

export function register(componentFunc, id) {
  idMapping[componentFunc] = id;
  instances[id]?.forEach((vnode) => {
    vnode.type = componentFunc;
    vnode.__c.constructor = componentFunc;
    Component.prototype.forceUpdate.call(vnode.__c);
  });
}

export function updateExtension(extension, baseUrl, name) {
  const id =
    baseUrl.replace("/extensions/", "").replace(/\.js$/, "") + ":" + name;
  const current = Extension.extensionRegistry.get(id);

  // TODO update to new API
  return;
  for (const editor of document.querySelectorAll("sb-editor")) {
    let didChange = false;
    for (const instance of editor.extensionInstances) {
      if (instance.extension === current) {
        instance.extension = extension;
        didChange = true;
      }
    }
    if (didChange) {
      editor.extensionsDo((e) => e.process(["replacement"], editor.source));
      editor.extensionsDo((e) => e.process(["always"], editor.source));
    }
  }

  Extension.extensionRegistry.set(id, extension);
}

// Our server informed us that the module at the given url changed.
// `url` is cache-busted, baseUrl is the original.
//
// Preact components are not exported, so we use code rewriting on the
// server to pass it to the `register` function.
// Extensions are exported, so we can reload them here, no rewriting needed.
window.io().on("hot-reload", async ({ url, baseUrl }) => {
  const exports = await import(url);
  for (const [key, value] of Object.entries(exports)) {
    if (value instanceof Extension) updateExtension(value, baseUrl, key);
  }
});
