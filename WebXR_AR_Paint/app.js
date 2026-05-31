import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const COLORS = ["#ff835c", "#ffd166", "#4cc9f0", "#80ed99", "#f72585", "#f4f7fb"];

const app = document.getElementById("app");
const overlay = document.getElementById("overlay");
const hintBar = document.getElementById("hintBar");
const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");
const status = document.getElementById("status");
const swatches = document.getElementById("swatches");
const sizeInput = document.getElementById("size");
const sizeValue = document.getElementById("sizeValue");
const undoButton = document.getElementById("undo");
const clearButton = document.getElementById("clear");

const state = {
  renderer: null,
  scene: null,
  camera: null,
  xrSession: null,
  referenceSpace: null,
  viewerSpace: null,
  hitTestSource: null,
  reticle: null,
  brushPreview: null,
  brushColor: COLORS[0],
  brushSize: Number(sizeInput.value),
  isDrawing: false,
  activeStroke: null,
  strokes: [],
  brushOffset: new THREE.Vector3(0, -0.02, -0.3),
  scratchMatrix: new THREE.Matrix4(),
  scratchPosition: new THREE.Vector3(),
  scratchQuaternion: new THREE.Quaternion(),
  scratchScale: new THREE.Vector3()
};

init();

function init() {
  initUi();
  initScene();
  checkSupport();
}

function initUi() {
  buildColorButtons();
  bindSizeSlider();
  bindActionButtons();
  bindPointerDrawing();
}

function buildColorButtons() {
  COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.style.background = color;
    if (color === state.brushColor) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => selectColor(color, button));
    swatches.appendChild(button);
  });
}

function selectColor(color, button) {
  state.brushColor = color;
  [...swatches.children].forEach((node) => node.classList.remove("active"));
  button.classList.add("active");

  if (state.brushPreview) {
    state.brushPreview.material.color.set(color);
    state.brushPreview.material.emissive.set(color);
  }
}

function bindSizeSlider() {
  updateSizeLabel();
  sizeInput.addEventListener("input", () => {
    state.brushSize = Number(sizeInput.value);
    updateSizeLabel();
    if (state.brushPreview) {
      state.brushPreview.scale.setScalar(state.brushSize * 0.9);
    }
  });
}

function updateSizeLabel() {
  sizeValue.textContent = `${(state.brushSize * 100).toFixed(1)}cm`;
}

function bindActionButtons() {
  undoButton.addEventListener("click", undoStroke);
  clearButton.addEventListener("click", clearStrokes);
}

function bindPointerDrawing() {
  const startDraw = (event) => {
    event.preventDefault();
    if (!state.xrSession || isUiInteraction(event.target)) {
      return;
    }
    state.isDrawing = true;
    state.activeStroke = null;
  };

  const stopDraw = (event) => {
    event.preventDefault();
    state.isDrawing = false;
    state.activeStroke = null;
  };

  window.addEventListener("pointerdown", startDraw, { passive: false });
  window.addEventListener("pointerup", stopDraw, { passive: false });
  window.addEventListener("pointercancel", stopDraw, { passive: false });
}

function initScene() {
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.xr.enabled = true;
  app.appendChild(state.renderer.domElement);

  addLights();
  createReticle();
  createBrushPreview();

  state.renderer.setAnimationLoop(render);
  window.addEventListener("resize", onResize);
}

function addLights() {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 1.4);
  state.scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1, 2, 1);
  state.scene.add(dirLight);
}

function createReticle() {
  state.reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.065, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x80ed99 })
  );
  state.reticle.matrixAutoUpdate = false;
  state.reticle.visible = false;
  state.scene.add(state.reticle);
}

function createBrushPreview() {
  state.brushPreview = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshStandardMaterial({
      color: state.brushColor,
      emissive: new THREE.Color(state.brushColor),
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.05
    })
  );
  state.brushPreview.scale.setScalar(state.brushSize * 0.9);
  state.scene.add(state.brushPreview);
}

async function checkSupport() {
  if (!navigator.xr) {
    status.textContent = "このブラウザは WebXR に対応していません。";
    startButton.disabled = true;
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) {
      status.textContent = "この端末では immersive-ar を利用できません。";
      startButton.disabled = true;
      return;
    }

    status.textContent = "対応を確認しました。AR開始の準備ができています。";
    startButton.addEventListener("click", startAr);
  } catch (error) {
    status.textContent = `対応確認に失敗しました: ${error.message}`;
    startButton.disabled = true;
  }
}

