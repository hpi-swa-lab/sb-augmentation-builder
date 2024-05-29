import { checkIfDAG, getExecutionOrder } from "./queryPipeline/dag.js";
import {
  AllNodes,
  AstGrepQuery,
  OptionalQuery,
  RootQuery,
  Pipeline,
  PipelineNode,
  SingleNode,
  Filter,
  CodeMatchQuery,
  TypeQuery,
  Children,
  SubNodes,
} from "./queryPipeline/pipelineNode.ts";
import { languageFor } from "../../core/languages.js";
import { SBBlock } from "../../core/model.js";
import { caseOf, exec } from "../../utils.js";
import {
  BoolBinding,
  ExportBinding,
  all,
  first,
  metaexec,
  spawnArray,
} from "./functionQueries.js";

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
  tree.children.forEach((child) =>
    simSbMatching2(child, pipeline, replacements),
  );
  return replacements;
}

describe("New Execution Test", async () => {
  test("test0", async () => {
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
    const typescript = languageFor("typescript");
    await typescript.ready();

    const tree = typescript.parseSync(code);

    const getDisplayNodes = (node) => {
      //debugger;
      const displayNodes = [];
      let current = node;
      do {
        displayNodes.push(current);
        current = current.previousSiblingNode;
      } while (current && !current.isWhitespace() && current.type == "comment");
      return displayNodes.reverse();
    };

    function collectMembers(node) {
      return metaexec(node, (capture) => [
        (it) => it.named,
        all([
          [(it) => getDisplayNodes(it), capture("displayNodes")],
          [
            (it) => {
              return it.type;
            },
            capture("type"),
          ],
          [capture("node")],
        ]),
      ]);
    }

    function collectToplevel(node) {
      return metaexec(node, (capture) => [
        (it) => it.named,
        all([
          [
            (it) => new ExportBinding(it.type == "export_statement"),
            capture("exported"),
          ],
          [
            all([
              [(it) => getDisplayNodes(it), capture("displayNodes")],
              [
                (it) => (it.type == "export_statement" ? it.children[2] : it),
                all([
                  [capture("node")],
                  [(it) => it.type, capture("type")],
                  [
                    first([
                      [
                        (it) => it.type == "class_declaration",
                        (it) => it.query("class $name {$$$members}"),
                      ],
                      [
                        (it) => it.type == "import_statement",
                        (it) => it.query("import {$$$members} from '$name'"),
                      ],
                      [
                        (it) => it.type == "function_declaration",
                        (it) =>
                          it.children.filter(
                            (it) => it.type == "identifier",
                          )[0],
                        (it) => ({ name: it, members: [] }),
                      ],
                      [(it) => null],
                    ]),
                    all([
                      [(it) => it.name.text, capture("name")],
                      [
                        (it) => it.members,
                        spawnArray(collectMembers),
                        capture("members"),
                      ],
                    ]),

                    // all([
                    //   [(it) => it.name.text, capture("name")],
                    //   [
                    //     (it) => it.members,
                    //     all([
                    //       ([
                    //         (it) => getDisplayNodes(it),
                    //         capture("displayNodes"),
                    //       ],
                    //       [capture("node")],
                    //       [(it) => it.type, capture("type")]),
                    //     ]),
                    //   ],
                    // ]),
                  ],
                ]),
              ],
            ]),
          ],
          //TODO: Test Binding implementation
          //(it) => new Binding(it)
          //capture("node", ExportBinding),
          //fork([[(it) => it.type, capture("type")], []]),

          //(it) =>
          //  metaexec(it, (capture, spawnArray) => [
          //    (it) => it.type,
          //    capture("type"),
          //  ]),
        ]),
        capture("node"),
      ]);
    }

    const pipeline = (node) =>
      metaexec(node, (capture) => [
        (it) => it.type == "program",
        (it) => it.children,
        spawnArray(collectToplevel),
        capture("topLevel"),
        //(it) => it.named,
        //capture("named"),
      ]);

    const res = simSbMatching2(tree, pipeline);

    console.log(res);
  });

  test("test1", async () => {
    return;
    const code = `
import { useState } from 'react'
// this is my top class!
export class MyCls {

  constructor() {}

  execute(input) {}
  
  const x = 1

  const y = 2
}
`;

    const typescript = languageFor("typescript");
    await typescript.ready();

    const tree = typescript.parseSync(code);

    let capture = {
      topLevel: [],
    };

    const findTopLevel = (node) => {
      //nodeList.captureAdd = (capture, name) => {
      //  debugger;
      //  this.forEach((elem) => {
      //    capture[name].push(elem);
      //  });
      //};
      //debugger;
      /*
      try {
        const res = [node]
          .filter((it) => it.type == "program")
          .map((it) => it.children)[0]
          .filter((it) => it.named)
          .map((it) => isExported(it, {}))
          .forEach((it) => capture["topLevel"].push(it));
        return capture;
      } catch {
        return null;
      }
      */

      function collectToplevel(node) {
        return exec(
          (it) => it.named,
          (it) => isExported(it, {}),
        );
      }

      const res = exec(node, (capture) => [
        (it) => it.type == "program",
        fork(
          [
            (it) => it.children,
            spawnArray(collectToplevel),
            capture("topLevel"),
          ],
          [
            (it) => it.name,
            capture("topLevelName"),
            (it) => 1111111111111111111,
          ],
        ),
        //(it) =>
        //  it.map((it) => {
        //    capture["topLevel"].push(it);
        //    return it;
        //  }),
      ]);
      return res ? capture : null;
    };

    const isExported = (node, capture) => {
      const exported = node.type == "export_statement";
      capture["exported"] = exported;
      if (exported) {
        //TODO: remove hardcoded index
        return getNodeInfo(node.children[2], capture);
      } else {
        return getNodeInfo(node, capture);
      }
    };

    const getNodeInfo = (node, capture) => {
      //TODO: Make custom methode orderFork
      switch (node.type) {
        case "class_declaration":
          capture["name"] = node.children[2].children[0].text;
          capture["members"] = node.children[4].children.filter(
            (it) => it.named && !it.isWhitespace(),
          );
          //node.children.filter(it => it.type == "class_body")[0].Children.filter(it => it.named && !it.isWhiteSpace())
          break;
        case "import_statement":
          capture["name"] = PipelineArray.from(node.allNodes()).filter(
            (it) => it.type == "identifier",
          )[0].text;
          capture["members"] = [];
          break;
      }
      return capture;
    };

    console.log(simSbMatching2(tree, findTopLevel));
  });
});

run();
