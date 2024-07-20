import fs from "fs";
import { promisify } from "util";
import * as fsPath from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { exec, spawn } from "child_process";
import Gitignore from "gitignore-fs";
import crypto from "crypto";
import https from "https";
import { hotReload } from "./hot-reload.js";
import { typescript } from "./typescript.js";
import chokidar from "chokidar";

let key, cert;
try {
  key = fs.readFileSync("localhost-key.pem");
  cert = fs.readFileSync("localhost.pem");
} catch (error) {}

const app = express();
const server = key
  ? https.createServer({ key, cert }, app)
  : http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cors());

app.post("/sb-watch", (req, res) => {
  io.sockets.emit("sb-watch", req.body);
  res.send();
});

const rootPath = fsPath.join(
  fsPath.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
if (process.env.HOT) hotReload(app, rootPath, io);
typescript(app, rootPath);
app.use(express.static(rootPath));

function callback(cb) {
  return async (data, send) => {
    // try {
    const ret = await cb(data);
    send(ret);
    // } catch (e) { send({ error: e.toString() }); }
  };
}

function handler(socket, name, cb) {
  socket.on(name, callback(cb));
}

let lastWrites = new Map();
const processes = new Map();

function listenToFileChanges(path, socket) {
  const watcher = chokidar
    .watch(path, { ignored: /node_modules/, ignoreInitial: true })
    .on("all", async (event, path) => {
      let data = null;
      try {
        data = await promisify(fs.readFile)(path, "utf-8");
      } catch (e) {}

      if (data === null || lastWrites.get(path) !== data) {
        socket.emit("fileChange", { event, path, data });
      }
      lastWrites.set(path, data);
    });
  socket.on("disconnect", () => watcher.close());
}

io.on("connection", (socket) => {
  const cleanup = [];

  socket.on("disconnect", () => {
    cleanup.forEach((cb) => cb());
  });

  handler(socket, "writeFile", async ({ path, data }) => {
    lastWrites.set(path, data);
    await promisify(fs.writeFile)(path, data);
    return {};
  });

  // TODO handle file deleted --> skip
  handler(
    socket,
    "readFiles",
    async ({ paths }) =>
      await Promise.all(
        paths.map((path) =>
          promisify(fs.readFile)(path, "utf-8").then((b) => ({
            path,
            hash: crypto.createHash("sha1").update(b).digest("hex"),
            data: b.toString(),
          })),
        ),
      ),
  );

  // TODO handle path does not exist
  handler(socket, "openProject", async ({ path }) => {
    const recurse = async (path, relPath, ignore) => {
      const files = await promisify(fs.readdir)(path, { withFileTypes: true });
      const output = [];
      for (const file of files) {
        const myAbsPath = fsPath.join(path, file.name);
        const myRelPath =
          fsPath.join(relPath, file.name) + (file.isDirectory() ? "/" : "");
        if (await ignore.ignores(myRelPath)) continue;

        const out = {
          name: file.name,
        };
        if (file.isDirectory()) {
          out.children = await recurse(myAbsPath, myRelPath, ignore);
        } else {
          const data = await promisify(fs.readFile)(myAbsPath, "utf-8");
          out.hash = crypto.createHash("sha1").update(data).digest("hex");
        }
        output.push(out);
      }
      return output;
    };

    listenToFileChanges(path, socket);

    const ignore = new Gitignore();
    return {
      name: fsPath.basename(path),
      children: await recurse(path, "", ignore),
    };
  });

  handler(socket, "installLanguage", async ({ repo, branch, path }) => {
    const repoName = repo.split("/")[1];
    const upToRoot = path
      .split("/")
      .map(() => "..")
      .join("/");

    return await promisify(exec)(`bash -c "mkdir -p languages
cd languages
wget https://github.com/${repo}/archive/${branch}.zip
unzip ${branch}.zip
cd ${repoName}-${branch}/${path}
npm install
${path ? `cd ${path}; npm install` : ""}
npx tree-sitter generate
npx tree-sitter build-wasm
cp ${repoName}.wasm ${upToRoot}/../../../external/${repoName}.wasm"`);
  });

  handler(socket, "hasProcess", async ({ pid }) => processes.has(pid));

  handler(socket, "writeProcess", async ({ pid, data, binary }) => {
    const proc = processes.get(pid);
    if (proc) proc.stdin.write(binary ? Buffer.from(data, "base64") : data);
    return {};
  });

  handler(socket, "closeProcess", async ({ pid }) => {
    const proc = processes.get(pid);
    proc?.stdin.end();
    return {};
  });

  handler(
    socket,
    "startProcess",
    async ({ command, args, cwd, binary, keepAlive }) => {
      const proc = spawn(command, args, { cwd, shell: true });
      const pid = proc.pid;
      processes.set(pid, proc);

      function enc(data) {
        return data.toString(binary ? "base64" : "utf-8");
      }

      if (!keepAlive) {
        const weakProc = new WeakRef(proc);
        cleanup.push(() => weakProc.deref()?.kill());
      }

      proc.stdout.on("data", (data) => {
        io.sockets.emit("process", { type: "stdout", data: enc(data), pid });
      });
      proc.stderr.on("data", (data) => {
        console.log(data.toString());
        io.sockets.emit("process", { type: "stderr", data: enc(data), pid });
      });
      proc.on("close", (code) => {
        processes.delete(pid);
        io.sockets.emit("process", { type: "close", code, pid });
      });
      return { pid };
    },
  );
});

const port = process.env.PORT ?? 3000;

server.listen(port, () =>
  console.log(`listening on http${key ? "s" : ""}://localhost:${port}`),
);
