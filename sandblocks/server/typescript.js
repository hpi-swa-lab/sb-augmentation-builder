import { transformFile } from "@swc/core";
import * as fsPath from "path";
import { promises as fs } from "fs";

export function typescript(app, rootPath) {
  app.get(/\/.*\.ts$/, async (req, res) => {
    const relPath = req.url.slice(1).split("?")[0];
    const path = fsPath.join(rootPath, relPath);
    if (
      !(await fs
        .access(path)
        .then(() => true)
        .catch(() => false))
    ) {
      res.status(404).send(`Not found: ${relPath}`);
      return;
    }
    const r = await transformFile(path, {
      jsc: {
        target: "es2022",
        parser: {
          syntax: "typescript",
          tsx: path.endsWith(".tsx"),
        },
      },
      sourceMaps: "inline",
    });
    res.setHeader("Content-Type", "text/javascript").send(r.code);
  });
}
