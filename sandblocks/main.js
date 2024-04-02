import { SandblocksEditor } from "./editor/editor.js";
import { button, useAsyncEffect } from "../view/widgets.js";
import { render, h } from "../view/widgets.js";
import { useEffect, useState } from "../external/preact-hooks.mjs";
import { matchesKey, withDo } from "../utils.js";
import { choose, openComponentInWindow } from "./window.js";
import {} from "./file-project/search.js";
import { loadUserPreferences, openPreferences } from "./preference-window.js";

await loadUserPreferences();

const PROJECT_TYPES = {
  FileProject: {
    path: "./file-project/main.js",
    name: "FileProject",
    label: "Open Folder",
    createArgs: () => ({ folder: prompt() }),
  },
  SqueakProject: {
    path: "./squeak-project/main.js",
    name: "SqueakProject",
    label: "Squeak Image",
    createArgs: async () => {
      const type = await choose(["browser", "rpc", "yaros"]);
      return {
        type,
        connectionOptions: {
          browser: () => ({
            path: prompt("Path?", "external/squeak-minimal.image"),
          }),
          rpc: () => ({
            port: withDo(prompt("Port?", 9823), (p) => parseInt(p)),
          }),
          yaros: () => ({
            path: prompt("Path?", "external/squeak-minimal-yaros.image"),
            ports: withDo(prompt("Ports?", "8085/8084"), (p) =>
              p.split("/").map((x) => parseInt(x)),
            ),
          }),
        }[type](),
      };
    },
  },
  VRProject: {
    path: "./vr-project/main.js",
    name: "VRProject",
    label: "VR Project",
    createArgs: async () => [prompt("Path?", "external/squeak-minimal.image")],
  },
};

async function loadProjectType(desc) {
  return (await import(desc.path))[desc.name];
}

async function loadSerializedProject(serialized) {
  return (await loadProjectType(PROJECT_TYPES[serialized.type])).deserialize(
    serialized,
  );
}

function projectEqual(a, b) {
  const aInfo = a.fullSerialize();
  const bInfo = b.fullSerialize();
  for (const key of Object.keys(aInfo)) {
    if (aInfo[key] !== bInfo[key]) return false;
  }
  return true;
}

SandblocksEditor.init();

const rag = async () => (await import("./oRAGle/ragPrototype.js")).RAGApp;
const tla = async () =>
  (await import("../extensions/tla/state-explorer.js")).TlaStateExplorer;
const queryBuilder = async () =>
  (await import("./query-builder/main.js")).QueryBuilder;

const startUpOptions = {
  rag: async (options) => {
    openComponentInWindow(
      await rag(),
      {},
      {
        doNotStartAttached: true,
        initialPosition: { x: 10, y: 10 },
        initialSize: { x: 1000, y: 1000 },
        ...options,
      },
    );
  },
  tla: async (options) => {
    openComponentInWindow(await tla(), options, {
      doNotStartAttached: true,
      initialPosition: { x: 10, y: 10 },
      initialSize: { x: 1000, y: 800 },
      ...options,
    });
  },
  queryBuilder: async (options) => {
    openComponentInWindow(
      await queryBuilder(),
      {},
      {
        doNotStartAttached: true,
        initialPosition: { x: 10, y: 10 },
        initialSize: { x: 500, y: 500 },
        ...options,
      },
    );
  },
};

function Sandblocks() {
  const [openProjects, setOpenProjects] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);

  // Debugging utility for diffing
  // useEffect(() => {
  //   const e = document.createElement("sb-editor");
  //   document.body.appendChild(e);
  //   e.load("a", "tsx", []);
  //   setTimeout(function () {
  //     e.replaceFullTextFromCommand("b");
  //   }, 1000);
  // }, []);

  useEffect(() => {
    if (location.hash) {
      startUpOptions[location.hash.slice(1)]?.();
    } else if (location.search) {
      const params = new URLSearchParams(location.search);
      startUpOptions[params.get("open")]?.({
        ...Object.fromEntries(params.entries()),
        fullscreen: params.get("fullscreen") !== null,
      });
    }
  }, []);

  useAsyncEffect(async () => {
    const lastProjects = JSON.parse(localStorage.lastProjects ?? "[]");
    for (const info of lastProjects) {
      const project = await loadSerializedProject(info);
      await project.open();
      setOpenProjects((p) => [...p, project]);
    }
  }, []);

  useAsyncEffect(async () => {
    for (const info of JSON.parse(localStorage.recentProjects ?? "[]")) {
      const project = await loadSerializedProject(info);
      setRecentProjects((p) => [...p, project]);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (matchesKey(e, "Ctrl-g")) {
        // openComponentInWindow(Workspace, {});
      } else if (matchesKey(e, "Ctrl-0")) {
        const search = document.createElement("sb-search");
        // FIXME
        search.project = openProjects[0];
        document.body.appendChild(search);
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    document.body.addEventListener("keydown", handler);
    return () => document.body.removeEventListener("keydown", handler);
  }, [openProjects]);

  useEffect(() => {
    localStorage.lastProjects = JSON.stringify(
      openProjects.map((p) => p.fullSerialize()),
    );
  }, [openProjects]);
  useEffect(() => {
    localStorage.recentProjects = JSON.stringify(
      recentProjects.map((p) => p.fullSerialize()),
    );
  }, [recentProjects]);
  useEffect(() => {
    const handler = (e) => {
      if (openProjects.some((p) => p.unsavedChanges)) {
        e.preventDefault();
        e.returnValue = "";
      }

      localStorage.lastProjects = JSON.stringify(
        openProjects.map((p) => p.fullSerialize()),
      );
    };
    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", (e) => handler);
  }, [openProjects]);

  return [
    h(
      "div",
      { style: "flex" },
      button("Open Project", async () => {
        const desc = await choose(Object.values(PROJECT_TYPES), (i) => i.label);
        if (!desc) return;
        const project = new (await loadProjectType(desc))(
          await desc.createArgs(),
        );
        await project.open();
        setOpenProjects((p) => [...p, project]);
        setRecentProjects((p) => [
          project,
          ...p.filter((x) => !projectEqual(x, project)),
        ]);
      }),
      button("Open Recent", async () => {
        const project = await choose(recentProjects, (i) => i.name);
        if (!project) return;
        await project.open();
        setOpenProjects((p) => [...p, project]);
      }),
      button("RAG", async () => openComponentInWindow(await rag())),
      button("TLA Sequence Diagram", async () =>
        openComponentInWindow(await tla()),
      ),
      button("Query Builder", async () =>
        openComponentInWindow(await queryBuilder()),
      ),
      openProjects.map((project) =>
        project.renderItem({
          onClose: () => setOpenProjects((p) => p.filter((x) => x !== project)),
        }),
      ),
      button("Preferences", () => openPreferences()),
    ),
    openProjects.map((project) => project.renderBackground?.()),
  ];
}

render(h(Sandblocks), document.body);
