import * as THREE from "https://unpkg.com/three@0.173.0/build/three.module.js";
import { getSessionSupport, requestMotionPermissionIfNeeded } from "./shared_xr.js";

const appEl = document.getElementById("app");
const startScreenEl = document.getElementById("startScreen");
const overlayEl = document.getElementById("overlay");
const supportLineEl = document.getElementById("supportLine");
const trackingNoticeEl = document.getElementById("trackingNotice");
const hintBarEl = document.getElementById("hintBar");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const exitButton = document.getElementById("exitButton");

const state = {
  renderer: null,
  scene: null,
  camera: null,
  xrSession: null,
  referenceSpace: null,
  trackingStatus: "idle",
  sampleCount: 0,
  lastDebugAt: 0
};

init();

async function init() {
  initScene();

  const supported = await getSessionSupport("immersive-vr");
  supportLineEl.textContent = supported
    ? "immersive-vr 対応を確認しました。Three.js 直描画で位置追跡を検証します。"
    : "この端末では immersive-vr が使えません。";
  startButton.disabled = !supported;

  startButton.addEventListener("click", startExperience);
  exitButton.addEventListener("click", endExperience);
  window.addEventListener("resize", onResize);
}

function initScene() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x6f9ec9);

  state.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);
  state.camera.position.set(0, 1.4, 0);

  state.renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance"
  });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.xr.enabled = true;
  appEl.appendChild(state.renderer.domElement);

  buildLights();
  buildWorld();
  state.renderer.setAnimationLoop(render);
}

function buildLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x4e6578, 1.5);
  state.scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 1.15);
  sun.position.set(-1, 4, 2);
  state.scene.add(sun);
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
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0x5e6775,
    roughness: 0.96
  });

  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.18, 48), platformMaterial);
  disk.position.set(0, -0.06, 0.55);
  root.add(disk);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 5), woodMaterial);
  bridge.position.set(0, 0.02, -2.85);
  root.add(bridge);

  const pillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 4.05, 0.46), pillarMaterial);
  pillar1.position.set(0, -2.1, 0.55);
  root.add(pillar1);

  const pillar2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.08, 0.22), pillarMaterial);
  pillar2.position.set(0, -2.12, -2.85);
  root.add(pillar2);

  const pillar3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.08, 0.7), pillarMaterial);
  pillar3.position.set(0, -2.12, -5.25);
  root.add(pillar3);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.62, 1.89, 64),
    new THREE.MeshBasicMaterial({ color: 0xf2f7ff, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.041, 0.55);
  root.add(ring);

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

async function startExperience() {
  statusEl.textContent = "HMD 6DoF 実験を開始しています…";

  try {
    await requestMotionPermissionIfNeeded();

    const session = await navigator.xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"]
    });
    await state.renderer.xr.setSession(session);

    state.xrSession = session;
    state.xrSession.addEventListener("end", onSessionEnd, { once: true });
    state.referenceSpace = await state.xrSession.requestReferenceSpace("local-floor");
    state.trackingStatus = "starting";
    state.sampleCount = 0;
    state.lastDebugAt = 0;

    console.info("[VR_DoF_Tester][HMD6DoF/Three] session started", {
      referenceSpaceType: "local-floor"
    });

    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    updateUi();
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message || "HMD 6DoF 実験の開始に失敗しました。";
  }
}

async function endExperience() {
  if (state.xrSession) {
    const session = state.xrSession;
    state.xrSession = null;
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
  state.referenceSpace = null;
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  state.trackingStatus = "idle";
  updateUi();
  statusEl.textContent = "HMD 6DoF 実験を終了しました。";
}

function render(_time, frame) {
  if (frame && state.xrSession && state.referenceSpace) {
    updateTracking(frame);
  }

  state.renderer.render(state.scene, state.camera);
}

function updateTracking(frame) {
  const viewerPose = safeGetViewerPose(frame, state.referenceSpace);
  state.sampleCount += 1;

  const nextStatus = !viewerPose
    ? "unavailable"
    : viewerPose.emulatedPosition
      ? "emulated"
      : "tracked";

  if (state.trackingStatus !== nextStatus) {
    state.trackingStatus = nextStatus;
    console.info("[VR_DoF_Tester][HMD6DoF/Three] tracking status", {
      status: nextStatus,
      sampleCount: state.sampleCount
    });
    updateUi();
  }

  maybeLogDebug(viewerPose);
}

function maybeLogDebug(viewerPose) {
  const now = performance.now();
  if (now - state.lastDebugAt < 1000) {
    return;
  }

  state.lastDebugAt = now;
  const xrCamera = state.renderer.xr.getCamera(state.camera);

  console.info("[VR_DoF_Tester][HMD6DoF/Three] debug", {
    trackingStatus: state.trackingStatus,
    sampleCount: state.sampleCount,
    viewerPosePosition: viewerPose
      ? {
          x: viewerPose.transform.position.x,
          y: viewerPose.transform.position.y,
          z: viewerPose.transform.position.z
        }
      : null,
    xrCameraPosition: {
      x: xrCamera.position.x,
      y: xrCamera.position.y,
      z: xrCamera.position.z
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
    ? "前進やしゃがみで viewerPosePosition.y と xrCameraPosition が変わるかをコンソールで確認してください。"
    : "位置追跡が取れない場合、この実験ページは 3DoF 相当か描画失敗の可能性があります。";

  if (state.trackingStatus === "tracked") {
    trackingNoticeEl.textContent =
      "位置追跡あり。コンソールの viewerPosePosition.y と xrCameraPosition.y を確認してください。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "emulated") {
    trackingNoticeEl.textContent =
      "この端末では位置追跡が使えず、HMD 6DoF 実験は 3DoF に近い見え方になっています。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "unavailable") {
    trackingNoticeEl.textContent =
      "viewerPose を取得できません。描画経路かブラウザの WebXR 実装を疑ってください。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  trackingNoticeEl.textContent = "位置追跡の状態を判定しています…";
  trackingNoticeEl.classList.remove("hidden");
}

function onResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}
