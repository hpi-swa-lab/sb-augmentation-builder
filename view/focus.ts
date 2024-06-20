import { SBNode } from "../core/model";

export function getFocusHost(element: Node) {
  let host: Node | null = element;
  while (host) {
    if ((host as any).isFocusHost) return host;
    host = host.parentNode;
  }
  return null;
}

export function markInputEditableForNode(
  range: [number, number],
  indexMap: [number, number][] = [],
) {
  return (input) => {
    if (input) {
      input.range = range;
      input.indexMap = indexMap;
    }
    markInputEditable(input);
  };
}

export function markInputEditable(input) {
  if (!input || input.hasAttribute("sb-editable")) return;
  input.setAttribute("sb-editable", "");

  function indexMap(): [number, number][] {
    return input.indexMap ?? [];
  }

  function move(forward, e) {
    e.preventDefault();
    e.stopPropagation();
    const pos = adjacentCursorPosition(
      {
        root: getFocusHost(input),
        element: input,
        index:
          mapIndexToLocal(indexMap(), input.selectionStart) + input.range[0],
      },
      forward,
    );
    if (pos && pos.element !== input)
      (pos.element as any).focusRange(pos.index, pos.index);
  }
  input.cursorPositions = function* () {
    let offset = 0;
    for (let i = 0; i <= input.value.length; i++) {
      yield {
        element: input,
        index: !!input.range ? i + input.range[0] + offset : undefined,
      };
      const remap = indexMap().find(([a]) => a === i);
      if (remap) offset += remap[1];
    }
  };
  input.focusRange = function (head, anchor) {
    input.focus();
    input.selectionStart = mapIndexToLocal(indexMap(), head) - input.range[0];
    input.selectionEnd = mapIndexToLocal(indexMap(), anchor) - input.range[0];
  };
  input.hasFocus = () => document.activeElement === input;
  input.getSelection = () => [
    mapIndexToGlobal(indexMap(), input.selectionStart) + input.range[0],
    mapIndexToGlobal(indexMap(), input.selectionEnd) + input.range[0],
  ];

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && input.selectionStart === input.value.length)
      move(true, e);
    if (e.key === "ArrowLeft" && input.selectionStart === 0) move(false, e);
    // make sure it doesn't bubble up to replacements or similar
    e.stopPropagation();
  });
}

export function mapIndexToLocal(indexMap: [number, number][], index: number) {
  for (const [insertIndex, length] of indexMap) {
    if (insertIndex >= index) break;
    index += length;
  }
  return index;
}

export function mapIndexToGlobal(indexMap: [number, number][], index: number) {
  for (const [insertIndex, length] of indexMap) {
    if (insertIndex >= index) break;
    index -= length;
  }
  return index;
}

export function remapIndices(
  s: string,
  rules: [string, string][],
): [string, [number, number][]] {
  const indexMap: [number, number][] = [];
  let out = "";
  for (let i = 0; i < s.length; i++) {
    let match = false;
    for (const [from, to] of rules) {
      if (s.slice(i, i + from.length) === from) {
        if (from.length !== to.length)
          indexMap.push([i, from.length - to.length]);
        out += to;
        i += from.length - 1;
        match = true;
        break;
      }
    }
    if (!match) out += s[i];
  }
  return [out, indexMap];
}

export function remapIndicesReverse(s: string, rules: [string, string][]) {
  const inverted = rules.map(([from, to]) => [to, from] as [string, string]);
  return remapIndices(s, inverted);
}

export function adjacentCursorPosition(
  { root, element, index },
  forward: boolean,
) {
  return forward
    ? nextCursorPosition({ root, element, index })
    : previousCursorPosition({ root, element, index });
}

function previousCursorPosition({ root, element, index }) {
  let previous: { index: number; element: HTMLElement } | null = null;
  for (const { index: i, element: e } of root.cursorPositions()) {
    if (i === index && element === e) return previous;
    previous = { index: i, element: e };
  }
  return previous;
}

function nextCursorPosition({ root, element, index }) {
  let takeNext = false;
  for (const { index: i, element: e } of root.cursorPositions()) {
    if (takeNext) return { index: i, element: e };
    if (i === index && element === e) takeNext = true;
  }
  return null;
}

export function cursorPositionsForIndex(element: HTMLElement, index: number) {
  let bestDistance = Infinity;
  let candidates: { index: number; element: HTMLElement }[] = [];

  for (const { index: i, element: e } of (element as any).cursorPositions()) {
    const distance = Math.abs(i - index);
    if (distance < bestDistance) {
      candidates = [];
      bestDistance = distance;
    }
    if (distance === bestDistance) candidates.push({ index: i, element: e });
  }
  return candidates;
}
