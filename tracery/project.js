import { languageFor, languageForPath } from "../core/languages.js";
import { Project } from "../core/project.js";
import { button } from "../view/widgets.js";
import { request, withSocket } from "./host.js";
import { LanguageClient, languageClientFor } from "./lsp.js";
import { openComponentInWindow } from "./window.js";

export class FileProject extends Project {
  path;

  languageClients = new Map();

  static deserialize(obj) {
    if (typeof obj.path !== "string") return null;
    return new FileProject({ folder: obj.path });
  }

  constructor(options) {
    super();
    ({ folder: this.path } = options);

    withSocket((socket) => {
      socket.on("fileChange", async ({ event, path, data }) => {
        if (["unlink", "add"].includes(event))
          // FIXME do not reopen entire project
          this.root = await request("openProject", { path: this.path });
      });
    });
  }

  get name() {
    return this.path.split("/").pop();
  }

  languageClientFor(language) {
    // FIXME
    if (true) return null;
    if (this.languageClients.has(language))
      return this.languageClients.get(language);
    const server = languageClientFor(this, language);
    if (server) this.languageClients.set(language, server);
    return server;
  }

  async open() {
    this.root = await request("openProject", { path: this.path });

    this.languageClients = new Map(
      (
        await Promise.all(
          Object.entries(
            JSON.parse(localStorage.restoreLanguageClients ?? "{}"),
          ).map(async ([name, data]) => [
            languageFor(name),
            await LanguageClient.restore(this, languageFor(name), data),
          ]),
        )
      ).filter(([_, server]) => server),
    );
  }

  async close() {
    localStorage.restoreLanguageClients = JSON.stringify(
      Object.fromEntries(
        this.languageClients
          .entries()
          .map(([language, server]) => [
            language.name,
            server.storeForRecovery(),
          ]),
      ),
    );

    await Promise.all(
      this.languageClients.values().map((server) => server.suspend()),
    );
  }

  async createFile(path, data) {
    await request("writeFile", { path, data });
    this.root = await request("openProject", { path: this.path });
  }

  async openFile(path) {
    // activate a language server for this file
    this.languageClientFor(languageForPath(path));

    return super.openFile(path);
  }

  async writeFile(path, data) {
    await request("writeFile", { path, data });
  }

  async readFiles(paths) {
    return await request("readFiles", { paths });
  }

  get allSources() {
    const out = [];
    const recurse = (file, path) => {
      if (file.children) {
        file.children.forEach((child) =>
          recurse(child, path + "/" + file.name),
        );
      } else {
        out.push({
          path: path + "/" + file.name,
          hash: file.hash,
        });
      }
    };
    for (const child of this.root.children) recurse(child, this.path);
    return out;
  }

  serialize() {
    return { path: this.path };
  }

  renderBackground() {
    return [
      button("Install Language", () =>
        request("installLanguage", {
          repo: prompt("Repo? (just username/repo)"),
          branch: prompt("Branch? (prefer commit hashes)"),
          path: prompt("Path? (leave empty for root"),
        }).then(() => alert("Installed!")),
      ),
      button("Open Workspace (Ctrl-g)", () =>
        openComponentInWindow(Workspace, {}),
      ),
    ];
  }
}
