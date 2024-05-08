import { checkIfDAG, getExecutionOrder } from "./queryPipeline/dag.js";
import {
  AstGrepQuery,
  Filter,
  Pipeline,
  PipelineNode,
  SearchType,
} from "./queryPipeline/pipelineNode.ts";
import { languageFor } from "../../core/languages.js";

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

function simSbMatching(tree, pipeline, replacements = []) {
  let res = pipeline.execute(tree);
  if (res[0]) replacements.push(res[1]);
  tree.children.forEach((child) =>
    simSbMatching(child, pipeline, replacements),
  );
  return replacements;
}

describe("check validity of DAG", () => {
  test("validDAG", async () => {
    /*
     * ┌─┐
     * │A│
     * └┬┘
     *  │
     *  ▼
     * ┌─┐    ┌─┐
     * │B├───►│C│
     * └┬┘    └┬┘
     *  │      │
     *  ▼      │
     * ┌─┐     │
     * │D│◄────┘
     * └─┘
     */
    const graph = new Pipeline();
    const nodeA = new PipelineNode("NodeA");
    const nodeB = new PipelineNode("NodeB");
    const nodeC = new PipelineNode("NodeC");
    const nodeD = new PipelineNode("NodeD");

    nodeA.addConnection(nodeB);
    nodeA.addConnection(nodeC);
    nodeB.addConnection(nodeC);
    nodeB.addConnection(nodeD);

    graph.addNode(nodeA);
    graph.addNode(nodeB);
    graph.addNode(nodeC);
    graph.addNode(nodeD);
    assertTrue(checkIfDAG(graph));
  });

  test("invalidDAG", async () => {
    /*
     * ┌─┐
     * │A│◄────┐
     * └┬┘     │
     *  │      │
     *  ▼      │
     * ┌─┐    ┌┴┐
     * │B├───►│C│
     * └┬┘    └┬┘
     *  │      │
     *  ▼      │
     * ┌─┐     │
     * │D│◄────┘
     * └─┘
     */

    const graph = new Pipeline();
    const nodeA = new PipelineNode("NodeA");
    const nodeB = new PipelineNode("NodeB");
    const nodeC = new PipelineNode("NodeC");
    const nodeD = new PipelineNode("NodeD");

    nodeA.addConnection(nodeB);
    nodeA.addConnection(nodeC);
    nodeB.addConnection(nodeC);
    nodeB.addConnection(nodeD);
    nodeC.addConnection(nodeA);

    graph.addNode(nodeA);
    graph.addNode(nodeB);
    graph.addNode(nodeC);
    graph.addNode(nodeD);

    assertTrue(!checkIfDAG(graph));
  });

  test("onlyOneNode", async () => {
    /*
     * ┌─┐
     * │A│
     * └─┘
     */
    const graph = new Pipeline();
    const nodeA = new PipelineNode("NodeA", () => {});

    graph.addNode(nodeA);

    assertTrue(checkIfDAG(graph));
  });

  test("smallestCircle", async () => {
    /*
     *   ┌─┐
     * ┌─┤A│◄┐
     * │ └─┘ │
     * │     │
     * │     │
     * │ ┌─┐ │
     * └►│B├─┘
     *   └─┘
     */

    const graph = new Pipeline();
    const nodeA = new PipelineNode("NodeA");
    const nodeB = new PipelineNode("NodeB");

    nodeA.addConnection(nodeB);
    nodeB.addConnection(nodeA);

    graph.addNode(nodeA);
    graph.addNode(nodeB);

    assertTrue(!checkIfDAG(graph));
  });
});

describe("check execution order", () => {
  test("executionOrder", async () => {
    /*
     * ┌─┐
     * │A│
     * └┬┘
     *  │
     *  ▼
     * ┌─┐    ┌─┐
     * │B├───►│C│
     * └┬┘    └┬┘
     *  │      │
     *  ▼      │
     * ┌─┐     │
     * │D│◄────┘
     * └─┘
     */
    const graph = new Pipeline();
    const nodeA = new PipelineNode("NodeA");
    const nodeB = new PipelineNode("NodeB");
    const nodeC = new PipelineNode("NodeC");
    const nodeD = new PipelineNode("NodeD");

    nodeA.addConnection(nodeB);
    nodeA.addConnection(nodeC);
    nodeB.addConnection(nodeC);
    nodeB.addConnection(nodeD);
    nodeC.addConnection(nodeD);

    graph.addNode(nodeA);
    graph.addNode(nodeB);
    graph.addNode(nodeC);
    graph.addNode(nodeD);

    assertEq(
      getExecutionOrder(graph).map((node) => node.name),
      ["NodeA", "NodeB", "NodeC", "NodeD"],
    );
  });
});

