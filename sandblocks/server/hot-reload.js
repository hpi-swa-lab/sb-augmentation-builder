import * as fsPath from "path";
import fs from "fs";
import { promisify } from "util";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import { watch } from "chokidar";
import crypto from "crypto";

const parser = new Parser();
parser.setLanguage(JavaScript);

export function hotReload(app, rootPath, io) {
  watch(rootPath).on("change", (path) => {
    if (!path.endsWith(".js")) return;
    const baseUrl = path.slice(rootPath.length);
    io.sockets.emit("hot-reload", {
      url: baseUrl + "?v=" + crypto.randomBytes(8).toString("hex"),
      baseUrl,
    });
  });

  app.get(/\/.*\.js$/, async (req, res) => {
    const send = (data) =>
      res.setHeader("Content-Type", "text/javascript").send(data);

    const isHotReload = req.url.includes("?v=");
    const relPath = req.url.slice(1).split("?")[0];
    const path = fsPath.join(rootPath, relPath);
    const content = await promisify(fs.readFile)(path, "utf8");

    if (path.includes("/external/")) {
      return send(content);
    }

    const name = (n) =>
      n.type === "function_declaration"
        ? n.firstNamedChild.text
        : n.firstNamedChild.firstNamedChild.text;
    const id = (n) => `${relPath}:${name(n)}`;

    const tree = parser.parse(content);
    const components = [
      ...tree.rootNode.children.filter(
        (n) => n.type === "function_declaration" && name(n)[0].match(/^[A-Z]/),
      ),
      ...tree.rootNode.children.filter(
        (n) => n.type === "lexical_declaration" && name(n)[0].match(/^[A-Z]/),
      ),
    ];
    if (!components.length) return send(content);

    send(`${isHotReload ? disableSideEffects : ""}

${content}

import { register as sbHotReloadRegister } from "/hot-reload.js";
${components
  .map((c) => `sbHotReloadRegister(${name(c)}, "${id(c)}");`)
  .join("\n")}`);
  });
}

const disableSideEffects = `
const customElements = {define: () => {}};
`;
