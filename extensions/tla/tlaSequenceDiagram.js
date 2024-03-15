import { h } from "../../view/widgets.js";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useContext,
} from "../../external/preact-hooks.mjs";
import htm from "../../external/htm.mjs";
import { Component, createContext, createRef } from "../../external/preact.mjs";
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: false });
const html = htm.bind(h);

/** actor to column map */
const DiagramConfig = createContext();

/** succesively applies the list of keys to obj. If the any intermediate result is a string, it is returned.
 * @example
 * apply({"a": {"b": "result"}}, ["a", "b"]) // "result"
 *
 * @example
 * apply({"a": {"b": "result"}}, ["a", "b", "c"]) // "result"
 *
 * @param {any} obj
 * @param {string[]} keys
 * @returns any
 */
function apply(obj, keys) {
    const reversedKeys = [...keys].reverse();
    let result = obj;
    while (reversedKeys.length > 0) {
        const k = reversedKeys.pop();
        if (Array.isArray(result)) {
            // this happens if the nested data structur is either a set or a sequence
            // if k is a number, we can access the element at that index
            // Note: In TLA+, arrays are 1-indexed
            result = result[k - 1];

            // we can also think of cases like {1, 2, 3}, where result would
            // also be modeled as an array and the key might be an int
            // TODO what do to then? -> currently we don't apply keys
            // on sets, so this shouldn't happen.
        } else {
            result = result[k];
        }

        if (result === undefined) {
            return undefined;
        }

        if (typeof result === "string") {
            return result;
        }
    }
    return result;
}

/** gives all possible nested key sequences of varTree
 *
 * @example
 * nestedKeys({msgs: true, rmState: {rm1: true}}) // [["msgs"] ["rmState", "rm1"]]
 *
 * @param {any} varTree
 * @returns {string[][]}
 */
function nestedKeys(varTree) {
    const keys = [];

    if (Array.isArray(varTree) || typeof varTree !== "object") {
        return [];
    }

    const dfs = (obj, accessors) => {
        if (Array.isArray(obj) || typeof obj !== "object") {
            keys.push([...accessors]);
            return;
        }

        for (const k of Object.keys(obj)) {
            accessors.push(k);
            dfs(obj[k], accessors);
            accessors.pop();
        }
    };

    dfs(varTree, []);

    return keys;
}

/** transforms a list of edges to visual variables for the diagram
 * @returns {{
 *  label: string,
 *  actor: string,
 *  msgs: string[]
 * }}
 */
function edgeToVizData({ reads, writes, label }) {
    const { actorSelectors, messagesSelector } = useContext(DiagramConfig);

    const actorsFreqs = [];
    for (const actor in actorSelectors) {
        // disambiguate between reads and writes
        const onlyReads = { reads };
        const readFreq = actorSelectors[actor].flatMap(
            (s) => jmespath.search(onlyReads, s) ?? [],
        ).length;
        const receivedAsyncMessages = jmespath.search(onlyReads, messagesSelector);

        const onlyWrites = { writes };
        const writeFreq = actorSelectors[actor].flatMap(
            (s) => jmespath.search(onlyWrites, s) ?? [],
        ).length;
        const sentAsyncMessages = jmespath.search(onlyWrites, messagesSelector);

        const sum = readFreq + writeFreq;
        actorsFreqs.push({
            actor,
            readFreq,
            writeFreq,
            sum,
            receivedAsyncMessages,
            sentAsyncMessages,
        });
    }

    // TODO what should we do with unmapped vars?
    // TODO what if only unmapped vars? or one action not mapped?

    // this is the actor where the lifeline is activated
    const activated = actorsFreqs.reduce((acc, el) =>
        el.sum > acc.sum ? el : acc,
    );
    const activatedActor = activated.actor;
    const actorFreqsWithoutActivated = actorsFreqs.filter(
        ({ actor }) => actor !== activatedActor,
    );

    const toSyncMsgs = (acc, { actor, readFreq, writeFreq }) => {
        // we interpret reads and writes as synchronous messages:
        if (readFreq > 0) {
            acc.push({ to: actor, type: "receive", label: `read` });
        }
        if (writeFreq > 0) {
            acc.push({ to: actor, type: "send", label: `write` });
        }
        return acc;
    };

    const getAsyncMsgsOf = ({ sentAsyncMessages, receivedAsyncMessages }) => {
        // we interpret messages over sets as asynchronous messages:
        const asyncMsgs = [];
        if (sentAsyncMessages.length > 0) {
            for (const msg of sentAsyncMessages) {
                asyncMsgs.push({
                    from: activatedActor,
                    type: "async-send",
                    label: "",
                    key: JSON.stringify(msg),
                });
            }
        }
        if (receivedAsyncMessages.length > 0) {
            for (const msg of receivedAsyncMessages) {
                asyncMsgs.push({
                    to: activatedActor,
                    type: "async-receive",
                    label: "",
                    key: JSON.stringify(msg),
                });
            }
        }
        return asyncMsgs;
    };

    // correct the line below to set inital propery
    const msgs = [
        ...actorFreqsWithoutActivated.reduce(toSyncMsgs, []),
        ...getAsyncMsgsOf(activated),
    ];

    return { label, actor: activatedActor, msgs };
}

