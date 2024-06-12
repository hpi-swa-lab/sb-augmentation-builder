import { languageFor } from "../core/languages.js";
import { h } from "../external/preact.mjs";
import {
  metaexec,
  all,
  query,
  spawnArray,
  queryDeep,
} from "../sandblocks/query-builder/functionQueries.js";
import { VitrailPane, useValidateKeepReplacement } from "./vitrail.ts";
import { createDefaultCodeMirror } from "./codemirror6.ts";
import { useSignal } from "../external/preact-signals.mjs";
import { useLocalStorageSignal } from "../view/widgets.js";

const processTask = (it) =>
  metaexec(it, (capture) => [
    query("task($name, $frequency, $id, $assignees)"),
    all(
      [(it) => it.id.childBlock(0).text, capture("id")],
      [(it) => it.name.childBlock(0).text, capture("name")],
      [
        (it) => it.frequency,
        query("every($interval, $unit)"),
        (it) => ({
          interval: it.interval.text,
          unit: it.unit.childBlock(0).text,
        }),
        capture("frequency"),
      ],
    ),
  ]);
const processCompleted = (it) =>
  metaexec(it, (capture) => [
    query("complete($id, $assignee, $date)"),
    all(
      [(it) => it.id.childBlock(0).text, capture("id")],
      [(it) => new Date(it.date.childBlock(0).text), capture("date")],
    ),
  ]);

let memo: { source: string; func: any } | null = null;
const evalLastMemo = (source) => {
  if (!memo || memo.source !== source) {
    return (memo = { source, func: eval(source) });
  } else {
    return memo.func;
  }
};

export const planner = {
  model: languageFor("javascript"),
  matcherDepth: Infinity,
  rerender: () => true,
  match: (x, _pane) =>
    metaexec(x, (capture) => [
      all(
        [
          query("const completed = $completed;"),
          (it) => it.completed,
          all(
            [capture("completedList")],
            [
              (it) => it.childBlocks,
              spawnArray(processCompleted),
              capture("completed"),
            ],
          ),
        ],
        [(it) => [it], capture("nodes")],
        [
          (it) => it.root,
          queryDeep("const tasks = [$$$tasks];"),
          (it) => it.tasks,
          spawnArray(processTask),
          capture("tasks"),
        ],
        [
          (it) => it.root,
          queryDeep("const people = [$$$people];"),
          (it) => it.people,
          spawnArray((it) =>
            metaexec(it, (capture) => [
              (it) => it.childBlock(0).text,
              capture("name"),
            ]),
          ),
          capture("people"),
        ],
      ),
    ]),
  view: ({ replacement, tasks, completed, people, completedList, nodes }) => {
    const showCode = useSignal(false);
    const person = useLocalStorageSignal("lastPerson", people[0].name);
    useValidateKeepReplacement(replacement);

    const tasksWithLastCompleted = tasks.map((task) => {
      const lastCompleted =
        completed.find((it) => it.id === task.id)?.date ?? new Date(0);
      const nextDue = new Date(
        +lastCompleted +
          task.frequency.interval * unitToSpan[task.frequency.unit],
      );
      return { task, lastCompleted, nextDue };
    });

    const markComplete = (id: string) => {
      const now = new Date().toISOString().split("T")[0];
      completedList.insert(
        `complete("${id}", "${person.value}", "${now}")`,
        "expression",
        0,
      );
    };

    return h(
      "div",
      {},
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between" } },
        h(
          "select",
          { onChange: (e) => (person.value = e.target.value) },
          people.map(({ name }) =>
            h("option", { selected: person.value === name }, name),
          ),
        ),
        h(
          "button",
          { onClick: () => (showCode.value = !showCode.value) },
          "Toggle Code",
        ),
      ),
      h("hr"),
      showCode.value
        ? h(VitrailPane, { nodes })
        : h(
            "table",
            {},
            tasksWithLastCompleted
              .sort((a, b) => a.nextDue - b.nextDue)
              .map((it) => h(Task, { ...it, markComplete })),
          ),
    );
  },
};

const unitToSpan = {
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  months: 30 * 24 * 60 * 60 * 1000,
  years: 365 * 24 * 60 * 60 * 1000,
};

const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

function Task({
  task,
  nextDue,
  markComplete,
}: {
  task: {
    name: string;
    id: string;
    frequency: { interval: number; unit: keyof typeof unitToSpan };
  };
  markComplete: (id: string) => void;
  lastCompleted: Date;
  nextDue: Date;
}) {
  const dueInDays = Math.floor((+nextDue - +today()) / (24 * 60 * 60 * 1000));
  return h(
    "tr",
    {},
    h("td", {}, task.name),
    h(
      "td",
      {
        style: {
          background:
            dueInDays === 0
              ? "#ff9900"
              : dueInDays < 0
                ? "#f88"
                : "transparent",
        },
      },
      dueInDays === 0
        ? "today"
        : [
            dueInDays < 0 ? "since " : "in ",
            dueInDays,
            " day",
            dueInDays !== 1 && "s",
          ],
    ),
    h(
      "td",
      {},
      h("button", { onclick: () => markComplete(task.id) }, "Complete"),
    ),
  );
}

const url = window.location.host.includes("localhost")
  ? "http://localhost/squeak/sb-js/vitrail/demo-planner.php"
  : location.href.split("/").slice(0, -1).join("/") + "/demo-planner.php";

let lastReadTime: number;
let scheduled: ReturnType<typeof setTimeout>;
function scheduleUpdate(source: string) {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(async () => {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ source, time: lastReadTime }),
    });
    const data = await res.json();
    if (!data.success) {
      alert(
        "Someone else saved the file in the meantime, sorry :( You gotta reload the page.",
      );
      return;
    }
    lastReadTime = data.time;
  }, 1000);
}

fetch(url).then(async (response) => {
  const data = await response.json();
  lastReadTime = data.time;
  const vitrail = await createDefaultCodeMirror(
    data.source,
    document.querySelector("#editor")!,
    [planner],
  );
  vitrail.addEventListener("change", ({ detail: { sourceString } }) => {
    scheduleUpdate(sourceString);
  });
});
