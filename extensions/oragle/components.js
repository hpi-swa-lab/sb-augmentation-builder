import { choose } from "../../sandblocks/window.js";
import { h, icon, useDebouncedEffect, useJSONComparedState, Component } from "../../view/widgets.js";
import { ShardArray } from "../../view/widgets/shard-array.js";
import {
  cascadedConstructorFor,
} from "./../smalltalk.js";
import { makeUUID, pluralString } from "../../utils.js";
import { useComputed } from "../../external/preact-signals.mjs"
import { useState } from "../../external/preact-hooks.mjs";
import { selectedModule, highlightedModules } from "./signals.js"
import { parseSqArray, formatPrice } from "./utils.js"

// Components
export const PromptContainer = (prompt, promptIndex) => {
  const [hoverOver, setHoverOver] = useState(false)
  const moduleIDs = prompt.modules.map(module => module.uuid);
  const shouldHighlight = useComputed(() => selectedModule.value ? moduleIDs.includes(selectedModule.value) : false)

  const onEnter = () => {
    setHoverOver(true)
    highlightedModules.value = moduleIDs
  }

  const onLeave = () => {
    setHoverOver(false)
    highlightedModules.value = []
  }

  return h("div", {}, ...prompt.outputs.map((output, outputIndex) =>
    h("div", {
      onMouseEnter: () => onEnter(),
      onMouseLeave: () => onLeave(),
      style: {
        "color": hoverOver ? "white" : undefined,
        "background-color": hoverOver || shouldHighlight.value ? "blue" : undefined
      }
    },

      // Prompt Container content
      h("strong", {}, `Prompt #${promptIndex + 1} - Output #${outputIndex + 1} (${prompt.modules.map(module => module.label).join(", ")})`),
      h("pre", { style: { whiteSpace: "pre-wrap" } }, output)
    ))
  )
}
/*
const OutputWindowFunc = (projectId, prompts) => {
  const [prompts, setPrompts] = useState([])
  const [hover, setHover] = useState(false)

  const update = async () => {
    const promptsObj = await sqQuery(`OragleProjects promptsForProjectId: '${projectId}'`,{
      "[]": {
        modules: [{
          "[]": ["uuid"],
        }],
        outputs: `outputs`,
      },
    });
    const parsedPrompts = parseSqArray(promptsObj);
    parsedPrompts.forEach((prompt) => {
      prompt.modules &&= parseSqArray(prompt.modules);
      prompt.outputs &&= parseSqArray(prompt.outputs);
    });
    setPrompts(prompts)
  }

  return h(
    "div",{style: {overflowY: "scroll"}},
      ...prompts.map((prompt, promptIndex) => PromptContainer(prompt, promptIndex))
  )
}
*/

export class OutputWindow extends Component {
  constructor(props) {
    super(props);
    this.projectId = props.projectId;

    this.state = {
      prompts: [],
      hover: false,
      isUpdating: false,
    }
  }

  async update() {
    const promptsObj = await sqQuery(`OragleProjects promptsForProjectId: '${this.projectId}'`, {
      "[]": {
        modules: [{
          "[]": ["uuid", "label"],
        }],
        outputs: `outputs`,
      },
    });
    const prompts = parseSqArray(promptsObj);
    prompts.forEach((prompt) => {
      prompt.modules &&= parseSqArray(prompt.modules);
      prompt.outputs &&= parseSqArray(prompt.outputs);
    });

    this.setState({ ...this.state, prompts })
  }

  setIsUpdating(isUpdating) {
    this.setState({ ...this.state, isUpdating });
  }

  render() {
    return h(
      "div", { style: { overflowY: "scroll" } },
      ...this.state.isUpdating ? ["Updating..."] : [],
      ...this.state.prompts.map((prompt, promptIndex) => PromptContainer(prompt, promptIndex))
    )
  }

  logOutputs() {
    console.group("Prompts");
    this.state.prompts.forEach((prompt, i) => {
      console.group(`Prompt #${i + 1}`);
      prompt.outputs.forEach((output, j) => {
        console.group(`Output #${j + 1}`);
        console.log(output);
        console.groupEnd();
      });
      console.groupEnd();
    });
  };
}

