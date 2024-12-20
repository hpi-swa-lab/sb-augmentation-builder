import { Extension } from "../core/extension.js";
import { Process } from "./host.js";
import { sequenceMatch } from "../utils.js";
import { languageFor, languageForPath } from "../core/languages.js";

const LSP_SYMBOL_KIND = {
  file: 1,
  module: 2,
  namespace: 3,
  package: 4,
  class: 5,
  method: 6,
  property: 7,
  field: 8,
  constructor: 9,
  enum: 10,
  interface: 11,
  function: 12,
  variable: 13,
  constant: 14,
  string: 15,
  number: 16,
  boolean: 17,
  array: 18,
  object: 19,
  key: 20,
  null: 21,
  enumMember: 22,
  struct: 23,
  event: 24,
  operator: 25,
  typeParameter: 26,
};

const lspSymbolKindIcons = {
  [LSP_SYMBOL_KIND.file]: "draft",
  [LSP_SYMBOL_KIND.module]: "description",
  [LSP_SYMBOL_KIND.namespace]: "category",
  [LSP_SYMBOL_KIND.package]: "package_2",
  [LSP_SYMBOL_KIND.class]: "account_tree",
  [LSP_SYMBOL_KIND.method]: "crisis_alert",
  [LSP_SYMBOL_KIND.property]: "line_start_circle",
  [LSP_SYMBOL_KIND.field]: "line_start_circle",
  [LSP_SYMBOL_KIND.constructor]: "star",
  [LSP_SYMBOL_KIND.enum]: "list",
  [LSP_SYMBOL_KIND.interface]: "new_releases",
  [LSP_SYMBOL_KIND.function]: "target",
  [LSP_SYMBOL_KIND.variable]: "timeline",
  [LSP_SYMBOL_KIND.constant]: "circle",
  [LSP_SYMBOL_KIND.string]: "abc",
  [LSP_SYMBOL_KIND.number]: "123",
  [LSP_SYMBOL_KIND.boolean]: "done",
  [LSP_SYMBOL_KIND.array]: "data_array",
  [LSP_SYMBOL_KIND.object]: "data_object",
  [LSP_SYMBOL_KIND.key]: "key",
  [LSP_SYMBOL_KIND.null]: "check_box_outline_blank",
  [LSP_SYMBOL_KIND.enumMember]: "chevron_right",
  [LSP_SYMBOL_KIND.struct]: "event_list",
  [LSP_SYMBOL_KIND.event]: "flag",
  [LSP_SYMBOL_KIND.operator]: "plus",
  [LSP_SYMBOL_KIND.typeParameter]: "play_shapes",
};

const LSP_TEXT_DOCUMENT_SYNC_KIND = {
  none: 0,
  full: 1,
  incremental: 2,
};

export function languageClientFor(project, language) {
  const languageServers = [
    {
      languages: [languageFor("javascript"), languageFor("typescript")],
      transport: new StdioTransport(
        "typescript-language-server",
        ["--stdio"],
        project.path,
      ),
    },
  ];

  for (const config of languageServers) {
    if (config.languages.includes(language)) {
      const client = new LanguageClient(
        project,
        config.transport,
        config.languages,
      );
      client.start();
      return client;
    }
  }

  return null;
}

function connectLanguageClientToProject(project, lsp, isMyFile) {
  project.addEventListener(
    "openFileFirst",
    async ({ detail: { path, text } }) => {
      if (isMyFile(path)) lsp.didOpen(path, text);
    },
  );
  project.addEventListener("closeFileAll", async ({ detail: { path } }) => {
    if (isMyFile(path)) lsp.didClose(path);
  });
  // FIXME what if two independent change the same file?
  project.addEventListener(
    "changeFile",
    async ({ detail: { path, oldSource, newSource, changes } }) => {
      if (isMyFile(path)) lsp.didChange(path, oldSource, newSource, changes);
    },
  );
}

