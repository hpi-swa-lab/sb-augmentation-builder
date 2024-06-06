import { useEffect, useMemo, useRef } from "../external/preact-hooks.mjs";
import {
  untracked,
  useSignal,
  useSignalEffect,
} from "../external/preact-signals.mjs";
import { h } from "../external/preact.mjs";

interface Node {
  node: any;
  name: string;
  key: string;
}
type Vec = [number, number];
function vecAdd(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1]];
}
function vecInv(a: Vec): Vec {
  return [-a[0], -a[1]];
}
function randomVec(): Vec {
  return angleToVec(Math.random() * Math.PI * 2);
}
function vecEqual(a: Vec, b: Vec): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
function vecSub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1]];
}
function vecNorm(a: Vec): Vec {
  const mag = vecMag(a);
  return [a[0] / mag, a[1] / mag];
}
function vecMul(a: Vec, b: number): Vec {
  return [a[0] * b, a[1] * b];
}
function angleToVec(angle: number): Vec {
  return [Math.cos(angle), Math.sin(angle)];
}
function vecMag(a: Vec): number {
  return Math.sqrt(a[0] ** 2 + a[1] ** 2);
}

const center = (rect: DOMRectReadOnly): Vec => [
  rect.x + rect.width / 2,
  rect.y + rect.height / 2,
];

const boundsFromPositions = (positions: Vec[], padding: Vec) => {
  let bounds =
    positions.length > 0
      ? positions.reduce(
          (acc, [x, y]) => {
            acc[0] = Math.min(acc[0], x);
            acc[1] = Math.min(acc[1], y);
            acc[2] = Math.max(acc[2], x);
            acc[3] = Math.max(acc[3], y);
            return acc;
          },
          [Infinity, Infinity, -Infinity, -Infinity],
        )
      : [0, 0, 0, 0];
  bounds[0] -= padding[0];
  bounds[1] -= padding[1];
  bounds[2] += padding[0];
  bounds[3] += padding[1];
  bounds = bounds.map((x) => Math.floor(x));
  return bounds;
};

export function ForceLayout({
  className,
  nodes,
  edges,
}: {
  className: string;
  nodes: Node[];
  edges: { label: any; from: string; to: string; key: string }[];
}) {
  const nodeSizes: { value: Map<string, DOMRectReadOnly> } = useSignal(
    new Map(),
  );
  const nodePositions: { value: Map<string, Vec> } = useSignal(new Map());

  const applyPairForces = (
    func: (a: [string, Vec], b: [string, Vec]) => void,
  ) => {
    for (const [a, aRect] of nodeSizes.value.entries()) {
      const aCenter = center(aRect);
      for (const [b, bRect] of nodeSizes.value.entries()) {
        const bCenter = center(bRect);
        if (a !== b) func([a, aCenter], [b, bCenter]);
      }
    }
  };

  const applyForces = (func: (a: [string, Vec]) => void) => {
    for (const [a, aRect] of nodeSizes.value.entries()) {
      const aCenter = center(aRect);
      func([a, aCenter]);
    }
  };

  const isConnected = (a: string, b: string) => {
    return edges.some(
      ({ from, to, key }) =>
        (key === a && (from === b || to === b)) ||
        (key === b && (from === a || to === a)),
    );
  };

  const observer: ResizeObserver = useMemo(
    () =>
      new ResizeObserver(
        (entries) =>
          (nodeSizes.value = new Map(
            entries.map(({ target, contentRect: box }) => [
              target.getAttribute("data-key")!,
              box,
            ]),
          )),
      ),
    [],
  );

  const update = () => {
    const forces = new Map<string, [number, number]>();
    for (let i = 0; i < 1; i++) {
      // gravity to center
      applyForces(([aNode, a]) => {
        const forceConstant = 0.01;
        const force = vecMul(a, forceConstant);
        forces.set(aNode, vecAdd(forces.get(aNode) ?? [0, 0], force));
      });
      // repulsive or attractive
      applyPairForces(([aNode, a], [bNode, b]) => {
        const forceConstant = 2.1;
        const vec = vecEqual(a, b) ? randomVec() : vecNorm(vecSub(b, a));
        const force = vecMul(vec, forceConstant / (vecMag(vec) * vecMag(vec)));
        forces.set(aNode, vecAdd(forces.get(aNode) ?? [0, 0], force));
        forces.set(bNode, vecSub(forces.get(bNode) ?? [0, 0], force));

        if (isConnected(aNode, bNode)) {
          const force = vecMul(vec, 2);
          forces.set(aNode, vecSub(forces.get(aNode) ?? [0, 0], force));
          forces.set(bNode, vecAdd(forces.get(bNode) ?? [0, 0], force));
        }
      });
      let result;
      untracked(() => {
        result = new Map(
          [...forces.entries()].map(([node, force]) => [
            node,
            vecAdd(force, nodePositions.value.get(node) ?? [0, 0]),
          ]),
        );
      });
      nodePositions.value = result;
    }
  };

  useSignalEffect(() => update());

  function render(element: Element, key: string) {
    return h(ForceLayoutNode, {
      node: element,
      observer,
      key,
      id: key,
      size: nodeSizes.value.get(key) ?? new DOMRectReadOnly(0, 0, 100, 100),
      position: nodePositions.value.get(key) ?? [0, 0],
    });
  }

  const bounds = boundsFromPositions(
    [...nodePositions.value.values()],
    [60, 30],
  );
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  return h(
    "svg",
    {
      onClick: () => update(),
      viewBox: `${bounds[0]} ${bounds[1]} ${width} ${height}`,
      width,
      height,
      class: className,
    },
    nodes.map(({ node, key }) => render(node, key)),
    edges.map(({ label, key }) => render(label, key)),
  );
}

function ForceLayoutNode({
  observer,
  node,
  size,
  position,
  id,
}: {
  size: DOMRectReadOnly;
  position: Vec;
  observer: ResizeObserver;
  node: any;
  id: string;
}) {
  const ref = useRef();

  useEffect(() => {
    observer.observe(ref.current);
    return () => observer.unobserve(ref.current);
  }, [observer, ref.current]);

  return h(
    "foreignObject",
    {
      x: position[0] - size.width / 2,
      y: position[1] - size.height / 2,
      width: size.width,
      height: size.height,
    },
    h("div", { style: { display: "inline-block" }, ref, "data-key": id }, node),
  );
}
