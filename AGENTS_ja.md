# 🤖 エージェント向け開発指示書 (for Cursor, Claude Code, GitHub Copilot, Antigravity, etc.)

[英語版エージェント指示書 (English AGENTS.md)](AGENTS.md)

本ガイドラインは、本プロジェクト（`md_editor`）を改変・カスタマイズ・機能拡張する AI コーディングエージェント向けに策定されています。
アーキテクチャの誤認を防ぎ、システムの一貫性を保つため、コードを編集する前には必ず本ドキュメントを参照してください。

---

## 🌟 開発思想: AI を活用したユーザー主導のカスタマイズ

本プロジェクトは、**「ユーザーが AI コーディングエージェント（Google Antigravity、Claude Code、Cursor、GitHub Copilot など）を利用して、自分好みの使い勝手に合わせて自在にカスタマイズ・機能拡張していく」** ことを最大の理想・設計思想として開発されています。

AI 支援による開発・改修に最も適した環境を提供するため、以下の基本構成を採用しています：
1. **フロントエンドのビルドステップを完全排除**: Node.js、npm、Webpack、Vite などのビルド環境は一切不要です。ブラウザ標準の Vanilla JavaScript、Tailwind CSS、CDN ライブラリのみで動作します。
2. **見通しの良い単一ファイル構成 (`app.js`)**: フロントエンドの全ロジックは、セクション番号で機能ごとに整然と区切られた単一ファイル（約7400行）に集約されています。
3. **即時反映の開発体験**: JavaScript、HTML、Python を書き換えるだけで、ブラウザの再読み込みやサーバー再起動ですぐに変更が反映されます。ビルドエラーやバンドル処理に阻まれる心配がありません。
4. **エージェント向けアーキテクチャ定義**: 本ドキュメントにより内部構造を明文化することで、AI エージェントがデータ構造を壊すことなく安全・迅速に機能拡張を行えるようにしています。

---

## 📁 プロジェクト構成 (Project Structure)