describe("PipelineExecution", async () => {
  test("Pipeline Single Query", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const tree = typescript.parseSync(
      "const name =  'test'\nconst ui = new UI(name)",
    );

    const query = new AstGrepQuery("Query1", "const $a = $b", false);
    const pipeline = new Pipeline();

    pipeline.addNode(query);
    const res = simSbMatching(tree, pipeline);

    assertEq(res.length, 2);
  });

  /**
   * Input: const x = [[1,2],[3,4]]
   *        const x = 5
   *
   * Query: let x = $a
   * Filter: a.type == array
   *
   * Output: a = [[1,2],[3,4]]
   */
  /*
  test("AstGrepQueryMatchOnlyOne", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const pipeline = new Pipeline();
    const tree = typescript.parseSync("const x = [[1,2],[3,4]]\nconst x = 5");
    const query = new AstGrepQuery("AstGrepQuery1", "let x = $a", tree);
    const filter = new Filter("Filter1", "input.a.type == 'array'");
    query.addConnection(filter);
    pipeline.addNode(query);
    pipeline.addNode(filter);
    debugger;
    const res = pipeline.execute(tree, true);
    assertTrue(res[0].a.type == "array");
    assertTrue(res.length == 1);
  });
  */

  /**
   * Input:      const x = 0
   *             const y = 1
   *
   *             const mood = [😇,👿]
   *
   *
   *             onLikeButtonPressed() {
   *                console.log(mood[x])
   *             }
   *             onDislikeButtonPressed() {
   *                console.log(mood[y])
   *             }
   *
   * Query:      mood[$pos]
   * Sub query:  const $pos = $mood
   *
   * Output:
   */
  test("AstGrepQueryMultiple", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const code =
      "const x = 0\n" +
      "const y = 1\n" +
      "const mood = ['😇','👿']\n" +
      "fun onDislikeButtonPressed() {\n   console.log(mood[y])\n}\n" +
      "fun onLikeButtonPressed() {\n   console.log(mood[x])\n}\n";

    const tree = typescript.parseSync(code);

    const query1 = new AstGrepQuery(
      "AstGrepQuery1",
      "mood[$a]",
      false,
      SearchType.THIS_NODE,
    );
    const query2 = new AstGrepQuery(
      "AstGrepQuery2",
      "const €captures.get('a').children[0].text€ = $pos",
      false,
      SearchType.PROGRAM,
    );
    const moodQuery = new AstGrepQuery(
      "MoodQuery",
      "const mood = $moods",
      false,
      SearchType.PROGRAM,
    );

    query1.addConnection(query2);
    query1.addConnection(moodQuery);

    const pipeline = new Pipeline();
    pipeline.addNode(query1);
    pipeline.addNode(query2);
    pipeline.addNode(moodQuery);

    const res = simSbMatching(tree, pipeline);
    assertEq(res.length, 2);

    assertEq(res[0].captures.size, 3);
    assertEq(res[0].captures.get("a").text, "y");
    assertEq(res[0].captures.get("pos").text, "1");

    assertEq(res[1].captures.size, 3);
    assertEq(res[1].captures.get("a").text, "x");
    assertEq(res[1].captures.get("pos").text, "0");
  });

  test("DifferentStateMachines", async () => {
    const typescript = languageFor("typescript");
    await typescript.ready();
    const code =
      "const s1 = new StateMaschine(edges,nodes)\nconst s2 = new StateMaschine(nodes)\nconst s3 = new StateMaschine()";

    const tree = typescript.parseSync(code);

    const queryS1 = new AstGrepQuery(
      "QueryS1",
      "const $sname = new StateMaschine($edges, $nodes)",
    );
    const queryS2 = new AstGrepQuery(
      "QueryS2",
      "const $sname = new StateMaschine($nodes)",
    );
    const queryS3 = new AstGrepQuery(
      "QueryS3",
      "const $sname = new StateMaschine()",
    );
    const pipeline = new Pipeline();
    pipeline.addNode(queryS1);
    pipeline.addNode(queryS2);
    pipeline.addNode(queryS3);

    const res = simSbMatching(tree, pipeline);

    assertEq(res[0].captures.size, 3);
    assertEq(res[1].captures.size, 2);
    assertEq(res[2].captures.size, 1);
  });
});

run();
