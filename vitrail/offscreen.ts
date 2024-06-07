import { Pane, Vitrail } from "./vitrail.ts";

export async function offscreenVitrail(sourceString: string) {
  function createPane(init: string) {
    let text = init;
    return new Pane({
      vitrail: v,
      view: document.createElement("div"),
      host: null as any,
      fetchAugmentations: () => null,
      getLocalSelectionIndices: () => [0, 0],
      focusRange: () => {},
      applyLocalChanges: (changes) => {
        debugger;
      },
      setText: (s) => (text = s),
      getText: () => text,
      hasFocus: () => false,
      syncReplacements: () => {},
    });
  }

  const v = new Vitrail({
    createPane: () => createPane(""),
    showValidationPending: () => {},
  });
  await v.connectHost(createPane(sourceString));

  return v;
}
