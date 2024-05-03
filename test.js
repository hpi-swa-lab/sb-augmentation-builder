import { CodeMirrorEditor } from "./codemirror6/editor.js";
import { Extension } from "./core/extension.js";
import { languageFor } from "./core/languages.js";
import { SBMatcher } from "./core/model.js";
import {
  DeletionInteraction,
  SBReplacement,
  SelectionInteraction,
  Shard,
  ShardList,
  useValidator,
} from "./core/replacement.js";
import { SBWhitespaceModel } from "./core/whitespace.js";
import { matchingParentheses } from "./extensions/base.js";
import { h } from "./external/preact.mjs";
import {
  SandblocksEditor,
  ShardSelection,
} from "./sandblocks/editor/editor.js";
import { rangeEqual } from "./utils.js";
import { editor, markInputEditable } from "./view/widgets.js";

const testWithEditor = false ? SandblocksEditor : CodeMirrorEditor;

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
describe.skip = () => {};
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
function eventDispatched(object, name) {
  return new Promise((resolve) => {
    const handler = (e) => {
      object.removeEventListener(name, handler);
      resolve(e);
    };
    object.addEventListener(name, handler);
  });
}

afterEach(() => {
  ShardSelection.reset();
});

describe("determine side affinity", () => {
  test("left", async () => {
    const root = await languageFor("javascript").parse("23+4");
    const changes = [{ from: 1, to: 1, insert: "3" }];
    new SandblocksEditor().determineSideAffinity(root, changes);
    assertEq(changes[0].sideAffinity, -1);
  });

  test("right", async () => {
    const root = await languageFor("javascript").parse("2+34");
    const changes = [{ from: 2, to: 2, insert: "3" }];
    new SandblocksEditor().determineSideAffinity(root, changes);
    assertEq(changes[0].sideAffinity, 1);
  });

  test("none", async () => {
    const root = await languageFor("javascript").parse("245+4");
    const changes = [{ from: 1, to: 1, insert: "4" }];
    new SandblocksEditor().determineSideAffinity(root, changes);
    assertEq(changes[0].sideAffinity, 0);
  });
});

describe("range shift pending changes", () => {
  test("simple", () => {
    const editor = new testWithEditor();
    editor.pendingChanges.value = [
      { from: 3, to: 3, insert: "a", sideAffinity: -1 },
      { from: 7, to: 10, insert: "", sideAffinity: -1 },
    ];
    assertEq(editor.adjustRange([0, 1]), [0, 1]);
    assertEq(editor.adjustRange([3, 4]), [3, 5]);
    assertEq(editor.adjustRange([7, 10]), [7, 8]);
  });

  test("complex", () => {
    const editor = new testWithEditor();
    editor.pendingChanges.value = [
      { from: 5, to: 5, insert: "3" },
      { from: 6, to: 6, insert: "2" },
      { from: 7, to: 7, insert: "1" },
      { from: 8, to: 8, insert: "3" },
      { from: 1, to: 7, insert: "" },
    ];
    assertEq(editor.adjustRange([1, 6], false), [1, 4]);
  });

  test("root", () => {
    const editor = new testWithEditor();
    editor.pendingChanges.value = [{ from: 0, to: 0, insert: "a" }];
    assertEq(editor.adjustRange([0, 10], true), [0, 11]);
  });

  test("edit", async () => {
    const editor = new testWithEditor();
    await editor.setText("a + b");

    await editor.registerValidator(languageFor("javascript"), () => false);

    editor.applyChanges([
      {
        from: 0,
        to: 0,
        insert: "c",
      },
    ]);

    assertEq(editor.pendingChanges.value, [
      { from: 0, to: 0, insert: "c", sideAffinity: 1 },
    ]);

    editor.applyChanges([
      {
        from: 5,
        to: 5,
        insert: "d",
      },
    ]);

    assertEq(editor.pendingChanges.value, [
      { from: 0, to: 0, insert: "c", sideAffinity: 1 },
      { from: 5, to: 5, insert: "d", sideAffinity: 1 },
    ]);
  });
});

