# WebXR_AR_Paint 現状仕様

WebXR の `immersive-ar` を使い、端末の移動と向きの変化を筆の動きとして扱う AR ペイントアプリです。ブラウザだけで起動でき、空間内に簡単な 3D ストロークを残せます。

## 技術構成

- HTML5 / JavaScript
- Three.js CDN
- WebXR Device API
- `immersive-ar`
- DOM Overlay
- hit-test

## 起動画面

- 中央に AR 開始ボタンを表示
- 短い説明文を表示
- WebXR `immersive-ar` 対応状況をステータス欄に表示

## AR セッション仕様

- ボタン押下で `immersive-ar` セッションを開始
- `requiredFeatures: ["hit-test"]`
- `optionalFeatures: ["dom-overlay"]`
- リファレンス空間は `local`
- hit-test 用に `viewer` 空間も取得可能な場合は使用

## 描画仕様

- カメラの少し前方、少し下にオフセットした位置を筆先として扱う
- 画面を押している間だけ描画
- UI 上の操作時は描画開始しない
- ストロークは球と円柱の組み合わせで表現
- 一定距離以上動いたときだけ新しい点を追加

## UI

- 色選択スウォッチ
- ブラシサイズスライダー
- 現在サイズの表示
- `Undo`
- `Clear`
- 下部ガイド表示

## 視覚要素

- 床や机の検出候補があればレティクルを表示
- 筆先プレビューとして発光気味の球を表示
- 空間照明として半球ライトと平行光源を配置

## セッション終了時

- hit-test source を破棄
- オーバーレイを非表示
- 起動画面へ戻す
- 再開可能なメッセージを表示

## 制約と現状

- 線の形状は滑らかなメッシュ生成ではなく、球と円柱の連結による軽量実装
- 描画は端末の空間認識精度に依存
- `immersive-ar` 非対応端末では開始不可

## ファイル構成

- `WebXR_AR_Paint/index.html`
  UI とオーバーレイ定義
- `WebXR_AR_Paint/app.js`
  AR セッション、描画、UI 制御、hit-test 処理

## 補足

- 大きな外部モデルや画像アセットは未使用
- 配布用ファイルはビルド後に `out/WebXR_AR_Paint/` へ生成される
