import { openDB } from "../external/idb.js";
import { languageForPath } from "./languages.js";

addEventListener("message", async (event) => {
  switch (event.data.type) {
    case "run_script":
      const mapScript = eval(event.data.mapScript);
      const reduceScript = eval(event.data.reduceScript);
      postMessage({
        type: "done",
        result: await runScript(
          event.data.fileHashes,
          mapScript,
          reduceScript,
          event.data.reduceArgs,
        ),
      });
      break;
  }
});

function requestFiles(files) {
  return new Promise((resolve) => {
    if (!files.length) return resolve([]);

    const listener = (event) => {
      if (event.data.type === "respond_files") {
        removeEventListener("message", listener);
        resolve(event.data.files);
      }
    };
    addEventListener("message", listener);
    postMessage({ type: "request_files", files });
  });
}

function getWork(currentList, storedList) {
  if (!storedList.length)
    return { deleted: [], updated: currentList, upToDate: [] };

  const deleted = [];
  const updated = [];
  const upToDate = [];
  for (const file of currentList) {
    const current = storedList.find((l) => l.hash === file.hash);
    if (!current) updated.push(file);
    else upToDate.push(current);
  }
  for (const stored of storedList) {
    if (!currentList.some((l) => l.hash === stored.hash)) deleted.push(stored);
  }
  return { deleted, updated, upToDate };
}

async function idForScript(db, data) {
  // const tx = db.transaction("scripts", "readwrite");
  // const scriptInfo = await tx.store.get("data", data);
  // await tx.done;
  const scriptInfo = await db.getFromIndex("scripts", "data", data);
  if (scriptInfo) {
    return scriptInfo.id;
  } else {
    return await db.add("scripts", { data });
  }
}

async function prepareLanguagesFor(files) {
  const languages = new Set();
  for (const file of files) {
    const language = languageForPath(file.path);
    if (language) languages.add(language);
  }
  await Promise.all(
    [...languages].map((language) => language.ready({ parserOnly: true })),
  );
}

async function runScript(fileHashes, mapScript, reduceScript, reduceArgs) {
  // await deleteDB("sandblocks");
  const db = await openDB("sandblocks", 1, {
    upgrade(db) {
      const store = db.createObjectStore("files", {
        keyPath: ["scriptId", "path"],
      });
      store.createIndex("scriptId", "scriptId");

      const scriptStore = db.createObjectStore("scripts", {
        keyPath: "id",
        autoIncrement: true,
      });
      scriptStore.createIndex("data", "data", { unique: true });
    },
  });

  const scriptId = await idForScript(db, mapScript.toString());
  const { deleted, updated, upToDate } = getWork(
    fileHashes,
    (scriptId && (await db.getAllFromIndex("files", "scriptId", scriptId))) ??
      [],
  );

  await prepareLanguagesFor(updated);

  const updatedData = Object.fromEntries(
    (await requestFiles(updated.map((f) => f.path))).map((file) => [
      file.path,
      mapScript(file, languageForPath(file.path)?.parseSync(file.data)),
    ]),
  );

  const tx = db.transaction("files", "readwrite");
  await Promise.all([
    ...updated.map((file) =>
      tx.store.put({
        scriptId,
        hash: file.hash,
        path: file.path,
        data: updatedData[file.path],
      }),
    ),
    ...deleted.map((file) => tx.store.delete([file.scriptId, file.path])),
    tx.done,
  ]);

  return reduceScript(
    {
      ...updatedData,
      ...Object.fromEntries(upToDate.map((f) => [f.path, f.data])),
    },
    ...reduceArgs,
  );
}