const Lifeline = ({ numRows, column, label }) => {
    const lifelineStyle = {
        gridColumn: column,
        gridRow: `2 / span ${numRows}`,
        width: "50%",
        height: "100%",
        borderRight: "1px solid grey",
        visibility: label === "$messages" ? "hidden" : "visible",
    };

    return html`<div style=${lifelineStyle}></div>`;
};

const gridElementStyle = (column, row) => ({
    gridColumn: `${column}`,
    gridRow: `${row}`,
    textAlign: "center",
});

const Actor = ({ row, col, label, setSelectedActor, isSelected }) => {
    const actorStyle = {
        ...gridElementStyle(col, row),
        fontWeight: 600,
        margin: "0 4px",
        visibility: label === "$messages" ? "hidden" : "visible",
    };

    return html`
    <div class="button" style=${actorStyle} onClick=${(e) => {
            if (label !== "$messages") setSelectedActor(label)
        }}>
        ${label}
    </div> `;
};

const delayActionStartPx = 8;
const actionLineWidth = 3;
/** an action is the point where the diagram's lifeline is activated */
const Action = ({ row, col, label, heightIncreaseFactor, isPreview }) => {
    const boxStyle = {
        ...gridElementStyle(col, row),
        width: `${actionLineWidth}%`,
        height: `calc(2.5em * ${heightIncreaseFactor})`,
        border: "1px solid black",
        backgroundColor: "white",
        marginLeft: "calc(50% - 1.5%)",
        marginTop: `${delayActionStartPx}px`,
        opacity: isPreview ? 0.5 : 1,
    };

    const labelStyle = {
        position: "absolute",
        transform: "translateY(50%)",
        whiteSpace: "nowrap",
        marginLeft: "8px",
        fontWeight: "bold",
    };

    return html`
    <div style=${boxStyle}>
        <div style=${labelStyle}>${label}</div>
    </div>`;
};

class LinePositioning extends Component {
    refFrom = createRef();
    refTo = createRef();

    constructor(props) {
        super(props);
        this.state = { line: null };
    }

    calcLineData() {
        if (!this.refFrom.current || !this.refTo.current) {
            console.error("ref not set");
            return;
        }

        const yStartFrom = this.refFrom.current.offsetTop;
        const xStartFrom = this.refFrom.current.offsetLeft;
        const yStartTo = this.refTo.current.offsetTop;
        const xStartTo = this.refTo.current.offsetLeft;

        const { width: widthFrom, height: heightFrom } =
            this.refFrom.current.getBoundingClientRect();

        const { width: widthTo, height: heightTo } =
            this.refFrom.current.getBoundingClientRect();

        // in action we have a top margin such that there's some gap between
        // successive actions, which we need to subtract because its included in heightFrom and heightTo
        const yOffsetMessageSend = (heightFrom - delayActionStartPx) * this.props.yRelativePositionFrom;
        const yOffsetMessageRcv = (heightFrom - delayActionStartPx) * this.props.yRelativePositionTo;

        const line = {
            xFrom: xStartFrom + (widthFrom / 2),
            yFrom: yStartFrom + yOffsetMessageSend + delayActionStartPx,
            xTo: xStartTo + (widthTo / 2),
            yTo: yStartTo + yOffsetMessageRcv + delayActionStartPx,
            label: this.props.label,
            type: this.props.type,
        };
        return line;
    }

