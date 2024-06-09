import { languageFor } from "../core/languages.js";
import { extractType } from "../core/model.js";
import { h } from "../external/preact.mjs";
import {
  all,
  metaexec,
  optional,
  spawnArray,
} from "../sandblocks/query-builder/functionQueries.js";
import { appendCss, clsx } from "../utils.js";
import { AutoSizeTextArea } from "../view/widgets/auto-size-text-area.js";
import { ForceLayout } from "./force-layout.ts";
import {
  VitrailPane,
  VitrailPaneWithWhitespace,
  useValidateKeepReplacement,
} from "./vitrail.ts";
import { createDefaultCodeMirror } from "./codemirror6.ts";

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
          [(it) => h(AutoSizeTextArea, { node: it }), capture("nameView")],
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
      [(it) => [it.expr.parent.parent], capture("nodes")],
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
        [capture("nodes")],
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
        [capture("nodes")],
      ),
    ]),
  view: ({ id, expr, replacement }) => {
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
    );
  },
};

const v = createDefaultCodeMirror(
  `
import { createMachine, createActor } from 'xstate';

const textMachine = createMachine({
  context: {
    committedValue: '',
    value: '',
  },
  initial: 'reading',
  states: {
    reading: {
      on: {
        'text.edit': { target: 'editing' },
      },
    },
    editing: {
      on: {
        /*'text.change': {
          actions: assign({
            value: ({ event }) => event.value,
          }),
        },
        'text.commit': {
          actions: assign({
            committedValue: ({ context }) => context.value,
          }),
          target: 'reading',
        },
        'text.cancel': {
          actions: assign({
            value: ({ context }) => context.committedValue,
          }),
          target: 'reading',
        },*/
      },
    },
  },
});

const textActor = createActor(textMachine).start();

textActor.subscribe((state) => {
  console.log(bWatch(state.context.value, '123'));
});

textActor.send({ type: sbWatch('text.edit', '123') });
/*textActor.send({ type: 'text.change', value: 'Hello' });
textActor.send({ type: 'text.commit' });
textActor.send({ type: 'text.edit' });
textActor.send({ type: 'text.change', value: 'Hello world' });
textActor.send({ type: 'text.cancel' });*/
      `,
  document.querySelector("#editor")!,
  [xstate, sendAction, watch],
);
console.log(v);
