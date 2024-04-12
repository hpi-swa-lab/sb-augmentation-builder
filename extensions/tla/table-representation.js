import { useContext } from "../../external/preact-hooks.mjs";
import { DiagramConfig, TaskContext } from "./state-explorer.js";
import { EdgePickers, apply, jsonToTLAString, nestedKeys, useDebounce } from "./utils.js";
import htm from "../../external/htm.mjs";
import { h } from "../../external/preact.mjs";
const html = htm.bind(h);

const TableHeader = ({ columnsKeys }) => {
    const maxRows = Math.max(...columnsKeys.map(col => col.length))
    const tableHeaders = []
    for (let row_i = 0; row_i < maxRows; row_i++) {
        const aggregatedRow = []
        let col_i = 0
        while (col_i < columnsKeys.length) {
            // we are iterating over the columns and select the same row per columns.
            const col = columnsKeys[col_i]

            // if the row is the last row, we span until max rows, such that all headers
            // columns are equally sized
            if (row_i === col.length - 1) {
                aggregatedRow.push(html`<th rowSpan=${maxRows - row_i}>${col[row_i]}</th>`)
                col_i++
                continue
            } else if (row_i > col.length - 1) {
                col_i++
                continue
            }

            // if multiple neighborign columns have the same key,
            // we want to show just one, so we look ahead and count
            // how many columns to span 
            let colSpan = 1
            while (col_i + colSpan < columnsKeys.length
                && columnsKeys[col_i + colSpan][row_i] === col[row_i]) {
                colSpan++
            }

            aggregatedRow.push(html`
                <th colspan=${colSpan}>${col[row_i]}</th>
            `)
            col_i += colSpan
        }

        if (row_i === 0) {
            const actionNameHeader = html`
                <th rowSpan=${maxRows}>Action taken</th>
            `
            aggregatedRow.push(actionNameHeader)
        }

        tableHeaders.push(html`
            <tr>
                ${aggregatedRow}
            </tr>
        `)
    }
    return tableHeaders
}

export const TableRepresentation = (props) => {
    const { currNode, graph, prevEdges, previewEdge, setActionLog } = props;
    const currentTask = useContext(TaskContext);

    const debounced = useDebounce((newEntry) =>
        setActionLog((log) => [...log, newEntry]), 3000)

    const handler = () => {
        const scrollEntry = [(new Date()).toISOString(), currentTask, "table", "-"]
        debounced(scrollEntry)
    };

    /** @type {string[][]} */
    const columnsKeys = nestedKeys(currNode.vars).toSorted((a, b) => a.join("").localeCompare(b.join("")))

    const nodeHistory = [
        ...prevEdges.map(({ from, label, parameters }) => ({ node: graph.nodes.get(from), label: label + parameters })),
        { node: currNode, label: previewEdge?.label + previewEdge?.parameters },
        {
            node: previewEdge ? graph.nodes.get(previewEdge.to) : undefined,
            label: ""
        }
    ].filter(({ node }) => node)

    /** @type {object[][]} */
    const values = nodeHistory.map(({ node }, i) => {
        const vals = columnsKeys.map(keys => {
            const value = apply(node.vars, keys)
            if (Array.isArray(value)) {
                const tlaValues = value.map(v => jsonToTLAString(v)).join(",\n")
                return `{ ${tlaValues} }`
            } else {
                return jsonToTLAString(value)
            }
        })
        if (i > 0) {
            vals.push(nodeHistory[i - 1].label)
        }
        return vals
    })

    return html`
    <style>
        #table-representation th {
            border: 1px solid #ccc;
        }
        #table-representation td {
            word-break: break-word;
            white-space: pre-line;
        }
    </style>
    <h3 style=${{ display: "block" }}>Table Values</h3>
    <div style=${{ display: "inline-block" }}>
        <${EdgePickers} representationKey="table" ...${props} filterFn=${_ => true} />
    </div>
    <div onScroll=${handler} id="table-representation" style=${{ padding: "0.5em", flex: "1 1 0px", overflow: "scroll" }}>
        <table style=${{ width: "100%" }}>
            <${TableHeader}  columnsKeys=${columnsKeys}/>
            ${values.map((rowValues, r_i) => html`
                <tr>
                    ${rowValues.map((colVal, c_i) => {
        const isValueUnchanged = r_i === values.length - 1 // last row
            && r_i > 0 // not the first row
            && previewEdge // there is a preview edge
            && values[r_i - 1][c_i] === colVal // the value is the same as in the previous row 

        return html`
                    <td style=${{ opacity: isValueUnchanged ? "20%" : "100%" }}>
                        ${colVal}
                    </td>`})}
                </tr>`)
        }
        </table>
    </div>
    `
}