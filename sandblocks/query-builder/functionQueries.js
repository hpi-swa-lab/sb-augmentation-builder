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
  // does not make sense with array processing
  // if (Array.isArray(next) && next.length < 1) return true;
  return false;
}

function exec(arg, ...script) {
  if (!arg) return null;
  let current = arg;
  for (const predicate of script) {
    try {
      let next = predicate(current);
      if (isAbortReason(next)) return null;
      if (next !== true) current = next;
    } catch (e) {
      console.error(e);
      return null;
    }
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

export function languageSpecific(language, ...pipeline) {
  return (it) => {
    const language_list = Array.isArray(language) ? language : [language];
    const mod_pipeline = [
      (it) => language_list.includes(it.language.name),
      ...pipeline,
    ];
    return exec(it, ...mod_pipeline);
  };
}

//execute abitray code, without effecting the the next step in the pipline
// helpfull for debugging
export function also(...pipeline) {
  return (it) => {
    console.log([...pipeline]);
    const og_it = it;
    exec(it, ...pipeline);
    return og_it;
  };
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

export function query(query, extract) {
  return (it) => it.query(query, extract);
}
export function queryDeep(query, extract) {
  return (it) => it.findQuery(query, extract);
}

export function log(prefix = null) {
  return (it) => {
    if (prefix) console.log(prefix);
    console.log(it);
    return it;
  };
}

export function getObjectField(obj, fieldName) {
  const res = obj.childBlocks.filter(
    (it) => it.childBlocks[0].text == fieldName,
  )[0].childBlocks[1];
  return res ? res : "";
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

export class ArrayBinding {
  constructor(node) {
    this.node = node;
    this.nodeArr = this.getArrayFromNode(node, node.type);
    this.depth = this.getArrayDepth(this.nodeArr);
    this.component = () => {
      if (this.depth < 3) {
        return html`${node.language.name}
          <table>
            ${this.nodeArr.array.map((element) => {
              return html`<tr>
                ${element.elements.map((element1) => {
                  return html`<td>${element1.text}</td>`;
                })}
              </tr>`;
            })}
          </table> `;
      } else {
        return html`${node.language.name}
          <table>
            <tr>
              <td>
                Array of depth ${this.depth} found. No visualisaztion
                implemented
              </td>
            </tr>
          </table>`;
      }
    };
  }

  get array() {
    return eval(this.node.sourceString);
  }

  getArrayDepth(nodeArr) {
    if (Object.keys(nodeArr).includes("elements")) {
      return 1;
    } else {
      return 1 + Math.max(...nodeArr.array.map((it) => this.getArrayDepth(it)));
    }
  }

  getArrayFromNode(node, listname) {
    return metaexec(node, (capture) => [
      first(
        [
          (it) => it.childBlocks.map((it) => it.type).includes(listname),
          (it) => it.childBlocks.filter((it) => it.type == listname),
          spawnArray((it) => this.getArrayFromNode(it, listname)),
          capture("array"),
        ],
        [(it) => it.childBlocks, capture("elements")],
      ),
    ]);
  }
}

export class ColorBinding {
  constructor(node, values, colorDefNode) {
    this.node = node;
    this.hex = this.rgbToHex(
      ...values.childBlocks[1].childBlocks.map((it) => it.text),
    );
    this.colorDefNode = colorDefNode;
    this.component = () => {
      return html`<input
        type="color"
        value="${this.hex}"
        onchange="${(e) => this.updateValue(e.target.value)}"
      />`;
    };
  }

  //From: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
  componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }
  //From: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
  rgbToHex(r, g, b) {
    return (
      "#" +
      this.componentToHex(r) +
      this.componentToHex(g) +
      this.componentToHex(b)
    );
  }

  //FROM: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
  hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  updateValue(hex) {
    const rgb = this.hexToRgb(hex);
    this.colorDefNode.values.replaceWith(`rgb(${rgb.r},${rgb.g},${rgb.b})`);
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
    //console.log(newVal);
    if (newVal == this.value) return;
    if (newVal) {
      //console.log(this.node);
      //const parent = this.node.parent;
      this.node.prependString("export ");
      //debugger;
      //this.node = parent;
    } else {
      //console.log(this.node);
      this.node.replaceWith(this.node.children[0].sourceString);
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
