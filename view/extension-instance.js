import { ExtensionInstance } from "../core/extension.js";

export class SandblocksExtensionInstance extends ExtensionInstance {
  attachedDataPerTrigger = new Map();
  queuedUpdates = [];
  widgets = [];

  installReplacement(view, tag, props) {
    const replacement = document.createElement(tag);
    replacement.source = view.node;
    Object.assign(replacement, props ?? {});
    replacement.init(view.node);
    replacement.update(view.node);
    view.replaceWith(replacement);
    view.node._views.remove(view);
    view.node._views.push(replacement);
  }

  installReplacement(view, replacement) {
    view.node._views.remove(view);
    view.node._views.push(replacement);
    replacement.node = view.node;
    view.replaceWith(replacement);
  }

  uninstallReplacement(replacement) {
    const view = replacement.node.toHTMLExpanded();
    prepareCb?.(view);
    replacement.editor.changeDOM(() => replacement.replaceWith(view));
    replacement.node._views.remove(replacement);
  }

  ensureReplacement(node, tag, props) {
    console.assert(this.processingTrigger === "replacement");

    node.viewsDo((view) => {
      // FIXME does this make sense? it prevents creation of replacements
      // for nodes whose weakrefs have not been collected yet
      if (!view.isConnected) return;

      if (!view.isReplacementAllowed(tag)) return;

      if (this._recordReplacementsOnly) {
        if (view.tagName.toLowerCase() === tag) {
          this.newReplacements.add(view);
        } else {
          const replacement = [...this.currentReplacements].find(
            (r) => r.source === node && !r.isConnected
          );
          if (replacement) this.newReplacements.add(replacement);
        }
        return;
      }

      let replacement;
      if (view.tagName.toLowerCase() === tag) {
        // already exists, update
        view.source = node;
        replacement = view;
        Object.assign(replacement, props ?? {});
        view.update(node);
      } else {
        replacement = [...this.currentReplacements].find(
          (r) => r.source === node && !r.isConnected
        );
        if (replacement) {
          // existed just now but got unmounted, remount
          view.replaceWith(replacement);
          Object.assign(replacement, props ?? {});
          replacement.update(node);
          node._views.remove(view);
          console.assert(node._views.includes(replacement));
        } else {
          // does not exist yet, create
          replacement = document.createElement(tag);
          replacement.source = node;
          Object.assign(replacement, props ?? {});
          replacement.init(node);
          replacement.update(node);
          view.replaceWith(replacement);
          node._views.remove(view);
          node._views.push(replacement);
        }
      }

      this.newReplacements.add(replacement);
    });
  }

  attachData(node, identifier, add, remove, update = null) {
    if (this._recordReplacementsOnly) return;

    node.viewsDo((view) => {
      const hash = `${view.hash}:${identifier}`;
      if (!this.currentAttachedData.has(hash)) {
        const customData = add(view);
        update?.(view, node, customData);
        this.newAttachedData.set(hash, {
          remove: (data) => remove?.(view, data),
          customData,
        });
      } else {
        const current = this.currentAttachedData.get(hash);
        this.newAttachedData.set(hash, current);
        update?.(view, node, current.customData);
      }
    });
  }

  _recordReplacementsOnly = false;

  addSuggestions(node, suggestions) {
    node.editor.addSuggestions(suggestions);
  }

  destroyReplacement(r) {
    // check if our node is still connected or we got unmounted entirely
    if (r.source.root.isRoot) r.replaceWith(r.source.toHTML());
  }
}
