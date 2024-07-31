import { languageFor } from "./core/languages.js";
import { useEffect, useRef } from "./external/preact-hooks.mjs";
import { useSignal } from "./external/preact-signals.mjs";
import { h } from "./external/preact.mjs";
import { bindSourceString } from "./sandblocks/query-builder/bindings.ts";
import {
  metaexec,
  query,
  all,
  also,
  first,
  debugIt,
  log,
  spawnArray,
  allMatch,
  optional,
  queryDeep,
  getField,
} from "./sandblocks/query-builder/functionQueries.js";
import { StringEnum } from "./tracery/enum.ts";
import { NodeArray } from "./tracery/node-array.ts";
import { Codicon } from "./view/widgets.js";
import { VitrailPane, VitrailPaneWithWhitespace } from "./vitrail/vitrail.ts";

export const augBool = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => ["true", "false"].includes(it.type),
      capture("node"),
    ]),
  view: ({ node }) => {
    return h("input", {
      type: "checkbox",
      checked: node.type == "true",
      onChange: (e) => {
        node.replaceWith(e.target.checked.toString(), "expression");
      },
    });
  },
  rerender: () => true,
  examples: [
    [
      "Utils.transparentize(Utils.CHART_COLORS.blue, 0.5)",
      [0, 0],
      "Utils.CHART_COLORS.blue",
      [0, 0],
    ],
  ],
});

export const augChartsType = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => it.type == "pair",
      (it) => it.atField("key").text == "type",
      capture("type"),
      () => "type",
      capture("name"),
    ]),
  view: ({ type, name }) =>
    h(StringEnum, {
      node: type.atField("value"),
      wrap: (it) =>
        h(
          "div",
          { style: { display: "flex", flexDirection: "row" } },
          `${name}: `,
          it,
        ),
      options: [
        "bar",
        "bubble",
        "doughnut",
        "pie",
        "line",
        "polarArea",
        "radar",
        "scatter",
      ],
    }),
  rerender: () => true,
  examples: [
    [
      "Utils.transparentize(Utils.CHART_COLORS.blue, 0.5)",
      [0, 0],
      "Utils.CHART_COLORS.blue",
      [0, 0],
    ],
  ],
});

export const augChartsColor = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => /^Utils.CHART_COLORS.\w*/gm.test(it.sourceString),
      capture("node"),
      (it) =>
        it.sourceString.replace("Utils.", "").replace("CHART_COLORS.", ""),
      log("color"),
      capture("color"),
    ]),
  view: ({ color, node }) => {
    const dropDownVisible = useSignal(false);
    const CHART_COLORS = {
      red: "rgb(255, 99, 132)",
      orange: "rgb(255, 159, 64)",
      yellow: "rgb(255, 205, 86)",
      green: "rgb(75, 192, 192)",
      blue: "rgb(54, 162, 235)",
      purple: "rgb(153, 102, 255)",
      grey: "rgb(201, 203, 207)",
    };
    const colorDisp = (color) =>
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            marginLeft: "1rem",
          },
        },
        h("div", {
          style: {
            height: "1rem",
            width: "1rem",
            backgroundColor: `${CHART_COLORS[color]}`,
          },
        }),
        color,
      );

    return [
      h(
        "div",
        {
          style: { display: "flex", cursor: "pointer" },
          onClick: () => (dropDownVisible.value = !dropDownVisible.value),
        },
        h(Codicon, {
          name: dropDownVisible.value ? "chevron-up" : "chevron-down",
          style: { width: "1rem" },
        }),
        colorDisp(color),
      ),
      dropDownVisible.value
        ? h(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            Object.keys(CHART_COLORS).map((chart_color) =>
              chart_color != color
                ? h(
                    "div",
                    {
                      style: { marginLeft: "1rem", cursor: "pointer" },
                      onClick: (e) => {
                        dropDownVisible.value = false;
                        node.replaceWith(
                          `Utils.CHART_COLORS.${e.target.textContent}`,
                        );
                      },
                    },
                    colorDisp(chart_color),
                  )
                : null,
            ),
          )
        : null,
    ];
  },
  rerender: () => true,
  examples: [
    [
      "Utils.transparentize(Utils.CHART_COLORS.blue, 0.5)",
      [0, 0],
      "Utils.CHART_COLORS.blue",
      [0, 0],
    ],
  ],
});

