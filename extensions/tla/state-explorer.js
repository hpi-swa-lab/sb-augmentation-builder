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
        <div style=${{ ...containerStyle, display: representations.includes("sequence") ? "flex" : "none", flexDirection: "column" }}>
            <${SequenceDiagramRepresentation} ...${props} />
        </div>
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
        <div style=${{ display: "flex", flexDirection: "column" }}>
            <${SpecTextRepresentation} ...${props} />
        </div>
    </div>
    `
}

const RepresentationsPicker = ({ representations, setRepresentations }) => {
    const onChange = (e) => {
        if (e.target.checked) {
            setRepresentations((r) => [...r, e.target.value]);
        } else {
            setRepresentations((r) => r.filter((v) => v !== e.target.value));
        }
    }

    return html`
    <div>
        <style>
          .checkbox-btn {
            margin-right: 8px;
          }
        </style>
        <h2>Representations</h2>
        <div style=${{ display: "flex", flexDirection: "row" }}>
          <div class="checkbox-btn">
            <input
              type="checkbox"
              name="sequence diagram"
              value="sequence"
              checked=${representations.includes("sequence")}
              onChange=${onChange}
            />
            <label for="sequence diagram">Sequence Diagram</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="state machine" value="state" 
                checked=${representations.includes("state")} 
                onChange=${onChange}
            />
            <label for="state machine">State Machine</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="table" value="table" onChange=${onChange}
                checked=${representations.includes("table")}
            />
            <label for="table">Table</label>
          </div>
          <div class="checkbox-btn">
            <input type="checkbox" name="text" value="text" onChange=${onChange}
                checked=${representations.includes("text")}
            />
            <label for="text">Text</label>
          </div>
        </div>
    </div>`
}

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
    const [representations, setRepresentations] = useState(["table", "text"]);

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
        heightIncreaseFactor, setHeightIncreaseFactor
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

    return html`
    <div style=${{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0px",
            overflowY: "clip"
        }}>
      <${RepresentationsPicker} representations=${representations} setRepresentations=${setRepresentations} />
      <${InitStateSelection} />
      <${RepresentationsLayout} ...${props} representations=${representations} />
    </div>
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

const SpecPicker = () => {
    const [spec, setSpec] = useLocalState("tla-spec");

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

export const TlaStateExplorer = () => {
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
            <${SpecPicker} />
        </div>`
    ];
};
