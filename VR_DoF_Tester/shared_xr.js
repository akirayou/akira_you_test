export async function getSessionSupport(mode) {
  if (!navigator.xr) {
    return false;
  }

  try {
    return await navigator.xr.isSessionSupported(mode);
  } catch (_error) {
    return false;
  }
}

export async function requestMotionPermissionIfNeeded() {
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

export async function waitForSceneReady(sceneEl) {
  if (sceneEl.hasLoaded && sceneEl.renderer) {
    return;
  }

  await new Promise((resolve) => {
    sceneEl.addEventListener("loaded", resolve, { once: true });
  });
}

export async function createArSession(sceneEl, overlayRoot = document.body) {
  const renderer = sceneEl.renderer;
  renderer.xr.enabled = true;

  let session;
  let referenceSpaceType = "local-floor";

  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local-floor"],
      optionalFeatures: ["hit-test", "dom-overlay"],
      domOverlay: { root: overlayRoot }
    });
  } catch (_error) {
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local"],
      optionalFeatures: ["hit-test", "dom-overlay"],
      domOverlay: { root: overlayRoot }
    });
    referenceSpaceType = "local";
  }

  renderer.xr.setReferenceSpaceType(referenceSpaceType);
  await renderer.xr.setSession(session);

  const referenceSpace = await session.requestReferenceSpace(referenceSpaceType);
  const viewerSpace = await session.requestReferenceSpace("viewer");

  let hitTestSource = null;
  try {
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  } catch (_error) {
    hitTestSource = null;
  }

  return {
    session,
    referenceSpace,
    viewerSpace,
    hitTestSource,
    referenceSpaceType
  };
}

export async function createVrSession(
  sceneEl,
  preferredReferenceSpace = "local-floor"
) {
  let referenceSpaceType = preferredReferenceSpace;

  try {
    sceneEl.setAttribute("webxr", `referenceSpaceType: ${preferredReferenceSpace}; optionalFeatures: local-floor`);
    await sceneEl.enterVR();
  } catch (_error) {
    referenceSpaceType = "local";
    sceneEl.setAttribute("webxr", "referenceSpaceType: local");
    await sceneEl.enterVR();
  }

  const renderer = sceneEl.renderer;
  const xrManager = renderer.xr;
  const session = xrManager.getSession?.() || null;
  const referenceSpace = xrManager.getReferenceSpace?.() ||
    (session ? await session.requestReferenceSpace(referenceSpaceType) : null);

  return {
    session,
    referenceSpace,
    referenceSpaceType,
    sceneEl
  };
}

export async function endSessionSafely(sessionState) {
  const session = sessionState.session;
  const hitTestSource = sessionState.hitTestSource;

  sessionState.session = null;
  sessionState.referenceSpace = null;
  sessionState.activeReferenceSpace = null;
  sessionState.viewerSpace = null;
  sessionState.hitTestSource = null;

  if (hitTestSource) {
    hitTestSource.cancel();
  }

  if (sessionState.sceneEl?.is?.("vr-mode")) {
    await sessionState.sceneEl.exitVR();
    return;
  }

  if (session) {
    await session.end();
  }
}

export function getFrame(sceneEl) {
  return sceneEl.frame || sceneEl.renderer?.xr?.getFrame?.() || null;
}

export function getViewerPose(frame, referenceSpace) {
  if (!frame || !referenceSpace) {
    return null;
  }

  try {
    return frame.getViewerPose(referenceSpace);
  } catch (_error) {
    return null;
  }
}

export function getTrackingStatus(viewerPose) {
  if (!viewerPose) {
    return "unavailable";
  }

  return viewerPose.emulatedPosition ? "emulated" : "tracked";
}

export function applyReferenceSpaceOffset(sceneEl, baseReferenceSpace, offset) {
  if (!sceneEl?.renderer?.xr || !baseReferenceSpace || typeof XRRigidTransform === "undefined") {
    return null;
  }

  const nextReferenceSpace = baseReferenceSpace.getOffsetReferenceSpace(
    new XRRigidTransform(offset)
  );
  sceneEl.renderer.xr.setReferenceSpace(nextReferenceSpace);
  return nextReferenceSpace;
}

export function resetReferenceSpace(sceneEl, referenceSpace) {
  if (!sceneEl?.renderer?.xr || !referenceSpace) {
    return;
  }

  sceneEl.renderer.xr.setReferenceSpace(referenceSpace);
}
