(function (global) {
  "use strict";

  const pose = points => Object.freeze(points);
  const frame = (time, points) => Object.freeze({ time, points: pose(points) });

  const pushUpStart = {
    head: [75, 102], neck: [96, 114], shoulderL: [112, 112], shoulderR: [117, 122],
    elbowL: [145, 151], elbowR: [151, 157], wristL: [172, 195], wristR: [181, 198],
    hipL: [205, 141], hipR: [208, 151], kneeL: [251, 162], kneeR: [254, 170],
    ankleL: [300, 188], ankleR: [304, 194], toeL: [324, 199], toeR: [328, 202]
  };
  const pushUpBottom = {
    head: [78, 151], neck: [99, 157], shoulderL: [116, 158], shoulderR: [121, 167],
    elbowL: [142, 184], elbowR: [150, 188], wristL: [172, 195], wristR: [181, 198],
    hipL: [207, 169], hipR: [210, 178], kneeL: [253, 179], kneeR: [257, 186],
    ankleL: [300, 188], ankleR: [304, 194], toeL: [324, 199], toeR: [328, 202]
  };

  const curlStart = {
    head: [180, 40], neck: [180, 68], shoulderL: [143, 78], shoulderR: [217, 78],
    elbowL: [139, 132], elbowR: [221, 132], wristL: [135, 187], wristR: [225, 187],
    hipL: [157, 154], hipR: [203, 154], kneeL: [157, 205], kneeR: [203, 205],
    ankleL: [154, 244], ankleR: [206, 244], toeL: [137, 249], toeR: [223, 249]
  };
  const curlTop = {
    head: [180, 40], neck: [180, 68], shoulderL: [143, 78], shoulderR: [217, 78],
    elbowL: [139, 132], elbowR: [221, 132], wristL: [151, 91], wristR: [209, 91],
    hipL: [157, 154], hipR: [203, 154], kneeL: [157, 205], kneeR: [203, 205],
    ankleL: [154, 244], ankleR: [206, 244], toeL: [137, 249], toeR: [223, 249]
  };

  const squatStart = {
    head: [180, 35], neck: [180, 64], shoulderL: [145, 76], shoulderR: [215, 76],
    elbowL: [132, 109], elbowR: [228, 109], wristL: [151, 91], wristR: [209, 91],
    hipL: [158, 151], hipR: [202, 151], kneeL: [154, 204], kneeR: [206, 204],
    ankleL: [151, 244], ankleR: [209, 244], toeL: [131, 249], toeR: [229, 249]
  };
  const squatBottom = {
    head: [203, 76], neck: [194, 101], shoulderL: [161, 104], shoulderR: [225, 115],
    elbowL: [145, 133], elbowR: [239, 140], wristL: [169, 119], wristR: [218, 126],
    hipL: [156, 169], hipR: [196, 177], kneeL: [129, 207], kneeR: [213, 209],
    ankleL: [151, 244], ankleR: [209, 244], toeL: [126, 249], toeR: [234, 249]
  };

  const DEFINITIONS = Object.freeze({
    push_up: Object.freeze({
      id: "push_up", name: "Push-Up", aliases: ["push-up", "push up", "pushup"], duration: 4,
      muscles: ["chest", "triceps", "frontShoulder"], equipment: "bodyweight", floorY: 210,
      arrowPath: "M 278 92 C 315 116 315 166 278 194",
      arrowLabel: "Ned og op",
      keyframes: [frame(0, pushUpStart), frame(.5, pushUpBottom), frame(1, pushUpStart)]
    }),
    dumbbell_curl: Object.freeze({
      id: "dumbbell_curl", name: "Dumbbell Curl", aliases: ["dumbbell curl"], duration: 4,
      muscles: ["biceps", "forearm"], equipment: "dumbbells",
      arrowPath: "M 280 185 C 318 159 316 107 278 82",
      arrowLabel: "Curl op",
      keyframes: [frame(0, curlStart), frame(.5, curlTop), frame(1, curlStart)]
    }),
    back_squat: Object.freeze({
      id: "back_squat", name: "Back Squat", aliases: ["back squat"], duration: 4,
      muscles: ["quadriceps", "gluteus", "hamstrings"], equipment: "barbell",
      arrowPath: "M 294 73 C 326 111 326 169 294 211",
      arrowLabel: "Hofte ned og op",
      keyframes: [frame(0, squatStart), frame(.5, squatBottom), frame(1, squatStart)]
    })
  });

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  }

  function get(name) {
    const candidate = normalize(name);
    return Object.values(DEFINITIONS).find(definition => definition.aliases.includes(candidate)) || null;
  }

  global.Work4itMannequinAnimations = Object.freeze({ DEFINITIONS, get, normalize });
}(typeof window !== "undefined" ? window : globalThis));
