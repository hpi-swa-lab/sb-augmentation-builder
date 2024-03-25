import { EdgePickers } from "./utils.js";
import { DiagramConfig } from "./state-explorer.js";
import { Component, createRef } from "../../external/preact.mjs";
import {
    useState,
    useContext,
} from "../../external/preact-hooks.mjs";
import htm from "../../external/htm.mjs";
import { h } from "../../view/widgets.js";
import { edgeToVizData } from "./actor-mapping.js";
const html = htm.bind(h);


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

const MessagesPositionsCompution = ({
    vizData,
    showMessagePayload,
    heightIncreaseFactor,
}) => {
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
        (m) =>
            html`<${LinePositioning}
        ...${m}
        key=${toKey(m)}
        heightIncreaseFactor=${heightIncreaseFactor}
      />`,
    );
};

const gridElementStyle = (column, row) => ({
    gridColumn: `${column}`,
    gridRow: `${row}`,
    textAlign: "center",
});


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
        const yOffsetMessageSend =
            (heightFrom - delayActionStartPx) * this.props.yRelativePositionFrom;
        const yOffsetMessageRcv =
            (heightFrom - delayActionStartPx) * this.props.yRelativePositionTo;

        const line = {
            xFrom: xStartFrom + widthFrom / 2,
            yFrom: yStartFrom + yOffsetMessageSend + delayActionStartPx,
            xTo: xStartTo + widthTo / 2,
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

    return html` <div style=${boxStyle}>
    <div style=${labelStyle}>${label}</div>
  </div>`;
};

const Actor = ({ row, col, label, setSelectedActor, isSelected }) => {
    const actorStyle = {
        ...gridElementStyle(col, row),
        fontWeight: 600,
        margin: "0 4px",
        visibility: label === "$messages" ? "hidden" : "visible",
    };

    return html`
    <div
      class="button"
      style=${actorStyle}
      onClick=${(e) => {
            if (label !== "$messages") setSelectedActor(label);
        }}
    >
      ${label}
    </div>
  `;
};

const SequenceDiagram = ({
    vizData,
    selectedActor,
    setSelectedActor,
    showMessagePayload,
    heightIncreaseFactor,
    previewEdge,
}) => {
    const { a2c, actors } = useContext(DiagramConfig);

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
            (a) =>
                html`<${Actor}
                label=${a}
                col=${a2c.get(a)}
                row=${1}
                isSelected=${a === selectedActor}
                setSelectedActor=${setSelectedActor}
              />`,
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
                html`<${Action}
                row=${i + 2}
                col=${a2c.get(d.actor)}
                ...${d}
                heightIncreaseFactor=${heightIncreaseFactor}
                isPreview=${previewEdge && i === vizData.length - 1}
              />`,
        )}
          <${MessagesPositionsCompution}
            vizData=${vizData}
            showMessagePayload=${showMessagePayload}
            heightIncreaseFactor=${heightIncreaseFactor}
          />
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
    setShowMessagePayload,
}) => {
    const { actors, varToActor } = useContext(DiagramConfig);

    const diagramContainerStyle = {
        padding: "16px 32px 16px 16px",
    };

    // TODO what about keys not mapping to actors

    const UndoButton = () => {
        return html` <button
      style=${{ height: "min-content" }}
      onClick=${() => {
                if (prevEdges.length > 0) {
                    setCurrNode(graph.nodes.get(prevEdges[prevEdges.length - 1].from));
                    setPrevEdges((prevEdges) => prevEdges.slice(0, prevEdges.length - 1));
                }
            }}
    >
      Undo
    </button>`;
    };

    const ToggleMsgLabelsButton = () => {
        return html` <button
      style=${{ height: "min-content" }}
      onClick=${() => setShowMessagePayload((v) => !v)}
    >
      Toggle Message Payload Visibility
    </button>`;
    };

    return html`
    <div style=${diagramContainerStyle}>
      <div
        style=${{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        }}
      >
        <h4>Choose Next Action</h4>
        <${ToggleMsgLabelsButton} />
        <${UndoButton} />
      </div>
      <div class="gridWrapper">
        ${actors.map(
            (actor, i) => html`
            <div
              style=${{
                    gridColumn: i + 1,
                    gridRow: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
              <${EdgePickers} ...${{ graph, currNode, setCurrNode, setPrevEdges, setPreviewEdge }} 
                filterFn=${e => edgeToVizData(e).actor === actor} />
            </div>
          `,
        )}
      </div>
    </div>
  `;
};

export const SequenceDiagramRepresentation = (props) => {
    return html`
    <h3 style=${{ display: "inline-block" }}>Sequence Diagram</h3>
    <${Topbar} ...${props} />
    <${SequenceDiagram} ...${props} />`
}