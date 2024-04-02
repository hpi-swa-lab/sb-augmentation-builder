import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
import htm from "../../external/htm.mjs";
import { EdgePickers, jsonToTLAString } from "./utils.js";
import { useContext, useEffect, useRef } from "../../external/preact-hooks.mjs";
import { DiagramConfig } from "./state-explorer.js";
import { h } from "../../external/preact.mjs";
import { edgeToVizData } from "./actor-mapping.js";
mermaid.initialize({ startOnLoad: false });
const html = htm.bind(h);

export const nodeToStateDescription = (selectors, node) => {
    const description = selectors
        .flatMap(([query, annotation, fallback]) => {
            const results = jmespath.search(node, query);
            if (!results) return []; // this will be removed in the subsequent flattening
            if (results.length === 0) return fallback ?? [];
            const tla = Array.isArray(results[0])
                ? `{${results[0].map(jsonToTLAString).join(", ")}}`
                : jsonToTLAString(results[0]);
            return annotation.replace(
                /@/g,
                tla?.replace(/\"/g, "'"),
            );
        })
        .flat()
        .join("\n");
    return description;
};

const StateDiagram = ({ actor, currentState, previewedState }) => {
    const config = useContext(DiagramConfig);
    const { stateSpaceByActor } = config;
    const mermaidContainerRef = useRef(null);
    const actorState = nodeToStateDescription(
        config.stateSpaceSelectors[actor],
        currentState,
    );
    const previewedActorState = previewedState
        ? nodeToStateDescription(config.stateSpaceSelectors[actor], previewedState)
        : "NONE";

    const getMermaidOutput = () => {
        if (actor === "$messages") return "";
        const transitions = stateSpaceByActor[actor];

        const fromStateDescriptions = Object.keys(transitions);
        const toStateDescriptions = Object.values(transitions).flatMap((toMap) => [
            ...Object.keys(toMap),
        ]);
        const states = [
            ...new Set([...fromStateDescriptions, ...toStateDescriptions]),
        ];
        const aliasByState = states.reduce((acc, state, i) => {
            acc[state] = i + 1;
            return acc;
        }, {});
        const stateDefsMermaid = states
            .map((state, i) => `  state "${state}" as ${aliasByState[state]}`)
            .join("\n");

        const stylesClassesMermaid = states
            .map((state, i) =>
                state === actorState
                    ? `  class ${aliasByState[state]} selectedStateStyle`
                    : state === previewedActorState
                        ? `  class ${aliasByState[state]} previewStateStyle`
                        : `  class ${aliasByState[state]} defaultStateStyle`,
            )
            .join("\n");

        const transitionsAsMermaid = Object.entries(transitions)
            .map(([from, tosMap]) => {
                const tosAsMermaid = Object.entries(tosMap)
                    .map(([k, labels]) =>
                        [...labels]
                            .map(
                                (l) => `  ${aliasByState[from]} --> ${aliasByState[k]}: ${l}`,
                            )
                            .join("\n"),
                    )
                    .join("\n");
                return tosAsMermaid;
            })
            .join("\n");
        const mermaidOutput = `stateDiagram-v2
    direction LR
    classDef defaultStateStyle fill:white,color:black,stroke-width:1px,stroke:black,font-size:1em
    classDef selectedStateStyle fill:grey,color:black,stroke-width:1px,stroke:black,font-size:1em
    classDef previewStateStyle fill:lightgrey,color:black,stroke-width:1px,stroke:black,font-size:1em
${stylesClassesMermaid}
${stateDefsMermaid}

${transitionsAsMermaid}`;
        return mermaidOutput;
    };

    useEffect(() => {
        if (mermaidContainerRef.current) {
            // mermaid adds a "data-processed" attribute to the diagram after processing it
            mermaidContainerRef.current.removeAttribute("data-processed");
            // after processing, the innerHTML will be svg elements, so we
            // reset it
            mermaidContainerRef.current.innerHTML = getMermaidOutput();
        }
        mermaid.run({
            querySelector: ".mermaid",
        });
    }, [config, actor, currentState, previewedState]);

    return html` <div style=${{ width: "100%" }}>
    <div class="mermaid" ref=${mermaidContainerRef}></div>
  </div>`;
};


export const StateDiagramRepresentation = (props) => {
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

    const ActorSelector = () => {
        return html` <div style=${{ paddingLeft: "4px", display: "inline-block" }}>
      <select
        id="actor"
        value=${selectedActor}
        style=${{
                display: "inline-block",
                fontWeight: "bold",
                fontSize: "1.17em",
            }}
        onChange=${(e) => setSelectedActor(e.target.value)}
      >
        ${config.actors
                .filter((a) => a !== "$messages")
                .map((a) => html`<option value=${a}>${a}</option>`)}
      </select>
    </div>`;
    };

    return html`
    <div>
        <h3 style=${{ display: "inline-block" }}>State Diagram of</h3>
        <${ActorSelector} />
    </div>
    <${EdgePickers} ...${props} representationKey="state" filterFn=${e => edgeToVizData(e).actor === selectedActor} />
    <${StateDiagram}
        actor=${selectedActor}
        currentState=${currNode}
        previewedState=${graph.nodes.get(previewEdge?.to)}
    />
    `
}