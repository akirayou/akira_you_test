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
    ? "immersive-vr 対応を確認しました。"
    : "この端末では immersive-vr が使えません。";
  startButton.disabled = !supported;

  startButton.addEventListener("click", startExperience);
  exitButton.addEventListener("click", endExperience);
  window.addEventListener("resize", onResize);
}

function initScene() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x1a2433);

  state.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
  state.camera.position.set(0, 1.6, 0);

  state.renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance"
  });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.xr.enabled = true;
  appEl.appendChild(state.renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0x334455, 1.5);
  state.scene.add(light);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffb066 })
  );
  box.position.set(0, 1.4, -2);
  state.scene.add(box);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x7f92a3, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  state.scene.add(floor);

  state.renderer.setAnimationLoop(render);
}

async function startExperience() {
  statusEl.textContent = "デバッグセッションを開始しています…";

  try {
    await requestMotionPermissionIfNeeded();

    const session = await navigator.xr.requestSession("immersive-vr", {
      requiredFeatures: ["local-floor"]
    });
    await state.renderer.xr.setSession(session);

    state.xrSession = session;
    state.referenceSpace = await session.requestReferenceSpace("local-floor");
    state.xrSession.addEventListener("end", onSessionEnd, { once: true });
    state.trackingStatus = "starting";
    state.sampleCount = 0;
    state.lastDebugAt = 0;

    console.info("[VR_DoF_Tester][MinimalVR] session started", {
      referenceSpaceType: "local-floor"
    });

    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    updateUi();
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message || "デバッグ開始に失敗しました。";
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
  statusEl.textContent = "デバッグセッションを終了しました。";
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
    console.info("[VR_DoF_Tester][MinimalVR] tracking status", {
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

  console.info("[VR_DoF_Tester][MinimalVR] debug", {
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
  hintBarEl.textContent = "このページは最小構成です。pose が `emulated` なら、Cardboard 向け独自処理なしでも 3DoF 相当です。";

  if (state.trackingStatus === "tracked") {
    trackingNoticeEl.textContent = "位置追跡あり。viewerPosePosition.y を確認してください。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "emulated") {
    trackingNoticeEl.textContent = "この最小ページでも position は emulated です。ブラウザ実装側で 3DoF 相当です。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "unavailable") {
    trackingNoticeEl.textContent = "viewerPose を取得できません。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  trackingNoticeEl.textContent = "追跡状態を判定しています…";
  trackingNoticeEl.classList.remove("hidden");
}

function onResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}