    componentDidMount() {
        const line = this.calcLineData();
        this.setState({ line });
    }

    componentDidUpdate(prevProps) {
        if (this.props.key !== prevProps.key) {
            const line = this.calcLineData();
            this.setState({ line });
        }
    }

    /** yRelativePosition is the percentage [0,1] where the message starts and ends */
    render({
        fromCol,
        toCol,
        fromRow,
        toRow,
        label,
        yRelativePosition,
        setLines,
        key,
    }) {
        return html`
      <div
        ref=${this.refFrom}
        style=${gridElementStyle(fromCol, fromRow)}
      ></div>
      <div ref=${this.refTo} style=${gridElementStyle(toCol, toRow)}></div>
      ${this.state?.line ? html`<${SVGArrow} ...${this.state.line} />` : ""}
    `;
    }
}

const SVGArrow = ({ xFrom, yFrom, xTo, yTo, label, type }) => {
    const svgStyle = {
        position: "absolute",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    };

    const lineStyle = {
        stroke: "black",
        strokeWidth: 1.5,
        markerEnd: "url(#arrow)",
    };

    const textStyle = {
        textAnchor: "middle",
        stroke: "white",
        strokeWidth: 4,
        paintOrder: "stroke",
    };

    return html` <svg style=${svgStyle}>
    <defs>
      <!-- arrowhead, src: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/marker -->
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    <!-- add line and text in the middle of it -->
    <g>
      <text
        style=${textStyle}
        x=${xFrom + (xTo - xFrom) / 2}
        y=${yFrom + (yTo - yFrom) / 2 - 8}
      >
        ${label}
      </text>
      <line style=${lineStyle} x1=${xFrom} y1=${yFrom} x2=${xTo} y2=${yTo} />
    </g>
  </svg>`;
};

const ActionInspector = ({ actionVizData, startRow, close }) => {
    const { actors } = useContext(DiagramConfig);

    const gridElementStyle = {
        gridColumn: `1 / span ${actors.length}`,
        gridRow: `${startRow} / 40`, // doesn't actually span 40 rows, instead goes to the end of the grid
        zIndex: 3,
        display: "flex",
        pointerEvents: "none",
    };

    const [opacity, setOpacity] = useState(0);

    const containerStyle = {
        backgroundColor: "rgb(249 249 249)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        width: "100%",
        padding: "16px",
        height: "min-content",
        transition: "opacity 0.2s ease-out",
        opacity: opacity,
        pointerEvents: "auto",
        boxShadow:
            "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px",
    };

    useEffect(() => {
        setOpacity(1);
        return () => setOpacity(0);
    }, []);

    const delayedClose = () => {
        setOpacity(0);
        setTimeout(close, 100);
    };

    return html`
    <div style=${gridElementStyle}>
      <div style=${containerStyle}>
        <style>
          .close {
            transition: background-color 0.1s ease-in-out;
            background-color: rgba(212, 212, 212, 0);
            height: min-content;
            width: min-content;
            padding: 0 0.3em;
            border-radius: 50%;
            cursor: pointer;
          }

          .close:hover {
            background-color: rgba(212, 212, 212, 1);
          }
        </style>
        <div
          style=${{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: "row",
            alignItems: "flex-start",
            padding: "0 0 8px 0",
        }}
        >
          <h4 style=${{ margin: "0" }}>${actionVizData.label}</h4>
          <div class="close" onClick=${delayedClose}>${"\u{2715}"}</div>
        </div>
        <button>Reset to this action</button>
      </div>
    </div>
  `;
};

