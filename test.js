import { CodeMirrorEditor } from "./codemirror6/editor.js";
import { Extension } from "./core/extension.js";
import {
  SBReplacement,
  SelectionInteraction,
  useValidator,
} from "./core/replacement.js";
import { h } from "./external/preact.mjs";
import { SandblocksEditor } from "./sandblocks/editor/editor.js";
import { markInputEditable, shard } from "./view/widgets.js";

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

describe("codemirror offscreen", () => {
  test("range shift complex", () => {
    const editor = new CodeMirrorEditor();
    editor.pendingChanges.value = [
      { from: 5, to: 5, insert: "3" },
      { from: 6, to: 6, insert: "2" },
      { from: 7, to: 7, insert: "1" },
      { from: 8, to: 8, insert: "3" },
      { from: 1, to: 7, insert: "" },
    ];
    assertEq(editor.adjustRange([1, 6], false), [1, 4]);
  });

  test("range shift simple", () => {
    const editor = new CodeMirrorEditor();
    editor.pendingChanges.value = [
      { from: 3, to: 3, insert: "a" },
      { from: 7, to: 10, insert: "" },
    ];
    assertEq(editor.adjustRange([0, 1], false), [0, 1]);
    assertEq(editor.adjustRange([3, 4], false), [4, 5]);
    assertEq(editor.adjustRange([7, 10], false), [7, 8]);
  });

  test("range shift root", () => {
    const editor = new CodeMirrorEditor();
    editor.pendingChanges.value = [{ from: 0, to: 0, insert: "a" }];
    assertEq(editor.adjustRange([0, 10], true), [0, 11]);
  });

  test("edit with pending changes", async () => {
    const editor = new CodeMirrorEditor();
    await editor.setText("a + b", "javascript");

    editor.registerValidator(() => false);

    editor.applyChanges([
      {
        from: 0,
        to: 0,
        insert: "c",
      },
    ]);

    assertEq(editor.pendingChanges.value, [{ from: 0, to: 0, insert: "c" }]);

    editor.applyChanges([
      {
        from: 5,
        to: 5,
        insert: "d",
      },
    ]);

    assertEq(editor.pendingChanges.value, [
      { from: 0, to: 0, insert: "c" },
      { from: 5, to: 5, insert: "d" },
    ]);
  });
});

describe("codemirror", () => {
  let editor;
  beforeEach(() => {
    editor = new CodeMirrorEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("delete", async () => {
    await editor.setText("b+12", "javascript");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("Backspace");
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
  });

  test("delete into replacement", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-hiding-replacement",
      query: [(x) => x.type === "number"],
      queryDepth: 1,
      rerender: () => true,
      component: ({ node }) =>
        h("span", { style: { "background-color": "red" } }, node.text),
    });
    editor.inlineExtensions = [extension];
    await editor.setText("b+12", "javascript");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+1\n");
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
  });

  test("selection in nested shard", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-program-replacement",
      query: [(x) => x.type === "program"],
      queryDepth: 1,
      component: ({ node }) =>
        h("span", {}, "[[", shard(node.children[0]), "]]"),
    });
    editor.inlineExtensions = [extension];
    await editor.setText("b+12", "javascript");
    editor.selectAndFocus([4, 4]);
    assertEq(editor.selection.head.element.node, editor.node.children[0]);
    assertEq(editor.selectedShard, editor.selection.head.element);
  });

  test("delete into replacement inside shard", async () => {
    const extension = new Extension()
      .registerReplacement({
        name: "test-hiding-replacement",
        query: [(x) => x.type === "number"],
        queryDepth: 1,
        rerender: () => true,
        component: ({ node }) =>
          h("span", { style: { "background-color": "red" } }, node.text),
      })
      .registerReplacement({
        name: "test-program-replacement",
        query: [(x) => x.type === "program"],
        queryDepth: 1,
        rerender: () => true,
        component: ({ node }) =>
          h("span", {}, "[[", shard(node.children[0]), "]]"),
      });
    editor.inlineExtensions = [extension];
    await editor.setText("b+12", "javascript");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+1\n");
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
    editor.simulateKeyStroke("a");
    await tick();
    assertEq(editor.sourceString, "b+a\n");
  });
});

describe("sandblocks", () => {
  let editor;
  beforeEach(() => {
    editor = new SandblocksEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("change type", async () => {
    await editor.setText("(1)", "javascript");
    editor.applyChanges([{ from: 0, to: 0, insert: "a" }]);
    assertEq(editor.rootShard.innerText, "a(1)\n");
    editor.applyChanges([{ from: 1, to: 1, insert: "," }]);
    assertEq(editor.rootShard.innerText, "a,(1)\n");
  });
});

describe("replacement", () => {
  let editor;
  beforeEach(() => {
    editor = new SandblocksEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("cursor positions for point selection", async () => {
    const ext = new Extension().registerReplacement({
      name: "test",
      query: [(x) => x.type === "number"],
      queryDepth: 1,
      selection: SelectionInteraction.Point,
      component: ({ node }) => h("span", {}, node.text),
    });
    editor.inlineExtensions = [ext];
    await editor.setText(";12", "javascript");

    const c = [...editor.rootShard.cursorPositions()];
    assertEq(editor.rootShard.replacements[0].range, [1, 3]);
    // ;  --> 0-1
    // 12 --> 1-3
    // \n --> 3-4
    assertEq(c.length, 5);
    assertTrue(c[2].element instanceof SBReplacement);
  });

  test("cursor positions for start and end selection", async () => {
    const ext = new Extension().registerReplacement({
      name: "test",
      query: [(x) => x.type === "number"],
      queryDepth: 1,
      selection: SelectionInteraction.StartAndEnd,
      component: () => h("input", { ref: markInputEditable, value: "ab" }),
    });
    editor.inlineExtensions = [ext];
    await editor.setText(";12", "javascript");

    const c = [...editor.rootShard.cursorPositions()];
    assertEq(editor.rootShard.replacements[0].range, [1, 3]);
    assertEq(c.length, 9);
    assertTrue(c[2].element instanceof SBReplacement);
    assertTrue(c[3].element instanceof HTMLInputElement);
    assertTrue(c[4].element instanceof HTMLInputElement);
    assertTrue(c[5].element instanceof HTMLInputElement);
    assertTrue(c[6].element instanceof SBReplacement);
  });
});

describe("pending changes", () => {
  let editor;
  beforeEach(() => {
    editor = new CodeMirrorEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test.skip("are buffered correctly when parentheses are entered", async () => {
    const ext = new Extension().registerReplacement({
      name: "validator-test",
      query: [(x) => x.type === "program"],
      queryDepth: 1,
      component: ({ node }) => {
        useValidator(() => false, []);
        return shard(node);
      },
    });
    editor.inlineExtensions = [ext];
    await editor.setText("a", "javascript");
    assertEq(editor.validators.size, 1);
    editor.selectAndFocus([1, 1]);
    editor.simulateKeyStroke("(");
    editor.simulateKeyStroke(")");
    assertContains(editor.pendingChanges.value, [
      { from: 1, to: 1, insert: "()" },
    ]);
    editor.applyPendingChanges();
    assertEq(editor.sourceString, "a()\n");
  });
});

run();
