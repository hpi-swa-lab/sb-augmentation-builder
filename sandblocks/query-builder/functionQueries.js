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

function exec(arg, ...script) {
  if (!arg) return null;
  let current = arg;
  for (const predicate of script) {
    let next = predicate(current);
    if (!next) return null;
    if (_isEmptyObject(next)) return null;
    if (Array.isArray(next) && next.length < 1) return null;
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

export function all(...pipelines) {
  return (it) => {
    for (const pipeline of pipelines) {
      exec(it, ...pipeline);
    }
    //endure that this is the last step in pipeline
    return null;
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
    this.tpe;
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
      this.node.prependString("export ");
    } else {
      this.node.replaceWith(this.node.childBlock(0));
    }
  }
}
