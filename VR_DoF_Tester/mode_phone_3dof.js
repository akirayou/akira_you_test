import { mountSharedScene, resetRigPose, resetScenePlacement } from "./shared_scene.js";
import { requestMotionPermissionIfNeeded, waitForSceneReady } from "./shared_xr.js";

const refs = mountSharedScene(document.getElementById("sceneHost"));
const overlayEl = document.getElementById("overlay");
const startScreenEl = document.getElementById("startScreen");
const statusEl = document.getElementById("status");
const startButton = document.getElementById("startButton");
const recenterButton = document.getElementById("recenter");

startButton.addEventListener("click", startExperience);
recenterButton.addEventListener("click", () => {
  resetRigPose(refs);
  statusEl.textContent = "視点を初期位置へ戻しました。";
});

resetScenePlacement(refs);
resetRigPose(refs);

async function startExperience() {
  statusEl.textContent = "起動準備中です…";

  try {
    await waitForSceneReady(refs.sceneEl);
    await requestMotionPermissionIfNeeded();
    resetScenePlacement(refs);
    resetRigPose(refs);
    startScreenEl.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message || "起動に失敗しました。";
  }
}
