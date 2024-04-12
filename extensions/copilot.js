import { Extension } from "../core/extension.js";
import { getPreferenceOrAsk } from "../sandblocks/preference-window.js";
import { preferences } from "../core/preferences.js";
import {
  StdioTransport,
  indexToPosition,
  positionToIndex,
  registerLsp,
} from "./lsp.js";

async function getKey() {
  return await getPreferenceOrAsk("openAIKey");
}

preferences
  .registerDefaultShortcut("autocompleteAI", "Ctrl-.")
  .registerPreference("openAIKey", null)
  .registerPreference("copilotGhDistPath", null);

export async function chat(messages, model = "gpt-3.5-turbo-1106") {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getKey()}`,
    },
    body: JSON.stringify({
      // response_format: { type: "json_object" },
      model,
      messages,
    }),
  });

  const data = await res.json();
  console.log(data);
  // const parsed = JSON.parse(data.choices[0].message.content);
  // return parsed;
  return data;
}

export async function complete(prefix, suffix) {
  const res = await fetch("https://api.openai.com/v1/completions ", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo-instruct",
      prompt: prefix,
      suffix,
    }),
  });
  const r = await res.json();
  console.log(r);
  return r;
}

export const base = new Extension().registerShortcut(
  "autocompleteAI",
  async (x) => {
    const editor = x.editor;
    const window = [500, 100];
    const position = x.editor.selectionRange[0];

    const prefix = x.root.sourceString.slice(
      Math.max(position - window[0], 0),
      position
    );
    const suffix = x.root.sourceString.slice(position, position + window[1]);

    const res = false
      ? await chat([
          {
            role: "system",
            content: `You are an expert code completion agent. You receive a JSON object with the following properties:
- prefix, suffix: strings containing the prefix and suffix, res., of the code to be completed
- language: name of the code snippet's language

You reply with a JSON object with the following properties:
- content: the code snippet to be inserted

You never explain code. You never add comments.
Do not elide any code from your output. Do not insert comments or TODOs for blocks that are empty.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              prefix,
              suffix,
              language: x.language.name,
            }),
          },
        ])
      : await complete(
          `You are an expert code completion agent. Complete the following snippet of ${x.language.name} code:\n${prefix}`,
          suffix
        );

    // strip markdown prefix and suffix if present
    // const code = res.content.replace(/(^```.+?\n)|(\n```$)/, "");
    const code = res.choices[0].text.trim();
    editor.insertTextFromCommand(position, code);
  }
);

export const gh = new Extension().registerShortcut(
  "autocompleteAI",
  async (x) => {
    const lsp = x.context.project.data("copilotGhLSP");
    const position = x.editor.selectionRange[0];
    const source = x.root.sourceString;
    const {
      completions: [completion],
    } = await lsp._request("getCompletions", {
      doc: {
        source,
        tabSize: 2,
        indentSize: 1,
        insertSpaces: true,
        path: x.context.path,
        uri: `file://${x.context.path}`,
        relativePath: x.context.path.slice(x.context.project.path.length),
        languageId: x.language.name,
        position: indexToPosition(x.root.sourceString, position),
        version: lsp.textDocumentVersions.get(x.context),
      },
    });

    if (completion) {
      x.editor.replaceTextFromCommand(
        [
          positionToIndex(source, completion.range.start),
          positionToIndex(source, completion.range.end),
        ],
        completion.text
      );
    }
  }
);

getPreferenceOrAsk("copilotGhDistPath", () => prompt("Path to dist?")).then(
  (path) =>
    registerLsp(
      gh,
      "copilotGhLSP",
      () => new StdioTransport("node", [path + "/dist/agent.js"], ".")
    )
);
