import { config } from "./config.js";
import { SBBlock, SBText, SBLanguage, OffscreenEditor } from "./model.js";
import { TreeSitter } from "../external/tree-sitter.js";
import { withDo } from "../utils.js";
import { MaybeEditor } from "./matcher.ts";

export class TreeSitterLanguage extends SBLanguage {
  static _initPromise = null;
  static async initTS() {
    await (this._initPromise ??= this._initTS());
  }
  static async _initTS() {
    await TreeSitter.init({ scriptDirectory: config.url("external/") });
  }

  _readyPromise = null;
  tsLanguage = null;

  get canBeDefault() {
    return true;
  }

  constructor({
    repo,
    branch,
    path,
    extensions,
    name,
    defaultExtensions,
    parseConfig,
  }) {
    super({
      name: name ?? repo.match(/.+\/tree-sitter-(.+)/)[1],
      extensions,
      defaultExtensions,
    });

    this.repo = repo;
    this.branch = branch ?? "master";
    this.path = path ?? "/";
    this.parseConfig = Object.assign(parseConfig ?? {}, {
      matchPrefix: parseConfig?.matchPrefix ?? "$",
      unwrapExpression:
        parseConfig?.unwrapExpression ??
        ((n) => {
          let child = n.childBlock(0) ?? n;
          if (child.type === "expression_statement") return child.childBlock(0);
          return child;
        }),
      parseExpressionPrefix: parseConfig?.parseExpressionPrefix ?? "",
      parseExpressionSuffix: parseConfig?.parseExpressionSuffix ?? "",
    });
  }

  // init API
  async ready(options) {
    await (this._readyPromise ??= this._load(options));
    this.initialized = true;
  }

  async _load(options) {
    await this.constructor.initTS();

    this.tsLanguage = await TreeSitter.Language.load(
      config.url(`external/tree-sitter-${this.name}.wasm`),
    );

    if (!options?.parserOnly)
      this.grammar = this._prepareGrammar(await this._loadGrammar());
  }

  async _loadGrammar() {
    const saved = localStorage.getItem(this.name + "-grammar");
    if (saved) {
      const info = JSON.parse(saved);
      if (
        info.repo === this.repo &&
        info.branch === this.branch &&
        info.path === this.path
      ) {
        return info.grammar;
      }
    }

    const grammar = await (
      await fetch(
        `https://raw.githubusercontent.com/${this.repo}/${this.branch}${this.path}src/grammar.json`,
      )
    ).json();
    localStorage.setItem(
      this.name + "-grammar",
      JSON.stringify({
        repo: this.repo,
        branch: this.branch,
        path: this.path,
        grammar,
      }),
    );
    return grammar;
  }

  _prepareGrammar(grammar) {
    for (const [name, rule] of Object.entries(grammar.rules)) {
      grammar.rules[name] = new GrammarNode(rule, null, name);
    }

    for (const external of grammar.externals) {
      grammar.rules[external.name] = new GrammarNode(
        { type: "BLANK" },
        null,
        external.name,
      );
    }

    for (const rule of Object.values(grammar.rules)) {
      rule.postProcess(grammar);
    }

    return grammar;
  }

  _parse(text, oldRoot = null) {
    console.assert(this.initialized, "language not initialized");
    const parser = new TreeSitter();
    parser.setLanguage(this.tsLanguage);

    const newRoot = this._nodeFromTree(parser.parse(text), text);
    oldRoot?._tree?.delete();

    return newRoot;
  }

  destroyRoot(root) {
    root._tree.delete();
    delete root._tree;
  }

  query(node, string, extract = null) {
    return TSQuery.get(string, this, extract).match(node);
  }

  parseExpression(string) {
    const source = `${this.parseConfig.parseExpressionPrefix}${string}${this.parseConfig.parseExpressionSuffix}`;
    const root = this.parseSync(source);
    this.destroyRoot(root);
    return this.parseConfig.unwrapExpression(root);
  }

  removeQueryMarkers(node) {
    const editor = new OffscreenEditor(node.root);

    const markers = [];
    for (const n of node.allNodes()) {
      // TODO don't hardcode markers but read from language
      if (n.text.startsWith("$")) markers.push(n);
    }

    node.root._editor.transaction(() => {
      for (const marker of markers) marker.removeFull();
    });

    editor.root._editor = undefined;
    return editor.root;
  }