export const OragleProjectMetrics = ({ label, project, metrics, rootModule, defaultNumberOfOutputs, replacement }) => {
  const [isSaving, setIsSaving] = useState(false);

  const metricText = metrics
    ? ` (${pluralString("prompt", metrics.numberOfPrompts)}${!metrics.numberOfPrompts ? `` : ` × ${metrics.defaultNumberOfOutputs !== null
        ? pluralString("output", metrics.defaultNumberOfOutputs)
        : "<variable>"
      }`} = ${metrics.totalPriceFormatted})`
    : null

  const onSave = async () => {
    if (!metrics) {
      const hasConfirmed = confirm(
        `About to spend ${metrics.totalPriceFormatted} to generate ${metrics.numberOfPrompts} prompts × ${metrics.defaultNumberOfOutputs ?? "<variable>"} outputs. Continue?`
      )
      if (!hasConfirmed) return;
    }

    const shard = replacement.editor.children[0];
    await shard.save();

    const selector = shard.sourceString.split(/\s/)[0];
    setIsSaving(true);
    project.setIsUpdating(true);
    try {
      try {
        await sqQuery(`OragleProjects updateProjectNamed: #${selector} approvedPrice: ${metrics.totalPrice}`);
      } finally {
        setIsSaving(false);
      }

      project.assureOutputWindow();
      await project.updateOutputWindows();
    } finally {
      project.setIsUpdating(false);
    }
  }

  return h("div", { class: "sb-column" },
    h("span", { class: "sb-row" },
      icon("draft"),
      h("span", { style: { fontWeight: "bold" } }, label),
      h("span", { style: { flexGrow: 1, display: "flex", justifyContent: "flex-end", alignItems: "center" } },
        h("span", { style: { marginRight: "0.5rem" } },
          h("span", { style: { fontWeight: "bold" } }, "Outputs: "),
          h("input", {
            type: "number",
            value: defaultNumberOfOutputs.get(),
            min: 1,
            onInput: (e) => defaultNumberOfOutputs.set(e.target.value),
            style: { width: "4ch" }
          })
        ),
        h("button", { className: "oragle-project-save-button", disabled: isSaving, onClick: () => onSave() },
          icon("play_arrow"),
          isSaving ? "Saving..." : "Save",
          metricText
        )
      )
    ),
    rootModule
  )
}

