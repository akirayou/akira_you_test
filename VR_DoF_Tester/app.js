const sceneEl = document.getElementById("scene");
const cameraRig = document.getElementById("cameraRig");
const mainCamera = document.getElementById("mainCamera");
const gazeCursor = document.getElementById("gazeCursor");
const cityEl = document.getElementById("city");

const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");
const statusEl = document.getElementById("status");
const overlayEl = document.getElementById("overlay");
const modeLabel = document.getElementById("modeLabel");
const mode3MonoButton = document.getElementById("mode3Mono");
const mode3StereoButton = document.getElementById("mode3Stereo");
const mode6Button = document.getElementById("mode6");
const recenterButton = document.getElementById("recenter");

const state = {
  currentMode: "3dof-mono",
  started: false,
  immersiveVrSupported: false,
  threeDofStereoLockActive: false
};

init();

function init() {
  buildCity();
  bindEvents();
  registerThreeDofStereoLock();
  checkVrSupport();
}

function bindEvents() {
  startButton.addEventListener("click", startExperience);
  mode3MonoButton.addEventListener("click", () => switchMode("3dof-mono"));
  mode3StereoButton.addEventListener("click", () => switchMode("3dof-stereo"));
  mode6Button.addEventListener("click", () => switchMode("6dof"));
  recenterButton.addEventListener("click", recenterView);

  sceneEl.addEventListener("enter-vr", updateUi);
  sceneEl.addEventListener("exit-vr", onExitVr);
}

function onExitVr() {
  if (!state.started) {
    return;
  }

  state.currentMode = "3dof-mono";
  stopThreeDofStereoLock();
  setReferenceSpace("local-floor");
  lockThreeDofPose();
  updateUi();
}

async function checkVrSupport() {
  if (!navigator.xr) {
    statusEl.textContent = "このブラウザは WebXR に対応していません。3DoF 単眼のみ試せます。";
    return;
  }

  try {
    state.immersiveVrSupported = await navigator.xr.isSessionSupported("immersive-vr");
    if (!state.immersiveVrSupported) {
      statusEl.textContent =
        "immersive-vr が使えないため、3DoF ゴーグルと 6DoF は端末依存になります。";
    }
  } catch (_error) {
    statusEl.textContent = "VR対応確認に失敗しました。3DoF 単眼はそのまま試せます。";
  }
}

async function startExperience() {
  statusEl.textContent = "起動準備中です…";

  try {
    await requestMotionPermissionIfNeeded();
    state.started = true;
    startScreen.classList.add("hidden");
    overlayEl.classList.remove("hidden");
    await switchMode("3dof-mono");
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message || "起動に失敗しました。";
  }
}

async function requestMotionPermissionIfNeeded() {
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== "granted") {
      throw new Error("モーションセンサーの許可が必要です。");
    }
  }
}

async function switchMode(mode) {
  state.currentMode = mode;

  if (mode === "3dof-mono") {
    if (sceneEl.is("vr-mode")) {
      sceneEl.exitVR();
    }
    stopThreeDofStereoLock();
    setReferenceSpace("local-floor");
    lockThreeDofPose();
    updateUi();
    return;
  }

  if (mode === "3dof-stereo") {
    if (!state.immersiveVrSupported) {
      statusEl.textContent = "この端末では 3DoF ゴーグル表示に未対応です。";
      state.currentMode = "3dof-mono";
      updateUi();
      return;
    }

    try {
      statusEl.textContent = "3DoF ゴーグル表示へ切り替えています…";
      stopThreeDofStereoLock();
      setReferenceSpace("local-floor");
      lockThreeDofPose();
      await sceneEl.enterVR();
      startThreeDofStereoLock();
      gazeCursor.setAttribute("visible", true);
      updateUi();
      statusEl.textContent = "";
    } catch (_error) {
      state.currentMode = "3dof-mono";
      setReferenceSpace("local-floor");
      lockThreeDofPose();
      updateUi();
      statusEl.textContent = "3DoF ゴーグル表示へ入れませんでした。";
    }
    return;
  }

  if (!navigator.xr) {
    statusEl.textContent = "この端末では WebXR が使えません。";
    state.currentMode = "3dof-mono";
    updateUi();
    return;
  }

  if (!state.immersiveVrSupported) {
    statusEl.textContent = "この端末では immersive-vr に未対応です。";
    state.currentMode = "3dof-mono";
    updateUi();
    return;
  }

  try {
    statusEl.textContent = "6DoF モードへ切り替えています…";
    stopThreeDofStereoLock();
    setReferenceSpace("local-floor");
    await sceneEl.enterVR();
    gazeCursor.setAttribute("visible", true);
    updateUi();
    statusEl.textContent = "";
  } catch (_error) {
    state.currentMode = "3dof-mono";
    setReferenceSpace("local-floor");
    lockThreeDofPose();
    updateUi();
    statusEl.textContent = "6DoF モードへ入れませんでした。";
  }
}