describe("codemirror", () => {
  let editor;
  beforeEach(() => {
    editor = new testWithEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("backspace", async () => {
    await editor.setText("b+12");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+1\n");
    editor.selectedShard.focus();
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
  });

  test("delete", async () => {
    await editor.setText("b+12");
    editor.selectAndFocus([2, 2]);
    editor.simulateKeyStroke("Delete");
    assertEq(editor.sourceString, "b+2\n");
    editor.simulateKeyStroke("Delete");
    assertEq(editor.sourceString, "b+\n");
  });

  test("backspace at boundary", async () => {
    await editor.setText("b+12");
    editor.selectAndFocus([0, 0]);
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+12\n");
  });

  test("backspace into replacement", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-hiding-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "number",
      ]),
      deletion: DeletionInteraction.Character,
      rerender: () => true,
      component: ({ node }) =>
        h("span", { style: { "background-color": "red" } }, node.text),
    });
    editor.extensions = [extension];
    await editor.setText("b+12");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+1\n");
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
  });

  test("selection in nested shard", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-program-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "program",
      ]),
      component: ({ node }) =>
        h("span", {}, "[[", h(Shard, { node: node.children[0] }), "]]"),
    });
    editor.extensions = [extension];
    await editor.setText("b+12");
    editor.selectAndFocus([4, 4]);
    assertEq(editor.shards.size, 2);
    assertEq(
      editor.selection.head.element.nodes[0],
      editor.models.get(languageFor("javascript")).children[0],
    );
    assertEq(editor.selectedShard, editor.selection.head.element);
  });

  test("delete into replacement inside shard", async () => {
    const extension = new Extension()
      .registerReplacement({
        name: "test-hiding-replacement",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        deletion: DeletionInteraction.Character,
        selection: SelectionInteraction.Skip,
        rerender: () => true,
        component: ({ node }) =>
          h("span", { style: { "background-color": "red" } }, node.text),
      })
      .registerReplacement({
        name: "test-program-replacement",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "program",
        ]),
        rerender: () => true,
        component: ({ node }) =>
          h("span", {}, "[[", h(Shard, { node: node.children[0] }), "]]"),
      });
    editor.extensions = [extension];
    await editor.setText("b+12");
    editor.selectAndFocus([4, 4]);

    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+1\n");
    editor.simulateKeyStroke("Backspace");
    assertEq(editor.sourceString, "b+\n");
    // FIXME not sure why this is necessary
    editor.selectedShard.focus();
    editor.simulateKeyStroke("a");
    await tick();
    assertEq(editor.sourceString, "b+a\n");
  });

  test("insert parentheses pair in nested shard", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-program-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "program",
      ]),
      queryDepth: 1,
      rerender: () => true,
      component: ({ node }) =>
        h("span", {}, "[[", h(ShardList, { list: node.children }), "]]"),
    });
    if (editor instanceof SandblocksEditor)
      editor.extensions = [extension, matchingParentheses];
    else editor.extensions = [extension];

    await editor.setText("a");
    editor.selectAndFocus([1, 1]);
    editor.simulateKeyStroke("(");
    assertEq(editor.selection.head.index, 2);
    assertEq(editor.sourceString, "a()\n");
    editor.simulateKeyStroke(")");
    assertEq(editor.selection.head.index, 3);
    assertEq(editor.sourceString, "a()\n");
    editor.simulateKeyStroke("b");
    assertEq(editor.selection.head.index, 4);
    assertEq(editor.sourceString, "a()b\n");
  });

  test("append char at end", async () => {
    await editor.setText("a");
    editor.selectAndFocus([2, 2]);
    editor.simulateKeyStroke("b");
    assertEq(editor.sourceString, "a\nb");
    assertEq(editor.selection.head.index, 3);
    editor.simulateKeyStroke("c");
    assertEq(editor.sourceString, "a\nbc");
  });

  test("change larger range than shard", async () => {
    const extension = new Extension().registerReplacement({
      name: "test-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "number",
      ]),
      queryDepth: 1,
      rerender: () => true,
      component: ({ node }) => h("span", {}, "[[", h(Shard, { node }), "]]"),
    });

    editor.extensions = [extension];
    await editor.setText("a+2+c");
    editor.selectAndFocus([0, 4]);
    editor.simulateKeyStroke("1");
    assertEq(editor.selection.head.index, 1);
    assertEq(editor.sourceString, "1c\n");
  });

  test("indent", async () => {
    await editor.setText("a\nb\nc\n");
    editor.selectAndFocus([0, 6]);
    // expected change: 0,0->tab, 3,3->tab, 6,6->tab
    editor.simulateKeyStroke("Tab");
    assertEq(editor.sourceString, "  a\n  b\n  c\n");
  });

  test("dedent", async () => {
    await editor.setText("  a\n  b\n  c");
    editor.selectAndFocus([0, 11]);
    editor.simulateKeyStroke("Shift+Tab");
    assertEq(editor.sourceString, "a\nb\nc\n");
  });
});

