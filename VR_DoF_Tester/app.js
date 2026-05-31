import { getSessionSupport } from "./shared_xr.js";

const supportPhone6El = document.getElementById("supportPhone6");
const supportHmd3El = document.getElementById("supportHmd3");
const supportHmd6El = document.getElementById("supportHmd6");
const launcherStatusEl = document.getElementById("launcherStatus");

init();

async function init() {
  if (!navigator.xr) {
    supportPhone6El.textContent = "WebXR 非対応";
    supportHmd3El.textContent = "WebXR 非対応";
    supportHmd6El.textContent = "WebXR 非対応";
    launcherStatusEl.textContent = "このブラウザでは WebXR が使えません。スマホ 3DoF だけ確認できます。";
    return;
  }

  const [arSupported, vrSupported] = await Promise.all([
    getSessionSupport("immersive-ar"),
    getSessionSupport("immersive-vr")
  ]);

  supportPhone6El.textContent = arSupported
    ? "immersive-ar 対応"
    : "immersive-ar 非対応";
  supportHmd3El.textContent = vrSupported
    ? "immersive-vr 対応"
    : "immersive-vr 非対応";
  supportHmd6El.textContent = vrSupported
    ? "immersive-vr 対応 / 実験版"
    : "immersive-vr 非対応";

  if (arSupported && vrSupported) {
    launcherStatusEl.textContent =
      "スマホ 6DoF と HMD 版の起動条件を満たしています。端末によって位置追跡の質は変わります。";
    return;
  }

  if (arSupported) {
    launcherStatusEl.textContent =
      "スマホ 6DoF は使えますが、HMD 版は immersive-vr 非対応の可能性があります。";
    return;
  }

  if (vrSupported) {
    launcherStatusEl.textContent =
      "HMD 版は試せますが、スマホ 6DoF は immersive-ar 非対応です。";
    return;
  }

  launcherStatusEl.textContent =
    "この端末では 6DoF または HMD 体験に制限があります。まずはスマホ 3DoF から確認してください。";
}