async function startAr() {
  try {
    status.textContent = "ARセッションを開始しています…";
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.body }
    });

    state.renderer.xr.setReferenceSpaceType("local");
    await state.renderer.xr.setSession(session);
    state.xrSession = session;
    state.xrSession.addEventListener("end", onSessionEnd);
    state.referenceSpace = await state.xrSession.requestReferenceSpace("local");

    try {
      state.viewerSpace = await state.xrSession.requestReferenceSpace("viewer");
      state.hitTestSource = await state.xrSession.requestHitTestSource({ space: state.viewerSpace });
    } catch (_error) {
      state.hitTestSource = null;
    }

    overlay.classList.remove("hidden");
    hintBar.classList.remove("hidden");
    startScreen.classList.add("hidden");
    status.textContent = "";
  } catch (error) {
    status.textContent = `AR開始に失敗しました: ${error.message}`;
  }
}

function onSessionEnd() {
  if (state.hitTestSource) {
    state.hitTestSource.cancel();
  }

  state.xrSession = null;
  state.referenceSpace = null;
  state.viewerSpace = null;
  state.hitTestSource = null;
  state.reticle.visible = false;

  overlay.classList.add("hidden");
  hintBar.classList.add("hidden");
  startScreen.classList.remove("hidden");
  status.textContent = "ARセッションを終了しました。もう一度開始できます。";
}

function render(_time, frame) {
  if (frame && state.xrSession && state.referenceSpace) {
    updateHitTest(frame);
    updateBrushPose();
    if (state.isDrawing) {
      appendPaintPoint();
    }
  }

  state.renderer.render(state.scene, state.camera);
}

function updateHitTest(frame) {
  if (!state.hitTestSource) {
    state.reticle.visible = false;
    return;
  }

  const hitTestResults = frame.getHitTestResults(state.hitTestSource);
  if (hitTestResults.length > 0) {
    const pose = hitTestResults[0].getPose(state.referenceSpace);
    state.reticle.visible = true;
    state.reticle.matrix.fromArray(pose.transform.matrix);
  } else {
    state.reticle.visible = false;
  }
}

function updateBrushPose() {
  const xrCamera = state.renderer.xr.getCamera(state.camera);
  state.scratchMatrix.copy(xrCamera.matrixWorld);
  state.scratchMatrix.decompose(
    state.scratchPosition,
    state.scratchQuaternion,
    state.scratchScale
  );

  const brushWorld = state.brushOffset
    .clone()
    .applyQuaternion(state.scratchQuaternion)
    .add(state.scratchPosition);

  state.brushPreview.position.copy(brushWorld);
}

function appendPaintPoint() {
  const point = state.brushPreview.position.clone();

  if (!state.activeStroke) {
    state.activeStroke = createStroke(state.brushColor, state.brushSize, point);
    state.strokes.push(state.activeStroke);
    state.scene.add(state.activeStroke.group);
    return;
  }

  const lastPoint = state.activeStroke.points[state.activeStroke.points.length - 1];
  if (lastPoint.distanceTo(point) < state.brushSize * 0.35) {
    return;
  }

  state.activeStroke.points.push(point);
  addSegment(state.activeStroke, lastPoint, point);
}

function createStroke(color, radius, startPoint) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.25,
    roughness: 0.55,
    metalness: 0.05
  });

  group.add(makeDot(startPoint, radius, material));

  return {
    color,
    radius,
    group,
    material,
    points: [startPoint.clone()]
  };
}

function addSegment(stroke, from, to) {
  stroke.group.add(makeDot(to, stroke.radius, stroke.material));
  stroke.group.add(makeSegment(from, to, stroke.radius, stroke.material));
}

function makeDot(position, radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), material);
  mesh.position.copy(position);
  return mesh;
}

function makeSegment(from, to, radius, material) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10, 1, true),
    material
  );

  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function undoStroke() {
  const stroke = state.strokes.pop();
  if (!stroke) {
    return;
  }
  state.scene.remove(stroke.group);
}

function clearStrokes() {
  while (state.strokes.length > 0) {
    state.scene.remove(state.strokes.pop().group);
  }
}

function onResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function isUiInteraction(target) {
  return target instanceof Element && target.closest(".toolbar, .start-card");
}
