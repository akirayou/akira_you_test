import { mountSharedScene, resetRigPose, resetScenePlacement } from "./shared_scene.js";
import {
  createVrSession,
  endSessionSafely,
  getSessionSupport,
  requestMotionPermissionIfNeeded,
  waitForSceneReady
} from "./shared_xr.js";

const refs = mountSharedScene(document.getElementById("sceneHost"), {
  showCursor: true,
  webxr: "optionalFeatures: local-floor",
  renderer: "antialias: false; colorManagement: true; alpha: false"
});
const startScreenEl = document.getElementById("startScreen");
const overlayEl = document.getElementById("overlay");
const supportLineEl = document.getElementById("supportLine");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const exitButton = document.getElementById("exitButton");

const state = {
  session: null,
  referenceSpace: null
};

init();

async function init() {
  const supported = await getSessionSupport("immersive-vr");
  supportLineEl.textContent = supported
    ? "immersive-vr 対応を確認しました。"
    : "この端末では immersive-vr が使えません。";
  startButton.disabled = !supported;

  startButton.addEventListener("click", startExperience);
  exitButton.addEventListener("click", exitExperience);
  registerTick();

  resetScenePlacement(refs);
  resetRigPose(refs);
}

async function startExperience() {
  statusEl.textContent = "HMD 3DoF を準備しています…";

  try {
    await waitForSceneReady(refs.sceneEl);
    await requestMotionPermissionIfNeeded();
    resetScenePlacement(refs);
    resetRigPose(refs);

    const sessionState = await createVrSession(refs.sceneEl, "local-floor");
    Object.assign(state, sessionState);
    state.session.addEventListener("end", onSessionEnd, { once: true });

    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message || "HMD 3DoF の開始に失敗しました。";
  }
}

function registerTick() {
  const behavior = {
    tick: () => {
      if (!state.session) {
        return;
      }

      const headsetPosition = refs.mainCamera.object3D.position;
      refs.cameraRig.object3D.position.set(
        -headsetPosition.x,
        1.4 - headsetPosition.y,
        -headsetPosition.z
      );
    }
  };

  if (refs.sceneEl.hasLoaded) {
    refs.sceneEl.addBehavior(behavior);
    return;
  }

  refs.sceneEl.addEventListener("loaded", () => {
    refs.sceneEl.addBehavior(behavior);
  }, { once: true });
}

async function exitExperience() {
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  await endSessionSafely(state);
  resetScenePlacement(refs);
  resetRigPose(refs);
}

function onSessionEnd() {
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  resetScenePlacement(refs);
  resetRigPose(refs);
  statusEl.textContent = "HMD 3DoF セッションを終了しました。";
}
