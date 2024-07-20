import { button } from "../view/widgets.js";
import { config } from "./config.js";

export class Project extends EventTarget {
  async open() {}

  // array of { path: string, hash: string }
  get allSources() {}

  get name() {}

  openFiles = new Map();

  async writeFile(path, source) {
    throw new Error("writeFile not implemented");
  }

  async readFile(path) {
    return (await this.readFiles([path]))[0].data;
  }

  async openFile(path) {
    const firstTime =
      !this.openFiles.has(path) || this.openFiles.get(path) === 0;
    this.openFiles.set(path, (this.openFiles.get(path) ?? 0) + 1);

    const text = await this.readFile(path);
    this.dispatchEvent(new CustomEvent("openFile", { detail: { path, text } }));
    if (firstTime)
      this.dispatchEvent(
        new CustomEvent("openFileFirst", { detail: { path, text } }),
      );

    return text;
  }

  closeFile(path) {
    this.openFiles.set(path, this.openFiles.get(path) - 1);
    console.assert(this.openFiles.get(path) >= 0);
    const allClosed = this.openFiles.get(path) === 0;
    this.dispatchEvent(new CustomEvent("closeFile", { detail: { path } }));
    if (allClosed)
      this.dispatchEvent(new CustomEvent("closeFileAll", { detail: { path } }));
  }

  async saveFile(path, content) {
    await this.writeFile(path, content);
    this.dispatchEvent(new CustomEvent("saveFile", { detail: { path } }));
  }

  onChangeFile({ path, sourceString, oldSource, changes, diff }) {
    this.dispatchEvent(
      new CustomEvent("changeFile", {
        detail: { path, newSource: sourceString, oldSource, changes, diff },
      }),
    );
  }

  // return an array of { path: string, data: string }
  async readFiles(paths) {}

  inAllFilesDo(filterScript, mapScript, reduceScript, reduceArgs) {
    return new Promise((resolve) => {
      const worker = new Worker(config.url("core/background.js"), {
        type: "module",
      });
      worker.onerror = (event) => {
        console.error(event);
      };
      worker.postMessage({
        type: "run_script",
        mapScript: mapScript.toString(),
        reduceScript: reduceScript.toString(),
        reduceArgs,
        fileHashes: this.allSources.filter((file) => filterScript(file.path)),
      });
      worker.addEventListener("message", async (event) => {
        switch (event.data.type) {
          case "request_files":
            worker.postMessage({
              type: "respond_files",
              files: await this.readFiles(event.data.files),
            });
            break;
          case "done":
            worker.terminate();
            resolve(event.data.result);
            break;
        }
      });
    });
  }

  renderItem({ onClose }) {
    return [this.name, button("Close", onClose)];
  }

  renderBackground() {
    return null;
  }

  serialize() {}

  fullSerialize() {
    return {
      ...this.serialize(),
      type: this.constructor.name,
    };
  }
}