```text
md_edit_and_view_app/
├── md_editor/
│   ├── __init__.py
│   ├── main.py            # FastAPI バックエンドサーバー（REST API、ルーティング、ファイル操作、WebSocket、複数セッション）
│   ├── templates/
│   │   └── index.html     # メインUI HTML。Tailwind CSS、FontAwesome、KaTeX、Highlight.js、DOMPurify、Twemoji を CDN 経由で読み込み
│   └── static/
│       ├── css/
│       │   └── style.css  # カスタム CSS スタイル（アニメーション、行番号、キャレットハイライト、@media print 等）
│       └── js/
│           └── app.js     # フロントエンドの全ロジックを含む単一 Vanilla JS ファイル（約7400行）
├── tests/
│   ├── __init__.py
│   ├── test_backend.py    # バックエンドセキュリティ、パストラバーサル、ファイル操作の単体・統合テスト
│   ├── test_cli_args.py   # CLI引数、作業ディレクトリ判定、OS起動連携の単体テスト
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

## 🔄 データフローと状態管理 (Data Lifecycle & State Management)

### 1. インメモリ状態管理（`localStorage` は不使用）
本アプリケーションは、フロントエンドのメモリ上（JavaScript ヒープ）でのみ状態を管理しています：
- **`documents`**: 開いている全ドキュメントを保持する `Map<string, DocumentModel>`。
  - `DocumentModel`: `{ id, filename, relPath, cells: CellModel[], isModified, activeCellIndex, selectedCellIndices, undoStack, redoStack, ... }`
  - `CellModel`: `{ id, content, mode: 'edit' | 'view', cursorPos }`
- **`panes`**: マルチペイン表示を管理する 3 要素の配列。
  - 各ペインオブジェクト: `{ id, tabs: [docId], activeTabId, cellsListEl, cellsScrollEl, ... }`
  - 最大 3 画面まで分割可能（`openPaneCount: 1..3`）。
  - 現在アクティブなペインは `activePaneIndex` で管理。
- **重要原則**: **ブラウザの `localStorage` は一切使用していません**。下書きやキャッシュはブラウザ側に保存されず、FastAPI を介してディスク上のファイルへ保存されるまでメモリ内でのみ保持されます。

### 2. セルのライフサイクルと描画フロー
一般的な左右分割型エディタとは異なり、タイピングのたびにドキュメント全体をパースしたり差分レンダリングすることは**ありません**：
1. **Edit モード（テキスト入力中）**:
   - `<textarea>` への入力時、`input` イベントによりインメモリの `cell.content` が同期され、`doc.isModified = true` が設定されます。
   - 行番号、カーソル位置、コメントハイライトが更新されます。
   - **タイピング中に Markdown のパースは一切行われません**（軽快な入力性能を維持するため）。
2. **View モードへの遷移（レンダリング実行）**:
   - セル実行（`Shift + Enter`、`Ctrl + Enter`）、移動（`Esc`）、またはセル外クリック（`exitEditingCell`）時に実行されます。
   - 描画パイプライン（`renderMarkdownWithMath`）:
     1. インライン数式（`$...$`）およびブロック数式（`$$...$$`）をプレースホルダーに退避。
     2. `marked.parse()` で Markdown を HTML へ変換。
     3. `DOMPurify.sanitize()` で HTML をサニタイズ。
     4. `katex.renderToString()` で数式をレンダリングして展開。
     5. コードブロックに `hljs.highlightElement()` でシンタックスハイライトを適用。
     6. `twemoji` で絵文字を SVG ベクターへ変換。
3. **DOM 更新スコープ**:
   - 単一セルのモード切替時は、`renderCellAt(index)` により該当セルのコンテナ DOM のみをピンポイントで差し替えます。
   - ドキュメント全体の再描画（`renderCells()`）は、セルの追加・削除・並び替え・結合など、構造的変更が発生した時のみ行われます。

### 3. ファイルの永続化とシリアライズ
- **保存フロー**:
  - `saveNotebook()` は全セルを区切り文字で結合します: `doc.cells.map(c => c.content).join('\n<!-- cell -->\n')`
  - HTTP POST `/api/save-file` に `{ path, content }` を送信します。
  - FastAPI がローカルファイルに同期書き込みを行い、`{ success: true, mtime }` を返します。
  - 保存成功後、`markModified(false, doc)` で未保存フラグが解除され、タブの UI が更新されます。
- **読み込みフロー**:
  - HTTP GET `/api/file-content?path=...` でファイル内容を取得します。
  - `splitDocumentIntoCells()` によりセル配列へ分割します。フェンスコードブロック（```）内の `<!-- cell -->` はコードの一部として保護され、誤分割されません。
- **未保存状態の保護**:
  - タブを閉じる、ペインを閉じる、アプリを終了（Quit）する際、`doc.isModified` がチェックされます。
  - 未保存の変更がある場合はカスタムモーダル（`#unsaved-modal`）が表示され、意図しないデータ破棄を防ぎます。

### 4. スクロールと画面ナビゲーション（ペイン間同期は存在しない）
- **ペインは独立したワークスペース**:
  - 分割されたペインは別々のタブ・ファイルを並行して表示するためのものです。
  - **ペイン間でスクロールを同期させる仕様やコードは一切存在しません**（「エディタ対プレビュー」のスクロール同期ではありません）。
- **セル表示追従ルール**:
  - セル選択時は `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` で可視範囲に入ります。
  - テキストエリア内のカーソル移動時は `scrollStartLineIntoViewIfNeeded` および `scrollEndLineIntoViewIfNeeded` により、カーソルが画面外へ見切れないよう自動スクロールされます。
  - `Ctrl + Alt + L` は、アクティブ行またはセル上枠をヘッダー下線の指定行位置にセンタリング配置します。

---

## 🗺️ `app.js` の機能セクション一覧

約7400行ある `app.js` を迷わず編集するための機能別マップです：