const MessagesPositionsCompution = ({ vizData, showMessagePayload, heightIncreaseFactor }) => {
    const { a2c } = useContext(DiagramConfig);

    // depending on if messages are read or write messages,
    // they are placed on top (reads) or bottom (writes) of the lifeline
    const computeMessagePositions = ({ actor, msgs }, i) => {
        const row = i + 2;

        const syncRcvMsgs = msgs.filter((m) => m.type === "receive");
        const sycnRcvMsgPositions = syncRcvMsgs.map((m, j) => {
            const fromCol = a2c.get(m.to);
            const toCol = a2c.get(actor);
            // reads start at the beginning up to the middle
            const yRelativePosition = j / syncRcvMsgs.length / 2;
            return {
                fromCol,
                toCol,
                fromRow: row,
                toRow: row,
                label: m.label,
                yRelativePositionFrom: yRelativePosition,
                yRelativePositionTo: yRelativePosition,
                type: m.type,
            };
        });

        const syncSentMsgs = msgs.filter((m) => m.type === "send");
        const syncSentMsgPositions = syncSentMsgs.map((m, j) => {
            const fromCol = a2c.get(actor);
            const toCol = a2c.get(m.to);
            // writes start at the end up to the middle
            const yRelativePosition = 1.0 - j / syncSentMsgs.length / 2;
            return {
                fromCol,
                toCol,
                fromRow: row,
                toRow: row,
                label: m.label,
                yRelativePositionFrom: yRelativePosition,
                yRelativePositionTo: yRelativePosition,
                type: m.type,
            };
        });

        const msgsWithoutSelfReferences = [
            ...sycnRcvMsgPositions,
            ...syncSentMsgPositions,
        ].filter((m) => m.fromCol !== m.toCol);

        return msgsWithoutSelfReferences;
    };
    const syncMsgs = vizData.flatMap(computeMessagePositions);

    const asyncMsgs = [];
    for (let i = 0; i < vizData.length; i++) {
        const fromRow = i + 2;
        const future = vizData.slice(i + 1, vizData.length);
        const sentMsgs = vizData[i].msgs.filter((m) => m.type === "async-send");
        for (const msg of sentMsgs) {
            // for each sent message we gather all received msgs
            const receivedMsgs = [];
            future.forEach((d, j) => {
                const rcvMsgs = d.msgs.filter((m) => m.type === "async-receive");
                for (const m of rcvMsgs) {
                    if (m.key === msg.key) {
                        receivedMsgs.push({ ...m, toRow: i + 1 + j + 2 });
                    }
                }
            });

            // each sentMsg->receivedMsg pair is a line
            for (const rcvMsg of receivedMsgs) {
                const fromCol = a2c.get(vizData[i].actor);
                const toCol = a2c.get(rcvMsg.to);
                const yRelativePosition = 0.5;
                asyncMsgs.push({
                    fromCol,
                    toCol,
                    fromRow,
                    toRow: rcvMsg.toRow,
                    label: showMessagePayload ? rcvMsg.key : "",
                    yRelativePositionFrom: 1.0, // start at bottom of sender
                    yRelativePositionTo: 0,
                    type: "async-success",
                });
            }
            if (receivedMsgs.length === 0) {
                // if no received message, we still want to draw a line into the reserved space for messages
                const fromCol = a2c.get(vizData[i].actor);
                const toCol = a2c.get("$messages");
                asyncMsgs.push({
                    fromCol,
                    toCol,
                    fromRow,
                    toRow: fromRow,
                    label: showMessagePayload ? msg.key : "",
                    yRelativePositionFrom: 1.0,
                    yRelativePositionTo: 1.0,
                    type: "async-pending",
                });
            }
        }
    }

    const toKey = (m) =>
        `${m.fromCol}-${m.toCol}-${m.fromRow}-${m.toRow}-${m.label}-${m.yRelativePositionFrom}-${m.yRelativePositionTo}-${heightIncreaseFactor}`;

    return [...syncMsgs, ...asyncMsgs].map(
        (m) => html`<${LinePositioning} ...${m} key=${toKey(m)} heightIncreaseFactor=${heightIncreaseFactor} />`,
    );
};

const EdgePickerButton = (props) => {
    useEffect(() => {
        // onMouseLeave is not called if the button gets removed while the mouse is still on it
        // so we need to manually call it
        return () => {
            if (props.onMouseLeave) props.onMouseLeave();
        };
    }, []);

    return html` <button class="button" ...${props} />`;
};

