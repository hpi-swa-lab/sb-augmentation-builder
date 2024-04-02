import { editor, h, shard, useLocalState } from "../../view/widgets.js";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    useContext,
} from "../../external/preact-hooks.mjs";
import { Component, createContext, createRef } from "../../external/preact.mjs";
import { SequenceDiagramRepresentation } from "./sequence-diagram-representation.js";
import { EdgePickers } from "./utils.js";
import { edgeToVizData } from "./actor-mapping.js";
import htm from "../../external/htm.mjs";
import { StateDiagramRepresentation, nodeToStateDescription } from "./state-diagram-representation.js";
import { SpecTextRepresentation } from "./spec-text-representation.js";
import { TableRepresentation } from "./table-representation.js";
const html = htm.bind(h);

/** actor to column map */
export const DiagramConfig = createContext();


const RepresentationsLayout = (props) => {
    const config = useContext(DiagramConfig);
    const {
        graph,
        previewEdge,
        currNode, setCurrNode,
        selectedActor, setSelectedActor,
        heightIncreaseFactor, setHeightIncreaseFactor,
        representations,
        setPrevEdges,
        setPreviewEdge
    } = props;

    const nextEdges = graph.outgoingEdges.get(currNode.id);

    const containerStyle = {
        display: "flex",
        flexDirection: "column",
        flex: "1 0 0",
        width: "100%",
    };

    return html`
    <div
        style=${{
            display: "grid",
            gridTemplateColumns: representations.length > 0
                ? representations.map(r => 1 / representations.length * 100 + "%").join(" ")
                : "1fr",
            height: "100%",
        }}
      >
        <!-- sequence diagram -->
        ${representations.includes("sequence")
            ? html`
                <div style=${{ ...containerStyle, display: "flex", flexDirection: "column" }}>
                    <${SequenceDiagramRepresentation} ...${props} />
                </div>`
            : ""}
        <!-- state diagram. We remove it from the tree because otherwise mermaid side effects cause havoc -->
        ${representations.includes("state")
            ? html`
            <div style=${{ padding: "0 16px 0 0", overflow: "scroll", height: "100%" }}>
                <${StateDiagramRepresentation} ...${props} />
            </div>`
            : ""
        }
        <!-- table -->
        <div style=${{ display: representations.includes("table") ? "flex" : "none", flexDirection: "column" }}>
            <${TableRepresentation} ...${props} />
        </div>
        <!-- text -->
        <div style=${{ display: representations.includes("text") ? "flex" : "none", flexDirection: "column" }}>
            <${SpecTextRepresentation} ...${props} />
        </div>
    </div>
    `
}

