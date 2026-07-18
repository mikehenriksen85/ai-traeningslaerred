(function (global) {
  "use strict";

  const MUSCLES = Object.freeze({
    chest: Object.freeze({ label: "Bryst", kind: "torso" }),
    triceps: Object.freeze({ label: "Triceps", kind: "upperArm" }),
    frontShoulder: Object.freeze({ label: "Forreste skulder", kind: "shoulder" }),
    biceps: Object.freeze({ label: "Biceps", kind: "upperArm" }),
    forearm: Object.freeze({ label: "Underarm", kind: "forearm" }),
    quadriceps: Object.freeze({ label: "Quadriceps", kind: "thigh" }),
    gluteus: Object.freeze({ label: "Gluteus", kind: "hip" }),
    hamstrings: Object.freeze({ label: "Hamstrings", kind: "thigh" })
  });

  function resolve(ids) {
    return (Array.isArray(ids) ? ids : []).map(id => ({ id, ...MUSCLES[id] })).filter(item => item.label);
  }

  global.Work4itMannequinMuscles = Object.freeze({ MUSCLES, resolve });
}(typeof window !== "undefined" ? window : globalThis));
