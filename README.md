# akira_you_test

高校生向けワークショップで使う WebXR サンプル集です。現在は 2 つのアプリが入っており、`3DoF / 6DoF` 比較と、AR 空間お絵かきを試せます。

## 公開中のデモ

- ランチャー: http://akirayou.net/test/
- `WebXR_AR_Paint`: https://akirayou.net/test/WebXR_AR_Paint/

`VR_DoF_Tester` は現在 WIP です。公開先では `test` 直下のランチャーから各モードや実験ページへ入る想定にしています。

## 収録アプリ

### `VR_DoF_Tester`（WIP）

高所の一本橋を題材に、`3DoF` と `6DoF` の見え方の違いを比較する実験アプリです。

現状は次のように分かれています。

- 安定版
  スマホ画面 `3DoF / 6DoF`
  Cardboard HMD `3DoF`
- 実験版
  `immersive-vr` 単独の HMD 6DoF 検証
  最小 `immersive-vr` デバッグページ
  `immersive-ar` の pose を自前 stereo へ転送する `pose transfer` 実験

特に `Cardboard HMD 6DoF` は検証中です。現時点では、`immersive-vr` 単独経路よりも `pose transfer` 方式の方が有望です。

関連ファイル:

- 設計仕様: [VR_DoF_Tester/spec.md](VR_DoF_Tester/spec.md)
- 実験メモ: [VR_DoF_Tester/experiment_notes.md](VR_DoF_Tester/experiment_notes.md)
- ランチャー: [VR_DoF_Tester/index.html](VR_DoF_Tester/index.html)

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
- `VR_DoF_Tester` は開発途中です。安定版と実験版を混在させているため、現状把握には `spec.md` と `experiment_notes.md` の両方を参照してください。
