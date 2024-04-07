export class WeakArray {
  constructor() {
    this._array = [];
  }
  push(item) {
    this._array.push(new WeakRef(item));
  }
  get length() {
    return this._array.length;
  }
  get any() {
    for (const ref of this._array) {
      const item = ref.deref();
      if (item) return item;
    }
    return null;
  }
  remove(item) {
    this._array = this._array.filter((ref) => ref.deref() !== item);
  }
  forEach(callback) {
    let anyRemoved = false;
    // work on a copy to allow removing while iterating
    const copy = [...this._array];
    for (let i = 0; i < copy.length; i++) {
      const item = copy[i].deref();
      if (item) {
        callback(item);
      } else {
        anyRemoved = true;
      }
    }
    // work on the original
    if (anyRemoved) this._array = this._array.filter((item) => item.deref());
  }
  getAll() {
    const list = [];
    this.forEach((e) => list.push(e));
    return list;
  }
  includes(item) {
    return this._array.some((ref) => ref.deref() === item);
  }
}

export function undoableMutation(root, cb) {
  const observer = new MutationObserver(() => {
    console.assert(false, "should not reach");
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    characterDataOldValue: true,
  });
  cb();
  const changes = observer.takeRecords();
  console.assert(changes.length > 0, "no operation recorded");
  observer.disconnect();
  return () => ToggleableMutationObserver.undoMutations(changes);
}

export class ToggleableMutationObserver {
  static observers = new WeakArray();
  static nestedDisable = 0;
  static get enable() {
    return this.nestedDisable === 0;
  }
  static ignoreMutation(cb) {
    if (this.nestedDisable === 0) {
      this.observers.forEach((observer) => observer.disconnect());
    }
    this.nestedDisable++;
    try {
      cb();
    } finally {
      this.nestedDisable--;
      if (this.nestedDisable === 0) {
        this.observers.forEach((observer) => observer.connect());
      }
    }
  }

  constructor(target, callback) {
    this.target = target;
    this.callback = callback;
    this.observer = new MutationObserver(this.callback);
    this.enabled = false;
    this.destroyed = false;
    if (this.constructor.enable) this.connect();
    this.constructor.observers.push(this);
  }

  takeRecords() {
    return this.observer.takeRecords();
  }

  connect() {
    if (this.destroyed) throw new Error("Cannot connect destroyed observer");
    if (this.enabled) return;

    // flush any that precede us listening
    this.observer.takeRecords();

    this.enabled = true;
    this.observer.observe(this.target, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      characterDataOldValue: true,
    });
  }

  disconnect() {
    if (!this.enabled) return;
    this.enabled = false;
    this.observer.disconnect();
  }

  destroy() {
    this.disconnect();
    this.constructor.observers.remove(this);
    this.destroyed = true;
  }

  static undoMutations(mutations) {
    for (const mutation of mutations.reverse()) {
      this.undoMutation(mutation);
    }
  }
  static undoMutation(mutation) {
    switch (mutation.type) {
      case "characterData":
        mutation.target.textContent = mutation.oldValue;
        break;
      case "childList":
        for (const node of mutation.removedNodes) {
          mutation.target.insertBefore(node, mutation.nextSibling);
        }
        for (const node of mutation.addedNodes) {
          mutation.target.removeChild(node);
        }
        break;
      default:
        debugger;
    }
  }
}

export function findChange(a, b, preferredPos, preferredSide) {
  const diff = findDiff(a, b, preferredPos, preferredSide);
  if (!diff) return null;

  const change =
    diff.from === diff.toB
      ? { delete: a.slice(diff.from, diff.toA), from: diff.from, to: diff.toA }
      : { insert: b.slice(diff.from, diff.toB), from: diff.from, to: diff.toA };
  return change;
}
// copied from codemirror: detect the change between to strings at the cursor position.
// `preferredSide` should be "end" if backspace was pressed
function findDiff(a, b, preferredPos, preferredSide) {
  let minLen = Math.min(a.length, b.length);
  let from = 0;
  while (from < minLen && a.charCodeAt(from) == b.charCodeAt(from)) from++;
  if (from == minLen && a.length == b.length) return null;
  let toA = a.length,
    toB = b.length;
  while (toA > 0 && toB > 0 && a.charCodeAt(toA - 1) == b.charCodeAt(toB - 1)) {
    toA--;
    toB--;
  }

  if (preferredSide === "end") {
    let adjust = Math.max(0, from - Math.min(toA, toB));
    preferredPos -= toA + adjust - from;
  }
  if (toA < from && a.length < b.length) {
    let move =
      preferredPos <= from && preferredPos >= toA ? from - preferredPos : 0;
    from -= move;
    toB = from + (toB - toA);
    toA = from;
  } else if (toB < from) {
    let move =
      preferredPos <= from && preferredPos >= toB ? from - preferredPos : 0;
    from -= move;
    toA = from + (toA - toB);
    toB = from;
  }
  return { from, toA, toB };
}

