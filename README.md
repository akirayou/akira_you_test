# akira_you_test

高校生向けワークショップで使う WebXR サンプル集です。現在は 2 つのアプリが入っており、VR の視点トラッキング差分と、AR 空間お絵かきを体験できます。

## 収録アプリ

### `VR_DoF_Tester`

高所の一本橋を題材に、`3DoF` と `6DoF` の見え方の違いを体験する WebVR アプリです。

- `3DoF 単眼`
  回転のみを反映する、非ゴーグル前提の表示です。
- `3DoF ゴーグル`
  両眼立体視で表示しつつ、位置移動は固定したまま回転だけを反映します。
- `6DoF`
  対応端末では、頭の位置移動も含めたトラッキングを使います。

主なソースは [VR_DoF_Tester/index.html](VR_DoF_Tester/index.html) と [VR_DoF_Tester/app.js](VR_DoF_Tester/app.js) です。

### `WebXR_AR_Paint`

WebXR のカメラ位置を筆先に見立てて、3D 空間に線を描く AR ペイントアプリです。

- 色の切り替え
- ブラシサイズ調整
- ストロークの Undo
- 全消去

主なソースは [WebXR_AR_Paint/index.html](WebXR_AR_Paint/index.html) と [WebXR_AR_Paint/app.js](WebXR_AR_Paint/app.js) です。

## ディレクトリ構成

- `VR_DoF_Tester/`, `WebXR_AR_Paint/`
  開発用ソースです。通常はこちらを編集します。
- `out/`
  ビルド生成物です。配布や配置に使う最終出力が入ります。
- `scripts/build.mjs`
  HTML / CSS / JS を minify して `out/` を再生成するビルドスクリプトです。
- `build_out.ps1`
  PowerShell からビルドを呼ぶための補助スクリプトです。
- `sync_out.ps1`
  `out/` を任意の同期先へ転送するための補助スクリプトです。共有用リポジトリでは、同期先の具体値はローカル設定に分離しています。

## 使い方

### 必要なもの

- Node.js
- npm

### セットアップ

```powershell
npm install
```

### ビルド

```powershell
.\build_out.ps1
```

または

```powershell
npm run build --silent
```

### 同期

同期先は Git 管理外の `sync_out.local.ps1` で指定できます。テンプレートとして `sync_out.local.example.ps1` を同梱しています。

プレビュー:

```powershell
.\sync_out.ps1
```

実行:

```powershell
.\sync_out.ps1 -Execute
```

## 開発メモ

- `out/` は生成物なので、手編集せずソース側を更新してから再ビルドします。
- WebXR 機能の挙動確認には、実機ブラウザやヘッドセットでの検証が必要です。