const Diagram = ({
    vizData,
    selectedActor,
    setSelectedActor,
    showMessagePayload,
    heightIncreaseFactor,
    previewEdge
}) => {
    const { a2c, actors } = useContext(DiagramConfig);
    const [inspectEdge, setInspectEdge] = useState(null);

    return html`
    <div style=${{ display: "flex", flexDirection: "column", flex: "1 0 0" }}>
      <div
        style=${{
            padding: "16px 32px 16px 16px",
            display: "flex",
            flex: "1 0 0",
            overflowY: "scroll",
        }}
      >
        <div class="gridWrapper" style=${{ width: "100%" }}>
          ${actors.map(
            (a) => html`<${Actor} label=${a} col=${a2c.get(a)} row=${1} isSelected=${a === selectedActor} setSelectedActor=${setSelectedActor} />`,
        )}
          ${actors.map(
            (a) =>
                html`<${Lifeline}
                label=${a}
                numRows=${vizData.length + 1}
                column=${a2c.get(a)}
              />`,
        )}
          ${vizData.map(
            (d, i) =>
                html`<${Action} row=${i + 2} col=${a2c.get(d.actor)} ...${d} heightIncreaseFactor=${heightIncreaseFactor} isPreview=${previewEdge && i === vizData.length - 1} />`,
        )}
          <${MessagesPositionsCompution} vizData=${vizData} showMessagePayload=${showMessagePayload} heightIncreaseFactor=${heightIncreaseFactor} />
          <!-- last row with fixed height to still show some of the lifeline -->
          ${actors.map(
            (_, i) =>
                html`<div
                style=${{
                        ...gridElementStyle(i + 1, vizData.length + 2),
                        height: "32px",
                    }}
              ></div>`,
        )}
          ${inspectEdge !== null
            ? html`<${ActionInspector}
                actionVizData=${vizData[inspectEdge]}
                startRow=${inspectEdge + 3}
                close=${() => setInspectEdge(null)}
              />`
            : ""}
        </div>
      </div>
    </div>
  `;
};

const Topbar = ({
    graph,
    prevEdges,
    currNode,
    setPreviewEdge,
    setCurrNode,
    setPrevEdges,
    vizData,
    setShowMessagePayload
}) => {
    const { actors, varToActor } = useContext(DiagramConfig);

    const tableHeaderStyle = {
        textAlign: "left",
        fontWeight: "normal",
    };

    const diagramContainerStyle = {
        padding: "16px 32px 16px 16px",
    };

    const nextEdges = graph.outgoingEdges.get(currNode.id);

    const selectNodeFn = (e) => {
        return () => {
            setCurrNode(graph.nodes.get(e.to));
            setPrevEdges([...prevEdges, e]);
        };
    };

    const nextActionsPerActorIndex = actors.map((a) =>
        nextEdges.filter(e => edgeToVizData(e).actor === a),
    );

    const keysMappingToActors = nestedKeys(varToActor);
    // TODO what about keys not mapping to actors
    const keysPerActorIndex = actors.map((a) => {
        const keysOfThisActor = keysMappingToActors.filter(
            (keys) => apply(varToActor, keys) === a,
        );
        return keysOfThisActor;
    });

    const exportToHTML = (keys) => {
        const value = apply(currNode.vars, keys);

        const scope = keys.reduce((acc, k) => acc + "[" + k + "]");

        if (Array.isArray(value) && value.length > 0) {
            return value.map(
                (v, i) => html`
          <tr>
            ${i === 0
                        ? html`<td style=${{ rowspan: value.length }}>${scope}</td>`
                        : html`<td></td>`}
            <td>${JSON.stringify(v)}</td>
          </tr>
        `,
            );
        }

        return html` <tr>
      <td>${scope}</td>
      <td>${JSON.stringify(value)}</td>
    </tr>`;
    };

    const UndoButton = () => {
        return html`
        <button
            style=${{ height: "min-content" }}
            onClick=${() => {
                if (prevEdges.length > 0) {
                    setCurrNode(graph.nodes.get(prevEdges[prevEdges.length - 1].from));
                    setPrevEdges(prevEdges => prevEdges.slice(0, prevEdges.length - 1));
                }
            }}
        >
            Undo
        </button>`;
    }

    const ToggleMsgLabelsButton = () => {
        return html`
        <button
            style=${{ height: "min-content" }}
            onClick=${() => setShowMessagePayload((v) => !v)}
        >
            Toggle Message Payload Visibility
        </button>`;
    }

    return html`
    <div style=${diagramContainerStyle}>
      <!-- <div class="gridWrapper" style=${{ gridGap: "16px" }}>
        ${actors.map(
        (a, i) =>
            html` <div
              style=${{
                    display: "flex",
                    flexDirection: "column",
                    gridColumn: i + 1,
                    gridRow: 1,
                }}
            >
              <h4>${a}</h4>
              <table>
                <thead>
                  <tr>
                    <th style=${tableHeaderStyle}>Scope</th>
                    <th style=${tableHeaderStyle}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${keysPerActorIndex[i].map(exportToHTML)}
                </tbody>
              </table>
            </div>`,
    )}
      </div> -->
      <div style=${{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <h4>Choose Next Action</h4>
        <${ToggleMsgLabelsButton} />
        <${UndoButton} />
      </div>
      <div class="gridWrapper">
        ${nextActionsPerActorIndex.map(
        (actions, i) => html`
            <div
              style=${{
                gridColumn: i + 1,
                gridRow: 1,
                display: "flex",
                flexDirection: "column",
            }}
            >
              ${actions.map(
                (e) => html`
                        <${EdgePickerButton} 
                            onClick=${selectNodeFn(e)}
                            onMouseEnter=${() => setPreviewEdge(e)}
                            onMouseLeave=${() => setPreviewEdge(null)}
                            >
                            ${e.label + e.parameters}
                        </${EdgePickerButton}>`,
            )}
            </div>
          `,
    )}
      </div>
    </div>
  `;
};

