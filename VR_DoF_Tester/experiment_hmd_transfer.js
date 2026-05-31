import * as THREE from "https://unpkg.com/three@0.173.0/build/three.module.js";
import { getSessionSupport, requestMotionPermissionIfNeeded } from "./shared_xr.js";

const IPD = 0.032;

const appEl = document.getElementById("app");
const startScreenEl = document.getElementById("startScreen");
const overlayEl = document.getElementById("overlay");
const supportLineEl = document.getElementById("supportLine");
const trackingNoticeEl = document.getElementById("trackingNotice");
const orientationNoticeEl = document.getElementById("orientationNotice");
const hintBarEl = document.getElementById("hintBar");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const exitButton = document.getElementById("exitButton");

const state = {
  renderer: null,
  gl: null,
  scene: null,
  leftCamera: null,
  rightCamera: null,
  xrSession: null,
  xrLayer: null,
  referenceSpace: null,
  trackingStatus: "idle",
  sampleCount: 0,
  lastDebugAt: 0,
  scratchPosition: new THREE.Vector3(),
  scratchQuaternion: new THREE.Quaternion(),
  scratchScale: new THREE.Vector3(),
  headMatrix: new THREE.Matrix4(),
  leftOffset: new THREE.Vector3(-IPD, 0, 0),
  rightOffset: new THREE.Vector3(IPD, 0, 0),
  eyeLayout: null
};

init();

async function init() {
  initScene();

  const supported = await getSessionSupport("immersive-ar");
  supportLineEl.textContent = supported
    ? "immersive-ar 対応を確認しました。pose 転送実験を開始できます。"
    : "この端末では immersive-ar が使えません。";
  startButton.disabled = !supported;

  startButton.addEventListener("click", startExperiment);
  exitButton.addEventListener("click", endExperiment);
  window.addEventListener("resize", onResize);
  updateOrientationNotice();
}

function initScene() {
  state.renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance"
  });
  state.renderer.autoClear = false;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  appEl.appendChild(state.renderer.domElement);

  state.gl = state.renderer.getContext();
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x6f9ec9);

  state.leftCamera = new THREE.PerspectiveCamera(70, (window.innerWidth / 2) / window.innerHeight, 0.01, 200);
  state.rightCamera = new THREE.PerspectiveCamera(70, (window.innerWidth / 2) / window.innerHeight, 0.01, 200);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.4);
  state.scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.0);
  sun.position.set(-1, 4, 2);
  state.scene.add(sun);

  buildWorld();
}

function buildWorld() {
  const root = new THREE.Group();
  state.scene.add(root);

  const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0xb7c4cf,
    roughness: 0.92,
    metalness: 0.04
  });
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xb98858,
    roughness: 0.95,
    metalness: 0.02
  });

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.18, 48), platformMaterial);
  disk.position.set(0, -0.06, 0.55);
  root.add(disk);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 5), woodMaterial);
  bridge.position.set(0, 0.02, -2.85);
  root.add(bridge);

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 28, 0.18, 80),
    new THREE.MeshStandardMaterial({ color: 0x8ea0b1, roughness: 1 })
  );
  ground.position.set(0, -4.06, -16);
  root.add(ground);

  for (let z = -8; z > -84; z -= 5) {
    for (const x of [-16, -12, -8, -4, 4, 8, 12, 16]) {
      const width = 1.2 + Math.random() * 2.6;
      const depth = 1.2 + Math.random() * 2.6;
      const height = 4.6 + Math.random() * 11.4;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHex([0x6f7f92, 0x8090a0, 0x92a3b2, 0x647384][Math.floor(Math.random() * 4)])
        })
      );
      building.position.set(x + (Math.random() * 2.4 - 1.2), -4.06 + height / 2, z);
      root.add(building);
    }
  }
}

async function startExperiment() {
  statusEl.textContent = "pose 転送実験を開始しています…";

  try {
    await requestMotionPermissionIfNeeded();
    await tryLockLandscape();
    await state.gl.makeXRCompatible();

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local-floor"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: document.body }
    });

    state.xrLayer = new XRWebGLLayer(session, state.gl);
    session.updateRenderState({ baseLayer: state.xrLayer });
    state.referenceSpace = await session.requestReferenceSpace("local-floor");
    state.xrSession = session;
    state.xrSession.addEventListener("end", onSessionEnd, { once: true });
    state.trackingStatus = "starting";
    state.sampleCount = 0;
    state.lastDebugAt = 0;

    console.info("[VR_DoF_Tester][PoseTransfer] session started", {
      referenceSpaceType: "local-floor",
      drawing: "manual stereo split"
    });

    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    updateUi();
    statusEl.textContent = "";

    state.xrSession.requestAnimationFrame(onXRFrame);
  } catch (error) {
    statusEl.textContent = error.message || "pose 転送実験の開始に失敗しました。";
  }
}

async function endExperiment() {
  if (state.xrSession) {
    const session = state.xrSession;
    state.xrSession = null;
    state.xrLayer = null;
    state.referenceSpace = null;
    await session.end();
  }

  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  state.trackingStatus = "idle";
  updateUi();
}

function onSessionEnd() {
  state.xrSession = null;
  state.xrLayer = null;
  state.referenceSpace = null;
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  state.trackingStatus = "idle";
  updateUi();
  statusEl.textContent = "pose 転送実験を終了しました。";
}

