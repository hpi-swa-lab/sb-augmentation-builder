import htm from "../../external/htm.mjs";
import { useCallback, useContext, useEffect, useRef, useState } from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";
import { editor } from "../../view/widgets.js";
import { Shard } from "../../core/replacement.js";
import { DiagramConfig, TaskContext } from "./state-explorer.js";
import { EdgePickers, apply, jsonToTLAString, nestedKeys, useDebounce } from "./utils.js";
const html = htm.bind(h);


const exportToHTML = (keys, ...varsList) => {
    // values is a list of primitive values or nested values
    const values = varsList.map(vars => apply(vars, keys));
    // each output space could have different size (e.g. a sequence with an added element)
    // We need to find the maximum number of rows to display
    const maxRows = Math.max(...values.map(v => Array.isArray(v) ? v.length : 1));

    const rows = []
    for (let i = 0; i < maxRows; i++) {
        if (i === 0) {
            const scope = keys.reduce((acc, k) => acc + "[" + k + "]");
            const before = jsonToTLAString(Array.isArray(values[0]) ? values[0][0] : values[0])
            rows.push(html`
                <tr>
                    <td>${scope}</td>
                    ${values.map((v, j) => {
                const current = jsonToTLAString(Array.isArray(v) ? v[i] : v)
                const isStateUnchanged = j > 0 && before === current
                return html`
                        <td style=${{ "wordBreak": "break-word", opacity: isStateUnchanged ? "50%" : "100%" }}>
                            ${current}
                        </td>`})}
                </tr>`);
        } else {
            // variable is nested (e.g. a set or sequence, represented as array)
            const before = jsonToTLAString(Array.isArray(values[0]) ? values[0][i] : values)
            rows.push(html`
                <tr>
                    <td></td>
                    ${values.map((v, j) => {
                const current = jsonToTLAString(Array.isArray(v) ? v[i] : v)
                const isStateUnchanged = j > 0 && before === current
                return html`
                        <td style=${{ wordBreak: "break-word", opacity: isStateUnchanged ? "50%" : "100%" }}>
                            ${current}
                        </td>`})}
                </tr>`);
        }
    }

    // add one empty row to the end. It has no vertical lines to
    // separate the table from the rest of the content
    rows.push(html`
        <tr>
            <td style=${{ border: "none" }}></td>
            ${values.map(v => html`
                <td style=${{ "border": "none" }}></td>`)}
        </tr>`)

    return rows;
};



const tableHeaderStyle = {
    textAlign: "left",
    // normal font weight
    fontWeight: "normal",
    wordBreak: "break-word",
    verticalAlign: "middle",
};

