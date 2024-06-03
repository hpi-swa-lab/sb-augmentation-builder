import { transformFile } from "@swc/core";
import * as fsPath from "path";

export function typescript(app, rootPath) {
  app.get(/\/.*\.ts$/, async (req, res) => {
    const relPath = req.url.slice(1).split("?")[0];
    const path = fsPath.join(rootPath, relPath);
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