  // node construction
  lastLeafIndex;
  _nodeFromTree(tree, text) {
    this.lastLeafIndex = 0;
    let node = this._nodeFromCursor(tree.walk(), text);
    node._tree = tree;
    // need to set the source string early for nested parsers
    node._sourceString = text;
    // tree-sitter may skip leading whitespace in the root node,
    // which confuses our system
    node._range = [0, text.length];
    console.assert(node.range[1] === text.length, "root range is wrong");
    return node;
  }

  _nodeFromCursor(cursor, text) {
    const node = new SBBlock(
      cursor.nodeType,
      cursor.currentFieldName(),
      cursor.startIndex,
      cursor.endIndex,
      cursor.nodeIsNamed,
    );

    if (cursor.gotoFirstChild()) {
      do {
        this.addTextFromCursor(cursor, node, false, text);
        node.addChild(this._nodeFromCursor(cursor, text));
      } while (cursor.gotoNextSibling());
      this.addTextFromCursor(cursor, node, false, text);
      cursor.gotoParent();
    } else {
      this.addTextFromCursor(cursor, node, true, text);
    }

    // see if there is some trailing whitespace we are supposed to include
    if (this.lastLeafIndex < node.range[1]) {
      node.addChild(
        new SBText(
          text.slice(this.lastLeafIndex, node.range[1]),
          this.lastLeafIndex,
          node.range[1],
        ),
      );
      this.lastLeafIndex = node.range[1];
    }

    return node;
  }

  addTextFromCursor(cursor, node, isLeaf, text) {
    const gap = text.slice(this.lastLeafIndex, cursor.startIndex);
    if (gap) {
      node.addChild(new SBText(gap, this.lastLeafIndex, cursor.startIndex));
      this.lastLeafIndex = cursor.startIndex;
    }

    if (isLeaf && cursor.nodeText.length > 0) {
      node.addChild(
        new SBText(cursor.nodeText, cursor.startIndex, cursor.endIndex),
      );
      this.lastLeafIndex = cursor.endIndex;
    }
  }

  // node API
  _grammarBodyFor(node) {
    // TODO resolve aliases --> type would not be found
    return this.grammar.rules[node.type];
  }

  _grammarNodeFor(node) {
    if (node.isRoot)
      return new GrammarNode({ type: "SYMBOL", name: this.type }, null);
    const rule = this._grammarBodyFor(node.parent);
    let res;
    this._matchRule(rule, [...node.parent.childNodes], (n, rule) => {
      if (node === n) res = rule;
    });
    return res;
  }

  firstInsertPoint(node, type) {
    const rule = this._grammarBodyFor(node);
    console.assert(node.childNodes.length > 0);

    let lastNode;
    let start = null;
    this._matchRule(rule, [...node.childNodes], (n, rule) => {
      lastNode = n ?? lastNode;
      if (
        n === null &&
        start === null &&
        this.compatibleType(type, rule.name)
      ) {
        start = lastNode?.range[1] ?? node.range[0];
      }
    });

    return start;
  }

  separatorContextFor(node) {
    const rule = this._grammarNodeFor(node);
    return rule.separatorContext?.repeatSeparator;
  }

  compatibleType(myType, grammarType) {
    if (myType === grammarType) return true;
    const rule = this.grammar.rules[grammarType];
    console.assert(rule);
    return this._matchesType(rule, myType);
  }

  isExpression(node) {
    // TODO parametrize the name of the expression type
    const rule = this._grammarNodeFor(node);
    return rule.name === "expression";
  }

