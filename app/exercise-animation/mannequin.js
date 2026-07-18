(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const instances = new WeakMap();
  const pointNames = ["head", "neck", "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "toeL", "toeR"];
  const segments = [
    ["neck", "head", "neck", "rear"],
    ["shoulderL", "elbowL", "upperArmL", "rear"], ["elbowL", "wristL", "forearmL", "rear"],
    ["hipL", "kneeL", "thighL", "rear"], ["kneeL", "ankleL", "shinL", "rear"], ["ankleL", "toeL", "footL", "rear"],
    ["shoulderR", "elbowR", "upperArmR", ""], ["elbowR", "wristR", "forearmR", ""],
    ["hipR", "kneeR", "thighR", ""], ["kneeR", "ankleR", "shinR", ""], ["ankleR", "toeR", "footR", ""]
  ];

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function setLine(line, a, b) {
    line.setAttribute("x1", a[0]); line.setAttribute("y1", a[1]);
    line.setAttribute("x2", b[0]); line.setAttribute("y2", b[1]);
  }

  function interpolatePose(keyframes, progress) {
    let from = keyframes[0], to = keyframes[keyframes.length - 1];
    for (let index = 1; index < keyframes.length; index++) {
      if (progress <= keyframes[index].time) { from = keyframes[index - 1]; to = keyframes[index]; break; }
    }
    const span = Math.max(.0001, to.time - from.time);
    const raw = Math.max(0, Math.min(1, (progress - from.time) / span));
    const eased = raw * raw * (3 - 2 * raw);
    return Object.fromEntries(pointNames.map(name => {
      const a = from.points[name], b = to.points[name];
      return [name, [a[0] + (b[0] - a[0]) * eased, a[1] + (b[1] - a[1]) * eased]];
    }));
  }

  function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }

  function createMuscleElements(group, definition) {
    const resolved = global.Work4itMannequinMuscles?.resolve(definition.muscles) || [];
    return resolved.flatMap(muscle => {
      if (muscle.kind === "torso") {
        const shape = svgElement("ellipse", { class: "work4it-mannequin-muscle chest", rx: 24, ry: 15, "data-muscle": muscle.id });
        group.appendChild(shape); return [{ muscle, shape }];
      }
      if (muscle.kind === "shoulder" || muscle.kind === "hip") {
        return ["L", "R"].map(side => {
          const shape = svgElement("circle", { class: `work4it-mannequin-muscle ${muscle.kind}`, r: muscle.kind === "hip" ? 11 : 8, "data-muscle": muscle.id, "data-side": side });
          group.appendChild(shape); return { muscle, shape, side };
        });
      }
      return ["L", "R"].map(side => {
        const shape = svgElement("line", { class: "work4it-mannequin-muscle segment", "data-muscle": muscle.id, "data-side": side });
        group.appendChild(shape); return { muscle, shape, side };
      });
    });
  }

  function updateMuscles(items, points) {
    items.forEach(({ muscle, shape, side }) => {
      if (muscle.kind === "torso") {
        const shoulder = midpoint(points.shoulderL, points.shoulderR), hip = midpoint(points.hipL, points.hipR);
        const center = [shoulder[0] * .68 + hip[0] * .32, shoulder[1] * .68 + hip[1] * .32];
        const angle = Math.atan2(hip[1] - shoulder[1], hip[0] - shoulder[0]) * 180 / Math.PI - 90;
        shape.setAttribute("cx", center[0]); shape.setAttribute("cy", center[1]);
        shape.setAttribute("transform", `rotate(${angle} ${center[0]} ${center[1]})`);
      } else if (muscle.kind === "shoulder") {
        const point = points[`shoulder${side}`]; shape.setAttribute("cx", point[0]); shape.setAttribute("cy", point[1]);
      } else if (muscle.kind === "hip") {
        const point = points[`hip${side}`]; shape.setAttribute("cx", point[0]); shape.setAttribute("cy", point[1]);
      } else {
        const pair = muscle.kind === "upperArm" ? [`shoulder${side}`, `elbow${side}`]
          : muscle.kind === "forearm" ? [`elbow${side}`, `wrist${side}`] : [`hip${side}`, `knee${side}`];
        const a = points[pair[0]], b = points[pair[1]];
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.max(1, Math.hypot(dx, dy));
        const muscleOffset = muscle.id === "quadriceps" ? -3.5 : muscle.id === "hamstrings" ? 3.5 : 0;
        const offsetX = -dy / length * muscleOffset, offsetY = dx / length * muscleOffset;
        const start = [a[0] * .72 + b[0] * .28 + offsetX, a[1] * .72 + b[1] * .28 + offsetY];
        const end = [a[0] * .28 + b[0] * .72 + offsetX, a[1] * .28 + b[1] * .72 + offsetY];
        setLine(shape, start, end);
      }
    });
  }

  function createEquipment(group, definition) {
    if (definition.equipment === "dumbbells") {
      return ["L", "R"].map(side => {
        const item = svgElement("line", { class: "work4it-mannequin-equipment", "data-side": side });
        group.appendChild(item); return item;
      });
    }
    if (definition.equipment === "barbell") {
      const bar = svgElement("line", { class: "work4it-mannequin-equipment" });
      const left = svgElement("circle", { class: "work4it-mannequin-equipment", r: 9 });
      const right = svgElement("circle", { class: "work4it-mannequin-equipment", r: 9 });
      group.append(bar, left, right); return [bar, left, right];
    }
    return [];
  }

  function updateEquipment(items, definition, points) {
    if (definition.equipment === "dumbbells") {
      items.forEach((line, index) => {
        const wrist = points[index ? "wristR" : "wristL"];
        setLine(line, [wrist[0] - 12, wrist[1]], [wrist[0] + 12, wrist[1]]);
      });
    } else if (definition.equipment === "barbell") {
      const shoulder = midpoint(points.shoulderL, points.shoulderR), angle = Math.atan2(points.shoulderR[1] - points.shoulderL[1], points.shoulderR[0] - points.shoulderL[0]);
      const dx = Math.cos(angle) * 67, dy = Math.sin(angle) * 67;
      const a = [shoulder[0] - dx, shoulder[1] - dy - 3], b = [shoulder[0] + dx, shoulder[1] + dy - 3];
      setLine(items[0], a, b);
      items[1].setAttribute("cx", a[0]); items[1].setAttribute("cy", a[1]);
      items[2].setAttribute("cx", b[0]); items[2].setAttribute("cy", b[1]);
    }
  }

  function mount(container, exerciseName) {
    unmount(container);
    const definition = global.Work4itMannequinAnimations?.get(exerciseName);
    if (!container || !definition) return null;
    const muscles = global.Work4itMannequinMuscles.resolve(definition.muscles);
    container.innerHTML = `<div class="work4it-mannequin-stage"></div><div class="work4it-mannequin-caption">${muscles.map(muscle => `<span class="work4it-mannequin-chip">${muscle.label}</span>`).join("")}</div><p class="work4it-mannequin-note">Orange markerer de primære arbejdende muskler. Bevægelsen er en Work4it-prototype.</p>`;
    const stage = container.querySelector(".work4it-mannequin-stage");
    const svg = svgElement("svg", { class: "work4it-mannequin-svg", viewBox: "0 0 360 260", role: "img", "aria-label": `Animeret Work4it-mannequin, der viser ${definition.name}` });
    const defs = svgElement("defs");
    const marker = svgElement("marker", { id: `work4it-arrow-${definition.id}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
    marker.appendChild(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#f97316" })); defs.appendChild(marker); svg.appendChild(defs);
    const floorY = Number(definition.floorY || 250);
    const grid = svgElement("path", { class: "work4it-mannequin-grid", d: `M20 ${floorY - 30} H340 M45 ${floorY - 15} H315 M80 ${floorY - 3} H280` });
    const floor = svgElement("line", { class: "work4it-mannequin-floor", x1: 22, y1: floorY, x2: 338, y2: floorY });
    const bodyGroup = svgElement("g"), equipmentGroup = svgElement("g"), muscleGroup = svgElement("g");
    const lineElements = {};
    segments.forEach(([, , id, depth]) => { const line = svgElement("line", { class: `work4it-mannequin-segment ${depth}`, "data-part": id }); bodyGroup.appendChild(line); lineElements[id] = line; });
    const torso = svgElement("polygon", { class: "work4it-mannequin-torso" }); bodyGroup.appendChild(torso);
    const head = svgElement("ellipse", { class: "work4it-mannequin-head", rx: 17, ry: 21 }); bodyGroup.appendChild(head);
    const joints = ["shoulderL", "shoulderR", "elbowL", "elbowR", "hipL", "hipR", "kneeL", "kneeR"].map(name => {
      const circle = svgElement("circle", { class: "work4it-mannequin-joint", r: 7, "data-joint": name }); bodyGroup.appendChild(circle); return [name, circle];
    });
    const muscleItems = createMuscleElements(muscleGroup, definition);
    const equipmentItems = createEquipment(equipmentGroup, definition);
    const arrow = svgElement("path", { class: "work4it-mannequin-arrow", d: definition.arrowPath, "marker-end": `url(#work4it-arrow-${definition.id})` });
    const arrowLabel = svgElement("text", { class: "work4it-mannequin-arrow-label", x: 338, y: 62, "text-anchor": "end" }); arrowLabel.textContent = definition.arrowLabel;
    svg.append(grid, floor, bodyGroup, muscleGroup, equipmentGroup, arrow, arrowLabel); stage.appendChild(svg);

    const update = points => {
      segments.forEach(([from, to, id]) => setLine(lineElements[id], points[from], points[to]));
      torso.setAttribute("points", [points.shoulderL, points.shoulderR, points.hipR, points.hipL].map(point => point.join(",")).join(" "));
      head.setAttribute("cx", points.head[0]); head.setAttribute("cy", points.head[1]);
      const neckAngle = Math.atan2(points.neck[1] - points.head[1], points.neck[0] - points.head[0]) * 180 / Math.PI;
      head.setAttribute("transform", `rotate(${neckAngle - 90} ${points.head[0]} ${points.head[1]})`);
      joints.forEach(([name, circle]) => { circle.setAttribute("cx", points[name][0]); circle.setAttribute("cy", points[name][1]); });
      updateMuscles(muscleItems, points); updateEquipment(equipmentItems, definition, points);
    };
    const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let frameId = 0, stopped = false, startedAt = performance.now();
    const animate = now => {
      if (stopped || !container.isConnected) return;
      const progress = reducedMotion ? 0 : ((now - startedAt) / (definition.duration * 1000)) % 1;
      update(interpolatePose(definition.keyframes, progress));
      if (!reducedMotion) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    const instance = { destroy() { stopped = true; cancelAnimationFrame(frameId); container.innerHTML = ""; instances.delete(container); } };
    instances.set(container, instance);
    return instance;
  }

  function unmount(container) { instances.get(container)?.destroy?.(); }
  function supports(name) { return Boolean(global.Work4itMannequinAnimations?.get(name)); }

  global.Work4itMannequin = Object.freeze({ mount, unmount, supports });
}(typeof window !== "undefined" ? window : globalThis));