function SpecEditor({ currNode, setCurrNode, graph, setPrevEdges, setPreviewEdge, currentTask, setActionLog }) {
    const config = useContext(DiagramConfig);
    const constants = config.mcConfig.CONSTANTS;
    const source = config.source;
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
                    // this action is disabled
                    return h(Shard, { node, style: { opacity: "60%" } })
                }

                const allReadKeys = edges.flatMap(e => nestedKeys(e.reads));
                const allWriteKeys = edges.flatMap(e => nestedKeys(e.writes));
                const combinedKeys = [...allReadKeys, ...allWriteKeys]
                    .toSorted((a, b) => a.join("").localeCompare(b.join("")))
                    // remove duplicates
                    .filter((k, i, arr) => i === 0 || arr[i - 1].join("") !== k.join(""));

                const nextNodes = edges.map(e => graph.nodes.get(e.to));
                const nextNodesVars = nextNodes.map(n => n.vars);

                const backgroundColor = "rgb(0 235 0 / 4%)";

                return html`
                <div >
                    <div style=${{ backgroundColor, marginTop: "0px" }}>
                        <h4 style=${{ display: "inline-block", margin: "0", paddingBottom: "4px" }}>State at ${actionName}</h4>
                        <table>
                          <thead>
                            <tr>
                              <th style=${tableHeaderStyle}>Scope:</th>
                              <th style=${tableHeaderStyle}>Before:</th>
                              <th style=${{ ...tableHeaderStyle, colSpan: edges.length }}>After action:</th>
                            </tr>
                            <tr>
                                <th style=${tableHeaderStyle}></th>
                                <th style=${tableHeaderStyle}></th>
                                ${edges.map(edge => html`
                                <th>
                                    <${EdgePickers} ...${{ graph, currNode, setCurrNode, setPrevEdges, setPreviewEdge, setActionLog, representationKey: "spec-text", currentTask }} 
                                        filterFn=${e => e === edge} />
                                </th>`)}
                            </tr>
                          </thead>
                          <tbody>
                            ${combinedKeys.map(keySeq => exportToHTML(keySeq, currNode.vars, ...nextNodesVars))}
                          </tbody>
                        </table>
                    </div>
                    <${Shard} node=${node} style=${{ display: "block", backgroundColor }} />
                </div>`
            };
            // FIXME not sure why this has to be in a micro task, is there global state
            // in preact that disallows nesting render calls?
            queueMicrotask(() => r.render());
        }

        for (const r of editorRef.current.querySelectorAll(
            "sb-replacement[name=tla-constants-display]",
        )) {
            r.props.renderContent = ({ node }) => {
                if (node.type !== "identifier") return h(Shard, { node });
                const identifierBlock = node;
                const tlaValue = Array.isArray(constants)
                    ? `{${constants.map(jsonToTLAString).join(", ")}}`
                    : jsonToTLAString(constants);
                return html`
                <div style=${{ display: "inline-block" }}>
                    <${Shard} node=${identifierBlock} />
                    <span> = </span>
                    <span>${tlaValue}</span>
                </div>
                `
            };
            // FIXME not sure why this has to be in a micro task, is there global state
            // in preact that disallows nesting render calls?
            queueMicrotask(() => r.render());
        }
    }, [refresh, currNode, currentTask]);

    return editor({
        editorRef,
        sourceString: source,
        language: "tlaplus",
        readonly: true,
        style: { minWidth: "660px" },
        onready: () => setRefresh((r) => r + 1),
        extensions: [
            "tlaplus:base",
            "tlaplus:nextStateDisplay",
            "tlaplus:constantsDisplay",
            "tlaplus:cup",
            "tlaplus:bulletConj",
            "tlaplus:bulletDisj",
            "tlaplus:lor",
            "tlaplus:land",
            "tlaplus:always",
            "tlaplus:diamond",
            "tlaplus:implies",
            "tlaplus:setIn",
            "tlaplus:notin",
            "tlaplus:setsubseteq",
            "tlaplus:setsubset",
            "tlaplus:mapsTo",
            "tlaplus:allMapTo",
            "tlaplus:defEq",
            "tlaplus:exists",
            "tlaplus:forall",
            "tlaplus:tlain",
            "tlaplus:except",
            "tlaplus:unchanged"
        ],
    });
}

export const SpecTextRepresentation = ({ currNode, setCurrNode, graph, setPrevEdges, setPreviewEdge, setActionLog, currentTask }) => {

    const debounced = useDebounce((newEntry) =>
        setActionLog((log) => [...log, newEntry]), 3000)

    const handler = () => {
        const scrollEntry = [(new Date()).toISOString(), currentTask, "spec-text", "-"]
        debounced(scrollEntry)
    };

    return html`
    <h3 style=${{ display: "inline-block" }}>Specification Source Code</h3>
    <div onScroll=${handler}  style=${{
            padding: "0 16px 0 0",
            overflow: "scroll",
            flexDirection: "column",
            flex: "1 1 0px"
        }}>
        <${SpecEditor} currNode=${currNode} setCurrNode=${setCurrNode} graph=${graph} setPrevEdges=${setPrevEdges} setPreviewEdge=${setPreviewEdge} 
            setActionLog=${setActionLog} currentTask=${currentTask}
        />
    </div>
    `
}