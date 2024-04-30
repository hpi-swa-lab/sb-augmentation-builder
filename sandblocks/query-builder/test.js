import { checkIfDAG, getExecutionOrder } from "./dag.js";
import { Pipeline, PipelineNode } from "./piplineNode.js";

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
//TODO Write Test test for tree

test("validDAG", async () => {
  const graph = new Pipeline();
  const nodeA = new PipelineNode("NodeA", () => console.log(self.name));
  const nodeB = new PipelineNode("NodeB", () => console.log(self.name));
  const nodeC = new PipelineNode("NodeC", () => console.log(self.name));
  const nodeD = new PipelineNode("NodeD", () => console.log(self.name));

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
  const graph = new Pipeline();
  const nodeA = new PipelineNode("NodeA", () => console.log(self.name));
  const nodeB = new PipelineNode("NodeB", () => console.log(self.name));
  const nodeC = new PipelineNode("NodeC", () => console.log(self.name));
  const nodeD = new PipelineNode("NodeD", () => console.log(self.name));

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

test("executionOrder", async () => {
  const graph = new Pipeline();
  const nodeA = new PipelineNode("NodeA", () => console.log("A"));
  const nodeB = new PipelineNode("NodeB", () => console.log("B"));
  const nodeC = new PipelineNode("NodeC", () => console.log("C"));
  const nodeD = new PipelineNode("NodeD", () => console.log("D"));

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
  assertTrue(checkIfDAG(graph));
});

run();
