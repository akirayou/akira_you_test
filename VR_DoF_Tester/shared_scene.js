export function mountSharedScene(host, options = {}) {
  const {
    showCursor = false,
    webxr = "optionalFeatures: local-floor, hit-test, dom-overlay; overlayElement: body",
    renderer = "antialias: true; colorManagement: true; alpha: true"
  } = options;

  host.innerHTML = `
    <a-scene
      id="scene"
      embedded
      background="color: #06111c"
      renderer="${renderer}"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      xr-mode-ui="enabled: false"
      webxr="${webxr}"
    >
      <a-assets>
        <canvas id="groundPattern" width="512" height="512"></canvas>
        <canvas id="platformPattern" width="512" height="512"></canvas>
      </a-assets>

      <a-entity light="type: ambient; color: #c8dcff; intensity: 1.1"></a-entity>
      <a-entity light="type: directional; color: #fff3d6; intensity: 1.15" position="-1 4 2"></a-entity>
      <a-entity light="type: directional; color: #92ddff; intensity: 0.7" position="2 2 -3"></a-entity>

      <a-sky id="sceneSky" color="#6f9ec9"></a-sky>
      <a-entity
        id="sceneDome"
        geometry="primitive: sphere; radius: 190; thetaLength: 90; thetaStart: 90"
        material="color: #d6e9ff; shader: flat; side: back; opacity: 0.72"
        position="0 -65 0"
      ></a-entity>

      <a-entity id="sceneRoot" position="0 0 0" rotation="0 0 0">
        <a-entity id="bridge-world" position="0 0 0">
          <a-cylinder
            position="0 -0.06 0.55"
            radius="1.95"
            height="0.18"
            material="src: #platformPattern; repeat: 3 3; roughness: 0.95; metalness: 0.02; color: #b7c4cf"
            shadow="cast: true; receive: true"
          ></a-cylinder>
          <a-ring
            position="0 0.041 0.55"
            rotation="-90 0 0"
            radius-inner="1.62"
            radius-outer="1.89"
            color="#f2f7ff"
            material="shader: flat; opacity: 0.92"
          ></a-ring>
          <a-box
            position="0 0.02 -2.85"
            depth="5"
            height="0.04"
            width="0.3"
            color="#b98858"
            material="roughness: 0.95; metalness: 0.02"
            shadow="cast: true; receive: true"
          ></a-box>
          <a-box position="0 -2.1 0.55" width="0.46" height="4.05" depth="0.46" color="#5e6775"></a-box>
          <a-box position="0 -2.12 -2.85" width="0.22" height="4.08" depth="0.22" color="#4f5663"></a-box>
          <a-box position="0 -2.12 -5.25" width="0.7" height="4.08" depth="0.7" color="#636d7e"></a-box>
          <a-cylinder
            position="0 -4.03 -3.4"
            radius="0.42"
            height="0.06"
            color="#4b535f"
            material="roughness: 1"
          ></a-cylinder>
        </a-entity>

        <a-entity id="city"></a-entity>

        <a-entity
          id="dangerArrows"
          position="0 1.12 -1.95"
          animation="property: rotation; to: 0 360 0; loop: true; dur: 16000; easing: linear"
        >
          <a-ring radius-inner="0.06" radius-outer="0.095" rotation="-90 0 0" color="#ff9f68"></a-ring>
          <a-cone position="0 0 -0.14" radius-bottom="0.04" radius-top="0" height="0.14" rotation="90 0 0" color="#ffd36e"></a-cone>
        </a-entity>
      </a-entity>

      <a-entity id="cameraRig" position="0 1.4 0">
        <a-camera
          id="mainCamera"
          position="0 0 0"
          look-controls="enabled: true; magicWindowTrackingEnabled: true; touchEnabled: true"
          wasd-controls="enabled: false"
        >
          ${showCursor ? `
          <a-cursor
            color="#ffcf8a"
            geometry="primitive: ring; radiusInner: 0.008; radiusOuter: 0.014"
            material="shader: flat; opacity: 0.9"
          ></a-cursor>` : ""}
        </a-camera>
      </a-entity>
    </a-scene>
  `;

  generateSurfaceTextures(host);
  const sceneEl = host.querySelector("#scene");
  const refs = {
    sceneEl,
    sceneRoot: host.querySelector("#sceneRoot"),
    sceneSky: host.querySelector("#sceneSky"),
    sceneDome: host.querySelector("#sceneDome"),
    cameraRig: host.querySelector("#cameraRig"),
    mainCamera: host.querySelector("#mainCamera"),
    cityEl: host.querySelector("#city")
  };

  buildCity(refs.cityEl);
  return refs;
}

export function resetRigPose(refs, eyeLevel = 1.4) {
  refs.cameraRig.setAttribute("position", `0 ${eyeLevel} 0`);
  refs.cameraRig.object3D.position.set(0, eyeLevel, 0);
  refs.mainCamera.setAttribute("position", "0 0 0");
  refs.mainCamera.object3D.position.set(0, 0, 0);
  refs.mainCamera.components["look-controls"]?.pitchObject.rotation.set(0, 0, 0);
  refs.mainCamera.components["look-controls"]?.yawObject.rotation.set(0, 0, 0);
}

