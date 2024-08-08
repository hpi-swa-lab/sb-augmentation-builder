//import { createRequire } from "module";
import { languageFor } from "./core/languages.js";
import { useRef } from "./external/preact-hooks.mjs";
import { h } from "./external/preact.mjs";
import { log, metaexec } from "./sandblocks/query-builder/functionQueries.js";

export const augRegex = {
  matcherDepth: Infinity,
  model: languageFor("typescript"),
  match: (it) =>
    metaexec(it, (capture) => [
      (it) => it.type == "regex_pattern",
      capture("regex"),
    ]),
  view: ({ regex }) => {
    //var require = createRequire(import.meta.url);
    var re = new RegExp(regex.sourceString);
    const regexVisual = useRef(null);
    try {
      visualize(parse(re.source), getRegexFlags(re), regexVisual);
    } catch (e) {
      if (e instanceof parse.RegexSyntaxError) {
        logError(re, e);
      } else {
        throw e;
      }
    }
    return h("div", {}, regex.sourceString, h("div", { ref: regexVisual }));
  },
  rerender: () => true,
  examples: [
    ["const test = /rgb( ?(d+), ?(d+), ?(d+), ?([01].d+))/gm", [0, 0]],
  ],
};

function logError(re, err) {
  var msg = ["Error:" + err.message, ""];
  if (typeof err.lastIndex === "number") {
    msg.push(re);
    msg.push(new Array(err.lastIndex).join("-") + "^");
  }
  console.log(msg.join("\n"));
}

function getRegexFlags(re) {
  var flags = "";
  flags += re.ignoreCase ? "i" : "";
  flags += re.global ? "g" : "";
  flags += re.multiline ? "m" : "";
  return flags;
}