function lspDo(x, filter, cb) {
  for (const entry of x.context?.project.allData.values()) {
    if (entry instanceof LanguageClient && entry.initialized && filter(entry)) {
      cb(entry);
    }
  }
}

export const formatting = new Extension().registerCustom("preSave", (x) =>
  lspDo(
    x,
    (sem) => !!sem.capabilities.documentFormattingProvider,
    (sem) => sem.formatting(x),
  ),
);

export const suggestions = new Extension().registerChangesApplied(
  (_changes, _oldSource, _newSource, { editor }) =>
    lspDo(
      editor,
      (sem) => !!sem.capabilities.completionProvider,
      async (sem) => {
        // always re-add our old suggestions while we wait for fresh ones
        // to come in, to prevent a brief flash during wait
        const current = editor.data("lsp-current-completion") ?? [];
        editor.addSuggestions(editor.selectedNode, current);

        const promise = sem.completion(editor);
        editor.setData("lsp-completion", promise);

        const suggestions = await promise;

        // check that no other completion has been started since
        if (editor.data("lsp-completion") === promise) {
          const node = editor.selectedNode;
          const list = suggestions
            .sort((a, b) => a.sortText.localeCompare(b.sortText))
            .filter((b) =>
              sequenceMatch(
                b.filterText?.toLowerCase() ?? node.sourceString.toLowerCase(),
                b.label.toLowerCase(),
              ),
            )
            .slice(0, 30)
            .map((b) => ({
              insertText: b.insertText,
              label: b.label,
              icon: lspSymbolKindIcons[b.kind],
              fetchDetail: async () => {
                // if we are no longer the active request, ignore
                if (editor.data("lsp-completion") !== promise) return null;
                const full = await sem.completionItemResolve(b);
                // update our old item with all info
                Object.assign(b, full);
                return full.detail;
              },
              use: (x) => {
                x.replaceWith(b.insertText ?? b.label);
                if (b.additionalTextEdits) {
                  const selection = editor.selectionRange;
                  const shard = editor.selectedShard;

                  const edits = b.additionalTextEdits.map((e) =>
                    convertEdit(x, e),
                  );
                  editor.applyChanges(edits);

                  // potentially shift selection to accommodate inserts before the cursor
                  for (const edit of edits) {
                    if (edit.to < selection[0]) {
                      selection[0] +=
                        edit.insert.length - (edit.to - edit.from);
                      selection[1] +=
                        edit.insert.length - (edit.to - edit.from);
                    }
                  }

                  shard.selectRange(selection);
                }
              },
            }));

          editor.setData("lsp-current-completion", list);
          editor.clearSuggestions();
          editor.addSuggestions(node, list);
        }
      },
    ),
);

export const browse = new Extension().registerShortcut("browseIt", (node) => {
  lspDo(
    node,
    (sem) => !!sem.capabilities.workspaceSymbolProvider,
    async (sem) => {
      const symbols = await sem.workspaceSymbols(node.text);
      const top = symbols
        .filter((sym) => sym.name === node.text)
        .sort((a, b) => a.kind - b.kind)[0];

      if (top) browseLocation(node.context.project, top.location);
    },
  );
});

export const diagnostics = new Extension().registerCustom(
  "lsp-diagnostics",
  (x) =>
    lspDo(
      x,
      (sem) => {
        return !!sem.capabilities.publishDiagnostics;
      },
      (sem) => {
        for (const diagnostic of sem(x)?.diagnosticsFor(x.context.path) ?? []) {
          const target = x.childEncompassingRange(
            rangeToIndices(x.sourceString, diagnostic.range),
          );
          const severity = ["", "error", "warning", "info", "hint"][
            diagnostic.severity
          ];
          e.ensureClass(target, `diagnostic-${severity}`);
          for (const tag of diagnostic.tags ?? []) {
            const t = ["", "unnecessary", "deprecated"][tag];
            e.ensureClass(target, `diagnostic-${t}`);
          }
          e.attachData(
            target,
            "diagnostic",
            (v) => (v.title = diagnostic.message),
            (v) => (v.title = null),
          );
        }
      },
    ),
);

