import { SBBlock, SBLanguage, SBText } from "./model.js";

class _SBWhitespaceModel extends SBLanguage {
  constructor() {
    super({ name: "whitespace" });
  }
  _parse(text, _old) {
    const root = new SBBlock("document", null, 0, text.length, true);
    const add = (type, text, start, end) => {
      const block = new SBBlock(type, null, start, end, true);
      block.appendChild(new SBText(text, start, end));
      root.appendChild(block);
    };
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\t") add("tab", "\t", i, i + 1);
      else if (text[i] === "\n") add("newline", "\n", i, i + 1);
      else if (text[i] === " " && text[i + 1] === " ") {
        add("tab", "  ", i, i + 2);
        i++;
      } else {
        const start = i;
        let s = "";
        do {
          s += text[i];
          i++;
        } while (text[i + 1] !== "\t" && text[i + 1] !== "\n");
        add("text", s, start, i);
      }
    }
    return root;
  }
}
export const SBWhitespaceModel = new _SBWhitespaceModel();
