import { CodeMirrorEditor } from "./codemirror6/editor.js";
import { SandblocksEditor } from "./sandblocks/editor/editor.js";

const tests = [];
const configStack = [{}];
function test(name, cb) {
  const config = [...configStack];
  tests.push(async () => {
    for (const c of config) for (const b of c.before ?? []) b();
    await cb();
    for (const c of config) for (const b of c.after ?? []) b();
  });
}
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
function assertEq(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`expected ${a} to equal ${b}`);
    for (let i = 0; i < a.length; i++) assertEq(a[i], b[i]);
    return;
  }
  if (typeof a === "object" && typeof b === "object") {
    for (const k in a) assertEq(a[k], b[k]);
    for (const k in b) assertEq(a[k], b[k]);
    return;
  }
  if (a !== b) throw new Error(`expected ${a} to equal ${b}`);
}

describe("codemirror", () => {
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

tests.forEach((t) => t());
