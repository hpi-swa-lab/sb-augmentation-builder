import { Component, createContext, createRef } from "../../external/preact.mjs";
import { DiagramConfig } from "./state-explorer.js";
import {
    useContext,
} from "../../external/preact-hooks.mjs";

/** transforms a list of edges to visual variables for the diagram
 * @returns {{
*  label: string,
*  actor: string,
*  msgs: string[]
* }}
*/
export function edgeToVizData({ reads, writes, label }) {
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