  // FIXME cb should only be called once we know that we have a full match
  _matchRule(rule, pending, cb) {
    switch (rule.type) {
      case "SEQ":
        for (const member of rule.members) {
          this._matchRule(member, pending, cb);
        }
        break;
      case "STRING":
        if (rule.value === (pending[0]?.text ?? "")) {
          cb(pending.shift(), rule);
        } else {
          throw new NoMatch();
        }
        break;
      case "SYMBOL":
        if (this.compatibleType(pending[0]?.type, rule.name)) {
          cb(pending.shift(), rule);
        } else {
          // inline?
          if (rule.name[0] === "_" || this.grammar.inline.includes(rule.name)) {
            this._matchRule(this.grammar.rules[rule.name], pending, cb);
          } else {
            // advertise the slot
            cb(null, rule);
            throw new NoMatch();
          }
        }
        break;
      case "ALIAS":
        if (pending[0]?.type === rule.value) {
          cb(pending.shift(), rule);
        } else {
          throw new NoMatch();
        }
        break;
      case "CHOICE":
        let didMatch = false;
        for (const member of rule.members) {
          // FIXME assumes that is can commit early to a choice,
          // instead we should be exploring all possible results
          try {
            const copy = [...pending];
            this._matchRule(member, copy, cb);
            // shrink to same size and continue
            while (pending.length > copy.length) pending.shift();
            didMatch = true;
            break;
          } catch (e) {
            if (!(e instanceof NoMatch)) throw e;
          }
        }
        if (!didMatch) throw new NoMatch();
        break;
      case "REPEAT1":
        this._matchRule(rule.content, pending, cb);
      // fallthrough /!\
      case "REPEAT":
        for (let i = 0; ; i++) {
          try {
            let previousLength = pending.length;
            this._matchRule(rule.content, pending, cb);
            if (pending.length === previousLength) break;
            else previousLength = pending.length;
          } catch (e) {
            if (!(e instanceof NoMatch)) throw e;
            break;
          }
        }
        break;
      case "TOKEN":
      case "IMMEDIATE_TOKEN":
        if (rule.regex.test(pending[0]?.text ?? "")) {
          cb(pending.shift(), rule);
        } else {
          throw new NoMatch();
        }
        break;
      case "PREC_DYNAMIC":
      case "PREC_LEFT":
      case "PREC_RIGHT":
      case "PREC":
      case "FIELD":
        return this._matchRule(rule.content, pending, cb);
      case "BLANK":
        break;
      default:
        debugger;
    }
  }

  _matchesType(rule, myType) {
    switch (rule.type) {
      case "SYMBOL":
        return (
          rule.name === myType ||
          this._matchesType(this.grammar.rules[rule.name], myType)
        );
      case "CHOICE":
        return rule.members.some((member) => this._matchesType(member, myType));
      case "PREC_DYNAMIC":
      case "PREC_LEFT":
      case "PREC_RIGHT":
      case "PREC":
      case "FIELD":
        return this._matchesType(rule.content, myType);
      case "ALIAS":
        return rule.value === myType || this._matchesType(rule.content, myType);
      case "BLANK":
        return !myType;
      default:
        return false;
    }
  }
}

class NoMatch {
  constructor() {
    this.name = "NoMatch";
  }
}

class GrammarNode extends Object {
  static buildRegex(node) {
    switch (node.type) {
      case "PREC":
      case "PREC_DYNAMIC":
      case "PREC_LEFT":
      case "PREC_RIGHT":
      case "FIELD":
        return this.buildRegex(node.content);
      case "SEQ":
        return node.children.map((c) => this.buildRegex(c)).join("");
      case "CHOICE":
        return `(${node.children.map((c) => this.buildRegex(c)).join("|")})`;
      case "TOKEN":
      case "IMMEDIATE_TOKEN":
        return this.buildRegex(node.content);
      case "REPEAT":
        return `(${this.buildRegex(node.content)})*`;
      case "REPEAT1":
        return `(${this.buildRegex(node.content)})+`;
      case "PATTERN":
        return `(${node.value})`;
      case "BLANK":
        return "";
      case "STRING":
        return node.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      default:
        throw new Error("unknown node type " + node.type);
    }
  }

  constructor(rule, parent, name = undefined) {
    super();
    this.parent = parent;
    if (name) this.name = name;
    if (rule.members)
      this.members = rule.members.map((r) => new GrammarNode(r, this));
    if (rule.content) this.content = new GrammarNode(rule.content, this);
    for (const key of Object.keys(rule)) {
      if (key === "members" || key === "content") continue;
      this[key] = rule[key];
    }
    if (this.type === "TOKEN" || this.type === "IMMEDIATE_TOKEN") {
      this.regex = new RegExp(this.constructor.buildRegex(this.content));
    }
    if (this.type === "PATTERN") {
      this.regex = new RegExp(this.value);
    }
  }

  repeaterFor(cb) {
    return (this.type === "REPEAT" || this.type === "REPEAT1") && cb(this)
      ? this
      : this.parent?.repeaterFor(cb);
  }

  get children() {
    return this.members ?? (this.content ? [this.content] : []);
  }

  get root() {
    while (this.parent) return this.parent.root;
    return this;
  }

  get structure() {
    return [this.type, ...this.children.map((c) => c.structure)];
  }

