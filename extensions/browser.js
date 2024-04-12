import { Extension } from "../core/extension.js";
import {
  DeletionInteraction,
  SelectionInteraction,
  ShardList,
} from "../core/replacement.js";
import { useEffect, useState } from "../external/preact-hooks.mjs";
import { List } from "../sandblocks/list.js";
import { h } from "../view/widgets.js";

function takeBackwardWhile(list, start, condition) {
  let index = list.indexOf(start) - 1;

  while (index >= 0 && condition(list[index])) {
    index--;
  }

  return list.slice(index + 1, list.indexOf(start));
}

const removeIndent = new Extension().registerReplacement({
  query: [(x) => x.isText && x.text.includes("\n") && x.text.length > 2],
  queryDepth: 1,
  selection: SelectionInteraction.Point,
  deletion: DeletionInteraction.SelectThenFull,
  component: ({ node, replacement }) => {
    const root = replacement.shard.node;
    let minIndent = Infinity;
    for (const child of root.allNodes())
      if (child.isText && child.text.includes("\n"))
        minIndent = Math.min(
          minIndent,
          child.text.match(/\n\s*/)?.[0].length ?? 0,
        );

    const [prefix, suffix] = node.text.split("\n", 2);
    return h(
      "span",
      { style: { fontFamily: "monospace" } },
      prefix + "\n" + (suffix ?? "").slice(minIndent - 1),
    );
  },
  name: "remove-indent",
});

export const javascript = new Extension().registerReplacement({
  query: [(x) => x.type === "program"],
  queryDepth: 1,
  rerender: () => true,
  component: ({ node, replacement }) => {
    const symbols = node.childBlocks;
    const [selectedSymbol, setSelectedSymbol] = useState(symbols[0]);

    let selectedBody = selectedSymbol;
    if (selectedBody?.type === "export_statement")
      selectedBody = selectedBody.childBlock(0);
    if (selectedBody?.type === "class_declaration")
      selectedBody = selectedBody.atField("body");

    const members =
      (["class_body"].includes(selectedBody?.type)
        ? selectedBody?.childBlocks
        : null) ?? [];

    let [selectedMember, setSelectedMember] = useState(members[0]);
    // if we have become disconnected while selected, choose a fallback
    if (!selectedMember?.connected) selectedMember = members[0];
    useEffect(() => {
      setSelectedMember(members[0]);
    }, [selectedSymbol]);

    useEffect(() => {
      replacement.style.display = "flex";
      replacement.style.height = "100%";
    }, []);

    const shownSymbol = selectedMember ?? selectedSymbol;
    const shownSymbolList = shownSymbol
      ? [
          ...takeBackwardWhile(
            shownSymbol.parent.children,
            shownSymbol,
            (n) => n.type === "comment" || n.isWhitespace(),
          ),
          shownSymbol,
        ]
      : [];

    const listStyles = {
      flex: 1,
      minHeight: 120,
    };
    return h(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: "1 1" } },
      h(
        "div",
        { style: { display: "flex" } },
        List({
          style: listStyles,
          items: symbols,
          selected: selectedSymbol,
          setSelected: setSelectedSymbol,
          labelFunc: (x) => {
            let label = "";
            if (x.type === "export_statement") {
              label += "* ";
              x = x.childBlock(0);
            }
            if (
              x.type === "lexical_declaration" &&
              x.childBlocks.filter((n) => n.type === "variable_declarator")
                .length === 1
            ) {
              const decl = x.atType("variable_declarator");
              label += ["arrow_function"].includes(decl.atField("value").type)
                ? "(fn) "
                : "(val) ";
              label += decl.atField("name").text;
              return label;
            }
            if (x.type === "import_statement") {
              label += "(imp) ";
              label += (x.atType("import_clause") ?? x.childBlock(0))
                .sourceString;
              return label;
            }

            if (x.type === "class_declaration") label += "(cls) ";
            if (x.type === "function_declaration") label += "(fn) ";
            if (x.type === "comment") label += "(doc) ";

            label += x.atField("name")?.text ?? x.sourceString.slice(0, 15);
            return label;
          },
        }),
        List({
          style: listStyles,
          items: members,
          selected: selectedMember,
          setSelected: setSelectedMember,
          labelFunc: (x) => {
            if (x.type === "comment")
              return "(doc) " + x.sourceString.slice(0, 10);
            if (x.type === "method_definition") {
              let label = "";
              if (x.childNode(0).type === "get") label += "(get) ";
              else if (x.childNode(0).type === "set") label += "(set) ";
              else label += "(fn) ";
              label += x.atField("name").text;
              return label;
            }
            if (x.type === "field_definition")
              return "(val) " + x.atField("property").text;
            return x.sourceString.slice(0, 10);
          },
        }),
      ),

      h(
        "div",
        {
          style: {
            overflowY: "auto",
            height: "100%",
            display: "block",
            padding: "2px",
            margin: "0 -2px -2px -2px",
          },
        },
        shownSymbol?.editor &&
          h(ShardList, {
            sticky: true,
            list: shownSymbolList,
            extensions: function () {
              return [...(this.parentShard?.extensions() ?? []), removeIndent];
            },
            style: { display: "inline-block", width: "100%" },
          }),
      ),
    );
  },
  name: "sb-browser",
  sticky: true,
});