function convertEdit(node, edit) {
  return {
    from: positionToIndex(node.root.sourceString, edit.range.start),
    to: positionToIndex(node.root.sourceString, edit.range.end),
    insert: edit.newText,
  };
}

function rangeToIndices(source, { start, end }) {
  return [positionToIndex(source, start), positionToIndex(source, end)];
}

export function positionToIndex(sourceString, { line, character }) {
  let index = 0;
  for (let i = 0; i < line; i++) {
    index = sourceString.indexOf("\n", index) + 1;
  }
  return index + character;
}
export function indexToPosition(sourceString, index) {
  let line = 0;
  let character = 0;
  for (let i = 0; i < index; i++) {
    if (sourceString[i] === "\n") {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return { line, character };
}

async function browseLocation(project, { uri, range: { start, end } }) {
  const path = uri.slice("file://".length);
  // FIXME loading the file twice this way...
  const position = positionToIndex(await project.readFile(path), start);

  throw new Error("todo");
}

class Transport {
  constructor(request) {
    this.request = request;
  }
  async start() {}
  async write() {}
  async close() {}
  storeForRecovery() {}
}

export class StdioTransport extends Transport {
  static async restore({ process }) {
    const p = await Process.restore(process);
    if (!p) return null;
    const t = new StdioTransport(null, null, null);
    t._connect(p);
    return t;
  }

  constructor(command, args, cwd) {
    super();
    this.command = command;
    this.args = args;
    // if we get a browser-only url or similar, start the lsp
    // in the server directory instead.
    this.cwd = cwd ? ([".", "/"].includes(cwd[0]) ? cwd : ".") : null;
    this.buffer = new Uint8Array();
  }

  appendData(data) {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
  }

  storeForRecovery() {
    return { process: this.process.storeForRecovery() };
  }

  async start() {
    this._connect(new Process());
    await this.process.start(this.command, this.args, this.cwd, true, true);
  }

  _connect(process) {
    this.process = process;
    this.process
      .onClose(this.onClose)
      .onStdout((data) => {
        this.appendData(data);
        this._processBuffer();
      })
      .onStderr((e) => {
        // FIXME should also buffer
        this.onStderr(new TextDecoder().decode(e));
      });
  }

  async close() {
    await this.process.close();
  }

  _processBuffer() {
    const headerEnd = this.buffer.indexOf(13); // \r for \r\n\r\n sequence
    const prefix = new TextDecoder().decode(this.buffer.slice(0, headerEnd));
    const size = prefix?.match(/^Content-Length: (\d+)/i)?.[1];

    if (size) {
      const length = parseInt(size, 10);
      const start = headerEnd + 4;
      const end = start + length;

      if (this.buffer.length >= end) {
        const data = this.buffer.slice(start, end);
        this.onMessage(JSON.parse(new TextDecoder().decode(data)));
        this.buffer = this.buffer.slice(end);
        this._processBuffer();
      }
    }
  }

  async write(data) {
    const payload = new TextEncoder().encode(data);
    const header = `Content-Length: ${payload.length}\r\n\r\n`;
    const full = new Uint8Array(header.length + payload.length);
    full.set(new TextEncoder().encode(header));
    full.set(payload, header.length);
    await this.process.write(full);
  }
}

export class LanguageClient extends EventTarget {
  static async restore(project, { transport, languageNames }) {
    const t = await StdioTransport.restore(transport);
    if (!t) return null;
    const languageClient = new LanguageClient(
      project,
      t,
      languageNames.map(languageFor),
    );
    await languageClient._afterInitialize();
    return languageClient;
  }

  storeForRecovery() {
    return {
      transport: this.transport.storeForRecovery(),
      languageNames: this.languages.map((l) => l.name),
    };
  }

  lastRequestId = +new Date();
  pending = new Map();
  textDocumentVersions = new Map();
  lastDocumentText = new Map();
  diagnostics = new Map();
  queuedRequests = [];
  initialized = false;

  constructor(project, transport, languages) {
    super();

    this.languages = languages;
    this.project = project;
    this.transport = transport;
    transport.onMessage = (message) => {
      this.log("[message]", message);
      if (message.method) {
        this._handleServerMessage(message);
      } else {
        const [resolve, reject] = this.pending.get(message.id);
        if (message.error) {
          reject(message.error);
        } else {
          resolve(message.result);
        }
        this.pending.delete(message.id);
      }
    };
    transport.onStderr = (data) => {
      this.log("[stderr]", data);
      console.error(data);
    };
    transport.onClose = (code) => {
      this.log("[closed]", code);
      console.log("process closed", code);
    };

    connectLanguageClientToProject(project, this, (path) =>
      this.languages.includes(languageForPath(path)),
    );
  }

  log(...msg) {
    if (false) console.log(...msg);
  }

  async suspend() {
    await Promise.all(
      [...this.textDocumentVersions.entries()].map(([file]) =>
        this.didClose(file),
      ),
    );
  }

  async write(data) {
    this.log("[write]", data);
    await this.transport.write(JSON.stringify(data));
  }

  async initialize() {
    const res = await this._request("initialize", {
      rootUri: `file://${this.project.path}`,
      capabilities: {
        window: { workDoneProgress: true },
        textDocument: {
          hover: {},
          publishDiagnostics: {
            relatedInformation: true,
            codeDescriptionSupport: true,
            dataSupport: true,
            tagSupport: { valueSet: [1, 2] },
          },
          synchronization: {
            didSave: true,
            dynamicRegistration: true,
          },
          completion: {
            dynamicRegistration: true,
            completionItem: {
              documentationFormat: ["markdown", "plaintext"],
              preselectSupport: true,
              insertReplaceSupport: true,
              labelDetailsSupport: true,
              snippetSupport: true,
              resolveSupport: {
                properties: ["documentation", "detail", "additionalTextEdits"],
              },
            },
          },
          documentSymbol: {
            tagSupport: { valueSet: [1] },
          },
        },
        workspace: {
          applyEdit: true,
          workspaceFolders: true,
          workspaceEdit: {
            documentChanges: true,
          },
        },
      },
      workDoneToken: "1d546990-40a3-4b77-b134-46622995f6ae",
    });

    this.capabilities = res.capabilities;

    await this._notification("initialized", {});
    await this._afterInitialize();
  }

  async _afterInitialize() {
    this.initialized = true;
    for (const request of this.queuedRequests) {
      await this.write(request);
    }
  }

  async didSave(path, text) {
    await this._notification("textDocument/didSave", {
      textDocument: { uri: `file://${path}` },
      text,
    });
  }

  async didOpen(path, text) {
    this.textDocumentVersions.set(path, 1);
    this.lastDocumentText.set(path, text);

    const language = languageForPath(path);

    await this._notification("textDocument/didOpen", {
      textDocument: {
        uri: `file://${path}`,
        languageId: language.name === "tsx" ? "typescriptreact" : language.name,
        version: 1,
        text,
      },
    });
  }

  get serverChangeKind() {
    if (typeof this.capabilities?.textDocumentSync?.change === "undefined")
      return this.capabilities?.textDocumentSync;
    return this.capabilities?.textDocumentSync?.change;
  }

  async didChange(path, oldSource, newSource, changes) {
    if (this.serverChangeKind === LSP_TEXT_DOCUMENT_SYNC_KIND.none) return;

    const version = this.textDocumentVersions.get(path) + 1;
    this.textDocumentVersions.set(path, version);
    this.lastDocumentText.set(path, newSource);

    await this._notification("textDocument/didChange", {
      textDocument: {
        uri: `file://${path}`,
        version,
      },
      contentChanges:
        this.serverChangeKind === LSP_TEXT_DOCUMENT_SYNC_KIND.full
          ? [{ text: newSource }]
          : changes.map((change) => ({
              range: {
                start: indexToPosition(oldSource, change.from),
                end: indexToPosition(oldSource, change.to),
              },
              rangeLength: change.to - change.from,
              text: change.insert ?? "",
            })),
    });
  }

  async didClose(path) {
    this.textDocumentVersions.delete(path);
    this.lastDocumentText.delete(path);
    this.diagnostics.delete(path);

    await this._notification("textDocument/didClose", {
      textDocument: { uri: `file://${path}` },
    });
  }

  async formatting(path) {
    const edits = await this._request("textDocument/formatting", {
      textDocument: {
        uri: `file://${path}`,
      },
      options: { tabSize: 2 },
    });
    node.editor.applyChanges(
      edits.map((e) => convertEdit(path, e)),
      [0, 0],
    );
  }

  async completion(editor) {
    const res = await this._request("textDocument/completion", {
      textDocument: {
        uri: `file://${editor.context.path}`,
      },
      position: indexToPosition(editor.sourceString, editor.selectionRange[0]),
    });
    // TODO incomplete flag
    return res.items;
  }

  async completionItemResolve(item) {
    return await this._request("completionItem/resolve", item);
  }

  async workspaceSymbols(query = "") {
    return await this._request("workspace/symbol", { query });
  }

  async start() {
    await this.transport.start();
    await this.initialize();
  }

  applyEdits(sourceString, edits) {
    let offset = 0;
    for (const {
      newText,
      range: { start, end },
    } of edits) {
      const startIndex = positionToIndex(sourceString, start);
      const endIndex = positionToIndex(sourceString, end);
      sourceString =
        sourceString.slice(0, startIndex + offset) +
        newText +
        sourceString.slice(endIndex + offset);
      offset += newText.length - (endIndex - startIndex);
    }
    return sourceString;
  }

  notifyChangeWorkspaceFolders() {
    // FIXME not used yet
    this._notification("workspace/didChangeWorkspaceFolders", {
      event: {
        added: [
          { uri: `file://${this.project.path}`, name: this.project.name },
        ],
        removed: [],
      },
    });
  }

  async _handleServerMessage(message) {
    switch (message.method) {
      case "window/logMessage":
        console.log(message.params.message);
        break;
      case "textDocument/publishDiagnostics":
        this.diagnostics.set(
          message.params.uri.slice("file://".length),
          message.params.diagnostics,
        );
        const path = message.params.uri.slice("file://".length);
        this.dispatchEvent(
          new CustomEvent("diagnostics", {
            detail: {
              path,
              diagnostics: message.params.diagnostics
                .filter(() => this.lastDocumentText.get(path))
                .map((d) => ({
                  ...d,
                  severity: ["", "error", "warning", "info", "hint"][
                    d.severity
                  ],
                  tags: (d.tags ?? []).map(
                    (t) => ["", "unnecessary", "deprecated"][t],
                  ),
                  range: rangeToIndices(
                    this.lastDocumentText.get(path),
                    d.range,
                  ),
                })),
            },
          }),
        );
        break;
      case "window/workDoneProgress/create":
        this._response(message.id, null);
        break;
      case "client/registerCapability":
        await this._response(message.id, null);
        break;
      default:
        // if (!message.method.startsWith("$/"))
        if (message.id)
          throw new Error("No response for server request", message);
        console.log("Unhandled server message", message);
        break;
    }
  }

  async _response(id, result) {
    await this.write({ jsonrpc: "2.0", id, result });
  }

  _request(method, params) {
    return new Promise(async (resolve, reject) => {
      const id = ++this.lastRequestId;
      const payload = { jsonrpc: "2.0", id, method, params };

      this.pending.set(id, [resolve, reject]);

      if (!this.initialized && method !== "initialize")
        this.queuedRequests.push(payload);
      else this.write(payload);
    });
  }

  async _notification(method, params) {
    const payload = { jsonrpc: "2.0", method, params };
    if (!this.initialized && method !== "initialized")
      this.queuedRequests.push(payload);
    else this.write(payload);
  }
}
