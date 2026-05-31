import {
  getForwardVector,
  getYawDegrees,
  mountSharedScene,
  prepareSceneForAr,
  resetRigPose,
  resetScenePlacement,
  setScenePlacement
} from "./shared_scene.js";
import {
  createArSession,
  endSessionSafely,
  getFrame,
  getSessionSupport,
  getTrackingStatus,
  getViewerPose,
  requestMotionPermissionIfNeeded,
  waitForSceneReady
} from "./shared_xr.js";

const refs = mountSharedScene(document.getElementById("sceneHost"));
const startScreenEl = document.getElementById("startScreen");
const overlayEl = document.getElementById("overlay");
const supportLineEl = document.getElementById("supportLine");
const supportBadgeEl = document.getElementById("supportBadge");
const trackingNoticeEl = document.getElementById("trackingNotice");
const hintBarEl = document.getElementById("hintBar");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const recenterButton = document.getElementById("recenter");
const exitButton = document.getElementById("exitButton");

const state = {
  session: null,
  referenceSpace: null,
  viewerSpace: null,
  hitTestSource: null,
  referenceSpaceType: "local",
  scenePlaced: false,
  usedHitTest: false,
  fallbackPlacementUsed: false,
  placementFrames: 0,
  trackingStatus: "idle"
};

init();

async function init() {
  const supported = await getSessionSupport("immersive-ar");
  supportLineEl.textContent = supported
    ? "immersive-ar 対応を確認しました。"
    : "この端末では immersive-ar が使えません。";
  startButton.disabled = !supported;

  startButton.addEventListener("click", startExperience);
  recenterButton.addEventListener("click", recenterScene);
  exitButton.addEventListener("click", exitExperience);
  registerTick();

  resetScenePlacement(refs);
  resetRigPose(refs);
}

async function startExperience() {
  statusEl.textContent = "6DoF ビューを準備しています…";

  try {
    await waitForSceneReady(refs.sceneEl);
    await requestMotionPermissionIfNeeded();
    prepareSceneForAr(refs);
    resetRigPose(refs);
    resetPlacementState();

    const sessionState = await createArSession(refs.sceneEl, document.body);
    Object.assign(state, sessionState);
    state.session.addEventListener("end", onSessionEnd, { once: true });

    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    updateUi();
    statusEl.textContent = "";
  } catch (error) {
    resetScenePlacement(refs);
    statusEl.textContent = error.message || "6DoF の開始に失敗しました。";
  }
}

function registerTick() {
  const behavior = {
    tick: () => {
      if (!state.session || !state.referenceSpace) {
        return;
      }

      const frame = getFrame(refs.sceneEl);
      const viewerPose = getViewerPose(frame, state.referenceSpace);
      updateTracking(viewerPose);
      updatePlacement(frame, viewerPose);
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

function updateTracking(viewerPose) {
  const nextStatus = getTrackingStatus(viewerPose);
  if (state.trackingStatus !== nextStatus) {
    state.trackingStatus = nextStatus;
    updateUi();
  }
}

function updatePlacement(frame, viewerPose) {
  if (state.scenePlaced) {
    return;
  }

  state.placementFrames += 1;

  if (state.hitTestSource && frame) {
    const hits = frame.getHitTestResults(state.hitTestSource);
    if (hits.length > 0) {
      const hitPose = hits[0].getPose(state.referenceSpace);
      if (hitPose) {
        placeFromHitPose(hitPose, viewerPose);
        state.scenePlaced = true;
        state.usedHitTest = true;
        updateUi();
        return;
      }
    }
  }

  if (state.placementFrames < 45 || !viewerPose) {
    return;
  }

  placeFromViewerPose(viewerPose);
  state.scenePlaced = true;
  state.fallbackPlacementUsed = true;
  updateUi();
}

function placeFromHitPose(hitPose, viewerPose) {
  const yaw = viewerPose ? getYawDegrees(viewerPose.transform.orientation) : 0;
  const position = hitPose.transform.position;
  const heightOffset = state.referenceSpaceType === "local-floor" ? 1.15 : 0.1;
  setScenePlacement(refs, position.x, position.y + heightOffset, position.z, yaw);
}

function placeFromViewerPose(viewerPose) {
  const position = viewerPose.transform.position;
  const yaw = getYawDegrees(viewerPose.transform.orientation);
  const forward = getForwardVector(yaw);
  setScenePlacement(
    refs,
    position.x + forward.x * 1.8,
    position.y - 0.2,
    position.z + forward.z * 1.8,
    yaw
  );
}

function recenterScene() {
  const frame = getFrame(refs.sceneEl);
  const viewerPose = getViewerPose(frame, state.referenceSpace);
  if (!viewerPose) {
    statusEl.textContent = "現在位置を取得できませんでした。";
    return;
  }

  placeFromViewerPose(viewerPose);
  state.scenePlaced = true;
  state.fallbackPlacementUsed = true;
  updateUi();
  statusEl.textContent = "空間を今の視線の前へ置き直しました。";
}

async function exitExperience() {
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  await endSessionSafely(state);
  resetScenePlacement(refs);
  resetRigPose(refs);
  resetPlacementState();
  updateUi();
}

function onSessionEnd() {
  startScreenEl.classList.remove("hidden");
  overlayEl.classList.add("hidden");
  resetScenePlacement(refs);
  resetRigPose(refs);
  resetPlacementState();
  updateUi();
  statusEl.textContent = "6DoF セッションを終了しました。";
}

function resetPlacementState() {
  state.scenePlaced = false;
  state.usedHitTest = false;
  state.fallbackPlacementUsed = false;
  state.placementFrames = 0;
  state.trackingStatus = "idle";
}

function updateUi() {
  supportBadgeEl.classList.remove("hidden");
  supportBadgeEl.textContent = state.usedHitTest
    ? "床面検知で固定"
    : state.fallbackPlacementUsed
      ? "初期視線方向で固定"
      : "空間を固定中";

  hintBarEl.textContent = state.scenePlaced
    ? "前進すると橋に近づき、しゃがむと足元を覗き込みやすくなります。"
    : "床や前方へ端末を向けて少し動かし、空間の固定を待ってください。";

  if (state.trackingStatus === "emulated") {
    trackingNoticeEl.textContent =
      "この端末やブラウザでは位置追跡が使えず、見え方が 3DoF に近くなっています。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (state.trackingStatus === "unavailable") {
    trackingNoticeEl.textContent =
      "6DoF の位置情報を取得できません。位置移動で変化しない場合は非対応の可能性があります。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  if (!state.scenePlaced) {
    trackingNoticeEl.textContent =
      "空間をまだ固定していません。床や机に向けて少し動かしてください。";
    trackingNoticeEl.classList.remove("hidden");
    return;
  }

  trackingNoticeEl.textContent = "";
  trackingNoticeEl.classList.add("hidden");
}
