import { Extension } from "../core/extension.js";
import { objectToMap } from "../extensions/javascript.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../external/preact-hooks.mjs";
import { orParentThat, withDo } from "../utils.js";
import { ensureReplacementPreact, h, render, shard } from "../view/widgets.js";

export const towers = new Extension()
  .registerReplacement((e) => [
    (x) => x.extract("new Tower($arg)"),
    ([x, { arg }]) =>
      ensureReplacementPreact(
        e,
        x,
        "scrower-tower",
        ({ arg }) => {
          const args = objectToMap(arg);
          return h(
            "div",
            {
              class: "sb-column tower",
              style: {
                left: parseInt(args.x.sourceString),
                top: parseInt(args.y.sourceString),
              },
            },
            "Tower",
            shard(arg)
          );
        },
        { arg }
      ),
  ])

  .registerReplacement((e) => [
    (x) => x.extract("new Enemy($arg)"),
    ([x, { arg }]) =>
      ensureReplacementPreact(
        e,
        x,
        "scrower-enemy",
        ({ arg }) => {
          const args = objectToMap(arg);
          const position = getPointOnPath(parseInt(args.progress.sourceString));
          return h(
            "div",
            {
              class: "sb-column enemy",
              style: {
                left: position[0],
                top: position[1],
              },
            },
            "Enemy",
            shard(arg)
          );
        },
        { arg }
      ),
  ])

  .registerReplacement((e) => [
    (x) => false,
    (x) => x.extract("this.shoot($range, $damage)"),
    (x) =>
      ensureReplacementPreact(e, x, "scrower-shoot", ({ range, damage }) => {}),
  ])

  .registerAlways((e) => [
    (x) => x.type === "number",
    (x) =>
      e.attachData(x, "scrubbing-event-listeners", (view) => {
        let transition;
        const tower = orParentThat(view, (p) => p.classList.contains("tower"));
        if (!tower) return;
        const scrub = (e) => {
          e.preventDefault();
          x.replaceWith(parseInt(x.text) + e.movementX);
        };
        const removeScrub = () => {
          window.removeEventListener("mousemove", scrub);
          window.removeEventListener("mouseup", removeScrub);
          tower.style.transition = transition;
        };
        view.addEventListener("mousedown", (e) => {
          transition = tower.style.transition;
          tower.style.transition = "none";
          window.addEventListener("mousemove", scrub);
          window.addEventListener("mouseup", removeScrub);
        });
      }),
  ])

  .registerExtensionConnected((e) => [
    (x) => true,
    (x) => x.isRoot,
    (x) => {
      document
        .querySelector("sb-editor")
        .source.findQuery("let hp = $value")
        .value.replaceWith(balancing.baseHp());
      document
        .querySelector("sb-editor")
        .source.findQuery("let energy = $value")
        .value.replaceWith(balancing.initialEnergy());

      let currentWave = 0;
      const waveInterval = balancing.waveInterval(currentWave);
      let spawnCounter = 0;
      const editor = x.editor;
      let beginWave = () => {
        ++currentWave;
        spawnCounter = currentWave;
        console.log("wave ", currentWave);
      };
      beginWave();
      setInterval(beginWave, waveInterval);

      setInterval(() => {
        const selectionRange = editor.selectionRange;

        try {
          updateEnergy((e) => e + balancing.energyPerTurn());

          const currentEnemies = [];
          const removeEnemies = [];
          x.allNodesDo((n) =>
            n.exec(
              (n) => n.extract("new Enemy($data)"),
              ([n, { data }]) => [n, objectToMap(data)],
              ([n, data]) => {
                let progress = parseInt(data.progress.sourceString);
                progress += balancing.enemySpeed(currentWave, data);
                if (progress >= getPathLength()) {
                  removeEnemies.push(n);
                  damage(balancing.enemyDamage(currentWave, data));
                } else {
                  data.progress.replaceWith(progress);
                  currentEnemies.push({ ...data, node: n });
                }
              }
            )
          );

          let now = Date.now();
          let timeSinceLastSpawn = now - lastSpawnTime;
          if (
            timeSinceLastSpawn >= balancing.spawnInterval(currentWave) &&
            spawnCounter > 0
          ) {
            const list = x.findQuery("let enemies = $list").list;
            list.insert(
              `new Enemy({ progress: 0, hp: ${balancing.enemyHp(
                currentWave
              )} })`,
              "expression",
              list.childBlocks.length
            );

            lastSpawnTime = now;
            spawnCounter--;
          }

          x.allNodesDo((n) =>
            n.exec(
              (n) => n.query("new Tower($data)")?.data,
              (data) => {
                try {
                  return [data, eval(`(${data.sourceString})`)];
                } catch (e) {
                  reportErrorAtNode(data, e);
                  return null;
                }
              }
            )
          );

          x.allNodesDo((n) =>
            n.exec(
              (n) => n.query("new Tower($data)")?.data,
              (data) => {
                try {
                  return [data, eval(`(${data.sourceString})`)];
                } catch (e) {
                  reportErrorAtNode(data, e);
                  return null;
                }
              },
              ([node, data]) => {
                try {
                  data.loop?.apply(towerApi(data, currentEnemies));
                } catch (e) {
                  reportErrorAtNode(node, e);
                }
              }
            )
          );

          for (const enemy of removeEnemies) {
            enemy.removeFull();
          }
        } finally {
          editor.selectRange(...selectionRange);
        }
      }, 500);
    },
  ]);

