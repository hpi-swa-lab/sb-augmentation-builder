export function getFocusHost(element: Node) {
  let host: Node | null = element;
  while (host) {
    if ((host as any).isFocusHost) return host;
    host = host.parentNode;
  }
  return null;
}

export function markInputEditableForNode(node) {
  return (input) => {
    markInputEditable(input);
    if (input) input.range = node.range;
  };
}

export function markInputEditable(input) {
  if (!input || input.hasAttribute("sb-editable")) return;
  input.setAttribute("sb-editable", "");

  function move(forward, e) {
    e.preventDefault();
    e.stopPropagation();
    const pos = adjacentCursorPosition(
      {
        root: getFocusHost(input),
        element: input,
        index: input.selectionStart + input.range[0],
      },
      forward,
    );
    if (pos && pos.element !== input)
      (pos.element as any).focusRange(pos.index, pos.index);
  }
  input.cursorPositions = function* () {
    for (let i = 0; i <= input.value.length; i++)
      yield {
        element: input,
        elementOffset: i,
        index: !!input.range ? i + input.range[0] : undefined,
      };
  };
  input.focusRange = function (head, anchor) {
    input.focus();
    input.selectionStart = head - input.range[0];
    input.selectionEnd = anchor - input.range[0];
  };
  input.hasFocus = () => document.activeElement === input;

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && input.selectionStart === input.value.length)
      move(true, e);
    if (e.key === "ArrowLeft" && input.selectionStart === 0) move(false, e);
    // make sure it doesn't bubble up to replacements or similar
    e.stopPropagation();
  });
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
