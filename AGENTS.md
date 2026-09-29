# 🤖 Agent Instructions (for Cursor, Claude Code, GitHub Copilot, etc.)

このファイルは、各種AIエージェント（Cursor, Claude Code, GitHub Copilot, 汎用LLMなど）が本プロジェクト（`md_editor`）を改変・機能追加する際に参照するためのガイドラインです。
エージェントに指示を出す際、このファイルをコンテキストに含めることで、プロジェクトの構造やアーキテクチャの誤認を防ぎ、より正確で効率的なコード修正が可能となります。

## 📁 Project Structure (プロジェクト構成)

本アプリは、Python（バックエンド）と Vanilla JavaScript（フロントエンド）によるシンプルな構成です。フロントエンドのビルドステップ（Webpack, Vite, npm など）は**存在しません**。

```text
md_edit_and_view_app/
├── md_editor/
│   ├── main.py            # FastAPI バックエンドサーバー（API, ルーティング, ファイル操作）
│   ├── templates/
│   │   └── index.html     # メインのUI構造。Tailwind CSS (CDN) と各種ライブラリの読み込み
│   └── static/
│       ├── css/
│       │   └── style.css  # カスタムスタイル
│       └── js/
│           └── app.js     # Vanilla JS によるフロントエンドの全ロジック（約6800行）
├── pyproject.toml         # パッケージと依存関係の定義
└── README.md
```

## 🏗️ Architecture & Key Concepts (アーキテクチャと基本概念)

1. **No Build Step (ビルド不要)**
   - フロントエンドは CDN から Tailwind CSS, FontAwesome, KaTeX, Highlight.js, Marked.js, Twemoji を読み込みます。
   - React, Vue, TypeScript 等は使用していません。**Vanilla JS** で記述されています。勝手に npm パッケージを導入しないでください。

2. **Backend (Python / FastAPI)**
   - `main.py` に記述されています。
   - ディレクトリ内のファイル一覧取得、ファイルの保存、名前変更、削除、画像変換など、OSレベルの操作をAPIとして提供します。
   - エンドポイントを追加する場合は、`@app.get` や `@app.post` を用いて `main.py` に追記してください。

3. **Frontend (Vanilla JS - `app.js`)**
   - **巨大な単一ファイル**: `app.js` は約6800行に及ぶ単一ファイルです。エージェントが修正する際は、行番号の指定に依存せず、関数名や特定のコメントブロックを目印に検索・置換を行ってください。
   - **DOMベースの状態管理**: グローバル変数（`documents`, `panes`, `openPaneCount`）を用いて、最大3ペインまでの画面分割とタブ管理を行っています。
   - **Jupyter ライクなセル管理**: 各 Markdown ドキュメントは「セル（Cell）」の配列として管理され、セルごとに Edit（編集） / Command（プレビュー） モードを持ちます。

## 🛠️ Modification Guidelines (修正・拡張時のガイドライン)

AIエージェントがコードを修正する際は、以下のルールを守ってください。

- **モジュール化の提案について**: `app.js` が巨大なため、エージェントはしばしば ES Modules への分割や React の導入を提案するかもしれません。しかし、**ユーザーから明示的な指示がない限り、現在の Vanilla JS 単一ファイル構成を維持してください**。
- **UIコンポーネントの追加**: 新しいボタンやモーダルを追加する場合は、`index.html` に HTML を追加し、Tailwind CSS クラスでスタイリングし、`app.js` の `document.getElementById` 等でイベントリスナーを登録してください。
- **スタイルの調整**: 基本的に Tailwind CSS のユーティリティクラスを使用します。どうしても CSS が必要な場合（アニメーションや複雑な疑似要素など）のみ `style.css` を編集してください。
- **エラーハンドリング**: バックエンド API の呼び出し（`fetch`）では、必ず `try...catch` を使用し、例外時は適切なエラーメッセージ（console.error や alert など）を出力するようにしてください。

## 🎯 Common Extension Points (よくある拡張ポイント)

- **ショートカットの追加**: `app.js` の `handleGlobalKeydown` や `attachTextareaEvents` 内にキー判定を追加してください。
- **Markdown パースのカスタマイズ**: `marked.js` の設定（`marked.use`）や、数式レンダリング（KaTeX適用）、絵文字変換関数付近を改修してください。