export const augTransparentColor = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => it.query("Utils.transparentize($color,$opacity)") != null,
      capture("node"),
      (it) => it.query("Utils.transparentize($color,$opacity)"),
      //(it) => {
      //  if (it.color.sourceString.includes("yellow")) {
      //    debugger;
      //  }
      //  return it;
      //},
      all(
        [(it) => it.color, capture("color")],
        [(it) => it.opacity, capture("opacity")],
      ),
    ]),
  view: ({ node, color, opacity }) => {
    return h(
      "div",
      { style: { display: "flex", flowDirection: "row" } },
      h(
        VitrailPaneWithWhitespace,
        { nodes: [color.parent] },
        h("input", { type: "range", min: "0", max: "1" }),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        "Opacity",
        h("input", {
          type: "range",
          min: 0,
          max: 1,
          step: 0.01,
          value: opacity.sourceString,
          onChange: (e) => opacity.replaceWith(e.target.value, "expression"),
        }),
      ),
    );
  },
  rerender: () => true,
  examples: [
    [
      "Utils.transparentize(Utils.CHART_COLORS.blue, 0.5)",
      [0, 0],
      "Utils.CHART_COLORS.blue",
      [0, 0],
    ],
  ],
});

const findData = (root, name) => {
  console.log("name: " + name);
  function matchRec(root, name) {
    const res = metaexec(root, (capture) => [
      (it) => it.type == "variable_declarator",
      (it) => it.atField("name").text == name,
      capture("dataString"),
    ]);
    console.log("res");
    console.log(res);
    return res
      ? res
      : root.childBlocks
          .map((child) => matchRec(child, name))
          .find((it) => it != null);
  }

  const res = matchRec(root, name);
  console.log(res);
  if (res) {
    console.log("returning: " + res.dataString.sourceString);
    return `const ${res.dataString.sourceString}`;
  } else {
    return null;
  }
};