const RepresentationsPicker = ({ representations, setRepresentations,
    actionLog, setActionLog,
    currentTask, setCurrentTask }) => {
    const onChange = (/** @type {string} */ value) =>
        setRepresentations((representations) => {
            const newRepresentations = representations.includes(value)
                ? representations.filter((r) => r !== value)
                : [...representations, value]

            setActionLog(actionLog => [...actionLog, [(new Date()).toISOString(), currentTask, "representationsToggle", newRepresentations]])
            return newRepresentations
        })

    return html`
    <div>
        <style>
          .checkbox-btn {
            margin-right: 8px;
          }
        </style>
        <div style=${{ display: "flex", flexDirection: "row" }}>
            <h2>Representations</h2>
            <!-- save log to clipboard button -->
            <button
                style=${{ height: "min-content", margin: "2px", padding: "2px" }}
                onClick=${() => navigator.clipboard.writeText(JSON.stringify(actionLog))}
            >
                Copy Action Log to Clipboard
            </button>
            <!-- radio buttons to select current task -->
            <div style=${{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
                <input type="radio" id="task1" name="task" value="1" checked=${currentTask === "1"} onChange=${() => setCurrentTask("1")} />
                <label for="task1">Task 1</label>
                <input type="radio" id="task2" name="task" value="2" checked=${currentTask === "2"} onChange=${() => setCurrentTask("2")} />
                <label for="task2">Task 2</label>
                <input type="radio" id="task3" name="task" value="3" checked=${currentTask === "3"} onChange=${() => setCurrentTask("3")} />
                <label for="task3">Task 3</label>
                <input type="radio" id="task4" name="task" value="4" checked=${currentTask === "4"} onChange=${() => setCurrentTask("4")} />
                <label for="task4">Task 4</label>
                <input type="radio" id="task5" name="task" value="5" checked=${currentTask === "5"} onChange=${() => setCurrentTask("5")} />
                <label for="task5">Task 5</label>
            </div>
        </div>
        <div style=${{ display: "flex", flexDirection: "row" }}>
          <div class="checkbox-btn">
            <input
              type="checkbox"
              name="sequence diagram"
              value="sequence"
              checked=${representations.includes("sequence")}
              onChange=${e => onChange(e.target.value)}
            />
            <label for="sequence diagram" onClick=${() => onChange("sequence")}>Sequence Diagram</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="state machine" value="state" 
                checked=${representations.includes("state")} 
                onChange=${e => onChange(e.target.value)}
            />
            <label for="state machine" onClick=${() => onChange("state")}>State Diagram</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="table" value="table" onChange=${e => onChange(e.target.value)}
                checked=${representations.includes("table")}
            />
            <label for="table" onClick=${() => onChange("table")}>Table</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="text" value="text" onChange=${e => onChange(e.target.value)}
                checked=${representations.includes("text")}
            />
            <label for="text" onClick=${() => onChange("text")}>Text</label>
          </div>
        </div>
    </div>`
}

export const TaskContext = createContext();

