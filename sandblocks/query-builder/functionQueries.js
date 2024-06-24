import { div, editor, html } from "../../view/widgets.js";
import { h } from "../../external/preact.mjs";
import {
  VitrailPane,
  VitrailPaneWithWhitespace,
  useValidateKeepReplacement,
} from "../../vitrail/vitrail.ts";
import { useSignal } from "../../external/preact-signals.mjs";
import { TextArea, bindPlainString } from "./bindings.ts";
import { languageFor, languageForPath } from "../../core/languages.js";

export function orderFork() {}

export function metaexec(obj, makeScript) {
  let captures = {};
  let selectedInput = {};
  let selectedOutput = {};
  const script = makeScript(
    function (captureName) {
      return (it) => {
        captures[captureName] = it;
        return it;
      };
    },
    function () {
      return (it) => {
        //debugger;
        selectedInput = it;
      };
    },
    function () {
      return (it) => (selectedOutput = it);
    },
  );
  const success = execScript(obj, ...script);
  // FIXME(tobe) which version to we want?
  // return Object.keys(captures).length > 0 ? captures : null;
  return success
    ? {
        captures: captures,
        selectedInput: selectedInput,
        selectedOutput: selectedOutput,
      }
    : null;
}

function isAbortReason(next) {
  if (!next) return true;
  if (_isEmptyObject(next)) return true;
  // does not make sense with array processing
  // if (Array.isArray(next) && next.length < 1) return true;
  return false;
}

export function replace(capture) {
  return (it) => {
    capture("nodes")(Array.isArray(it) ? it : [it]);
    return it;
  };
}

function execScript(arg, ...script) {
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
    return execScript(it, ...mod_pipeline);
  };
}

export function selected(selectedInput, selectedOutput, ...pipeline) {
  return (it) => {
    selectedInput(it);
    const output = execScript(it, ...pipeline);
    selectedOutput(output);
    return output;
  };
}

//execute abitray code, without effecting the the next step in the pipline
// helpfull for debugging
export function also(...pipeline) {
  return (it) => {
    const og_it = it;
    execScript(it, ...pipeline);
    return og_it;
  };
}

export function first(...pipelines) {
  return (it) => {
    for (const pipeline of pipelines) {
      const res = execScript(it, ...pipeline);
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
      if (isAbortReason(execScript(it, ...pipeline))) return null;
    }
    // signal that we completed, but return no sensible value
    return true;
  };
}

export function captureAll(capture) {
  return (it) => {
    for (const key of it) capture(key, it[key]);
  };
}

