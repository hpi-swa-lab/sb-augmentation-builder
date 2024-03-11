import { matchesKey } from "../utils.js";

export class Preferences {
  base = null;
  map = new Map();

  *getShortcutsFor(e) {
    for (const [action, shortcut] of this.map) {
      if (action.startsWith("shortcut:") && matchesKey(e, shortcut))
        yield action.slice("shortcut:".length);
    }
    if (this.base) yield* this.base.getShortcuts();
  }

  *getDefaultExtensions() {
    for (const [extension, enabled] of this.map) {
      if (extension.startsWith("default-extension:") && enabled)
        yield extension.slice("default-extension:".length);
    }
    if (this.base) yield* this.base.getDefaultExtensions();
  }

  get(key) {
    if (this.map.has(key)) return this.map.get(key);
    return this.base?.get(key);
  }

  has(key) {
    return this.map.has(key) || this.base?.has(key);
  }

  set(key, value, isUserSet = true) {
    if (isUserSet || !this.has(key)) {
      this.map.set(key, value);
    }
    return this;
  }

  setDefault(key, value) {
    this.set(key, value, false);
    return this;
  }

  registerPreference(key, defaultValue) {
    this.set(key, defaultValue, false);
    return this;
  }

  registerDefaultShortcut(key, value) {
    this.set(`shortcut:${key}`, value, false);
    return this;
  }

  setShortcut(key, value) {
    this.set(`shortcut:${key}`, value, true);
    return this;
  }

  addDefaultExtension(extension, enable = true, isUserSet = true) {
    this.set(`default-extension:${extension}`, enable, isUserSet);
    return this;
  }

  clone() {
    const clone = new Preferences();
    clone.base = this;
    return clone;
  }
}

export const preferences = new Preferences();
