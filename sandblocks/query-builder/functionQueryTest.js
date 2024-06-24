import { checkIfDAG, getExecutionOrder } from "./queryPipeline/dag.js";
import { languageFor, languageForPath } from "../../core/languages.js";
import {
  ArrayBinding,
  ColorBinding,
  ExportBinding,
  all,
  also,
  first,
  languageSpecific,
  log,
  metaexec,
  selected,
  spawnArray,
} from "./functionQueries.js";
import { drawSelection } from "../../codemirror6/external/codemirror.bundle.js";
import { html, render, editor } from "../../view/widgets.js";
import { useComputed, useSignal } from "../../external/preact-signals.mjs";
import { offscreenVitrail } from "../../vitrail/offscreen.ts";

const tests = [];
const configStack = [{}];
let viewTest;
async function run() {
  if (viewTest) viewTest();
  else for (const test of tests) await test();
}
function test(name, cb) {
  const config = [...configStack];
  tests.push(async () => {
    try {
      for (const c of config) for (const b of c.before ?? []) b();
      await cb();
    } finally {
      for (const c of config) for (const b of c.after ?? []) b();
    }
  });
}
test.skip = () => {};
test.view = (name, cb) => {
  if (viewTest) throw new Error("multiple tests designated for viewing");
  const config = [...configStack];
  viewTest = async () => {
    for (const c of config) for (const b of c.before ?? []) b();
    await cb();
    // skip cleanup, as it would close the view
  };
};
function describe(name, cb) {
  configStack.push({});
  cb();
  configStack.pop();
}
function beforeEach(cb) {
  (configStack[configStack.length - 1].before ??= []).push(cb);
}
function afterEach(cb) {
  (configStack[configStack.length - 1].after ??= []).push(cb);
}
function assertTrue(a) {
  if (!a) throw new Error(`expected ${a} to be true`);
}
function assertEq(a, b, contains = false) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`expected ${a} to equal ${b}`);
    for (let i = 0; i < a.length; i++) assertEq(a[i], b[i], contains);
    return;
  }
  if (typeof a === "object" && typeof b === "object") {
    if (!contains) for (const k in a) assertEq(a[k], b[k], contains);
    for (const k in b) assertEq(a[k], b[k], contains);
    return;
  }
  if (a !== b) throw new Error(`expected ${a} to equal ${b}`);
}
function assertContains(a, b) {
  return assertEq(a, b, true);
}
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function simSbMatching2(tree, pipeline, replacements = []) {
  //console.log(tree);
  const res = pipeline(tree);
  if (res) {
    replacements.push(res);
  }
  tree.children.forEach((child) => {
    simSbMatching2(child, pipeline, replacements);
  });
  return replacements;
}