const StateDiagram = ({ actor, currentState, previewedState }) => {
    const config = useContext(DiagramConfig);
    const { stateSpaceByActor } = config;
    const mermaidContainerRef = useRef(null);
    const actorState = nodeToStateDescription(config.stateSpaceSelectors[actor], currentState)
    const previewedActorState = previewedState ? nodeToStateDescription(config.stateSpaceSelectors[actor], previewedState) : "NONE"

    const getMermaidOutput = () => {
        if (actor === "$messages") return "";
        const transitions = stateSpaceByActor[actor];

        const fromStateDescriptions = Object.keys(transitions)
        const toStateDescriptions = Object.values(transitions).flatMap((toMap) => [...Object.keys(toMap)])
        const states = [...new Set([...fromStateDescriptions, ...toStateDescriptions])]
        const aliasByState = states.reduce((acc, state, i) => {
            acc[state] = i + 1
            return acc
        }, {})
        const stateDefsMermaid = states.map((state, i) => `  state "${state}" as ${aliasByState[state]}`).join("\n")

        const stylesClassesMermaid = states.map((state, i) => state === actorState
            ? `  class ${aliasByState[state]} selectedStateStyle`
            : state === previewedActorState
                ? `  class ${aliasByState[state]} previewStateStyle`
                : `  class ${aliasByState[state]} defaultStateStyle`).join("\n")

        const transitionsAsMermaid = Object.entries(transitions).map(([from, tosMap]) => {
            const tosAsMermaid = Object.entries(tosMap)
                .map(([k, labels]) => [...labels].map(l => `  ${aliasByState[from]} --> ${aliasByState[k]}: ${l}`).join("\n"))
                .join("\n")
            return tosAsMermaid
        }
        ).join("\n");
        const mermaidOutput = `stateDiagram-v2
    direction LR
    classDef defaultStateStyle fill:white,color:black,stroke-width:1px,stroke:black,font-size:1em
    classDef selectedStateStyle fill:grey,color:black,stroke-width:1px,stroke:black,font-size:1em
    classDef previewStateStyle fill:lightgrey,color:black,stroke-width:1px,stroke:black,font-size:1em
${stylesClassesMermaid}
${stateDefsMermaid}

${transitionsAsMermaid}`;
        return mermaidOutput
    }

    useEffect(() => {
        if (mermaidContainerRef.current) {
            // mermaid adds a "data-processed" attribute to the diagram after processing it
            mermaidContainerRef.current.removeAttribute("data-processed");
            // after processing, the innerHTML will be svg elements, so we
            // reset it
            mermaidContainerRef.current.innerHTML = getMermaidOutput()
        }
        mermaid.run({
            querySelector: ".mermaid",
        })
    }, [config, actor, currentState, previewedState])

    return html`
    <div style=${{ width: "100%" }}>
        <div class="mermaid" ref=${mermaidContainerRef}></div>    
    </div >`;
}


