import { languageFor } from "../core/languages.js";
import { extractType } from "../core/model.js";
import { useEffect, useMemo } from "../external/preact-hooks.mjs";
import { useSignal } from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";
import {
  TextArea,
  bindPlainString,
  bindSourceString,
} from "../sandblocks/query-builder/bindings.ts";
import {
  all,
  first,
  languageSpecific,
  metaexec,
  optional,
  replace,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { appendCss, clsx } from "../utils.js";
import { markInputEditableForNode } from "../view/focus.ts";
import { ForceLayout } from "./force-layout.ts";
import {
  SelectionInteraction,
  VitrailPane,
  VitrailPaneWithWhitespace,
  changesIntendToDeleteNode,
  useValidateKeepReplacement,
  useValidator,
} from "./vitrail.ts";

const objectField = (field) => (it) =>
  it.findQuery(`let a = {${field}: $value}`, extractType("pair"))?.value;

const objectKeyName = (keyOrString) =>
  keyOrString.type === "string"
    ? keyOrString.childBlock(0).text
    : keyOrString.text;

const query = (query, extract?) => (it) => it.query(query, extract);
const queryDeep = (query, extract?) => (it) => it.findQuery(query, extract);

const collectState = (it) =>
  metaexec(it, (capture) => [
    all(
      [
        (it) => it.atField("key"),
        all(
          [(it) => it.text, capture("name")],
          [(it) => h(TextArea, bindSourceString(it)), capture("nameView")],
        ),
      ],
      [(it) => it.id, capture("id")],
      [
        queryDeep("let a = {on: {$$$transitions}}", extractType("pair")),
        (it) => it.transitions,
        spawnArray(collectTransition),
        capture("transitions"),
      ],
    ),
  ]);

const collectTransition = (it) =>
  metaexec(it, (capture) => [
    all(
      [(it) => it.id, capture("id")],
      [(it) => it.atField("key"), objectKeyName, capture("event")],
      [
        (it) => it.atField("value"),
        all(
          [
            optional([
              objectField("actions"),
              (it) => h(VitrailPane, { nodes: [it] }),
              capture("actions"),
            ]),
          ],
          [
            objectField("target"),
            (it) => it.childBlock(0).text,
            capture("target"),
          ],
        ),
      ],
    ),
  ]);

const xstatePipeline = (it) =>
  metaexec(it, (capture) => [
    query("createMachine($expr)"),
    all(
      [(it) => [it.expr.parent.parent], replace(capture)],
      [
        (it) => it.expr,
        all(
          [objectField("context"), capture("context")],
          [
            optional([
              objectField("initial"),
              (it) => it.childBlock(0),
              (it) => it.text,
              capture("initial"),
            ]),
          ],
          [
            queryDeep("let a = {states: {$$$states}}", extractType("pair")),
            (it) => it.states,
            spawnArray(collectState),
            capture("states"),
          ],
        ),
      ],
    ),
  ]);

appendCss(`
    .xstate-statemachine {
        display: inline-block;
        padding: 0.5rem;
        border: 1px solid black;
    }
    .xstate-state {
        display: inline-block;
        padding: 0.5rem;
        margin: 0.5rem;
        border: 1px solid black;
    }
    .xstate-state.initial {
        border: 4px double black;
    }
`);

export const xstate = {
  model: languageFor("javascript"),
  matcherDepth: 100,
  rerender: () => true,
  match: (x, _pane) => xstatePipeline(x),
  view: ({ states, initial }) => {
    return h(ForceLayout, {
      className: "xstate-statemachine",
      nodes: states.map(({ name, nameView, id }) => ({
        name,
        node: h(
          "div",
          { class: clsx("xstate-state", name === initial && "initial") },
          h("strong", {}, nameView),
        ),
        key: id,
      })),
      edges: states.flatMap(({ name: from, transitions }) =>
        (transitions ?? []).map(({ event, target: to, id }) => ({
          label: h("div", {}, event),
          from,
          to,
          key: id,
        })),
      ),
    });
  },
};

export const sendAction = {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      all(
        [query("textActor.send($obj)"), (it) => it.obj, capture("obj")],
        [replace(capture)],
      ),
    ]),
  view: ({ obj }) =>
    h("span", {}, ":rocket: ", h(VitrailPane, { nodes: [obj] })),
};

export const watch = {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      all(
        [
          query("sbWatch($expr, $id)"),
          all(
            [(it) => it.id, capture("id")],
            [(it) => it.expr, capture("expr")],
          ),
        ],
        [replace(capture)],
      ),
    ]),
  view: ({ id, expr, replacement }) => {
    const checked = useSignal(false);
    useValidateKeepReplacement(replacement);
    return h(
      "span",
      {
        style: {
          padding: "3px",
          borderRadius: "5px",
          display: "inline-block",
          background: "#333",
        },
      },
      h(VitrailPaneWithWhitespace, { nodes: [expr] }),
      h("input", {
        type: "checkbox",
        checked: checked.value,
        oninput: (e) => (checked.value = e.target.checked),
      }),
    );
  },
};

export function createPlaceholder(label: string) {
  return "__VI_PLACEHOLDER_" + label.replace(/ /g, "_");
}

export const placeholder = {
  model: languageFor("javascript"),
  matcherDepth: 1,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      first([
        languageSpecific(
          "javascript",
          (it) => it.type === "identifier",
          (it) => it.text.startsWith("__VI_PLACEHOLDER"),
          replace(capture),
        ),
      ]),
    ]),
  selectionInteraction: SelectionInteraction.Skip,
  view: ({ nodes, replacement }) => {
    const text = useMemo(() => nodes[0].text, []);

    useValidateKeepReplacement(replacement);
    // prevent changes after the placeholder from changing our label
    useValidator(
      languageFor("javascript"),
      (_root, _diff, changes) =>
        changesIntendToDeleteNode(changes, nodes[0]) || nodes[0].text === text,
      [nodes[0].text],
    );

    return h("input", {
      ref: markInputEditableForNode(nodes[0].range),
      placeholder: nodes[0].text
        .substring("__VI_PLACEHOLDER_".length)
        .replace(/_/g, " "),
      oninput: (e) => nodes[0].replaceWith(e.target.value, [nodes[0]]),
    });
  },
};

export const smileys = {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      (x) => x.type === "lexical_declaration",
      (x) => x.childNode(0),
      all([replace(capture)], [(x) => x.text, capture("type")]),
    ]),
  view: ({ type, nodes }) => {
    return h(
      "span",
      { onclick: () => nodes[0].replaceWith(type === "let" ? "const" : "let") },
      type === "let" ? "let 😀" : "const 😇",
    );
  },
};

export const colorstring = {
  model: languageFor("javascript"),
  matcherDepth: 3,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      (x) => x.type === "string",
      (x) => x.childBlock(0),
      (x) => !!x.text.match(/^rgba?\(.*\)$/),
      all([replace(capture)], [(x) => x.text, capture("value")]),
    ]),
  view: ({ type, nodes }) => {
    return h(
      "div",
      {},
      h("div", {
        style:
          `
              display: inline-block; 
              background: ` +
          nodes[0].text +
          `; 
              width: 20px; 
              position: relative;
              white-space: wrap;
              height: 20px; 
              border: 1px solid red`,
        onclick: async (evt) => {},
      }),
      h(VitrailPaneWithWhitespace, { nodes: nodes }),
    );
  },
};

export const text = {
  model: languageFor("javascript"),
  matcherDepth: 1,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      (it) => it.type === "string",
      all([replace(capture)], [bindPlainString, capture("text")]),
    ]),
  view: ({ text }) => {
    return h(TextArea, text);
  },
};