describe.skip("sandblocks", () => {
  let editor;
  beforeEach(() => {
    editor = new SandblocksEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("change type", async () => {
    await editor.setText("(1)");
    editor.applyChanges([{ from: 0, to: 0, insert: "a" }]);
    assertEq(editor.rootShard.innerText, "a(1)\n");
    editor.applyChanges([{ from: 1, to: 1, insert: "," }]);
    assertEq(editor.rootShard.innerText, "a,(1)\n");
  });
});

describe("replacement", () => {
  let editor;
  beforeEach(() => {
    editor = new testWithEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  describe("cursor positions", () => {
    test("for point selection", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        selection: SelectionInteraction.Point,
        component: ({ node }) => h("span", {}, node.text),
      });
      editor.extensions = [ext];
      await editor.setText(";12");

      const c = [...editor.rootShard.cursorPositions()];
      assertEq(editor.rootShard.replacements[0].range, [1, 3]);
      // ;  --> 0-1
      // 12 --> 1-3
      // \n --> 3-4
      assertEq(c.length, 5);
      assertTrue(c[2].element instanceof SBReplacement);
    });

    test("for start and end selection", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        selection: SelectionInteraction.StartAndEnd,
        component: () => h("input", { ref: markInputEditable, value: "ab" }),
      });
      editor.extensions = [ext];
      await editor.setText(";12");

      const c = [...editor.rootShard.cursorPositions()];
      assertEq(editor.rootShard.replacements[0].range, [1, 3]);
      assertEq(c.length, 9);
      assertTrue(c[2].element instanceof SBReplacement);
      assertTrue(c[3].element instanceof HTMLInputElement);
      assertTrue(c[4].element instanceof HTMLInputElement);
      assertTrue(c[5].element instanceof HTMLInputElement);
      assertTrue(c[6].element instanceof SBReplacement);
    });

    test("after edit after a replacement", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "array",
        ]),
        component: ({ node }) => [h(Shard, { node: node.childBlock(0) })],
      });
      editor.extensions = [ext];
      await editor.setText("2+[12]+3");

      editor.selectAndFocus([7, 7]);
      assertEq(editor.selection.head.index, 7);
      editor.simulateKeyStroke("4");
      assertEq(editor.sourceString, "2+[12]+43\n");
      assertEq(editor.selection.head.index, 8);
    });
  });

  describe("deletion", () => {
    test("by character", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        deletion: DeletionInteraction.Character,
        rerender: () => true,
        component: ({ node }) => h("span", {}, node.text),
      });
      editor.extensions = [ext];
      await editor.setText("12");
      editor.selectAndFocus([2, 2]);

      editor.simulateKeyStroke("Backspace");
      assertEq(editor.sourceString, "1\n");
      editor.simulateKeyStroke("Backspace");
      assertEq(editor.sourceString, "\n");
    });

    test("full", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        deletion: DeletionInteraction.Full,
        component: ({ node }) => h("span", {}, node.text),
      });
      editor.extensions = [ext];
      await editor.setText("12");
      editor.selectAndFocus([2, 2]);

      editor.simulateKeyStroke("Backspace");
      assertEq(editor.sourceString, "\n");
    });

    test("select then full", async () => {
      const ext = new Extension().registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        selection: SelectionInteraction.Point,
        deletion: DeletionInteraction.SelectThenFull,
        component: ({ node }) => h("span", {}, node.text),
      });
      editor.extensions = [ext];
      await editor.setText("12");
      editor.selectAndFocus([2, 2]);

      editor.simulateKeyStroke("Backspace");
      assertEq(editor.sourceString, "12\n");
      await tick();
      editor.simulateKeyStroke("Backspace");
      assertEq(editor.sourceString, "\n");
      // FIXME not sure why this is necessary
      editor.rootShard.focus();
      editor.simulateKeyStroke("a");
      assertEq(editor.sourceString, "a\n");
    });
  });

  test("update after change", async () => {
    const ext = new Extension().registerReplacement({
      name: "test-hiding-replacement",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "number",
      ]),
      rerender: () => true,
      component: ({ node }) =>
        h("span", { style: { "background-color": "red" } }, node.text),
    });
    editor.extensions = [ext];
    await editor.setText("a = ");
    editor.selectAndFocus([4, 4]);
    editor.simulateKeyStroke("1");
    editor.simulateKeyStroke("2");
    assertEq(editor.sourceString, "a = 12\n");
    assertEq(editor.rootShard.replacements[0].range, [4, 6]);
  });
});

