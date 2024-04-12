import { Extension } from "../core/extension.js";
import { languageFor } from "../core/languages.js";
import { asyncEval } from "../utils.js";
import { preferences } from "../core/preferences.js";
import { button, h, icon } from "../view/widgets.js";
import { Shard } from "../core/replacement.js";
import { FileEditor } from "./file-project/file-editor.js";
import { localStorageProject } from "./local-project.js";
import { openComponentInWindow } from "./window.js";

const preferencesFilePath = "localStorage:///preferences.js";

async function readPreferences() {
  const s = await localStorageProject.readFile(preferencesFilePath);
  if (!s) return "import { preferences } from '/core/preferences.js';\n\n";
  return s;
}

let _userPreferencesLoaded = false;
export async function loadUserPreferences(source = null) {
  asyncEval(source ?? (await readPreferences()));
  _userPreferencesLoaded = true;
}

export async function setUserPreference(preference, value) {
  preferences.set(preference, value);

  const source = await readPreferences();
  const file = await languageFor("javascript").parseOffscreen(source);
  _setUserPreference(file, preference, value);
  localStorageProject.writeFile(preferencesFilePath, file.sourceString);
}

function _setUserPreference(root, preference, value, method = "set") {
  const found = root.findQuery(`$a.set("${preference}", $value)`);
  if (found) {
    found.value.replaceWith(JSON.stringify(value));
  } else {
    root.insert(
      `\n\npreferences.${method}("${preference}", ${JSON.stringify(value)});`,
      "expression_statement",
      9e8,
    );
  }
}

export function getPreferenceOr(preference, defaultValue) {
  if (!_userPreferencesLoaded)
    throw new Error(
      "attempted to access preference before user preferences were loaded",
    );
  return preferences.get(preference) ?? defaultValue;
}

export async function getPreferenceOrAsk(preference, ifMissing) {
  if (!_userPreferencesLoaded)
    throw new Error(
      "attempted to access preference before user preferences were loaded",
    );
  if (!preferences.has(preference) || preferences.get(preference) === null) {
    const value = await ifMissing();
    await setUserPreference(preference, value);
    return value;
  }
  return preferences.get(preference);
}

export function openPreferences() {
  openComponentInWindow(FileEditor, {
    project: localStorageProject,
    path: preferencesFilePath,
    // inlineExtensions: [preferencesExtension],
  });
}

const preferencesExtension = new Extension()
  .registerReplacement((e) => [
    (x) => x.type === "true" || x.type === "false",
    (x) =>
      ensureReplacementPreact(e, x, "sb-prefs-boolean", ({ node }) =>
        h("input", {
          type: "checkbox",
          checked: node.type === "true",
          onchange: (e) => node.replaceWith(e.target.checked.toString()),
        }),
      ),
  ])
  .registerReplacement((e) => [
    (x) => x.extract("preferences.$method($field, $value)"),
    ([x, props]) =>
      ensureReplacementPreact(
        e,
        x,
        "sb-prefs-set",
        ({ field, value, method }) =>
          h(
            "table",
            { style: { display: "inline-table" } },
            h(
              "tr",
              {},
              h(
                "td",
                {},
                methodIcon(method),
                " ",
                field.childBlock(0).sourceString,
              ),
              h("td", {}, h(Shard, { value })),
            ),
          ),
        props,
      ),
  ]);
// .registerSave((e) => [
//   (x) => x.isRoot,
//   (x) => loadUserPreferences(x.sourceString),
// ])
// .registerExtensionConnected((e) => [
//   (x) => x.isRoot,
//   (x) =>
//     x.editor.appendChild(
//       createWidgetPreact(
//         e,
//         "sb-prefs-list",
//         ({ node }) => {
//           const allStrings = [];
//           node.root.allChildrenDo(
//             (x) =>
//               x.type === "string" && allStrings.push(x.childBlock(0).text)
//           );

//           return h(
//             "table",
//             { style: { marginTop: "1rem" } },
//             h(
//               "tr",
//               {},
//               h(
//                 "td",
//                 { colspan: 2 },
//                 button("Add Default Extension", () =>
//                   _setUserPreference(
//                     node.root,
//                     prompt("Name?"),
//                     true,
//                     "addDefaultExtension"
//                   )
//                 )
//               )
//             ),
//             h(
//               "tr",
//               {},
//               h(
//                 "td",
//                 { colspan: 2 },
//                 h("h2", {}, "Default Preferences"),
//                 "Click to override."
//               )
//             ),
//             [...preferences.map.entries()]
//               .filter(([field]) => !allStrings.includes(prefString(field)[1]))
//               .sort((a, b) => a[0].localeCompare(b[0]))
//               .map(([field, value]) =>
//                 h(Preference, { field, value, root: node.root })
//               )
//           );
//         },
//         (trigger) => trigger === "always"
//       )
//     ),
// ]);

function prefString(name) {
  const [prefix, ...rest] = name.split(":");
  return rest.length > 0 ? [prefix, rest.join(":")] : [null, prefix];
}

function methodIcon(method) {
  return icon(
    {
      set: "toggle_on",
      setShortcut: "keyboard",
      addDefaultExtension: "extension",
    }[method.text],
  );
}

function prefIcon(name) {
  const [prefix] = prefString(name);
  return icon(
    {
      shortcut: "keyboard",
      "default-extension": "extension",
    }[prefix] ?? "toggle_on",
  );
}

function prefMethod(name) {
  const [prefix] = prefString(name);
  return (
    {
      shortcut: "setShortcut",
      "default-extension": "addDefaultExtension",
    }[prefix] ?? "set"
  );
}

function Preference({ field, value, root }) {
  const [_, name] = prefString(field);

  return h(
    "tr",
    {},
    h("td", {}, prefIcon(field), " ", name),
    h(
      "td",
      {},
      button(JSON.stringify(value), () =>
        _setUserPreference(root, name, JSON.parse(prompt()), prefMethod(field)),
      ),
    ),
  );
}
