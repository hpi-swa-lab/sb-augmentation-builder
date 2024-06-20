import { Project } from "../core/project.js";
import { button } from "../view/widgets.js";
import { request } from "../sandblocks/host.js";
import { openComponentInWindow } from "./window.js";

export class FileProject extends Project {
  static deserialize(obj) {
    if (typeof obj.path !== "string") return null;
    return new FileProject({ folder: obj.path });
  }

  constructor(options) {
    super();
    ({ folder: this.path } = options);
  }

  get name() {
    return this.path.split("/").pop();
  }

  async open() {
    this.root = await request("openProject", { path: this.path });
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