describe("pending changes", () => {
  let editor;
  beforeEach(() => {
    editor = new testWithEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("adjust the visible ranges of a shard", async () => {
    const ext = new Extension().registerReplacement({
      name: "test",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "array",
      ]),
      component: ({ node }) => [
        h(Shard, { node: node.childBlock(0) }),
        h(Shard, { node: node.childBlock(0) }),
      ],
    });
    await editor.registerValidator(languageFor("javascript"), () => false);
    editor.extensions = [ext];
    await editor.setText("[12]");

    editor.selectAndFocus([2, 2]);
    editor.simulateKeyStroke("3");
    const ranges = [...editor.shards].map((s) => [...s.iterVisibleRanges()]);
    assertEq(ranges.filter((r) => rangeEqual(r[0], [1, 4])).length, 2);
  });

  test("are buffered correctly when parentheses are entered", async () => {
    const ext = new Extension().registerReplacement({
      name: "validator-test",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "program",
      ]),
      component: ({ node }) => {
        useValidator(node.language, () => false, []);
        return h(Shard, { node });
      },
    });
    editor.extensions = [ext];
    await editor.setText("a");
    assertEq(editor.validators.size, 2);
    editor.selectAndFocus([1, 1]);
    editor.simulateKeyStroke("(");
    editor.simulateKeyStroke(")");
    assertContains(editor.pendingChanges.value, [
      {
        from: 1,
        to: 1,
        insert: editor instanceof SandblocksEditor ? "(" : "()",
      },
      { from: 2, to: editor instanceof SandblocksEditor ? 2 : 3, insert: ")" },
    ]);
    editor.applyPendingChanges();
    assertEq(editor.sourceString, "a()\n");
  });

  test("place the cursor correctly in a shard", async () => {
    const ext = new Extension().registerReplacement({
      name: "test",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "array",
      ]),
      component: ({ node }) => [
        h(Shard, { node: node.childBlock(0) }),
        h(Shard, { node: node.childBlock(0) }),
      ],
    });
    await editor.registerValidator(languageFor("javascript"), () => false);
    editor.extensions = [ext];
    await editor.setText("2+[12]+3");

    editor.selectAndFocus([5, 5]);
    editor.simulateKeyStroke("3");
    assertEq(editor.selection.head.index, 6);
    editor.simulateKeyStroke("4");
    assertEq(editor.selection.head.index, 7);
    editor.simulateKeyStroke("+");
    assertEq(editor.selection.head.index, 8);
  });
});

describe("multiple models", () => {
  let editor;
  beforeEach(() => {
    editor = new testWithEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("both support replacements", async () => {
    const ext = new Extension()
      .registerReplacement({
        name: "test",
        query: new SBMatcher(languageFor("javascript"), [
          (x) => x.type === "number",
        ]),
        component: ({ node }) => h("span", {}, node.text),
      })
      .registerReplacement({
        name: "test2",
        query: new SBMatcher(SBWhitespaceModel, [(x) => x.type === "tab"]),
        component: ({ node }) => h("span", {}, node.text),
      });
    editor.extensions = [ext];
    await editor.setText("12\t");
    assertEq(editor.rootShard.replacements.length, 2);
  });

  test("loads model late", async () => {
    const nestedExt = new Extension().registerReplacement({
      name: "test2",
      query: new SBMatcher(languageFor("javascript"), [
        (x) => x.type === "number",
      ]),
      component: () => h("span", {}, "num"),
    });
    const ext = new Extension().registerReplacement({
      name: "test",
      query: new SBMatcher(SBWhitespaceModel, [(x) => x.type === "document"]),
      component: ({ node }) =>
        h(Shard, { node, extensions: () => [nestedExt] }),
    });
    editor.extensions = [ext];
    await editor.setText("12\t");
    if (editor.shards.size < 2) await eventDispatched(editor, "modelLoaded");
    assertEq(editor.shards.size, 2);
    assertEq(
      [...editor.shards]
        .map((s) => s.replacements.length)
        .reduce((a, b) => a + b, 0),
      2,
    );
  });
});

describe("extensions", () => {
  let editor;
  beforeEach(() => {
    editor = new testWithEditor();
    document.body.appendChild(editor);
  });
  afterEach(() => {
    editor.remove();
  });

  test("can listen to shard changes", async () => {
    let newStr = null;
    const ext = new Extension().registerShardChanged(
      (shard, string, changes) => {
        newStr = string;
      },
    );
    editor.extensions = [ext];
    await editor.setText("a");
    assertEq(newStr, "a\n");
    editor.selectAndFocus([0, 0]);
    editor.simulateKeyStroke("b");
    assertEq(newStr, "ba\n");
  });
});

run();
