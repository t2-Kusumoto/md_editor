# 🤖 エージェント向け開発指示書 (for Cursor, Claude Code, GitHub Copilot, Antigravity, etc.)

[英語版エージェント指示書 (English AGENTS.md)](AGENTS.md)

本ガイドラインは、本プロジェクト（`md_editor`）を改変・機能拡張する AI コーディングエージェント向けに策定されています。
アーキテクチャの誤認を防ぎ、コードの一貫性を保つため、編集前には必ず本ドキュメントを参照してください。

---

## 📁 プロジェクト構成 (Project Structure)

本アプリケーションは、Python バックエンド（FastAPI）と Vanilla JavaScript フロントエンドで構成されています。フロントエンドのビルドステップ（Webpack、Vite、npm 等）は**存在しません**。

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI バックエンドサーバー（REST API、ルーティング、ファイル操作、WebSocket）
│   ├── templates/
│   │   └── index.html     # メインUI HTML。Tailwind CSS、FontAwesome、KaTeX、Highlight.js、DOMPurify、Twemoji を CDN 経由で読み込み
│   └── static/
│       ├── css/
│       │   └── style.css  # カスタム CSS スタイル
│       └── js/
│           └── app.js     # フロントエンドの全ロジックを含む単一 Vanilla JS ファイル（約7300行）
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # バックエンドセキュリティ、パストラバーサル、ファイル操作の単体・統合テスト
│   └── test_parser.py     # コードブロック内数式保護および安全なセル分割のパーサーテスト
├── pyproject.toml         # パッケージ定義、CLI エントリポイント、依存関係
├── build.py               # PyInstaller スタンドアロン実行ファイルビルドスクリプト
├── README.md              # ユーザー向けドキュメント（英語版）
├── README_ja.md           # ユーザー向けドキュメント（日本語版）
├── AGENTS.md              # エージェント向け開発指示書（英語版）
├── AGENTS_ja.md           # エージェント向け開発指示書（日本語版）
├── reproduction_log.md    # 開発プロンプト履歴・再現ログ（英語版）
└── reproduction_log_ja.md # 開発プロンプト履歴・再現ログ（日本語版）
```

---

## 🏗️ アーキテクチャと基本原則 (Architecture & Core Principles)

1. **フロントエンドのビルドステップ不要 (No Frontend Build Step)**
   - フロントエンドの依存関係（Tailwind CSS、FontAwesome、KaTeX、Highlight.js、Marked.js、DOMPurify、Twemoji）は、`index.html` 内の CDN スクリプトタグから直接読み込まれます。
   - ユーザーから明示的な指示がない限り、**npm、Webpack、Vite、React、TypeScript などを導入しないでください**。

2. **単一ファイルフロントエンド構成 (`app.js`) (Single-File Frontend Architecture)**
   - `app.js` は、番号付きセクションヘッダーで構造化された単一ファイルとして意図的に維持されています。
   - ユーザーから明示的なファイル分割要求がない限り、**`app.js` を ES モジュールや複数ファイルに分割しないでください**。関連する関数は指定されたセクションブロック内に収めてください。

3. **セキュリティ優先の設計 (Security-First Paradigm)**
   - **XSS 保護**: `marked.parse()` で描画されるすべての Markdown 出力は、DOM に挿入する前に必ず `DOMPurify.sanitize()` を通す必要があります。
   - **パストラバーサル保護**: `main.py` におけるすべてのファイルシステムアクセスは、必ず `safe_join_path()` を経由してください。検証されていないユーザー入力を `os.path.join()` で直接使用しないでください。
   - **パス区切り文字**: Windows 互換性を保証するため、`main.py` は常に `to_posix_relpath()` 経由で POSIX 形式（スラッシュ `/`）の相対パスを返却しなければなりません。
   - **FastAPI スレッド実行**: 同期的なファイルシステム I/O エンドポイントは、非同期イベントループをブロックしないよう、通常の `def`（`async def` ではなく）で定義して FastAPI が自動的にワーカースレッドプールで実行するようにしてください。

4. **Jupyter 風のセル管理 (Jupyter-like Cell Management)**
   - Markdown ドキュメントはセル（`CellModel`）の配列として表現され、それぞれ `edit`（編集）または `view`（プレビュー）モードを持ちます。
   - セルの区切りには `<!-- cell -->` を使用します。スプリッター `splitDocumentIntoCells()` は、フェンスで囲まれたコードブロック内にある `<!-- cell -->` タグを安全に無視して分割します。

---

## 🛠️ 改修ガイドライン (Modification Guidelines)

- **UI コンポーネント**: ボタンやモーダルを追加する場合は、`index.html` に HTML を配置し、Tailwind クラスでスタイルを設定し、`app.js` 内で `document.getElementById()` を使用してイベントをバインドしてください。
- **スタイル**: Tailwind CSS のユーティリティクラスを優先してください。カスタムアニメーション、複雑な疑似要素、または印刷スタイル（`@media print`）にのみ `style.css` を編集してください。
- **エラーハンドリング**: すべての API `fetch()` 呼び出しには `try...catch` ブロックを使用してください。
- **自動テスト**: バックエンド API やパーサーロジックを追加・変更した際は、必ず `python3 -m unittest discover tests` を実行し、すべてのテストがパスすることを確認してください。

---

## 🎯 よくある拡張ポイント (Common Extension Points)

- **ショートカットとキーバインド**: `app.js` の `handleGlobalKeydown` または `attachTextareaEvents` を変更します。
- **Markdown と数式の描画**: `app.js` の `renderMarkdownWithMath()` を変更します。
- **バックエンドエンドポイント**: `main.py` に `@app.get`、`@app.post`、または `@app.delete` を持つ標準 `def` 関数を追加します。
