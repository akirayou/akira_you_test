# VR_DoF_Tester 実験メモ

このファイルは `VR_DoF_Tester/spec.md` とは別に、実機検証で分かったことを随時追記するためのメモである。

`spec.md` は設計方針を記述し、このファイルは「何を試して、何が起きたか」を残す。

## 1. 目的

- `Cardboard HMD` 環境で `6DoF` 比較が成立するかを検証する
- `immersive-vr` 単独経路での限界と、`pose 転送型` の可能性を切り分ける

## 2. 現在のページ構成

### 安定版

- `mode_phone_3dof.html`
- `mode_phone_6dof.html`
- `mode_hmd_3dof.html`

### 実験版

- `mode_hmd_6dof.html`
  `immersive-vr` を直接検証する Three.js 実験ページ
- `debug_minimal_vr.html`
  立方体 1 個だけの最小 `immersive-vr` 切り分けページ
- `experiment_hmd_transfer.html`
  `immersive-ar` で pose を取得し、自前 stereo に転送する実験ページ

## 3. immersive-vr 単独経路で分かったこと

### 3.1 A-Frame ベース HMD 6DoF は不安定

初期の `mode_hmd_6dof` は A-Frame ベースで実装したが、次の問題が出た。

- `viewerPose` は取得できても `emulatedPosition` になる
- `GL_INVALID_FRAMEBUFFER_OPERATION` が頻発する
- `Cardboard` で高さ情報が反映されない

### 3.2 Three.js 最小ページでも `emulated`

`debug_minimal_vr.html` を追加し、余計な初期化を削った最小 `immersive-vr` を検証した。

確認できたこと:

- `tracking status` は `emulated`
- `viewerPosePosition` は取得されるが、6DoF の実位置追跡としては扱われていない
- `A-Frame` を外しても結果は変わらなかった

この時点で、

- 「Cardboard 用の独自初期化が悪いだけ」

という仮説は弱くなり、

- 「この端末 / ブラウザの `immersive-vr` + Cardboard 経路自体が 3DoF 相当」

という見方が強くなった。

### 3.3 framebuffer 警告は最小ページでも残る

最小 `immersive-vr` ページでも、次の警告が継続した。

- `GL_INVALID_FRAMEBUFFER_OPERATION: glClear`
- `GL_INVALID_FRAMEBUFFER_OPERATION: glDrawElements`

このため、少なくともこの警告はアプリ独自の空間構築よりも、

- ブラウザの `immersive-vr` 実装
- 端末 GPU / WebGL / XR レイヤ相性

に寄る可能性が高い。

## 4. pose 転送型実験で分かったこと

### 4.1 `immersive-ar` を pose 取得元にすると `tracked` へ入る

`experiment_hmd_transfer.html` では、

- pose 取得: `immersive-ar`
- 描画: 自前 stereo

に分離して実装した。

このページでは、

- 最初は `unavailable`
- 少し後に `tracked`

へ遷移した。

これは重要で、少なくとも今回の端末 / ブラウザでは

- `immersive-vr` 経路では `emulated`
- `immersive-ar` 経路では `tracked`

という差があることを示している。

### 4.2 現在の課題

`experiment_hmd_transfer` はまだ試作段階であり、次の課題が残っている。

- 端末が縦向きのまま開始されることがある
- 左右分割の中央寄せと黒枠は入れたが、レンズ向けの歪み補正は未実装
- Cardboard で自然に見える視野角 / IPD / マスク調整は未完了

## 5. 現時点の結論

### 安定版について

- 本番導線は引き続き `スマホ画面 3DoF / 6DoF` を主軸にする
- `mode_phone_6dof` は比較体験として成立しやすい

### HMD 6DoF について

- `immersive-vr` 単独で Cardboard 6DoF を成立させるのは難しい
- `debug_minimal_vr` の結果から、単純な実装バグだけでは説明しにくい
- `pose 転送型` の方が実現可能性が高い

### 次の開発方針

次に優先すべきなのは `experiment_hmd_transfer` の改善である。

候補:

- 横向き開始の安定化
- stereo viewport の調整
- レンズ向け歪み補正
- IPD / FOV / マスクの実機調整
- 必要なら pose 平滑化

## 6. 使い分けの目安

### `mode_hmd_6dof.html`

- `immersive-vr` 単独経路の限界確認用
- `emulated/tracked` の確認用

### `debug_minimal_vr.html`

- 「余計な初期化が悪いのでは」という仮説の切り分け用
- 最小構成でも `emulated` かどうかを確認する

### `experiment_hmd_transfer.html`

- 今後の本命候補
- `pose 取得` と `Cardboard 向け表示` を分離した実験用
