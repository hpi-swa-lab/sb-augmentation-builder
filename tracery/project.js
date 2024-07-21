import { languageFor, languageForPath } from "../core/languages.js";
import { Project } from "../core/project.js";
import { button } from "../view/widgets.js";
import { request, withSocket } from "./host.js";
import { LanguageClient, languageClientFor } from "./lsp.js";
import { openComponentInWindow } from "./window.js";

export class FileProject extends Project {
  path;

  languageClients = [];

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
    const languageClient = this.languageClients.find((c) =>
      c.languages.includes(language),
    );
    if (languageClient) return languageClient;
    const server = languageClientFor(this, language);
    if (server) this.languageClients.push(server);
    return server;
  }

  async open() {
    this.root = await request("openProject", { path: this.path });

    this.languageClients = (
      await Promise.all(
        JSON.parse(localStorage.restoreLanguageClients ?? "[]").map((data) =>
          LanguageClient.restore(this, data),
        ),
      )
    ).filter((server) => server);
  }

  async close() {
    localStorage.restoreLanguageClients = JSON.stringify(
      this.languageClients.map((client) => client.storeForRecovery()),
    );

    await Promise.all(this.languageClients.map((client) => client.suspend()));
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