const State = ({ graph, initNodes }) => {
    const [currNode, setCurrNode] = useState(graph.nodes.get(initNodes[0].id));
    const [previewEdge, setPreviewEdge] = useState(null);
    const [prevEdges, setPrevEdges] = useState([]);
    const config = useContext(DiagramConfig);
    const [selectedActor, setSelectedActor] = useState(config.actors[0] === "$messages" ? config.actors[1] : config.actors[0]);
    const [showMessagePayload, setShowMessagePayload] = useState(false);
    const [heightIncreaseFactor, setHeightIncreaseFactor] = useState(1);

    const containerStyle = {
        display: "flex",
        flexDirection: "column",
        flex: "1 0 0",
        width: "100%",
    };

    const edges = previewEdge ? [...prevEdges, previewEdge] : prevEdges;
    const vizData = edges.map(edgeToVizData);

    const props = {
        graph,
        prevEdges,
        setPrevEdges,
        previewEdge,
        setPreviewEdge,
        currNode,
        setCurrNode,
        vizData,
        selectedActor,
        setSelectedActor,
        showMessagePayload,
        setShowMessagePayload,
        heightIncreaseFactor
    };

    const InitStateSelection = () => {
        const resetInitNode = (nodeId) => {
            setCurrNode(graph.nodes.get(nodeId));
            setPrevEdges([]);
        };

        return html`
        <div style=${{ padding: "4px 4px 4px 16px" }}>
            <label for="init">Choose initial state:</label>
            <select
                id="init"
                value=${currNode.id}
                onChange=${(e) => resetInitNode(e.target.value)}
            >
                ${initNodes.map((n) => html`<option value=${n.id}>${n.id}</option>`)}
            </select>
        </div>`
    };

    const ActorSelector = () => {
        return html`
        <div style=${{ padding: "4px 4px 4px 16px" }}>
            <label for="actor">Choose actor:</label>
            <select
                id="actor"
                value=${selectedActor}
                onChange=${(e) => setSelectedActor(e.target.value)}
            >
                ${config.actors.filter(a => a !== "$messages").map((a) => html`<option value=${a}>${a}</option>`)}
            </select>
        </div>`
    }

    const ActionHeightSlider = () => {
        return html`
        <div style=${{ padding: "4px 4px 4px 16px" }}>
            <label for="height">Choose action height:</label>
            <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value=${heightIncreaseFactor}
                onChange=${(e) => setHeightIncreaseFactor(e.target.value)}
            />
        </div>`
    }

    // a grid layout where the right column shows the StateMachines component
    // and the remaining space shows the rest
    return html`
    <div style=${containerStyle}>
        <div style=${{ display: "grid", gridTemplateColumns: "50% 50%", height: "100%" }}>
            <div style=${containerStyle}>
                <${InitStateSelection} />
                <${ActionHeightSlider} />
                <${Topbar} ...${props} />
                <${Diagram} ...${props} />
            </div >
            <div style=${{ display: "flex", flexDirection: "column", flex: "1 0 0", padding: "0 16px 0 0" }}>
                <h4>${selectedActor}</h4>
                <${ActorSelector} />
                <${StateDiagram} actor=${selectedActor} currentState=${currNode} previewedState=${graph.nodes.get(previewEdge?.to)}/>
            </div>
        </div>
    </div>
  `;
};

