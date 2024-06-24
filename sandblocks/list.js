import {
  useEffect,
  useRef,
  useState,
  useMemo,
} from "../external/preact-hooks.mjs";
import { appendCss, last, sequenceMatch, withDo } from "../utils.js";
import { h } from "../view/widgets.js";

function highlightSubstring(string, search) {
  if (!search) return string;

  const index = string.toLowerCase().indexOf(search.toLowerCase());
  return [
    string.slice(0, index),
    h(
      "span",
      { class: "search-result" },
      string.slice(index, index + search.length),
    ),
    string.slice(index + search.length),
  ];
}

function wrapIndex(index, dir, max) {
  if (dir === -1 && index === 0) return max - 1;
  if (dir === 1 && index === max - 1) return 0;
  return index + dir;
}

appendCss(`
.sb-list {
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.5rem;
}
.sb-list-item {
  white-space: nowrap;
  user-select: none;
  padding: 0 0.25rem;
}
.sb-list .selected {
  background: rgb(40, 131, 241);
  color: #fff;
}
.search-result {
  background-color: #ffe17d;
  outline: 1px solid #ffcc00;
}`);

export function List({
  items,
  labelFunc,
  iconFunc,
  setSelected,
  selected,
  height,
  style,
  onConfirm,
  autofocus,
  fuzzy,
  selectionContext,
}) {
  labelFunc ??= (x) => x;
  iconFunc ??= (x) => x?.icon;

  const selectedRef = useRef(null);

  const [filterString, setFilterString] = useState("");

  const filter = fuzzy
    ? (query, word) => sequenceMatch(query, word, false)
    : (query, word) => word.toLowerCase().includes(query);

  const visibleItems = useMemo(() => {
    return filterString === ""
      ? items
      : items
          .filter((item) => filter(filterString, labelFunc(item)))
          .sort((a, b) => labelFunc(a).length - labelFunc(b).length);
  }, [items, filterString]);

  useEffect(() => {
    if ((!selected || !visibleItems.includes(selected)) && visibleItems[0])
      setSelected(visibleItems[0]);
  }, [visibleItems, filterString]);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selected]);

  return h(
    "div",
    {
      class: "sb-list",
      tabIndex: -1,
      focusable: true,
      ref: (e) => {
        if (e) e.selectionContext = selectionContext;
      },
      autofocus,
      style: { maxHeight: height, ...(style ?? {}) },
      onClick: (e) => setSelected(last(visibleItems)),
      onkeydown: (e) => {
        if (e.key === "ArrowDown") {
          const index = visibleItems.indexOf(selected);
          setSelected(visibleItems[wrapIndex(index, 1, visibleItems.length)]);
        } else if (e.key === "ArrowUp") {
          const index = visibleItems.indexOf(selected);
          setSelected(visibleItems[wrapIndex(index, -1, visibleItems.length)]);
        } else if (e.key === "Enter") {
          selected && onConfirm?.(selected);
        } else if (e.key === "Backspace") {
          setFilterString("");
        } else if (e.key.length === 1 && !e.ctrlKey) {
          setFilterString((s) => s + e.key.toLowerCase());
        } else {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      },
    },
    visibleItems.map((item) =>
      h(
        "div",
        {
          class: `sb-list-item ${selected === item ? "selected" : ""}`,
          ref: selected === item ? selectedRef : null,
          onClick: (e) => {
            e.stopPropagation();
            setSelected(item);
            onConfirm?.(item);
          },
        },
        h("span", {
          style: {
            marginRight: "0.25rem",
            color: selected === item ? "#fff" : "rgb(40, 131, 241)",
          },
          class: withDo(iconFunc(item), (i) =>
            i ? "codicon codicon-" + i : null,
          ),
        }),
        fuzzy
          ? labelFunc(item)
          : highlightSubstring(labelFunc(item), filterString),
      ),
    ),
    visibleItems.length < 1 &&
      items.length > 0 &&
      h(
        "span",
        { style: { fontStyle: "italic" } },
        "No items matching ",
        h("span", { class: "search-result" }, filterString),
        h("br"),
        "(Press backspace to clear)",
      ),
  );
}