const balancing = {
  waveInterval: (wave) => 5000,
  energyOnKill: (enemy) => 300,
  energyPerTurn: () => 100,
  enemySpeed: (wave, enemy) => 30 + wave * 5,
  enemyHp: (wave) => 100 + wave * 10,
  enemyDamage: (wave, enemy) => 10 + wave * 2,
  shootCost: (range, damage) => damage * (range / 200),
  baseHp: () => 1000,
  spawnInterval: (wave) => 2000,
  initialEnergy: () => 300,
};

const towerApi = (tower, enemies) => ({
  shoot: (range, damage) => {
    const enemiesToRemove = [];
    for (const enemy of enemies) {
      const [x, y] = getPointOnPath(parseInt(enemy.progress.sourceString));
      const distance = Math.sqrt((x - tower.x) ** 2 + (y - tower.y) ** 2);
      addCircle(tower.x, tower.y, range * 2);
      if (distance <= range) {
        const cost = balancing.shootCost(range, damage);
        withCostDo(
          cost,
          () => {
            addParticle(x, y, "💥", damage, 18);
            const newHp = parseInt(enemy.hp.sourceString) - damage;
            enemy.hp.replaceWith(newHp);
            if (newHp <= 0) {
              enemiesToRemove.push(enemy.node);
              updateEnergy((e) => e + balancing.energyOnKill(enemy));
            }
          },
          () => addParticle(tower.x, tower.y, "🔋", cost, 30)
        );
      }
    }
    for (const node of enemiesToRemove) node.removeFull();
  },
});

function reportErrorAtNode(node, error) {
  console.error(error);
  addParticle(
    ...withDo(node.debugView.getBoundingClientRect(), (r) => [
      r.x + r.width / 2,
      r.y + r.height / 2,
    ]),
    "🔥",
    error.message,
    18
  );
}

function withCostDo(num, action, noEnergy) {
  const { value } = document
    .querySelector("sb-editor")
    .source.findQuery("let energy = $value");
  if (parseInt(value.sourceString) >= num) {
    value.replaceWith(parseInt(value.sourceString) - num);
    action();
  } else noEnergy?.();
}

function updateEnergy(cb) {
  const { value } = document
    .querySelector("sb-editor")
    .source.findQuery("let energy = $value");
  const newVal = cb(parseInt(value.sourceString));
  value.replaceWith(newVal);
}