export const augChartsJS = (model) => ({
  matcherDepth: Infinity,
  model: model,
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => it.type != "programm",
      capture("root"),
      all(
        [
          queryDeep("const $var = {labels: $labels, datasets: [$_datasets]}"),
          all(
            [(it) => it.labels, capture("labels")],
            [
              (it) => it.datasets.childBlocks,
              spawnArray([
                (it) => it.childBlocks,
                spawnArray([
                  (it) => ({
                    key: it.childBlocks[0].text,
                    value: it.childBlocks[1],
                    valueEvaled: eval(
                      `${findData(it.root, "month")};${
                        it.childBlocks[1].sourceString
                      }`,
                    ),
                  }),
                ]),
              ]),
              capture("datasets"),
            ],
          ),
        ],
        [
          queryDeep(
            "const $var = {labels: $labels, datasets: $datasetContainer}",
          ),
          (it) => it.datasetContainer,
          capture("datasetContainer"),
        ],
        [
          queryDeep("const config = $config"),
          (it) => it.config,
          capture("config"),
          all([getField("type"), capture("type")]),
        ],
        [queryDeep("const data = $data"), (it) => it.data, capture("data")],
      ),
    ]),
  view: ({ nodes, labels, datasets, datasetContainer, config, data, type }) => {
    //debugger;
    const canvasRef = useRef(null);
    useEffect(() => {
      let dataset_tmp: object[] = [];
      datasets.forEach((dataset, index) => {
        dataset_tmp.push({});
        dataset.forEach((pair) => {
          if (pair.key == "data") {
            dataset_tmp[index][pair.key] = pair.valueEvaled;
          } else {
            dataset_tmp[index][pair.key] = eval(pair.value.sourceString);
          }
        });
      });

      const ctx = canvasRef.current.getContext("2d");
      const config_tmp = eval(`new Object(${config.sourceString})`);
      config_tmp["data"] = {
        labels: eval(labels.sourceString),
        datasets: dataset_tmp,
      };
      const myChart = new Chart(ctx, config_tmp);

      return () => {
        myChart.destroy();
      };
    }, [datasets, config]);

    return h(
      "div",
      {
        style: { display: "flex", flexDirection: "row", alignItems: "center" },
      },
      h(
        "div",
        { style: { border: "2px solid red" } },
        h("h2", {}, "charts.js"),
        h("h3", {}, "config"),
        h(VitrailPaneWithWhitespace, { nodes: [config] }),

        h("h3", {}, "labels"),
        h(
          "div",
          {},
          h(VitrailPane, { nodes: [labels] }),
          h("h3", {}, "datasets"),
          h(NodeArray, {
            insertItem: () => `{label: "Name"}`,
            container: datasetContainer,
            wrap: (it) => it,
            items: datasets,
            nodeFromItem: (item) =>
              item[0] ? item[0].value.parent.parent : null,
            view: (it, ref, onmousemove, onmouseleave) => {
              //debugger;
              const expanded = useSignal(true);
              return [
                h(
                  "div",
                  {
                    style: {
                      boxShadow: "0 4px 8px 0 rgba(0,0,0,0.2)",
                      padding: "1rem",
                      margin: "1rem",
                    },
                    ref,
                    onmousemove,
                    onmouseleave,
                  },
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        flexDirection: "row",
                      },
                      onclick: () => (expanded.value = !expanded.value),
                    },
                    h(
                      "h4",
                      { style: { flexGrow: 4 } },
                      it.map((item) => item.key).includes("label")
                        ? it.find((it) => it.key == "label").value
                            .childBlocks[0].text
                        : "unnamed",
                    ),
                    h(Codicon, {
                      name: expanded.value ? "chevron-up" : "chevron-down",
                      style: { width: "1rem" },
                    }),
                  ),
                  expanded.value
                    ? [
                        it.map((it) => {
                          return h(
                            "div",
                            {},
                            `${it.key}: `,
                            h(VitrailPaneWithWhitespace, {
                              nodes: [it.value],
                            }),
                          );
                        }),
                        //TODO: make this less horrible
                        h(AddKeyValueButton, {
                          parentObject: it[0].value.parent.parent,
                        }),
                      ]
                    : null,
                ),
              ];
            },
          }),
        ),
      ),
      h(
        "div",
        {
          style: {
            width: "500px",
            height: "auto",
            resize: "both",
            overflow: "auto",
            border: "2px solid gray",
          },
        },
        h("canvas", { ref: canvasRef }),
      ),
    );
  },
  rerender: () => true,
  examples: [
    [
      `const data = {
  labels: ["Jan","Feb","Mar"],
  datasets: [
    {
      label: 'Fully Rounded',
      data: [1,2,3],
      borderColor: "rgb(128,128,128)",
      backgroundColor: "rgb(128,128,128, 0.5)",
      borderWidth: 2,
      borderRadius: 200,
      borderSkipped: false,
    },
    {
      label: 'Small Radius',
      data: [4,5,6],
      borderColor: "rgb(1,1,1)",
      backgroundColor: "rgb(1,1,1,0.5)",
      borderWidth: 2,
      borderRadius: 5,
      borderSkipped: false,
    }
  ]
};`,
      [0, 0],
    ],
  ],
});

export const rgb2hex = (it) =>
  metaexec(it, (capture) => [
    query('"$content"'),
    (it) => it.content,
    capture("node"),
    (it) => it.text,
    first(
      [(it) => /rgb\((\d+),(\d+),(\d+)\)/i.exec(it)],
      [(it) => /#([a-z0-9]{2})([a-z0-9]{2})([a-z0-9]{2})/i.exec(it)],
    ),
    (it) => ({
      r: parseInt(it[1], capture.get("base")),
      g: parseInt(it[2], capture.get("base")),
      b: parseInt(it[3], capture.get("base")),
    }),
    all(
      [(it) => it.r, capture("r")],
      [(it) => it.g, capture("g")],
      [(it) => it.b, capture("b")],
    ),
  ]);

function AddKeyValueButton({ parentObject }) {
  const addMode = useSignal(false);
  const key = useSignal("");
  const value = useSignal("");

  return h(
    "div",
    {},
    addMode.value
      ? h(
          "div",
          { style: { display: "flex", flexDirection: "row" } },
          "key: ",
          h("textarea", {
            rows: "1",
            onchange: (e) => (key.value = e.target.value),
          }),
          "value: ",
          h("textarea", {
            rows: "1",
            onchange: (e) => (value.value = e.target.value),
          }),
          h("button", {}, "✅"),
        )
      : h("button", { onclick: () => (addMode.value = true) }, "+"),
  );
}
