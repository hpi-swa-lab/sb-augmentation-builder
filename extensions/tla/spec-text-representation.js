import htm from "../../external/htm.mjs";
import { useContext, useEffect, useRef, useState } from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";
import { shard, editor } from "../../view/widgets.js";
import { DiagramConfig } from "./state-explorer.js";
import { EdgePickers, exportToHTML, nestedKeys, tableHeaderStyle } from "./utils.js";
const html = htm.bind(h);



function SpecEditor({ currNode, setCurrNode, graph }) {
    const source = useContext(DiagramConfig).source;
    const [refresh, setRefresh] = useState(0);
    const editorRef = useRef(null);

    const enabledEdges = graph.outgoingEdges.get(currNode.id);
    const enabledEdgesNames = enabledEdges.map(e => e.label);

    useEffect(() => {
        for (const r of editorRef.current.querySelectorAll(
            "sb-replacement[name=tla-next-state-display]",
        )) {
            r.props.renderContent = ({ node }) => {
                const actionName = node.atField("name").text;
                // its possible to have multipe edges with same name
                // for example through non-deterministic transitions or parameters
                const edges = enabledEdges.filter(e => e.label === actionName);

                if (edges.length === 0 || !enabledEdgesNames.includes(actionName)) {
                    return shard(node)
                }

                const allReadKeys = edges.flatMap(e => nestedKeys(e.reads));
                const allWriteKeys = edges.flatMap(e => nestedKeys(e.writes));
                const combinedKeys = [...allReadKeys, ...allWriteKeys]
                    .toSorted((a, b) => a.join("").localeCompare(b.join("")))
                    // remove duplicates
                    .filter((k, i, arr) => i === 0 || arr[i - 1].join("") !== k.join(""));

                const nextNodes = edges.map(e => graph.nodes.get(e.to));
                const nextNodesVars = nextNodes.map(n => n.vars);

                return html`
                <div style=${{ borderLeft: "6px solid green", marginLeft: "12px", paddingLeft: "8px" }} >
                    <table>
                      <thead>
                        <tr>
                          <th style=${tableHeaderStyle}>Scope</th>
                          <th style=${tableHeaderStyle}>Before</th>
                          ${edges.map(edge => html`
                            <th>
                                <${EdgePickers} ...${{ graph, currNode, setCurrNode, setPrevEdges: () => { }, setPreviewEdge: () => { } }} 
                                    filterFn=${e => e === edge} />
                            </th>`)}
                        </tr>
                      </thead>
                      <tbody>
                        ${combinedKeys.map(keySeq => exportToHTML(keySeq, currNode.vars, ...nextNodesVars))}
                      </tbody>
                    </table>
                    ${shard(node, { style: { display: "block" } })}
                </div>`
            };
            // FIXME not sure why this has to be in a micro task, is there global state
            // in preact that disallows nesting render calls?
            queueMicrotask(() => r.render());
        }
    }, [refresh, currNode]);

    return editor({
        editorRef,
        sourceString: source,
        language: "tlaplus",
        readonly: true,
        style: { width: "660px" },
        onready: () => setRefresh((r) => r + 1),
        extensions: [
            "tlaplus:base",
            "tlaplus:nextStateDisplay",
            "tlaplus:syntaxExplain",
            "tlaplus:tlacup",
            "tlaplus:tlabulletConj",
            "tlaplus:tlabulletDisj",
            "tlaplus:tlalor",
            "tlaplus:tlaland",
            "tlaplus:tlaalways",
            "tlaplus:tladiamond",
            "tlaplus:tlaimplies",
            "tlaplus:tlasetIn",
            "tlaplus:tlanotin",
            "tlaplus:tlasetsubseteq",
            "tlaplus:tlasetsubset",
            "tlaplus:tlamapsTo",
            "tlaplus:tlaallMapTo",
            "tlaplus:tladefEq",
            "tlaplus:tlaexists",
            "tlaplus:tlaforall",
            "tlaplus:tlain"
        ],
    });
}

export const SpecTextRepresentation = ({ currNode, setCurrNode, graph }) => {
    return html`
    <h3 style=${{ display: "inline-block" }}>Spec Source Code</h3>
    <${SpecEditor} currNode=${currNode} setCurrNode=${setCurrNode} graph=${graph} />
    `
}