// assume the only change from prev to current is that a string was inserted
// into current. find that string.
function findInsertedString(prev, current) {
  if (prev.length >= current.length) throw new Error("prev must be shorter");

  let string = "";
  let start = 0;
  let i = 0;
  let j = 0;

  while (j < current.length) {
    if (prev[i] !== current[j]) {
      start = i;
      string += current[j];
      j++;
    } else {
      i++;
      j++;
    }
  }

  return { string, index: start };
}

// on firefox, we pierce to the inner-most shadow root.
// on chrome, we can call getSelection on the shadow root, so we repeat
// until there is no more shadowRoot to pierce.
export function getSelection() {
  let selection = document.getSelection();
  while (
    selection.type !== "None" &&
    selection.anchorNode.childNodes[selection.anchorOffset]?.shadowRoot &&
    selection.anchorNode.childNodes[selection.anchorOffset].shadowRoot
      .getSelection
  ) {
    selection =
      selection.anchorNode.childNodes[
        selection.anchorOffset
      ].shadowRoot.getSelection();
  }

  return selection;
}

export function orParentThat(node, predicate) {
  if (node instanceof Text) node = node.parentNode;

  while (node instanceof HTMLElement) {
    if (predicate(node)) return node;
    node = node.parentNode ?? node.getRootNode()?.host;
    if (node instanceof ShadowRoot) node = node.host;
  }
  return null;
}

export function parentWithTag(node, tag) {
  return orParentThat(node, (n) =>
    Array.isArray(tag) ? tag.includes(n.tagName) : n.tagName === tag,
  );
}

export function parentsWithTagDo(node, tag, cb) {
  while (node) {
    if (Array.isArray(tag) ? tag.includes(node.tagName) : node.tagName === tag)
      cb(node);
    node = node.parentNode;
  }
}

export class SortedArray {
  constructor(compare) {
    this.array = [];
    this.compare = compare;
  }

  insert(value) {
    const index = this.array.findIndex((v) => this.compare(v, value) > 0);
    if (index === -1) {
      this.array.push(value);
    } else {
      this.array.splice(index, 0, value);
    }
  }
}

export function zipOrNullDo(a, b, cb) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    cb(a[i], b[i]);
  }
}

let _hash = 1;
export function nextHash() {
  return _hash++;
}

export function allViewsDo(parent, cb) {
  for (const child of parent.childNodes) {
    if (child.tagName === "SB-TEXT" || child.tagName === "SB-BLOCK") {
      cb(child);
      allViewsDo(child, cb);
    } else {
      allViewsDo(child, cb);
    }
  }
}