function lockThreeDofPose() {
  cameraRig.setAttribute("position", "0 1.4 0");
  mainCamera.setAttribute("position", "0 0 0");
  mainCamera.components["look-controls"]?.pitchObject.rotation.set(0, 0, 0);
  mainCamera.components["look-controls"]?.yawObject.rotation.set(0, 0, 0);
  gazeCursor.setAttribute("visible", state.currentMode !== "3dof-mono");
}

function startThreeDofStereoLock() {
  state.threeDofStereoLockActive = true;
}

function stopThreeDofStereoLock() {
  state.threeDofStereoLockActive = false;
}

function maintainThreeDofStereoPose() {
  if (!state.threeDofStereoLockActive || state.currentMode !== "3dof-stereo" || !sceneEl.is("vr-mode")) {
    return;
  }

  const headsetPosition = mainCamera.object3D.position;
  cameraRig.object3D.position.set(-headsetPosition.x, 1.4 - headsetPosition.y, -headsetPosition.z);
}

function recenterView() {
  if (state.currentMode === "6dof" && sceneEl.is("vr-mode")) {
    statusEl.textContent = "6DoF 中の視点リセットは端末側のVR機能に依存します。";
    return;
  }

  lockThreeDofPose();
  statusEl.textContent = "視点をアイレベル 140cm の初期位置へ戻しました。";
}

function updateUi() {
  mode3MonoButton.classList.toggle("active", state.currentMode === "3dof-mono");
  mode3StereoButton.classList.toggle("active", state.currentMode === "3dof-stereo");
  mode6Button.classList.toggle("active", state.currentMode === "6dof");

  mode3MonoButton.classList.toggle("secondary", state.currentMode !== "3dof-mono");
  mode3StereoButton.classList.toggle("secondary", state.currentMode !== "3dof-stereo");
  mode6Button.classList.toggle("secondary", state.currentMode !== "6dof");

  if (state.currentMode === "3dof-mono") {
    modeLabel.textContent = "3DoF 単眼: 回転のみ / 位置固定 / アイレベル140cm";
  } else if (state.currentMode === "3dof-stereo") {
    modeLabel.textContent = "3DoF ゴーグル: 両眼立体視 / 位置固定 / アイレベル140cm";
  } else {
    modeLabel.textContent = "6DoF: 位置トラッキングあり / アイレベル140cm基準";
  }
}

function setReferenceSpace(referenceSpaceType) {
  sceneEl.setAttribute(
    "webxr",
    `referenceSpaceType: ${referenceSpaceType}; optionalFeatures: local-floor, bounded-floor, hand-tracking`
  );
}

function buildCity() {
  const buildings = [];
  const lanes = [-16, -12, -8, -4, 4, 8, 12, 16];

  for (let z = -8; z > -84; z -= 5) {
    for (const x of lanes) {
      const jitterX = x + randomRange(-1.2, 1.2);
      const width = randomRange(1.2, 3.8);
      const depth = randomRange(1.2, 3.8);
      const height = randomRange(18, 72);
      const y = -height / 2 - 10 - randomRange(0, 24);
      const color = randomChoice(["#263349", "#2e3d56", "#39465d", "#1f2938"]);

      buildings.push(
        makeEntity("a-box", {
          position: `${jitterX.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`,
          width: width.toFixed(2),
          height: height.toFixed(2),
          depth: depth.toFixed(2),
          color,
          shadow: "cast: false; receive: true"
        })
      );

      if (Math.random() > 0.55) {
        buildings.push(
          makeEntity("a-box", {
            position: `${jitterX.toFixed(2)} ${(y + height / 2 + 1.3).toFixed(2)} ${z.toFixed(2)}`,
            width: (width * 0.25).toFixed(2),
            height: "2.6",
            depth: (depth * 0.25).toFixed(2),
            color: "#7388aa"
          })
        );
      }
    }
  }

  const fogLayer = makeEntity("a-cylinder", {
    position: "0 -34 -35",
    radius: "60",
    height: "0.2",
    color: "#a5d7ff",
    material: "opacity: 0.08; transparent: true",
    rotation: "0 0 0"
  });

  buildings.forEach((building) => cityEl.appendChild(building));
  cityEl.appendChild(fogLayer);
}

function makeEntity(tagName, attributes) {
  const entity = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => entity.setAttribute(key, value));
  return entity;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function registerThreeDofStereoLock() {
  if (sceneEl.hasLoaded) {
    sceneEl.addBehavior({
      tick: maintainThreeDofStereoPose
    });
    return;
  }

  sceneEl.addEventListener("loaded", () => {
    sceneEl.addBehavior({
      tick: maintainThreeDofStereoPose
    });
  }, { once: true });
}
