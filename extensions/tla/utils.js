import htm from "../../external/htm.mjs";
import { useContext, useEffect, useRef } from "../../external/preact-hooks.mjs";
import { h } from "../../external/preact.mjs";
import { TaskContext } from "./state-explorer.js";
const html = htm.bind(h);

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
export function apply(obj, keys) {
    const reversedKeys = [...keys].reverse();
    let result = obj;
    while (reversedKeys.length > 0) {
        const k = reversedKeys.pop();
        if (Array.isArray(result) && !Number.isNaN(Number.parseInt(k ?? ""))) {
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
export function nestedKeys(varTree) {
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

export const jsonToTLAString = (obj) => {
    let json = JSON.stringify(obj);
    if (json === undefined) return undefined;
    // remove all " and replace : in pattern "<key>": with <key>↦
    json = json.replace(/"(\w+)":/g, "$1 ↦ ");
    // replace all remaining : with →
    json = json.replace(/:/g, "→");
    // replace all , with ,\n
    json = json.replace(/,/g, ", ");
    // replace all { with [
    json = json.replace(/{/g, "[");
    // replace all } with ]
    json = json.replace(/}/g, "]");
    // we cannot do this here because records and sets are not distinguished
    // meaning that we would interpret records as sets if proceeeding here
    // replace all [ with {
    //json = json.replace(/\[/g, "{");
    // replace all ] with }
    //json = json.replace(/\]/g, "}");
    return json;
}

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

/** returns buttons to pick next edge. Considers all possible enabled actions but applies
 * filterFn to filter out some of them. 
 */
export const EdgePickers = ({ graph, currNode, setCurrNode, setPrevEdges, setPreviewEdge, filterFn, representationKey, setActionLog, currentTask }) => {
    const enabledEdges = graph.outgoingEdges.get(currNode.id);
    const enabledEdgesOfSelectedActor = enabledEdges.filter(filterFn)

    const currentTaskCtx = useContext(TaskContext); // is null in editor

    const selectNode = (e) => {
        setCurrNode(graph.nodes.get(e.to));
        setPrevEdges(prevEdges => [...prevEdges, e]);
        const task = currentTask ? currentTask : currentTaskCtx;
        setActionLog(actionLog => [...actionLog, [(new Date()).toISOString(), task, representationKey, e.label + e.parameters]]);
    }

    return enabledEdgesOfSelectedActor.map(e => html`
            <${EdgePickerButton} 
                onClick=${() => selectNode(e)}
                onMouseEnter=${() => setPreviewEdge(e)}
                onMouseLeave=${() => setPreviewEdge(null)}
                >
                ${e.label + e.parameters}
            </${EdgePickerButton}>
        `)
}

// https://designtechworld.medium.com/create-a-custom-debounce-hook-in-react-114f3f245260
export const useDebounce = (callback, delay) => {
    const ref = useRef(null);

    useEffect(() => {
        return () => {
            if (ref.current) {
                clearTimeout(ref.current);
            }
        };
    }, []);

    const debouncedCallback = (...args) => {
        if (ref.current) {
            clearTimeout(ref.current);
        }

        ref.current = setTimeout(() => {
            callback(...args);
        }, delay);
    };

    return debouncedCallback;
};