| 行目安 | セクション名 | 主な役割と関数 |
| :--- | :--- | :--- |
| `22 ～ 386` | **01. Global State & DOM** | グローバル変数（`documents`, `panes`, `activePaneIndex`）、DOM要素バインド、初期化 |
| `387 ～ 720` | **02. Data Models & Factories** | `createCellModel`, `createDocumentModel`, `splitDocumentIntoCells` |
| `721 ～ 1528` | **UI & Pane Management** | `renderTabs`, `updatePaneVisibility`, `renderPane`, `setActivePane`, 下部ダミーセル |
| `1529 ～ 2053` | **Cell Rendering & Modes** | `renderCells`, `renderCellAt`, `editCell`, `exitEditingCell`, `setDocGlobalMode` |
| `2054 ～ 2164` | **Markdown & Math Engine** | `renderMarkdownWithMath` (LaTeX保護, Marked.js, DOMPurify, KaTeX, Highlight.js, Twemoji) |
| `2165 ～ 2695` | **Cell Operations & History** | セル選択, 挿入(A/B), 削除(DD), コピー/カット/貼付, 分割(`Ctrl+Alt+-`), 結合(`Shift+M`), Undo/Redo |
| `2696 ～ 3950` | **Gutter & Scroll Helpers** | 行番号, ブロックカーソル, `scrollStartLineIntoViewIfNeeded`, センタリング処理 |
| `3951 ～ 4997` | **File & Workspace Ops** | `openFileByPath`, `saveNotebook`, `saveNotebookAs`, Markdown/HTML/PDF エクスポート |
| `4998 ～ 5430` | **Split Panes & Drag-Drop** | ペイン境界リサイズ, タブドラッグ＆ドロップ, ドロップ時の画面分割 |
| `5431 ～ 5550` | **Modals & Dialogs** | 共通確認モーダル (`showConfirmDialog`), 未保存変更確認 (`checkUnsavedChangesForDoc`) |
| `5551 ～ 6810` | **Keybindings & Routing** | グローバルキーイベント (`handleGlobalKeydown`), コマンドモード/編集モード分岐, Vim風キー |
| `6811 ～ 7077` | **Sidebars & ToC** | 3状態サイドバー切替 (ファイルブラウザ / 目次 / 閉じる), 見出し解析, 目次ジャンプ |
| `7078 ～ 7450` | **Textarea Events & WebSocket**| `attachTextareaEvents`, 自動伸縮, コメント装飾, WebSocket Keepalive / 終了処理 |

---

## 🛠️ 改修ガイドライン (Modification Guidelines)

- **UI コンポーネント**: ボタンやモーダルを追加する場合は、`index.html` に HTML を配置し、Tailwind クラスでスタイルを設定し、`app.js` 内で `document.getElementById()` を使用してイベントをバインドしてください。
- **ダイアログ・確認プロンプト**: ブラウザ標準の `window.confirm()` や `window.prompt()` は環境によって日本語化（「キャンセル」等）されてしまうため使用せず、必ずカスタムモーダル `showConfirmDialog({ title, message, confirmText, cancelText, isDanger })` を使用してください。
- **スタイル**: Tailwind CSS のユーティリティクラスを優先してください。カスタムアニメーション、複雑な疑似要素、または印刷スタイル（`@media print`）にのみ `style.css` を編集してください。
- **エラーハンドリング**: すべての API `fetch()` 呼び出しには `try...catch` ブロックを使用してください。
- **自動テスト**: バックエンド API やパーサーロジックを追加・変更した際は、必ず `python3 -m unittest discover tests` を実行し、すべてのテストがパスすることを確認してください。

---

## 🎯 よくある拡張ポイント (Common Extension Points)

- **ショートカットとキーバインド**: `app.js` の `handleGlobalKeydown` または `attachTextareaEvents` を変更します。
- **Markdown と数式の描画**: `app.js` の `renderMarkdownWithMath()` を変更します。
- **セルツールバーや操作**: `createCellToolbar` やセル操作関数群を変更します。
- **バックエンドエンドポイント**: `main.py` に `@app.get`、`@app.post`、または `@app.delete` を持つ標準 `def` 関数を追加します。
- **CLI 引数や起動処理**: `main.py` の `parse_args_and_setup_workspace()` を変更します。
