import { languageFor } from "./core/languages.js";
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
    var parse = require("regulex").parse;
    var visualize = require("regulex").visualize;
    var Raphael = require("regulex").Raphael;
    var re = new RegExp(regex.sourceString);
    var paper = Raphael("yourSvgContainerId", 0, 0);
    try {
      visualize(parse(re.source), getRegexFlags(re), paper);
    } catch (e) {
      if (e instanceof parse.RegexSyntaxError) {
        logError(re, e);
      } else {
        throw e;
      }
    }
    return h("div", {}, regex.sourceString);
  },
  rerender: () => true,
  examples: [
    ["const test = /rgb( ?(d+), ?(d+), ?(d+), ?([01].d+))/gm", [0, 0]],
  ],
};
