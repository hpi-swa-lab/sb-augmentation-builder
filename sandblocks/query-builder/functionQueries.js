import { html } from "../../view/widgets.js";

export function orderFork() {}

export function metaexec(obj, makeScript) {
  let captures = {};
  const script = makeScript(function (captureName) {
    return (it) => {
      captures[captureName] = it;
      return it;
    };
  });
  exec(obj, ...script);
  return Object.keys(captures).length > 0 ? captures : null;
}

function isAbortReason(next) {
  if (!next) return true;
  if (_isEmptyObject(next)) return true;
  if (Array.isArray(next) && next.length < 1) return true;
  return false;
}

function exec(arg, ...script) {
  if (!arg) return null;
  let current = arg;
  for (const predicate of script) {
    let next = predicate(current);
    if (isAbortReason(next)) return null;
    if (next !== true) current = next;
  }
  return current;
}

function _isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function spawnArray(pipeline) {
  return (it) =>
    it.map((node) => pipeline(node)).filter((node) => node != null);
}

export function first(...pipelines) {
  return (it) => {
    for (const pipeline of pipelines) {
      const res = exec(it, ...pipeline);
      if (res) return res;
    }
    return null;
  };
}

export const optional = (pipeline) => first(pipeline, [() => true]);

export const debugIt = (it) => {
  console.log(it);
  return it;
};

export function all(...pipelines) {
  return (it) => {
    for (const pipeline of pipelines) {
      if (isAbortReason(exec(it, ...pipeline))) return null;
    }
    // signal that we completed, but return no sensible value
    return true;
  };
}

export function log(prefix = null) {
  return (it) => {
    if (prefix) console.log(prefix);
    console.log(it);
    return it;
  };
}

//TODO: Think about Views in JSX
export class BoolBinding {
  constructor(val) {
    this.val = val;
  }
}

export class NodeInfoBinding {
  constructor(node) {
    this.name = node.text;
  }
}

export class ExportBinding {
  constructor(node) {
    this.node = node;
  }

  get value() {
    return this.node.type == "export_statement";
  }

  //Might work
  //TODO: Write test
  set value(newVal) {
    if (newVal == this.value) return;
    if (newVal) {
      const parent = this.node.parent;
      this.node.prependString("export ");
      this.node = parent;
    } else {
      this.node.replaceWith(this.node.childBlock(0).sourceString);
    }
  }

  component = () => {
    return html`<input
      type="checkbox"
      checked=${this.value}
      onChange=${(e) => {
        this.value = e.target.checked;
      }}
    />`;
  };
}
