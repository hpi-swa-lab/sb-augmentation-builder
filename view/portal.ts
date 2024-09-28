import { useEffect, useRef } from "../external/preact-hooks.mjs";
import { render } from "./widgets.js";

export function Portal({ into, children }) {
  const old = useRef(null);

  useEffect(
    () => {
      queueMicrotask(() => (old.current = render(children, into, old)));
      return () => queueMicrotask(() => render(null, into, old));
    },
    Array.isArray(children) ? children : [children],
  );

  return null;
}