async function queryForBrowser(code) {
  // create editor instance
  const offscreenTest = await offscreenVitrail(code);
  // make sure it knows that we need a javascript parser
  await offscreenTest.registerValidator(languageFor("typescript"), () => true);
  // access the root node of the javascript model
  const tree = offscreenTest.getModels().get(languageFor("typescript"));

  //whitspaces need to be included (has to be consecutive range)
  const getDisplayNodes = (node) => {
    const displayNodes = [];
    let current = node;
    do {
      displayNodes.push(current);
      current = current.previousSiblingNode;
    } while (current && !current.isWhitespace() && current.type == "comment");
    return displayNodes.reverse();
  };

  function collectMembers(node) {
    return metaexec(node, (capture, selectedInput, selectedOutput) => [
      (it) => it.named,
      (it) => it.type != "comment",
      all(
        [(it) => getDisplayNodes(it), capture("displayNodes")],
        [
          (it) => {
            return it.type;
          },
          capture("type"),
        ],
        [capture("node")],
      ),
    ]);
  }

  function collectToplevel(node) {
    return metaexec(node, (capture, selectedInput, selectedOutput) => [
      (it) => it.named,
      (it) => it.type != "comment",
      all(
        [(it) => new ExportBinding(it), capture("exported")],
        [
          all(
            [(it) => getDisplayNodes(it), capture("displayNodes")],
            [
              (it) => (it.type == "export_statement" ? it.children[2] : it),
              all(
                [capture("node")],
                [(it) => it.type, capture("type")],
                [
                  first(
                    [
                      (it) => it.type == "class_declaration",
                      //Thing about queryAndCapture methode
                      (it) => it.query("class $name {$$$members}"),
                    ],
                    [
                      (it) => it.type == "import_statement",
                      (it) => it.query("import {$$$members} from '$name'"),
                    ],
                    [
                      (it) => it.type == "function_declaration",
                      (it) => it.children.find((it) => it.type == "identifier"),
                      (it) => ({ name: it, members: [] }),
                    ],
                  ),
                  all(
                    [(it) => it.name.text, capture("name")],
                    [
                      (it) => it.members,
                      spawnArray(collectMembers),
                      capture("members"),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      capture("node"),
    ]);
  }

  const pipeline = (node) =>
    metaexec(node, (capture, selectedInput, selectedOutput) => [
      (it) => it.type == "program",
      (it) => it.children,
      spawnArray(collectToplevel),
      capture("topLevel"),
    ]);

  return simSbMatching2(tree, pipeline);
}

describe("UI-Tool-Tests", () => {
  test("selected", async () => {
    console.log("selected test");
    const typescript = languageFor("typescript");
    await typescript.ready();
    const code = `const x = "test"`;
    const tree = typescript.parseSync(code);

    const pipeline = (node) =>
      metaexec(node, (capture, selectedInput, selectedOutput) => [
        (it) => it.query("const $var = $name"),
        (it) => it.name,
        selected(selectedInput(), selectedOutput(), capture("name")),
      ]);

    const res = simSbMatching2(tree, pipeline);
    console.log(res[0]);
  });
});

describe("New Execution Test", async () => {
  test("TypeFilter", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const tree = typescript.parseSync(
      "const a = [[1,2],[3,4]]\nconst b = 5\nconst c = [1,2,3]",
    );

    const pipeline = (node) =>
      metaexec(node, (capture, selectedInput, selectedOutput) => [
        (it) => it.query("const $name = $obj"),
        (it) => it.obj.type == "array",
        all(
          [(it) => it.name.text, capture("name")],
          [(it) => it.obj, capture("obj")],
        ),
      ]);

    const res = simSbMatching2(tree, pipeline);
    debugger;
    assertEq(res.length, 2);

    assertEq(res[0].name, "a");
    assertEq(res[0].obj.type, "array");
    assertEq(
      res[0].obj.children.filter((node) => node.type == "array").length,
      2,
    );

    assertEq(res[1].name, "c");
    assertEq(res[1].obj.type, "array");
  });

  test("StateMachines", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const code =
      "const s1 = new StateMaschine(edges,nodes)\nconst s2 = new StateMaschine(nodes)\nconst s3 = new StateMaschine()";
    const tree = typescript.parseSync(code);
    //TODO: finish
  });

  test("browser", async () => {
    const code = `
import { useState } from 'react'
// this is my top class!
export class MyCls {

  constructor() {}

  //I love the function!
  execute(input) {}
  
  const y = 2
}

function test(string) {
    return string
}
`;
    const res = queryForBrowser(code);
    assertEq(res.length, 1);
    assertEq(res[0].topLevel.length, 3);
    assertEq(
      res[0].topLevel.map((it) => it.type),
      ["import_statement", "class_declaration", "function_declaration"],
    );
    assertEq(res[0].topLevel[1].members.length, 3);
    assertEq(
      res[0].topLevel[1].members.map((it) => it.type),
      ["method_definition", "method_definition", "public_field_definition"],
    );
  });
});

describe("UI-Test", () => {
  let container;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    debugger;
    container.remove();
  });
  test("Ui1", async () => {
    const code = `
import { useState } from 'react'
// this is my top class!
export class MyCls {

  constructor() {}

  //I love the function!
  execute(input) {}
  
  const y = 2
}

function test(string) {
    return string
}
`;

    //const browserData = [["1", "2"]];
    const browserData = (await queryForBrowser(code))[0];
    // const browserData = [
    //   {
    //     topLevel: [
    //       { name: "class", members: ["function 1", "function 2"] },
    //       { name: "comment", members: ["function 3", "function 4"] },
    //     ],
    //   },
    // ];

    function Browser() {
      const topLevelPos = useSignal(0);
      const membersPos = useSignal(0);
      const members = useComputed(
        () => browserData.topLevel[topLevelPos.value].members,
      );
      const member = useComputed(() =>
        members.value && members.value[membersPos.value]
          ? members.value[membersPos.value]
          : null,
      );
      const currentSourceString = useComputed(() => {
        return member.value ? member.value.node.sourceString : "";
      });
      return html`
        <div
          style=${{
            display: "flex",
            "column-gap": "15px",
          }}
        >
          <div>
            <div>
              <h2>top level</h3>
            </div>
            ${browserData.topLevel.map((it, index) => {
              return html`<div
                style=${{
                  cursor: "pointer",
                  "background-color":
                    index == topLevelPos.value ? "#ADD8E6" : "#FFFFFF",
                }}
                onclick=${() => {
                  topLevelPos.value = index;
                  membersPos.value = 0;
                }}
              >
                <${it.exported.component} /> ${it.name}
              </div>`;
            })}
          </div>
          <div>
            <div>
              <h2>second level</h3>
            </div>
            ${
              members.value
                ? members.value.map((it, index) => {
                    return html`<div
                      style=${{
                        cursor: "pointer",
                        "background-color":
                          index == membersPos.value ? "#ADD8E6" : "#FFFFFF",
                      }}
                      onclick="${() => {
                        membersPos.value = index;
                      }}"
                    >
                      ${it.type}
                    </div>`;
                  })
                : null
            }
          </div>
        </div>
        ${currentSourceString.value.toString()}
      `;
    }

    render(html`<${Browser} />`, container);
  });

  test("List", async () => {
    const code_ts = `const list = [[[1],[2]],[[3],[4]]]`;
    const code_hsk = `[[1,2],[3,4]]`;
    const code_py = `list = [[1,2],[3,4]]`;
    const code_md = "| 1 | 2 |\n|---|---|\n| 3 | 4 |";

    const offscreenTest_ts = await offscreenVitrail(code_ts);
    await offscreenTest_ts.registerValidator(
      languageFor("typescript"),
      () => true,
    );
    const tree_ts = offscreenTest_ts.getModels().get(languageFor("typescript"));

    const offscreenTest_hsk = await offscreenVitrail(code_hsk);
    await offscreenTest_hsk.registerValidator(
      languageFor("haskell"),
      () => true,
    );
    const tree_hsk = offscreenTest_hsk.getModels().get(languageFor("haskell"));

    const offscreenTest_py = await offscreenVitrail(code_py);
    await offscreenTest_py.registerValidator(languageFor("python"), () => true);
    const tree_py = offscreenTest_py.getModels().get(languageFor("python"));

    // const offscreenTest_md = await offscreenVitrail(code_md);
    // await offscreenTest_md.registerValidator(
    //   languageFor("markdown"),
    //   () => true,
    // );
    // const tree_md = offscreenTest_md.getModels().get(languageFor("markdown"));
    // debugger;

    const pipeline = (tree) => {
      return metaexec(tree, (capture, selectedInput, selectedOutput) => [
        first(
          [
            languageSpecific(
              "typescript",
              (it) => it.type == "array",
              (it) => it.parent.type != "array",
            ),
          ],
          [
            languageSpecific(
              ["haskell", "python"],
              (it) => it.type == "list",
              (it) => it.parent.type != "list",
            ),
          ],
        ),
        (it) => new ArrayBinding(it),
        capture("array"),
      ]);
    };

    const res_ts = simSbMatching2(tree_ts, pipeline);
    const res_hsk = simSbMatching2(tree_hsk, pipeline);
    const res_py = simSbMatching2(tree_py, pipeline);
    //const res_md = simSbMatching2(tree_md, pipeline);

    assertEq(res_ts.length, 1);
    assertEq(res_hsk.length, 1);
    assertEq(res_py.length, 1);
    render(
      html`<${res_ts[0].array.component} /> <${res_hsk[0].array.component} />
        <${res_py[0].array.component} />`,
      container,
    );
  });

  //Color Picker for JS/TS
  test("ColorPicker", async () => {
    const code_jv =
      "const c_white = rgb(12,34,56)\n const graph = new Graph(c_color)";

    const offscreenTest_jv = await offscreenVitrail(code_jv);
    await offscreenTest_jv.registerValidator(
      languageFor("typescript"),
      () => true,
    );
    const tree_jv = offscreenTest_jv.getModels().get(languageFor("typescript"));

    const pipeline_colorDef = (tree) => {
      return metaexec(tree, (capture, selectedInput, selectedOutput) => [
        (it) => it.query("const $name = $values"),
        (it) => it.values.sourceString.includes("rgb"),
        all(
          [(it) => it.name, capture("name")],
          [(it) => it.values, capture("values")],
          [capture("node")],
        ),
      ]);
    };

    const colorDef = simSbMatching2(tree_jv, pipeline_colorDef)[0];

    const pipeline_colorOcc = (tree) => {
      return metaexec(tree, (capture, selectedInput, selectedOutput) => [
        (it) => it.type == "identifier",
        also((it) => it.text, log()),
        (it) => it.text == colorDef.name.text,
        (it) => it.parent,
        (it) => new ColorBinding(it, colorDef.values, colorDef.node),
        capture("occurence"),
      ]);
    };

    const colorOccurences = simSbMatching2(tree_jv, pipeline_colorOcc);
    debugger;
    render(html`<${colorOccurences[0].occurence.component} />`, container);
  });
});

run();