export function mapSeparated(list, item, separator) {
  const result = [];
  for (let i = 0; i < list.length; i++) {
    result.push(item(list[i]));
    if (i < list.length - 1) result.push(separator());
  }
  return result;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function asyncEval(str) {
  const s = document.createElement("script");
  s.setAttribute("type", "module");
  s.textContent = str;
  document.head.appendChild(s);
  queueMicrotask(() => s.remove());
}

export function exec(arg, ...script) {
  if (!arg) return null;

  let current = arg;
  for (const predicate of script) {
    let next = predicate(current);
    if (!next) return null;
    if (_isEmptyObject(next)) return null;
    if (Array.isArray(next) && next.length < 1) return null;
    if (next !== true) current = next;
  }
  return current;
}

export function requireValues(arg, keys) {
  if (!arg) return false;

  for (const key of keys) {
    if (!(key in arg)) return false;
  }

  return true;
}

function _isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function rangeEqual(a, b) {
  console.assert(Array.isArray(a));
  console.assert(Array.isArray(b));

  let [a0, a1] = a;
  if (a0 > a1) [a0, a1] = [a1, a0];
  let [b0, b1] = b;
  if (b0 > b1) [b0, b1] = [b1, b0];
  return a0 === b0 && a1 === b1;
}

export function rangeContains(a, b) {
  console.assert(Array.isArray(a));
  console.assert(Array.isArray(b));
  return a[0] <= b[0] && a[1] >= b[1];
}

export function rangeIntersects(a, b) {
  console.assert(Array.isArray(a));
  console.assert(Array.isArray(b));
  return a[0] <= b[1] && a[1] >= b[0];
}

export function rangeDistance(a, b) {
  if (a[0] > b[1]) return a[0] - b[1];
  else if (b[0] > a[1]) return b[0] - a[1];
  else return 0;
}

export function rangeShift(range, delta) {
  return [range[0] + delta, range[1] + delta];
}

export function matchesKey(e, key) {
  const modifiers = key.split("-");
  const baseKey = modifiers.pop();

  if (modifiers.includes("Ctrl") && !e.ctrlKey && !e.metaKey) return false;
  if (modifiers.includes("Alt") && !e.altKey) return false;
  if (modifiers.includes("Shift") && !e.shiftKey) return false;
  return e.key === baseKey;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sequenceMatch(query, word, startMustMatch = true) {
  if (!query) return true;
  if (word.length < query.length) return false;
  if (startMustMatch && query[0] !== word[0]) return false;

  let i = 0;
  for (const char of word.toLowerCase()) {
    if (char === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

export function last(array) {
  return array[array.length - 1];
}

export function rectDistance(a, b) {
  const left = b.right < a.left;
  const right = a.right < b.left;
  const bottom = b.bottom < a.top;
  const top = a.bottom < b.top;

  function dist([x1, y1], [x2, y2]) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  if (top && left) {
    return dist([a.left, a.bottom], [b.right, b.top]);
  } else if (left && bottom) {
    return dist([a.left, a.top], [b.right, b.bottom]);
  } else if (bottom && right) {
    return dist([a.right, a.top], [b.left, b.bottom]);
  } else if (right && top) {
    return dist([a.right, a.bottom], [b.left, b.top]);
  } else if (left) {
    return a.left - b.right;
  } else if (right) {
    return b.left - a.right;
  } else if (bottom) {
    return a.top - b.bottom;
  } else if (top) {
    return b.top - a.bottom;
  } else {
    return 0;
  }
}

export function lastDeepChild(element) {
  if (element.children.length > 0) return lastDeepChild(last(element.children));
  else return element;
}

export function lastDeepChildNode(element) {
  if (element.childNodes.length > 0)
    return lastDeepChildNode(last(element.childNodes));
  else return element;
}

export function firstDeepChild(element) {
  if (element.children.length > 0) return firstDeepChild(element.children[0]);
  else return element;
}

export function withDo(obj, cb) {
  return cb(obj);
}

export function isNullRect(rect) {
  return rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0;
}

export function clampRange(range, [min, max]) {
  return [clamp(range[0], min, max), clamp(range[1], min, max)];
}

export const caseOf = (x, cases, otherwise) => {
  const func = cases[x];
  return func ? func() : otherwise();
};

// Focus an element without scrolling any of its parents.
// You may provide a custom function for scrolling if you
// have overridden the default focus function.
export function focusWithoutScroll(element, focusFn = (e) => e.focus()) {
  const parents = [];
  let parent = element;
  while (parent) {
    parents.push(parent);
    parent = parent.parentNode;
  }
  const scrollPositions = parents.map((x) => x.scrollTop);
  focusFn(element);
  parents.forEach((x, i) => (x.scrollTop = scrollPositions[i]));
}

export function randomId() {
  return Math.floor(Math.random() * 1e9);
}

// usage: pluralString("prompt", numberOfPrompts)
export function pluralString(string, number) {
  return `${number} ${string}${number === 1 ? "" : "s"}`;
}

export function takeWhile(list, cb) {
  const result = [];
  for (const item of list) {
    if (cb(item)) result.push(item);
    else break;
  }
  return result;
}

// CREDITS: https://stackoverflow.com/a/8809472/13994294
export function makeUUID() {
  var d = new Date().getTime(); //Timestamp
  var d2 =
    (typeof performance !== "undefined" &&
      performance.now &&
      performance.now() * 1000) ||
    0; //Time in microseconds since page-load or 0 if unsupported
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16; //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