const nodeToStateDescription = (selectors, node) => {
    const description = selectors.flatMap(([query, annotation, fallback]) => {
        const results = jmespath.search(node, query)
        if (!results) return [] // this will be removed in the subsequent flattening
        if (results.length === 0) return fallback ?? []
        return annotation.replace(/@/g, JSON.stringify(results[0]).replace(/\"/g, ""))
    }).flat().join("\n");
    return description
}

const GraphProvider = ({ spec }) => {
    // only do computation-heavy operations on whole graph once
    const nodesList = spec.graph.filter(
        (n) => n.$type === "node" || n.$type === "init-node",
    );
    const nodes = nodesList.reduce((acc, n) => acc.set(n.id, n), new Map());
    const edges = spec.graph.filter((e) => e.$type === "edge");
    const initNodes = nodesList.filter((n) => n.$type === "init-node");

    const computeOutgoingEdges = () => {
        const m = new Map();
        for (const n of nodesList) {
            m.set(n.id, []);
        }

        for (const e of edges) {
            const outgoingFrom = m.get(e.from);
            // TODO here we discard any edges that have the same transition
            // this would be cases where the another action has the same result for this state, i.e. stuttering steps
            outgoingFrom.push(e);
        }

        return m;
    };
    const outgoingEdges = computeOutgoingEdges();

    const computeStateSpaceOf = (actor) => {
        const stateTransitionsByBeforeState = {}
        for (const e of edges) {
            const varStateSpaceBefore = nodeToStateDescription(spec.transformation.stateSpaceSelectors[actor], nodes.get(e.from))
            const varStateSpaceAfter = nodeToStateDescription(spec.transformation.stateSpaceSelectors[actor], nodes.get(e.to))
            const beforeJson = varStateSpaceBefore
            const afterJson = varStateSpaceAfter

            if (beforeJson === afterJson) {
                // TODO
                // this could either be a stuttering step of this actor or a step of another actor
                // we currently discard these cases, even though we would like the stuttering
                // step of this actors
                continue
            }

            if (stateTransitionsByBeforeState[beforeJson] === undefined) {
                const labelsByToTransition = {}
                labelsByToTransition[afterJson] = new Set([e.label + e.parameters])
                stateTransitionsByBeforeState[beforeJson] = labelsByToTransition
            } else if (!stateTransitionsByBeforeState[beforeJson][afterJson]) {
                stateTransitionsByBeforeState[beforeJson][afterJson] = new Set([e.label + e.parameters]);
            } else {
                // we have multiple transitions from the same from state to the same to state
                stateTransitionsByBeforeState[beforeJson][afterJson].add(e.label + e.parameters)
            }
        }
        return stateTransitionsByBeforeState
    }
    const stateSpaceByActor = spec.transformation.actors.reduce((acc, actor) => {
        if (!spec.transformation.actorSelectors[actor]) return acc;
        acc[actor] = computeStateSpaceOf(actor)
        return acc
    }, {})

    const graph = { nodes, edges, outgoingEdges, nodesList };

    const config = {
        actors: spec.transformation.actors,
        actorSelectors: spec.transformation.actorSelectors,
        messagesSelector: spec.transformation.messagesSelector ?? "",
        a2c: spec.transformation.actors.reduce(
            (acc, a, i) => acc.set(a, i + 1),
            new Map(),
        ),
        stateSpaceByActor,
        stateSpaceSelectors: spec.transformation.stateSpaceSelectors
    };

    return [
        html`
      <style>
        .gridWrapper {
          position: relative;
          display: grid;
          grid-template-columns: ${`repeat(${config.actors.length}, 1fr)`};
          height: min-content;
        }
      </style>
    `,
        html`
    <${DiagramConfig.Provider} value=${config}>
        <${State} graph=${graph} initNodes=${initNodes}/>
    </${DiagramConfig.Provider}>`,
    ];
};

export const SpecPicker = () => {
    const [spec, setSpec] = useState();

    const loadSpec = (e) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = JSON.parse(e.target.result);
            setSpec(result);
        };
        reader.readAsText(e.target.files[0]);
    };

    return html`
    <div style=${{ display: "flex" }}>
      <label for="spec">Load spec</label>
      <!-- we reset the spec state onClick to prevent inconsistent state while loading the new (potentially large) spec -->
      <input
        type="file"
        id="spec"
        accept=".json"
        onClick=${() => setSpec(undefined)}
        onChange=${loadSpec}
      />
    </div>
    ${spec ? html`<${GraphProvider} spec=${spec} />` : ""}
  `;
};

export const SequenceDiagram = () => {
    return [
        html`
      <style>
        .button {
          background: white;
          border: 1px solid black;
          box-sizing: border-box;
          padding: 8px;
          margin: 0 4px 4px 4px;
          text-align: center;
          cursor: pointer;
          touch-action: manipulation;
          word-break: break-all;
        }

        .button:hover {
          background-color: rgb(240, 240, 241);
        }
      </style>
    `,
        html`<${SpecPicker} />`,
    ];
};