export const OragleSequenceModule = ({ uuid, separator, label, children, replacement }) => {
  const moduleId = uuid.get().replace(/'/g, "");
  return h(
    OragleModule,
    { node: replacement.node, type: "OragleSequenceModule" },
    h(
      "div",
      { class: "sb-insert-button-container sb-column" },
      h(
        "span",
        {
          class: "sb-row",
          style: { justifyContent: "space-between" },
        },
        icon("table_rows"),
        label?.key && h("span", { style: { fontWeight: "bold" } }, label),
        h(
          "span",
          {
            style: {
              flexGrow: 1,
              display: "flex",
              justifyContent: "flex-end",
            },
          },
          h(ModulePriceTag, { replacement, moduleId }),
        ),
      ),
      h(ShardArray, {
        elements: children.elements,
        onInsert: (i) => insertModule(children, i),
      })
    )
  );
}

export const OragleScriptModule = ({ uuid, children, replacement }) => {
  const moduleId = uuid.get().replace(/'/g, "");

  return h(
    OragleModule,
    { node: replacement.node, type: "OragleScriptModule" },
    h(
      "div",
      { class: "sb-insert-button-container sb-column" },
      h("span", { class: "sb-row" }, icon("code"), "Script"),
      h(ShardArray, {
        elements: children.elements,
        onInsert: (i) => insertModule(children, i),
      }),
      h(
        "span",
        {
          class: "sb-row",
          style: { justifyContent: "space-between" },
        },
        h(ModulePriceTag, { replacement, moduleId }),
      ),
    )
  );
}

export const OragleAlternationModule = ({ uuid, children, replacement }) => {
  const moduleId = uuid.get().replace(/'/g, "");

  return h(
    OragleModule,
    { node: replacement.node, type: "OragleAlternation" },
    h(
      "div",
      {
        class: "sb-insert-button-container sb-row",
        style: {
          alignItems: "start",
        },
      },
      icon("alt_route"),
      h(ShardArray, {
        elements: children.elements,
        onInsert: (i) => insertModule(children, i),
      }),
      h(
        "span",
        {
          class: "sb-row",
          style: { justifyContent: "space-between" },
        },
        h(ModulePriceTag, { replacement, moduleId }),
      ),
    )
  );
}

export const OragleLeafModule = ({ uuid, label, content, state, replacement }) => {
  const moduleId = uuid.get().replace(/'/g, "");
  const project = (() => {
    let node = replacement;
    while (node) {
      if (node.project) return node.project;
      node = node.parentElement;
    }
  })();

  const saveAndUpdateProject = async () => {
    const shard = replacement.editor.children[0];
    await shard.save();

    const selector = shard.sourceString.split(/\s/)[0];
    await sqQuery(`OragleProjects updateProjectNamed: #${selector}`);

    await project.updateOutputWindows();
  };

  return h(
    OragleModule,
    { uuid: uuid, node: replacement.node, type: "OragleLeafModule" },
    h(
      "div",
      { class: "sb-column", id: uuid.get().slice(1, -1) },
      h(
        "span",
        {
          class: "sb-row",
          style: { justifyContent: "space-between" },
        },
        h("span", { style: { fontWeight: "bold" } }, label),
        h(ModulePriceTag, { replacement, moduleId }),
      ),
      content,
      h(
        "div",
        { class: "sb-row" },
        h(
          "button",
          {
            class: state.get() === "#solo" && "sb-button-pressed",
            onClick: async () => {
              state.set(state.get() === "#solo" ? "#enabled" : "#solo");
              await saveAndUpdateProject();
            },
          },
          "S"
        ),
        h(
          "button",
          {
            class: state.get() === "#mute" && "sb-button-pressed",
            onClick: async () => {
              state.set(state.get() === "#mute" ? "#enabled" : "#mute"),
                await saveAndUpdateProject();
            },
          },
          "M"
        )
      )
    )
  );
}

export const OragleProject = ({ children }) => {
  return h(
    "div",
    {
      style: {
        display: "inline-flex",
        border: "2px solid #333",
        borderRadius: "6px",
        padding: "0.5rem",
      },
    },
    children
  );
}

// Container component for modules that supports wrapping / unwrapping
// children of that module.
export const OragleModule = ({ uuid, children, node, type }) => {
  const highlighted = useComputed(() => {
    if (uuid) {
      return highlightedModules.value.includes(uuid.get().slice(1, -1))
    }
    return false
  });

  return h(
    "div",
    {
      onMouseEnter: () => {
        if (uuid) {
          selectedModule.value = uuid.get().slice(1, -1);
        }
      },
      onMouseLeave: () => {
        if (uuid) {
          selectedModule.value = null;
        }
      },
      oncontextmenu: (e) => {
        e.stopPropagation();
        e.preventDefault();

        const wrapItem = (name, cls) => ({
          label: `Wrap in ${name}`,
          action: () => node.wrapWith(`${cls} new uuid: '${makeUUID()}'; children: {`, "}"),
        });

        choose([
          wrapItem("Sequence", "OragleSequenceModule"),
          wrapItem("Alternative", "OragleAlternation"),
          {
            label: "Unwrap children",
            action: () => {
              const {
                messages: { children },
              } = cascadedConstructorFor(
                node.findQuery(`${type} new`).root,
                type
              );
              if (children)
                node.replaceWith(
                  children.childBlocks.map((c) => c.sourceString).join(". ")
                );
              else node.removeFull();
            },
          },
        ]).then((a) => a?.action());
      },
      style: {
        display: "inline-flex",
        border: "2px solid #333",
        borderRadius: "6px",
        borderColor: highlighted.value == true ? "red" : undefined,
        padding: "0.5rem",
      },
    },
    children
  );
}

function insertModule({ insert }, i) {
  insert(i, `OragleLeafModule new uuid: '${makeUUID()}'`);
}

export const ModulePriceTag = ({ replacement, moduleId }) => {
  const [bufferedMetrics, setMetrics] = useJSONComparedState(null);

  // As the resolved content of the module might depend on earlier script modules or configuration modules, metrics depend on the whole project
  // FIXME: Typing into one leaf module should not rebuild the entire project UI - this is NOT due to our effects but seems to come from sandblocks!
  const editorShard = replacement.editor?.children[0];
  const editorSourceString = editorShard?.sourceString;
  useDebouncedEffect(
    500,
    async () => {
      const editorShard = replacement.editor.children[0];
      const editorSourceString = editorShard.sourceString;

      // trim initial selector and optional pragmas
      const input = editorSourceString.replace(/^[^\s]+/, "").replace(/<[^>]+>/, "").trim();

      const _metrics = await sqQuery(
        `| project |
        project := Compiler evaluate: '${sqEscapeString(input)}'.
        ^ project metricsForModule: (project moduleForId: '${moduleId}')`,
        {
          "minPrice": "self minPrice maxCents oragleNanToNil",
          "maxPrice": "self maxPrice maxCents oragleNanToNil",
          "minTokens": "self minTokens oragleNanToNil",
          "maxTokens": "self maxTokens oragleNanToNil",
        }
      );

      _metrics.minPriceFormatted = formatPrice(_metrics.minPrice);
      _metrics.maxPriceFormatted = formatPrice(_metrics.maxPrice);
      _metrics.minPriceFormattedLong = formatPrice(_metrics.minPrice, { minDigits: 4 });
      _metrics.maxPriceFormattedLong = formatPrice(_metrics.maxPrice, { minDigits: 4 });

      setMetrics({
        editorSourceString,
        ..._metrics
      });
    },
    [editorSourceString]
  );

  const metrics = bufferedMetrics

  const span = metrics === null
    ? null
    : h(
      "span",
      {
        className: "oragle-module-price-tag",
        title:
          `Tokens: ${metrics === null
            ? "(computing...)"
            : metrics.minTokens == metrics.maxTokens
              ? `${metrics.minTokens === null ? "n/a" : metrics.minTokens}`
              : `${metrics.minTokens} – ${metrics.maxTokens}`}
Price for one request: ${metrics === null
              ? "(computing...)"
              : metrics.minPriceFormattedLong == metrics.maxPriceFormattedLong
                ? `${metrics.minPriceFormattedLong}`
                : `${metrics.minPriceFormattedLong} – ${metrics.maxPriceFormattedLong}`}`,
      },
      metrics.minPriceFormatted === metrics.maxPriceFormatted
        ? `${metrics.minPriceFormatted}`
        //: `${metrics.minPriceFormatted} – ${metrics.maxPriceFormatted}`
        : `≤${metrics.maxPriceFormatted}`
    );

  if (span)
    // force re-rendering when text changes to restart animation
    span.key = span.props?.children;

  return span;
}