export function setScenePlacement(refs, x, y, z, yawDegrees) {
  refs.sceneRoot.object3D.position.set(x, y, z);
  refs.sceneRoot.object3D.rotation.set(0, degToRad(yawDegrees), 0);
  refs.sceneRoot.setAttribute("position", `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
  refs.sceneRoot.setAttribute("rotation", `0 ${yawDegrees.toFixed(2)} 0`);
}

export function resetScenePlacement(refs) {
  setScenePlacement(refs, 0, 0, 0, 0);
  refs.sceneSky.setAttribute("visible", true);
  refs.sceneDome.setAttribute("visible", true);
  refs.sceneEl.renderer?.setClearAlpha?.(1);
}

export function prepareSceneForAr(refs) {
  refs.sceneSky.setAttribute("visible", false);
  refs.sceneDome.setAttribute("visible", false);
  refs.sceneEl.renderer?.setClearAlpha?.(0);
}

export function getYawDegrees(orientation) {
  const x = orientation.x;
  const y = orientation.y;
  const z = orientation.z;
  const w = orientation.w;
  const siny = 2 * (w * y + x * z);
  const cosy = 1 - 2 * (y * y + z * z);
  return Math.atan2(siny, cosy) * 180 / Math.PI;
}

export function getForwardVector(yawDegrees) {
  const radians = degToRad(yawDegrees);
  return {
    x: -Math.sin(radians),
    z: -Math.cos(radians)
  };
}

function degToRad(value) {
  return value * Math.PI / 180;
}

function buildCity(cityEl) {
  const buildings = [];
  const lanes = [-16, -12, -8, -4, 4, 8, 12, 16];

  const groundDisk = makeEntity("a-cylinder", {
    position: "0 -4.06 -16",
    radius: "28",
    height: "0.18",
    color: "#7f92a3",
    material: "src: #groundPattern; repeat: 18 18; roughness: 1; metalness: 0",
    shadow: "cast: false; receive: true"
  });

  const horizonDisk = makeEntity("a-cylinder", {
    position: "0 -4.2 -16",
    radius: "60",
    height: "0.08",
    color: "#a9bbca",
    material: "opacity: 0.34; transparent: true",
    shadow: "cast: false; receive: true"
  });

  for (let z = -8; z > -84; z -= 5) {
    for (const x of lanes) {
      const jitterX = x + randomRange(-1.2, 1.2);
      const width = randomRange(1.2, 3.8);
      const depth = randomRange(1.2, 3.8);
      const height = randomRange(4.6, 16);
      const y = -4.06 + height / 2;
      const color = randomChoice(["#6f7f92", "#8090a0", "#92a3b2", "#647384"]);

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
            position: `${jitterX.toFixed(2)} ${(y + height / 2 + 0.45).toFixed(2)} ${z.toFixed(2)}`,
            width: (width * 0.18).toFixed(2),
            height: "0.9",
            depth: (depth * 0.18).toFixed(2),
            color: "#eaf4ff"
          })
        );
      }
    }
  }

  const fogLayer = makeEntity("a-cylinder", {
    position: "0 -2.3 -28",
    radius: "42",
    height: "0.14",
    color: "#ffffff",
    material: "opacity: 0.12; transparent: true"
  });

  cityEl.appendChild(groundDisk);
  cityEl.appendChild(horizonDisk);
  buildings.forEach((building) => cityEl.appendChild(building));
  cityEl.appendChild(fogLayer);
}

function generateSurfaceTextures(host) {
  const groundCanvas = host.querySelector("#groundPattern");
  const platformCanvas = host.querySelector("#platformPattern");

  if (groundCanvas instanceof HTMLCanvasElement) {
    const ctx = groundCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#a7b7c5";
      ctx.fillRect(0, 0, groundCanvas.width, groundCanvas.height);

      for (let y = 0; y < groundCanvas.height; y += 64) {
        for (let x = 0; x < groundCanvas.width; x += 64) {
          ctx.fillStyle = (x / 64 + y / 64) % 2 === 0 ? "#96a7b8" : "#b7c6d2";
          ctx.fillRect(x, y, 64, 64);
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.lineWidth = 4;
      for (let i = 0; i <= groundCanvas.width; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, groundCanvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(groundCanvas.width, i);
        ctx.stroke();
      }
    }
  }

  if (platformCanvas instanceof HTMLCanvasElement) {
    const ctx = platformCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#b8c5cf";
      ctx.fillRect(0, 0, platformCanvas.width, platformCanvas.height);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 10;
      for (let i = -platformCanvas.width; i < platformCanvas.width * 2; i += 56) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - platformCanvas.width, platformCanvas.height);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(85,100,116,0.42)";
      ctx.lineWidth = 6;
      for (let i = 0; i <= platformCanvas.height; i += 72) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(platformCanvas.width, i);
        ctx.stroke();
      }
    }
  }
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