  get separatorContext() {
    return this.repeatSeparator ? this : this.parent?.separatorContext;
  }

  postProcess(grammar) {
    this.detectSeparator();

    for (const child of this.children) {
      child.postProcess(grammar);
    }
  }

  firstChildThat(cb) {
    for (const child of this.children) {
      if (cb(child)) return child;
      else {
        const result = child.firstChildThat(cb);
        if (result) return result;
      }
    }
    return null;
  }

  matchesStructure(structure) {
    return matchesStructure(this.structure, structure);
  }

  deepEqual(other) {
    if (this.type !== other.type) return false;
    if (this.children.length !== other.children.length) return false;
    for (let i = 0; i < this.children.length; i++) {
      if (!this.children[i].deepEqual(other.children[i])) return false;
    }
    return true;
  }

  detectSeparator() {
    if (
      this.matchesStructure([
        "CHOICE",
        [
          "SEQ",
          ["SEQ", ["*"], ["REPEAT", ["SEQ", ["STRING"], ["*"]]]],
          ["CHOICE", ["STRING"], ["BLANK"]],
        ],
        ["BLANK"],
      ])
    ) {
      const sep1 = this.children[0].children[1].children[0].value;
      const sep2 =
        this.children[0].children[0].children[1].children[0].children[0].value;
      const sym1 = this.children[0].children[0].children[0];
      const sym2 =
        this.children[0].children[0].children[1].children[0].children[1];
      if (sep1 === sep2 && sym1.deepEqual(sym2)) {
        this.repeatSeparator = sep1;
        this.repeatSymbol = sym1;
        return;
      }
    }

    if (
      this.matchesStructure([
        "SEQ",
        ["*"],
        ["REPEAT", ["SEQ", ["STRING"], ["*"]]],
      ])
    ) {
      const sep = this.children[1].children[0].children[0].value;
      const sym1 = this.children[0];
      const sym2 = this.children[1].children[0].children[1];
      if (sym1.deepEqual(sym2)) {
        this.repeatSeparator = sep;
        this.repeatSymbol = sym1;
        return;
      }
    }

    if (
      this.matchesStructure([
        "CHOICE",
        ["SEQ", ["*"], ["REPEAT", ["SEQ", ["STRING"], ["*"]]]],
        ["BLANK"],
      ])
    ) {
      const sep = this.children[0].children[1].children[0].children[0].value;
      const sym1 = this.children[0].children[0];
      const sym2 = this.children[0].children[1].children[0].children[1];
      if (sym1.deepEqual(sym2)) {
        this.repeatSeparator = sep;
        this.repeatSymbol = sym1;
        return;
      }
    }
  }
}

function matchesStructure(a, b) {
  if (a[0] === "*" || b[0] === "*") return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Array.isArray(a[i]) && Array.isArray(b[i])) {
      if (!matchesStructure(a[i], b[i])) return false;
    } else if (a[i] !== b[i]) return false;
  }
  return true;
}

export class TreeSitterComposedLanguage extends SBLanguage {
  constructor({
    name,
    extensions,
    defaultExtensions,
    baseLanguage,
    nestedLanguage,
    matcher,
  }) {
    super({
      name,
      extensions,
      defaultExtensions,
    });

    this.baseLanguage = baseLanguage;
    this.nestedLanguage = nestedLanguage;
    this.matcher = matcher;
  }

  async ready() {
    await this.baseLanguage.ready();
    await this.nestedLanguage.ready();
  }

  destroyRoot(root) {
    this.baseLanguage.destroyRoot(root);
    // TODO nestedLanguage
  }

  // TODO compatibleType and separatorContext

  _parse(text, oldRoot = null) {
    // TODO use includedRanges instead
    const newRoot = this.baseLanguage.parse(text, oldRoot);
    const update = [];
    newRoot.allNodesDo((n) => {
      if (this.matcher(n)) {
        // TODO oldRoot?
        const nestedRoot = this.nestedLanguage.parse(n.sourceString);
        update.push([n, nestedRoot]);
      }
    });

    for (const [base, nested] of update) {
      base.replaceNode(nested);
      nested.allNodesDo((n) => n.shiftRange(base.range[0]));
    }

    return newRoot;
  }
}

export class TSQuery {
  static cache = new Map();
  static get(template, language, extract = null) {
    const key = `${template}::${language.name}`;
    if (!this.cache.has(key))
      this.cache.set(key, new TSQuery(template, language, extract));
    return this.cache.get(key);
  }