function onXRFrame(_time, frame) {
  if (!state.xrSession || !state.xrLayer || !state.referenceSpace) {
    return;
  }

  state.xrSession.requestAnimationFrame(onXRFrame);

  const pose = safeGetViewerPose(frame, state.referenceSpace);
  state.sampleCount += 1;
  updateTrackingStatus(pose);

  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.xrLayer.framebuffer);

  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  state.eyeLayout = computeEyeLayout(width, height);
  const { leftViewport, rightViewport } = state.eyeLayout;

  state.renderer.setScissorTest(true);
  state.renderer.setViewport(0, 0, width, height);
  state.renderer.setScissor(0, 0, width, height);
  state.renderer.clear(true, true, true);

  if (pose) {
    updateStereoCameras(pose, leftViewport.width / leftViewport.height);

    state.renderer.setViewport(
      leftViewport.x,
      leftViewport.y,
      leftViewport.width,
      leftViewport.height
    );
    state.renderer.setScissor(
      leftViewport.x,
      leftViewport.y,
      leftViewport.width,
      leftViewport.height
    );
    state.renderer.render(state.scene, state.leftCamera);

    state.renderer.setViewport(
      rightViewport.x,
      rightViewport.y,
      rightViewport.width,
      rightViewport.height
    );
    state.renderer.setScissor(
      rightViewport.x,
      rightViewport.y,
      rightViewport.width,
      rightViewport.height
    );
    state.renderer.render(state.scene, state.rightCamera);
  }

  state.renderer.setScissorTest(false);
  maybeLogDebug(pose);
}

function updateStereoCameras(pose, eyeAspect) {
  state.headMatrix.fromArray(pose.transform.matrix);
  state.headMatrix.decompose(
    state.scratchPosition,
    state.scratchQuaternion,
    state.scratchScale
  );

  const leftWorld = state.leftOffset.clone().applyQuaternion(state.scratchQuaternion).add(state.scratchPosition);
  const rightWorld = state.rightOffset.clone().applyQuaternion(state.scratchQuaternion).add(state.scratchPosition);

  configureEyeCamera(state.leftCamera, leftWorld, eyeAspect);
  configureEyeCamera(state.rightCamera, rightWorld, eyeAspect);
}

function configureEyeCamera(camera, position, aspect) {
  camera.aspect = aspect;
  camera.position.copy(position);
  camera.quaternion.copy(state.scratchQuaternion);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function updateTrackingStatus(pose) {
  const nextStatus = !pose
    ? "unavailable"
    : pose.emulatedPosition
      ? "emulated"
      : "tracked";

  if (state.trackingStatus !== nextStatus) {
    state.trackingStatus = nextStatus;
    console.info("[VR_DoF_Tester][PoseTransfer] tracking status", {
      status: nextStatus,
      sampleCount: state.sampleCount
    });
    updateUi();
  }
}

function maybeLogDebug(pose) {
  const now = performance.now();
  if (now - state.lastDebugAt < 1000) {
    return;
  }

  state.lastDebugAt = now;

  console.info("[VR_DoF_Tester][PoseTransfer] debug", {
    trackingStatus: state.trackingStatus,
    sampleCount: state.sampleCount,
    viewerPosePosition: pose
      ? {
          x: pose.transform.position.x,
          y: pose.transform.position.y,
          z: pose.transform.position.z
        }
      : null,
    leftCameraPosition: {
      x: state.leftCamera.position.x,
      y: state.leftCamera.position.y,
      z: state.leftCamera.position.z
    },
    rightCameraPosition: {
      x: state.rightCamera.position.x,
      y: state.rightCamera.position.y,
      z: state.rightCamera.position.z
    }
  });
}

function safeGetViewerPose(frame, referenceSpace) {
  try {
    return frame.getViewerPose(referenceSpace);
  } catch (_error) {
    return null;
  }
}

function updateUi() {
  hintBarEl.textContent = state.trackingStatus === "tracked"
    ? "この実験は pose を直接 stereo へ転送します。しゃがみで viewerPosePosition.y が変わるかを確認してください。"
    : "tracked にならない場合、pose 取得元そのものが 3DoF 相当です。";
  updateOrientationNotice();

  if (state.trackingStatus === "tracked") {
    trackingNoticeEl.textContent = "位置追跡あり。pose を stereo 描画へ転送中です。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "emulated") {
    trackingNoticeEl.textContent = "pose 取得元の immersive-ar でも emulated です。この端末/ブラウザでは 6DoF が取れていません。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "unavailable") {
    trackingNoticeEl.textContent = "viewerPose を取得できません。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  trackingNoticeEl.textContent = "pose 状態を判定しています…";
  trackingNoticeEl.classList.remove("hidden");
}

function onResize() {
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  updateOrientationNotice();
}

async function tryLockLandscape() {
  if (!screen.orientation?.lock) {
    return;
  }

  try {
    await screen.orientation.lock("landscape");
  } catch (_error) {
    // Some browsers require fullscreen or user settings; fall back to warning only.
  }
}

function updateOrientationNotice() {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait) {
    orientationNoticeEl.textContent = "横向き推奨です。Cardboard に入れる前に端末を landscape にしてください。";
    orientationNoticeEl.classList.remove("hidden");
    return;
  }

  orientationNoticeEl.textContent = "";
  orientationNoticeEl.classList.add("hidden");
}

function computeEyeLayout(width, height) {
  const halfWidth = width / 2;
  const eyeWidth = Math.floor(halfWidth * 0.86);
  const eyeHeight = Math.floor(height * 0.82);
  const y = Math.floor((height - eyeHeight) / 2);

  const leftX = Math.floor((halfWidth - eyeWidth) / 2);
  const rightX = Math.floor(halfWidth + (halfWidth - eyeWidth) / 2);

  return {
    leftViewport: {
      x: leftX,
      y,
      width: eyeWidth,
      height: eyeHeight
    },
    rightViewport: {
      x: rightX,
      y,
      width: eyeWidth,
      height: eyeHeight
    }
  };
}