const State = ({ graph, initNodes }) => {
    const config = useContext(DiagramConfig);
    const [currNode, setCurrNode] = useState(graph.nodes.get(initNodes[0].id));
    const [previewEdge, setPreviewEdge] = useState(null);
    const [prevEdges, setPrevEdges] = useState([]);
    const [selectedActor, setSelectedActor] = useState(
        config.actors[0] === "$messages" ? config.actors[1] : config.actors[0],
    );
    const [showMessagePayload, setShowMessagePayload] = useState(false);
    const [heightIncreaseFactor, setHeightIncreaseFactor] = useState(1);
    const [representations, setRepresentations] = useState(["sequence", "state", "table", "text"]);
    const [actionLog, setActionLog] = useState([]);
    const [currentTask, setCurrentTask] = useState("1");

    useEffect(() => {
        const log = localStorage.getItem("tla-action-log");
        if (log) {
            setActionLog(JSON.parse(log));
        }
    }, [])

    useEffect(() => {
        localStorage.setItem("tla-action-log", JSON.stringify(actionLog));
        console.table(actionLog)
    }, [actionLog]);

    const edges = previewEdge ? [...prevEdges, previewEdge] : prevEdges;
    const vizData = edges.map(edgeToVizData);

    const props = {
        graph,
        prevEdges, setPrevEdges,
        previewEdge, setPreviewEdge,
        currNode, setCurrNode,
        vizData,
        selectedActor, setSelectedActor,
        showMessagePayload, setShowMessagePayload,
        heightIncreaseFactor, setHeightIncreaseFactor,
        setActionLog, currentTask
    };

    const InitStateSelection = () => {
        const resetInitNode = (nodeId) => {
            setCurrNode(graph.nodes.get(nodeId));
            setPrevEdges([]);
        };

        return html` <div style=${{ padding: "4px 4px 4px 16px" }}>
      <label for="init">Choose initial state:</label>
      <select
        id="init"
        value=${currNode.id}
        onChange=${(e) => resetInitNode(e.target.value)}
      >
        ${initNodes.map((n) => html`<option value=${n.id}>${n.id}</option>`)}
      </select>
    </div>`;
    };

    const UndoButton = () => {
        return html` <button
      style=${{ height: "min-content", width: "min-content", margin: "4px", padding: "8px" }}
      onClick=${() => {
                if (prevEdges.length > 0) {
                    setCurrNode(graph.nodes.get(prevEdges[prevEdges.length - 1].from));
                    setPrevEdges((prevEdges) => prevEdges.slice(0, prevEdges.length - 1));
                    setActionLog(actionLog => [...actionLog, [(new Date()).toISOString(), currentTask, "global", "undo"]])
                }
            }}
    >
      Undo
    </button>`;
    };

    return html`
    <${TaskContext.Provider} value=${currentTask}>
        <div style=${{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0px",
            overflowY: "clip"
        }}>
          <${RepresentationsPicker} actionLog=${actionLog} setActionLog=${setActionLog} 
            representations=${representations} setRepresentations=${setRepresentations} 
            currentTask=${currentTask} setCurrentTask=${setCurrentTask} />
          <div style=${{ display: "flex", justifyContent: "space-between", margin: "8px" }}>
            <${InitStateSelection} />
            <${UndoButton} />
          </div>
          <${RepresentationsLayout} ...${props} representations=${representations} />
        </div>
    </${TaskContext.Provider}>
  `;
};


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
        const stateTransitionsByBeforeState = {};
        for (const e of edges) {
            const varStateSpaceBefore = nodeToStateDescription(
                spec.transformation.stateSpaceSelectors[actor],
                nodes.get(e.from),
            );
            const varStateSpaceAfter = nodeToStateDescription(
                spec.transformation.stateSpaceSelectors[actor],
                nodes.get(e.to),
            );
            const beforeJson = varStateSpaceBefore;
            const afterJson = varStateSpaceAfter;

            if (beforeJson === afterJson) {
                // TODO
                // this could either be a stuttering step of this actor or a step of another actor
                // we currently discard these cases, even though we would like the stuttering
                // step of this actors
                // its a stuttering step if the whole state space is the same, else 
                // its a step of another actor
                continue;
            }

            if (stateTransitionsByBeforeState[beforeJson] === undefined) {
                const labelsByToTransition = {};
                labelsByToTransition[afterJson] = new Set([e.label + e.parameters]);
                stateTransitionsByBeforeState[beforeJson] = labelsByToTransition;
            } else if (!stateTransitionsByBeforeState[beforeJson][afterJson]) {
                stateTransitionsByBeforeState[beforeJson][afterJson] = new Set([
                    e.label + e.parameters,
                ]);
            } else {
                // we have multiple transitions from the same from state to the same to state
                stateTransitionsByBeforeState[beforeJson][afterJson].add(
                    e.label + e.parameters,
                );
            }
        }
        return stateTransitionsByBeforeState;
    };
    const stateSpaceByActor = spec.transformation.actors.reduce((acc, actor) => {
        if (!spec.transformation.actorSelectors[actor]) return acc;
        acc[actor] = computeStateSpaceOf(actor);
        return acc;
    }, {});

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
        stateSpaceSelectors: spec.transformation.stateSpaceSelectors,
        source: spec.source,
        mcConfig: spec.mcConfig,
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

const SpecPicker = ({ specUrl }) => {
    const [spec, setSpec] = useLocalState("tla-spec");

    const loadSpec = (e) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = JSON.parse(e.target.result);
            setSpec(result);
        };
        reader.readAsText(e.target.files[0]);
    };

    useEffect(() => {
        if (specUrl) fetch(specUrl).then((r) => r.json()).then(setSpec);
    }, [specUrl])

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

export const TlaStateExplorer = ({ specUrl }) => {
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
        html`
        <div style=${{ height: "100%", display: "flex", flexDirection: "column" }}>
            <${SpecPicker} specUrl=${specUrl} />
        </div>`
    ];
};