  constructor(template, language, extract = null) {
    const processed = template.replace(/\$/g, language.parseConfig.matchPrefix);
    const parse = processed.replace(/\(\?/g, "").replace(/\?\)/g, "");
    const root = language.parseExpression(parse);

    let adjust = 0;
    const optionalStack = [];
    for (let i = 0; i < processed.length; i++) {
      const char = processed[i];
      if (char === "(" && processed[i + 1] === "?") {
        optionalStack.push(i - adjust);
        adjust += 2;
      }
      if (char === "?" && processed[i + 1] === ")") {
        const start = optionalStack.pop();
        const node = root.childForRange([start, i - adjust]);
        node.optional = true;
        adjust += 2;
      }
    }

    this.template =
      typeof extract === "string"
        ? root.firstOfType(extract)
        : extract?.(root) ?? root;
    this.language = language;
  }

  match(node) {
    const captures = [];
    if (this._match(this.template, node, captures)) return captures;
    return null;
  }

  get multiPrefix() {
    return this.prefix.repeat(3);
  }

  get parentPrefix() {
    return this.prefix + "_";
  }

  get prefix() {
    return this.language.parseConfig.matchPrefix;
  }

  _match(a, b, captures) {
    if (!a || !b) return false;
    const isTemplate = a.text.startsWith(this.prefix);
    if (isTemplate) {
      captures.push([a.text.slice(1), b]);
      return true;
    }
    if (!a.isText && !b.isText && a.type === b.type) {
      const aChildren = a.childNodes.filter((n) => n.text !== ",");
      const bChildren = b.childNodes.filter((n) => n.text !== ",");
      const leading = aChildren.findIndex((c) =>
        c.text.startsWith(this.multiPrefix),
      );
      // if we have a multi match for children, match the prefix and suffix
      // of the template (if any), then collect the remaining children
      if (leading >= 0) {
        if (leading > bChildren.length) return false;
        for (let i = 0; i < leading; i++) {
          if (!this._match(aChildren[i], bChildren[i], captures)) return false;
        }
        let trailing = aChildren.length - leading - 1;
        for (let i = 0; i < trailing; i++) {
          if (
            !this._match(
              aChildren[aChildren.length - i - 1],
              bChildren[bChildren.length - i - 1],
              captures,
            )
          )
            return false;
        }
        captures.push([
          aChildren[leading].text.slice(this.multiPrefix.length),
          bChildren.slice(leading, -trailing).filter((n) => n.named),
        ]);
        return true;
      }

      const parentMatch = a.childNodes.find((n) =>
        n.text.startsWith(this.parentPrefix),
      );
      if (parentMatch) {
        captures.push([parentMatch.text.slice(this.parentPrefix.length), b]);
        return true;
      }

      for (let i = 0, j = 0; i < aChildren.length; i++, j++) {
        const match = this._match(aChildren[i], bChildren[j], captures);
        if (match) continue;
        if (aChildren[i].optional) {
          let optionalRoot = aChildren[i].root.internalClone();
          optionalRoot._sourceString = aChildren[i].root.sourceString;
          optionalRoot._language = aChildren[i].root.language;

          const optionalTemplate = optionalRoot.childForRange(
            aChildren[i].range,
          );
          for (const child of optionalTemplate.allNodes()) {
            if (child.named && child.text.startsWith(this.prefix)) {
              if (child.text.startsWith(this.parentPrefix)) {
                captures.push([child.text.slice(2), child.parent]);
              } else {
                captures.push([child.text.slice(1), new SBBlock()]);
                throw new Error("Still need to implement fallback definitions");
              }
            }
          }

          console.assert(optionalTemplate.connected);
          optionalRoot =
            optionalRoot.language.removeQueryMarkers(optionalTemplate);
          console.assert(optionalTemplate.connected);
          optionalRoot._editor = new MaybeEditor(
            b.editor,
            b,
            optionalTemplate,
            // FIXME correct?
            withDo(
              b.childBlocks.indexOf(
                bChildren[Math.min(j, bChildren.length - 1)],
              ),
              (index) => (index < 0 ? b.childBlocks.length : index),
            ),
          );
          j--;
          continue;
        }
        return false;
      }

      return true;
    }
    if (a.isText && b.isText && a.text === b.text) return true;
    return false;
  }
}