render(h(Particles), document.querySelector("#particles"));

function addCircle(x, y, size) {
  addParticle(x, y, "circle", null, size);
}

function Particles() {
  const [particles, setParticles] = useState([]);
  const idRef = useRef(0);

  window.addParticle = useCallback((x, y, icon, text, size) => {
    setParticles((p) => [
      ...p,
      { x, y, icon, text, size, id: idRef.current++ },
    ]);
  });

  return particles.map((p) =>
    h(Particle, {
      key: p.id,
      ...p,
      onExpired: () =>
        setParticles((list) => list.filter((x) => x.id !== p.id)),
    })
  );
}

function Particle({ x, y, icon, text, size, onExpired }) {
  size ??= 18;

  const isCircle = icon === "circle";

  const [position, setPosition] = useState([x, y]);

  const direction = useMemo(() => {
    const angle = Math.random() * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });

  const lifeTimeRef = useRef(0);

  useEffect(() => {
    const update = () => {
      if (!isCircle) {
        setPosition(([x, y]) => [x + direction[0], y + direction[1]]);
      }
      lifeTimeRef.current++;
      if (lifeTimeRef.current > 20) onExpired();
      else requestAnimationFrame(update);
    };
    const id = requestAnimationFrame(update);
    () => cancelAnimationFrame(id);
  }, []);

  return h(
    "div",
    {
      class: isCircle ? "circle" : "particle",
      style: {
        left: position[0],
        top: position[1],
        fontSize: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        width: size,
        height: size,
      },
    },
    !isCircle && icon,
    text && h("span", {}, text)
  );
}

let _pathPoints;
function getPathPoints() {
  if (_pathPoints == null) {
    const enemyPath = document.getElementById("enemy-path").getAttribute("d");
    _pathPoints = [...enemyPath.matchAll(/\w\s*(\d+)\s+(\d+)/g)].map(
      ([_, x, y]) => [parseInt(x), parseInt(y)]
    );
  }

  return _pathPoints;
}

let _pathLength;
function getPathLength() {
  if (_pathLength == null) {
    _pathLength = 0;
    const pathPoints = getPathPoints();
    let currentPoint = pathPoints[0];
    for (let i = 1; i < pathPoints.length; ++i) {
      let nextPoint = pathPoints[i];
      _pathLength += Math.abs(
        currentPoint[0] - nextPoint[0] + currentPoint[1] - nextPoint[1]
      );
      currentPoint = nextPoint;
    }
  }

  return _pathLength;
}

function getPointOnPath(distance) {
  let pathPoints = getPathPoints();

  let currentDistance = 0;
  let currentPoint = pathPoints[0];
  for (let i = 1; i < pathPoints.length; ++i) {
    const nextPoint = pathPoints[i];
    const segmentLength = Math.abs(
      currentPoint[0] - nextPoint[0] + currentPoint[1] - nextPoint[1]
    );
    if (currentDistance + segmentLength < distance) {
      currentDistance += segmentLength;
      currentPoint = nextPoint;
      continue;
    }

    const remainingDistance = distance - currentDistance;
    const direction = [
      Math.sign(nextPoint[0] - currentPoint[0]),
      Math.sign(nextPoint[1] - currentPoint[1]),
    ];
    const newPoint = [
      currentPoint[0] + remainingDistance * direction[0],
      currentPoint[1] + remainingDistance * direction[1],
    ];

    return newPoint;
  }

  return pathPoints[pathPoints.length - 1];
}

function damage(amount) {
  let { value } = document
    .querySelector("sb-editor")
    .source.findQuery("let hp = $value");
  const newHp = parseInt(value.sourceString) - amount;
  value.replaceWith(newHp);
  if (newHp <= 0) {
    alert("you done goofed");
  }
}

let lastSpawnTime = -balancing.spawnInterval();