export function query(query, extract) {
  return (it) => it.query(query, extract);
}
export function queryDeep(query, extract) {
  return (it) => it.findQuery(query, extract);
}
export function type(typeName) {
  return (it) => it.type === typeName;
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
        return html`<div>
          ${node.language.name}
          <table>
            ${this.nodeArr.array.map((element) => {
              return html`<tr>
                ${element.elements.map((element1) => {
                  return html`<td>${element1.text}</td>`;
                })}
              </tr>`;
            })}
          </table>
          <button onclick=${() => this.addRow()}>Add row</button>
          <button onclick=${() => this.addColumn()}>Add column</button>
        </div>`;
      } else {
        return html`${node.language.name}
          <table>
            <tr>
              <td>
                Array of depth ${this.depth} found. No visualization
                implemented.
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

  addRow() {
    if (["typescript", "haskell", "python"].includes(this.node.language.name)) {
      const ogSourceString = this.node.sourceString;
      const newSourceString =
        ogSourceString.slice(0, ogSourceString.length - 1) +
        ",[]" +
        ogSourceString.slice(ogSourceString.length - 1);
      this.node.replaceWith(newSourceString);
    }
  }

  addColumn() {
    if (["typescript", "haskell", "python"].includes(this.node.language.name)) {
      const arrays = this.node.sourceString
        .replace("[[", "[")
        .replace("]]", "]")
        .split("],[");
      debugger;
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

export class PipelineBinding {
  constructor(node, type = PipelineSteps.PIPELINE) {
    this.type = type;
    this.steps = this.getPipelineSteps(node);
    this.node = node;

    this.component = (
      top,
      bottom = false,
      firstPipeline = false,
      lastPipeline = false,
      connectFirstNodes = false,
    ) => {
      switch (this.type) {
        case PipelineSteps.PIPELINE:
          return h(
            "div",
            { style: { display: "flex", "flex-grow": "1" }, id: "Pipeline" },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  "flex-direction": "column",
                },
              },
              this.steps.steps.map((step, index) => {
                return h(
                  "div",
                  {},
                  top && index == 0
                    ? this.verticalLine(true, false, this.node, index)
                    : null,
                  index != 0
                    ? this.verticalLine(false, false, this.node, index)
                    : null,
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        "flex-direction": "row",
                        "flex-grow": "1",
                        position: "relative",
                      },
                    },
                    step.step.component(
                      connectFirstNodes && index == 0 && !lastPipeline,
                      lastPipeline && index == 0,
                      index == this.steps.steps.length - 1,
                      this.node,
                      index,
                    ),
                  ),
                );
              }),
              bottom
                ? this.verticalLine(
                    false,
                    true,
                    this.node,
                    this.steps.steps.length,
                  )
                : null,
              bottom
                ? this.horizontalLine(
                    firstPipeline,
                    lastPipeline,
                    true,
                    this.node,
                    this.steps.steps.length,
                  )
                : null,
            ),
          );

        case PipelineSteps.ALL:
          return h(
            "div",
            {
              style: {
                display: "flex",
                //gap: "10px",
                border: "0px dotted",
                "border-color": "red",
              },
            },
            this.steps.steps.map((step, index) => {
              return html`<div
                style=${{ position: "relative", border: "0px dotted green" }}
              >
                ${step.step.component(true)}
                <div
                  style=${{ position: "absolute", width: "100%", top: "0%" }}
                >
                  ${this.horizontalLine(
                    index == 0,
                    index == this.steps.steps.length - 1,
                    true,
                    this.node,
                    index,
                  )}
                </div>
              </div>`;
            }),
          );
        case PipelineSteps.FIRST:
          return h(
            "div",
            {
              style: {
                display: "flex",
                //gap: "10px",
                border: "0px dotted",
                "border-color": "green",
                "flex-grow": "1",
              },
            },
            this.steps.steps.map((step, index) => {
              return html`<div style=${{ display: "flex" }}>
                ${step.step.component(
                  false,
                  true,
                  index == 0,
                  index == this.steps.steps.length - 1,
                  true,
                )}
              </div>`;
            }),
            addButton(true, this.node, 1),
          );
        default:
          return html`<div>Not yet implemented</div>`;
      }
    };
  }

  getPipelineStep(node) {
    return metaexec(node, (capture) => [
      first(
        [
          query("($any) => $STEP"),
          (it) => it.STEP,
          (it) => new PipelineStepBinding(it, PipelineSteps.FUNCTION),
        ],
        [
          query("all($$$STEPS)"),
          (it) => it.STEPS,
          (it) => new PipelineBinding(it, PipelineSteps.ALL),
        ],
        [
          query("first($$$STEPS)"),
          (it) => it.STEPS,
          (it) => new PipelineBinding(it, PipelineSteps.FIRST),
        ],
        [
          query("capture($NAME)"),
          (it) => it.NAME,
          (it) => new PipelineStepBinding(it, PipelineSteps.CAPTURE),
        ],
        [
          query("query($QUERY)"),
          (it) => it.QUERY,
          (it) => new PipelineStepBinding(it, PipelineSteps.QUERY),
        ],
        [
          query("type($TYPE)"),
          (it) => it.TYPE,
          (it) => new PipelineStepBinding(it, PipelineSteps.TYPE),
        ],
        [
          query("spawnArray($CALL)"),
          (it) => it.CALL,
          (it) => new PipelineStepBinding(it, PipelineSteps.FUNCTION),
        ],
        [
          query("[$$$STEPS]"),
          (it) => it.STEPS,
          (it) => new PipelineBinding(it, PipelineSteps.PIPELINE),
        ],
      ),
      capture("step"),
    ]);
  }

  getPipelineSteps(node) {
    return metaexec(node, (capture) => [
      first([(it) => Array.isArray(it)], [(it) => it.childBlocks]),
      spawnArray((it) => this.getPipelineStep(it)),
      capture("steps"),
    ]);
  }

  verticalLine(first, last = false, container, index) {
    //return html`<div style=${{ width: "10px" }}><hr></hr></div>`;
    const buttonVisible = useSignal(false);

    const horizontalLineThinkness = 2;
    return html`<div
      style=${{
        position: "relative",
        display: "flex",
        "flex-grow": "1",
        "align-items:": "center",
      }}
    >
      <div
        style=${{
          "border-left": "2px solid black",
          "margin-left": "1rem",
          "margin-top": first ? `-${horizontalLineThinkness}px` : "0px",
          "min-height": "25px",
          "flex-grow": "1",
        }}
      ></div>

      <div
        style=${{
          display: "block",
          position: "absolute",
          "margin-top": "0px",
          "margin-left": "7px",
          height: "100%",
          width: "30px",
        }}
        onmouseenter=${() => (buttonVisible.value = true)}
        onmouseleave=${async () => (buttonVisible.value = false)}
      >
        ${addButton(buttonVisible.value, container, index)}
      </div>
    </div>`;
  }

  horizontalLine(first, last, buttonVisibleOverwrite = true, container, index) {
    const buttonVisible = useSignal(false);
    if (last && !first) {
      return html`<div
        style=${{
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
        onmouseenter=${() => (buttonVisible.value = true)}
        onmouseleave=${async () => (buttonVisible.value = false)}
      >
        <div
          style=${{
            "border-top": "2px solid black",
            "margin-left": "0rem",
            height: "0px",
            width: "1rem",
          }}
          id="last"
        ></div>
        <div
          style=${{
            marginLeft: "1.5rem",
            marginTop: "-0.6rem",
            position: "absolute",
            //top: "100%",
            //right: "50%",
          }}
        >
          ${addButton(
            buttonVisible.value && buttonVisibleOverwrite,
            container,
            index,
          )}
        </div>
      </div>`;
    } else {
      return html`<div
        style=${{ position: "relative" }}
        onmouseenter=${() => {
          buttonVisible.value = true;
        }}
        onmouseleave=${async () => (buttonVisible.value = false)}
      >
        <div
          style=${{
            "margin-left": "1rem",
            "margin-right": "1rem",
            "margin-top": "-5px",
            border: "2px dotted red",
            //background: "blue",
            height: "10px",
            width: last ? "1rem" : "100%",
            opacity: "0.5",
            position: "absolute",
            display: "block",
          }}
        ></div>
        <div
          style=${{
            "border-top": "2px solid red",
            "margin-left": first ? "1rem" : "0rem",
            height: "0px",
          }}
          id=${first ? "first" : "not first"}
        ></div>
        <div
          style=${{
            display: "block",
            position: "absolute",
            "margin-top": "-13px",
            "margin-left": "1rem",
          }}
        >
          <div style=${{ border: "2px dotted red" }}>
            ${addButton(
              buttonVisible.value && buttonVisibleOverwrite,
              container,
              index,
            )}
          </div>
        </div>
      </div>`;
    }
  }
}

function addButton(visible, container, index) {
  const visibilityOverwirte = useSignal(false);
  const selectExpanded = useSignal(false);
  return visible || visibilityOverwirte.value || selectExpanded.value
    ? html`
        <div onclick=${() => (selectExpanded.value = !selectExpanded.value)}>
          <select>
            <option
              value="fuction"
              onclick=${() =>
                insertStep(container, index, PipelineSteps.FUNCTION)}
            >
              funtion
            </option>
            <option
              value="all"
              onclick=${() => insertStep(container, index, PipelineSteps.ALL)}
            >
              all
            </option>
            <option
              value="first"
              onclick=${() => insertStep(container, index, PipelineSteps.FIRST)}
            >
              first
            </option>
            <option
              value="type"
              onclick=${() => insertStep(container, index, PipelineSteps.TYPE)}
            >
              type
            </option>
            <option
              value="capture"
              onclick=${() =>
                insertStep(container, index, PipelineSteps.CAPTURE)}
            >
              capture
            </option>
          </select>
        </div>
      `
    : null;
}

async function insertStep(container, index, pipelineStep) {
  let code = "";
  if (Array.isArray(container)) {
    container = container[0].parent;
  }
  const isPipeline = ["all", "first"].includes(
    container.previousSiblingChild.text,
  );

  //debugger;
  switch (pipelineStep) {
    case PipelineSteps.FUNCTION:
      code = "(it) => it";
      break;
    case PipelineSteps.CAPTURE:
      code = "capture('')";
      break;
    case PipelineSteps.FIRST:
      code = "first([(it) => it],[(it) => it])";
      break;
    case PipelineSteps.ALL:
      code = "all([(it) => it],[(it) => it])";
      break;
    case PipelineSteps.QUERY:
      code = "query()";
      break;
    case PipelineSteps.TYPE:
      code = "type()";
      break;
    case PipelineSteps.SPAWN_ARRAY:
      code = "spawnArray()";
      break;
  }
  if (isPipeline) code = "[" + code + "]";

  container.insert(code, "expression", index);
  //console.log(container.root.sourceString);
}

export class PipelineStepBinding {
  constructor(node, type) {
    this.type = type;
    this.node = node;
    this.component = (
      connectToRight = false,
      first = false,
      last = false,
      container,
      index,
    ) => {
      return h(
        "div",
        {
          style: {
            display: "flex",
            "flex-grow": "1",
            "align-items": "center",
            position: "relative",
          },
        },
        this.getNodeComponent(first, last, container, index),
        connectToRight ? this.horizontalLine(container, index) : null,
      );
    };
  }

  get sourceString() {
    this.node.sourceString;
  }

  horizontalLine(container, index) {
    const buttonVisible = useSignal(false);

    return html`
      <div
        style=${{ position: "relative", display: "flex", "flex-grow": "1" }}
        onmouseenter=${() => (buttonVisible.value = true)}
        onmouseleave=${async () => (buttonVisible.value = false)}
      >
        <div
          style=${{
            position: "absolute",
            display: "block",
            position: "absolute",
            width: "calc(100% + 5px)",
            height: "10px",
            opacity: "0.5",
            //background: "blue",
            "margin-top": "-4px",
            "margin-left": "-5px",
          }}
        ></div>
        <div
          style=${{
            display: "block",
            position: "absolute",
            "margin-top": "-13px",
            "margin-left": "5px",
          }}
        >
          ${addButton(buttonVisible.value, container, index)}
        </div>
        <div
          style=${{
            "border-top": "2px solid black",
            "margin-left": "-5px",
            "flex-grow": "1",
            height: "0px",
            width: "1rem",
          }}
        ></div>
      </div>
    `;
  }

  removeButton(remove) {
    return html`
      <button
        style=${{
          backgroundColor: "red",
          border: "none",
          color: "white",
          padding: "px",
          height: "20px",
          width: "20px",
          textAlign: "center",
          textDecoration: "none",
          display: "inline-block",
          fontSize: "10px",
          margin: "0px auto",
          borderRadius: "100%",
          cursor: "pointer",
          lineHeight: "20px",
          position: "absolute",
          top: "0%",
          left: "calc(100% - 15px)",
          marginRight: "-10px",
          marginTop: "-10px",
        }}
        onclick=${() => remove()}
      >
        x
      </button>
    `;
  }

  findContainer(node) {
    //console.log(node.sourceString);
    if (
      node.type == "array" ||
      (node.type == "arguments" &&
        node.previousSiblingChild.type == "identifier" &&
        ["first", "all"].includes(node.previousSiblingChild.text))
    ) {
      //console.log("returning: \n " + node.sourceString);
      //console.log(node);
      return node;
    } else {
      //console.log(node.parent);
      return node.parent ? this.findContainer(node.parent) : null;
    }
  }

  findContainerChild(node) {
    if (
      node.parent.type == "array" ||
      (node.parent.type == "arguments" &&
        node.parent.previousSiblingChild.type == "identifier" &&
        ["first", "all"].includes(node.parent.previousSiblingChild.text))
    ) {
      return node;
    } else {
      return this.findContainer(node.parent);
    }
  }

  removeElementAndParentIfEmpty(node) {
    const container = this.findContainer(node.parent);
    //console.log("container:\n" + container.sourceString);
    const containerChild = container.childBlocks.find((it) =>
      Array.from(it.allNodes())
        .map((it) => it.id)
        .includes(node.id),
    );
    //console.log("containerChild:\n" + containerChild.sourceString);
    if (containerChild) {
      //debugger;
      //console.log("Deleting: containerChild");
      //containerChild.removeSelf();
      //debugger;
      //console.log("Remaining Container:\n" + container.sourceString);
      //console.log(container);
      container.childNodes.forEach((node) => {
        if (
          node.type == "," &&
          (["[", ",", "]", "\n", "(", ")"].includes(
            node.previousSiblingNode.type,
          ) ||
            !node.previousSiblingNode)
        ) {
          node.removeSelf();
        }
      });
      //debugger;
    }
    //debugger;
    if (container && container.childBlocks.length == 0) {
      this.removeElementAndParentIfEmpty(container);
    }
  }

  getNodeComponent(
    addButtonRight = false,
    addButtonBottom = false,
    container,
    index,
  ) {
    const haloVisible = useSignal(false);
    return html`
      <div
        onmouseenter=${() => (haloVisible.value = true)}
        onmouseleave=${() => (haloVisible.value = false)}
      >
        <div style=${{ position: "relative", display: "flex" }}>
          ${this.getRawNodeComponent()}
          ${haloVisible.value
            ? this.removeButton(() => {
                this.removeElementAndParentIfEmpty(this.node);
              })
            : null}
          ${addButtonRight
            ? addButton(haloVisible.value, container[0].parent.parent, index)
            : null}
        </div>
        ${addButtonBottom
          ? html`<div
              style=${{ top: "100%", right: "0%", marginLeft: "0.5rem" }}
            >
              ${addButton(haloVisible.value, container, index + 1)}
              <div></div>
            </div>`
          : null}
      </div>
    `;
  }

  displayLabel(label) {
    return html`<div
      style=${{
        position: "absolute",
        background: "#fff",
        top: -10,
        left: 4,
        fontSize: "0.6rem",
      }}
    >
      ${label}
    </div>`;
  }

  getRawNodeComponent() {
    const baseStyle = {
      padding: "3px",
      border: "3px solid black",
      //background: "#333",
      display: "inline-block",
      position: "relative",
      marginRight: "5px",
    };

    switch (this.type) {
      case PipelineSteps.FUNCTION:
        return html`<div
          style=${{
            padding: "3px",
            "margin-right": "5px",
            borderRadius: "5px",
            border: "3px solid black",
            //background: "#333",
            display: "inline-block",
          }}
        >
          ${h(VitrailPaneWithWhitespace, {
            ignoreLeft: true,
            nodes: [this.node],
            style: { maxWidth: "300px", display: "block" },
          })}
        </div>`;
      case PipelineSteps.CAPTURE:
        return html`<div style=${{ ...baseStyle, borderColor: "orange" }}>
          ${h(TextArea, bindPlainString(this.node))}
        </div>`;
      case PipelineSteps.QUERY:
        return html`<div style=${{ ...baseStyle }}>
          ${this.displayLabel("QUERY")}
          ${h(TextArea, bindPlainString(this.node))}
        </div>`;
      case PipelineSteps.TYPE:
        return html`<div style=${{ ...baseStyle }}>
          ${this.displayLabel("TYPE")}
          ${h(TextArea, bindPlainString(this.node))}
        </div>`;
    }
  }
}

const PipelineSteps = {
  ALL: "all",
  FIRST: "first",
  FUNCTION: "function",
  SPAWN_ARRAY: "spawnArray",
  CAPTURE: "capture",
  PIPELINE: "pipeline",
  QUERY: "query",
  TYPE: "type",
};

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
