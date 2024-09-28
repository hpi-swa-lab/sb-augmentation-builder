import { SBLanguage, SBBlock, SBText } from "./model.js";

type Rules = {
  [name: string]: RegExp;
};

export class RegexModel extends SBLanguage {
  rules: Rules;

  constructor(name: string, rules: Rules) {
    super({ name, extensions: [], defaultExtensions: [] });
    this.rules = rules;
  }

  _parse(text, _old) {
    const root = new SBBlock("document", null, 0, text.length, true);
    for (const [name, pattern] of Object.entries(this.rules)) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text))) {
        const [fullMatch, ...captures] = match;
        const start = match.index;
        const end = start + fullMatch.length;
        const block = new SBBlock(name, null, start, end, true);
        for (const c of captures) {
          const s = fullMatch.indexOf(c) + start;
          block.appendChild(new SBText(c, s, s + c.length));
        }
        root.appendChild(block);
      }
    }
    return root;
  }

  get rootRuleName() {
    return "document";
  }
}
