import * as THREE from "./vendor/three/three.module.min.js";

const VERSION = "work4it-three-rig-v1";
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function normalizedName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function motionProfile(specification) {
  const name = normalizedName(specification?.exerciseName);
  if (["push up", "push ups", "pushup", "pushups"].includes(name)) return "push_up";
  return "";
}

function supports(specification) {
  return Boolean(motionProfile(specification));
}

function material(color, roughness = 0.55, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function capsule(materialValue, radius = 1) {
  const geometry = new THREE.CapsuleGeometry(radius, 1, 8, 18);
  const mesh = new THREE.Mesh(geometry, materialValue);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function joint(materialValue, radius) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), materialValue);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(materialValue, size) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z, 2, 2, 2), materialValue);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function setSegment(mesh, start, end, radius) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(0.01, direction.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  // CapsuleGeometry(1, 1) is three units high before scaling (two caps plus
  // the centre section). Scale from the complete segment length so limbs do
  // not overlap or appear stretched when the pose bends.
  mesh.scale.set(radius, Math.max(0.01, length / 3), radius);
}

function pushUpPose(progress) {
  const descent = (1 - Math.cos(progress * Math.PI * 2)) / 2;
  const shoulderY = THREE.MathUtils.lerp(0.76, 0.34, descent);
  const ankleY = 0.15;
  const bodyLineY = z => THREE.MathUtils.lerp(shoulderY, ankleY, (z + 0.48) / 1.97);
  const hipY = bodyLineY(0.55);
  const kneeY = bodyLineY(1.08);
  const elbowY = THREE.MathUtils.lerp(0.43, 0.17, descent);
  const elbowX = THREE.MathUtils.lerp(0.47, 0.78, descent);
  const headY = bodyLineY(-0.91);
  const left = -1;
  const right = 1;
  const side = sign => ({
    shoulder: new THREE.Vector3(sign * 0.34, shoulderY, -0.48),
    elbow: new THREE.Vector3(sign * elbowX, elbowY, -0.37),
    wrist: new THREE.Vector3(sign * 0.57, 0.10, -0.62),
    hand: new THREE.Vector3(sign * 0.57, 0.065, -0.69),
    hip: new THREE.Vector3(sign * 0.21, hipY, 0.55),
    knee: new THREE.Vector3(sign * 0.17, kneeY, 1.08),
    ankle: new THREE.Vector3(sign * 0.14, ankleY, 1.49),
    toe: new THREE.Vector3(sign * 0.14, 0.075, 1.69)
  });
  return {
    centerShoulder: new THREE.Vector3(0, shoulderY, -0.48),
    centerHip: new THREE.Vector3(0, hipY, 0.55),
    neck: new THREE.Vector3(0, bodyLineY(-0.68), -0.68),
    head: new THREE.Vector3(0, headY, -0.91),
    left: side(left),
    right: side(right)
  };
}

function createMannequin(scene) {
  const skin = material(0xc7a184, 0.7);
  const shirt = material(0x18a882, 0.5);
  const shorts = material(0x17243b, 0.72);
  const shoes = material(0xe8eef5, 0.5);
  const dark = material(0x202b3c, 0.8);
  const body = {
    torso: capsule(shirt), pelvis: capsule(shorts), neck: capsule(skin), head: joint(skin, 0.19),
    left: {}, right: {}
  };
  [body.torso, body.pelvis, body.neck, body.head].forEach(mesh => scene.add(mesh));
  ["left", "right"].forEach(side => {
    body[side] = {
      upperArm: capsule(skin), forearm: capsule(skin), hand: box(skin, new THREE.Vector3(0.20, 0.07, 0.25)),
      thigh: capsule(shorts), shin: capsule(skin), foot: box(shoes, new THREE.Vector3(0.20, 0.12, 0.34)),
      shoulderJoint: joint(shirt, 0.14), elbowJoint: joint(skin, 0.105), kneeJoint: joint(skin, 0.12),
      shoeSole: box(dark, new THREE.Vector3(0.21, 0.025, 0.35))
    };
    Object.values(body[side]).forEach(mesh => scene.add(mesh));
  });
  return body;
}

function applyPushUpPose(body, pose) {
  setSegment(body.torso, pose.centerHip, pose.centerShoulder, 0.30);
  setSegment(body.pelvis, new THREE.Vector3(0, pose.centerHip.y - 0.03, 0.42), new THREE.Vector3(0, pose.centerHip.y, 0.68), 0.25);
  setSegment(body.neck, pose.centerShoulder, pose.neck, 0.09);
  body.head.position.copy(pose.head);
  body.head.scale.set(0.82, 1.05, 0.90);
  ["left", "right"].forEach(side => {
    const joints = pose[side];
    const part = body[side];
    setSegment(part.upperArm, joints.shoulder, joints.elbow, 0.115);
    setSegment(part.forearm, joints.elbow, joints.wrist, 0.095);
    setSegment(part.thigh, joints.hip, joints.knee, 0.145);
    setSegment(part.shin, joints.knee, joints.ankle, 0.105);
    part.hand.position.copy(joints.hand);
    part.hand.rotation.x = -0.08;
    part.foot.position.copy(joints.toe).add(joints.ankle).multiplyScalar(0.5);
    part.foot.lookAt(joints.toe);
    part.shoeSole.position.copy(part.foot.position); part.shoeSole.position.y -= 0.065;
    part.shoeSole.rotation.copy(part.foot.rotation);
    part.shoulderJoint.position.copy(joints.shoulder);
    part.elbowJoint.position.copy(joints.elbow);
    part.kneeJoint.position.copy(joints.knee);
  });
}

function addSceneEnvironment(scene) {
  scene.background = new THREE.Color(0x07111f);
  scene.fog = new THREE.Fog(0x07111f, 7, 13);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0d1c2e, roughness: 0.93, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(12, 24, 0x1fbf91, 0x23364d);
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  grid.position.y = 0.006;
  scene.add(grid);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x102033, 1.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-3.5, 6, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x29e6b0, 2.2);
  rim.position.set(4, 3, 5);
  scene.add(rim);
}

function create(canvas, specification) {
  const profile = motionProfile(specification);
  if (!profile) throw new Error(`Der findes endnu ingen biomekanisk godkendt 3D-profil til ${specification?.exerciseName || "øvelsen"}.`);
  const width = Math.max(320, Math.round(canvas.clientWidth || 640));
  const height = Math.max(240, Math.round(canvas.clientHeight || 400));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  addSceneEnvironment(scene);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 30);
  camera.position.set(3.75, 2.35, -4.5);
  camera.lookAt(0, 0.48, 0.28);
  const mannequin = createMannequin(scene);
  const render = progress => {
    applyPushUpPose(mannequin, pushUpPose(progress));
    renderer.render(scene, camera);
  };
  render(0);
  return {
    version: VERSION,
    render,
    dispose() {
      scene.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(item => item.dispose?.());
        else object.material?.dispose?.();
      });
      renderer.dispose();
    }
  };
}

window.Work4itThreeRenderer = Object.freeze({ VERSION, supports, create });
window.dispatchEvent(new CustomEvent("work4it-three-renderer:ready"));
