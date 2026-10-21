# Markdown Notebook Editor & Viewer (`md_editor`)

[English Document (英語版README)](README.md)

Jupyter Lab に着想を得た、デスクトップ環境向けの軽量な Markdown ノートブックエディタ＆ビューアです。**編集 (Edit) モード** と **コマンド (View) モード** をシームレスに切り替えながら、セル単位で Markdown を執筆・プレビュー・操作できます。

---

## 主な機能 (Key Features)

- **Jupyter Lab ライクなセル操作**: セル単位で Markdown、LaTeX 数式（KaTeX）、コードハイライト、絵文字を編集・プレビューできます。
- **充実したキーボード操作**: 直感的なコマンドモードと編集モードを備え、豊富なショートカット（Vim 風移動、セル分割、挿入、削除、順序入れ替え）をサポートしています。
- **マルチペインワークスペース**: ドラッグ＆ドロップによるタブ管理とともに、エディタ画面を垂直に最大 3 ペインまで分割可能です。
- **セキュリティ優先設計**: 組み込みの DOMPurify HTML サニタイズにより、信頼できない Markdown ファイルからのローカル XSS 攻撃を防止します。ディレクトリトラバーサル保護によりローカルファイル操作を保護します。
- **目次 (ToC) サイドバー**: 見出しアウトラインを即座に表示し、目的のセクションへスムーズにジャンプできます。
- **多彩なエクスポート機能**: セル区切りタグのないプレーンな Markdown、単体で表示可能な HTML、ブラウザ標準印刷を利用した高品質な PDF 出力をサポートしています。
- **フロントエンドのビルドステップ不要**: Python バックエンド（FastAPI）と Vanilla JS ＋ CDN/ローカルアセットのみで動作します。エンドユーザー側で Node.js や npm のビルド環境は一切不要です。

---

## インストールと配布 (Installation & Distribution)

本アプリケーションは、お使いの環境やお好みに応じて複数のインストール方法をサポートしています。

### 方法 A: ローカル環境に Python が導入されている人向け

#### 1. 開発・カスタマイズしたい人向け
ソースコードを直接開発・カスタマイズできるよう、編集可能（editable）モードで実行します：

```bash
# 1. リポジトリをクローンし、移動
git clone https://github.com/user/md_editor.git
cd md_edit_and_view_app

# 2. 仮想環境を作成し、有効化
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

# 3. 開発モードでインストール
pip install -e .

# 4. アプリケーションを起動
md_editor
# Python や JS ファイルを変更すると、再インストール不要で即座に反映されます！
```

#### 2. 日常の CLI ツールとして利用（仮想環境をアクティベートせずにどこからでも起動）

**`pipx` または `uv` を使用する場合:**
```bash
# pipx を利用する場合
pipx install git+https://github.com/user/md_editor.git
# またはローカルクローンから:
pipx install .

# uv を利用する場合
uv tool install git+https://github.com/user/md_editor.git
# またはローカルクローンから:
uv tool install .
```

**Python 標準環境のみの場合（外部ツールなし）:**
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install .

# macOS / Linux: ユーザーの bin にシンボリックリンクを作成
ln -s "$(pwd)/.venv/bin/md_editor" ~/.local/bin/md_editor

# Windows: .venv\Scripts をユーザー環境変数の PATH に追加するか、ショートカットを作成
```

---

### 方法 B: スタンドアロン実行ファイル（Python がインストールされていない環境向け）

PyInstaller を使用して、単一のスタンドアロン実行ファイルを生成します：

```bash
python3 build.py
```
これにより `dist/` ディレクトリ内に実行ファイル（Linux/macOS は `dist/md-editor`、Windows は `dist/md-editor.exe`）が生成されます。
このバイナリをシステムの `PATH` が通ったディレクトリに配置することで、ターミナルから直接起動できます：
```bash
md-editor
```

---

## クイックスタートと起動 (Quick Start & Usage)

作業したいディレクトリでコマンドを実行します：
```bash
# 引数なしで起動（ワークスペースを開く）
md-editor
# または
md_editor

# Markdown ファイルを直接開いて起動
md-editor document.md
```
既定の Web ブラウザが自動的に開き、`http://127.0.0.1:18000`（または空いているポート）でエディタが表示されます。


---

## 操作方法とショートカット (Operation & Shortcuts)

エディタは Jupyter Lab と同様に、**Edit モード**（セル内容の編集）と **Command モード**（セルの選択・移動・操作）の 2 つの状態で動作します。

### グローバルショートカット (Global Shortcuts)
- **`Ctrl + Shift + ← / H`**: アクティブなペインで左のタブへ切り替え。
- **`Ctrl + Shift + → / L`**: アクティブなペインで右のタブへ切り替え。
- **`Ctrl + N`** または **`Ctrl + Alt + N`**: 新規ノートブック（新規タブ）を作成。
- **`Ctrl + Alt + W`**: 現在のアクティブタブを閉じる。
- **`Ctrl + Alt + M`**: 現在のペインを左隣のペインへ統合 (マージ)。
- **`Ctrl + S`**: 現在のノートブックを保存。
- **`Ctrl + Alt + S`**: ノートブックを名前を付けて保存 (Save As)。
- **`Ctrl + \`**: アクティブなエディタを垂直分割（最大 3 ペイン）。
- **`Ctrl + Shift + F`**: ファイルブラウザサイドバーの表示 / 非表示を切り替え。
- **`Ctrl + Alt + F`**: 目次 (ToC) サイドバーの表示 / 非表示を切り替え。
- **`Ctrl + Shift + Q`**: アプリケーションを終了し、バックエンドサーバーを安全に停止。

### Edit モード (セル内でのテキスト入力中)
- **`Esc`**: Command モードへ移行（レンダリングされた Markdown をプレビュー表示）。
- **`Ctrl + Enter`**: セルを実行（プレビュー）し、同一セルを選択したまま Command モードへ移行。
- **`Shift + Enter`**: セルを実行（プレビュー）し、下のセルを選択（末尾の場合は新規セルを自動作成）。
- **`Ctrl + /`**: 選択行または現在行をコメントアウトトグル (`<!-- ... -->` 形式)。
- **`Ctrl + Alt + -`**: カーソル位置または選択範囲の中央でセルを分割 (Split Cell)。
- **`Ctrl + Shift + K`**: 現在行を削除（複数行選択時は選択された全行を一括削除）。
- **`Ctrl + Shift + D`**: 現在行（または選択中の複数行）を下へ複製。
- **`Ctrl + Shift + ↑ / ↓`**: 同一セル内で現在行（または選択行）を上下に移動。
- **`Ctrl + B`**: 選択した文字列を太字強調 (`**...**`)。
- **`Ctrl + I`**: 選択した文字列を斜体 (`*...*`)。
- **`Ctrl + ← / →`**: 現在行の行頭 / 行末へカーソル移動。
- **`Ctrl + ↑ / ↓`**: セルの先頭（1行目） / セルの末尾へカーソル移動。
- **`Ctrl + H`**: セル内文字列置換プロンプトを開く（対話型置換: `y`で置換 / `n`でスキップ / `a`で一括置換 / `q`または`Esc`で終了）。
- **`Ctrl + G`**: セル内指定行ジャンププロンプトを開く (Go to Line)。
- **`Ctrl + Alt + L`**: エディタビュー内で現在カーソルのある行をヘッダー下線から12行下の位置に移動。

### Command モード (セルの選択・ナビゲーション・操作)
- **`Enter`**: 選択中のセルの編集を開始 (Edit モードへ移行)。
- **`J`** または **`Ctrl + ↓`**: 下のセルを選択。
- **`K`** または **`Ctrl + ↑`**: 上のセルを選択。
- **`↑ / ↓`**: ページをコマ送りスクロール（上下移動）。
- **`H`** または **`←`**: 左のペインへフォーカス移動（複数ペイン分割時）。
- **`L`** または **`→`**: 右のペインへフォーカス移動（複数ペイン分割時）。
- **`Shift + ↑ / ↓`** または **`Shift + J / K`**: 複数セルを選択範囲に追加 / 縮小。
- **`Shift + クリック`**: 起点からクリックしたセルまでを範囲選択。
- **`Esc`**: 複数セル選択を解除（起点セルの単独選択へ戻す）。
- **`Ctrl + Shift + ↑ / ↓`**: 選択中のセルを上下に移動（順序入れ替え）。
- **`A`**: 選択中セルの **上** に新規セルを挿入。
- **`B`**: 選択中セルの **下** に新規セルを挿入。
- **`D, D`** (Dを2回連続で押す): 選択中のセルを削除。
- **`C`**: 選択中のセルをコピー。
- **`X`**: 選択中のセルをカット (切り取り)。
- **`V`**: コピー/カットしたセルを下に貼り付け。
- **`Shift + V`**: コピー/カットしたセルを上に貼り付け。
- **`Shift + M`**: 選択された複数のセルを 1 つに結合。
- **`Ctrl + Alt + -`**: 選択中のセルを中央で分割 (Split Cell)。
- **`Z`** または **`Ctrl + Z`**: セル操作を Undo (元に戻す)。
- **`Shift + Z`** または **`Ctrl + Y`**: セル操作を Redo (やり直す)。
- **`Ctrl + A`**: すべてのセルを選択。
- **`Ctrl + Alt + L`**: 選択セルの上枠をヘッダー下線から2行下の位置に移動。
- **`G, G`**: 先頭セルへ移動。
- **`[番号] + G, G`** (例: `5gg`): 指定した番号のセルへジャンプ。
- **`Shift + G`**: 末尾セルへ移動。
- **`Shift + Enter`**: セルを実行（プレビュー表示）。
- **`Ctrl + \`**: エディタ画面を垂直分割（最大3ペイン）。

### ファイルブラウザショートカット (セル非入力時)
- **`Ctrl + C`**: 選択中のファイルまたはフォルダをコピー。
- **`Ctrl + X`**: 選択中のファイルまたはフォルダをカット (切り取り)。
- **`Ctrl + V`**: コピー/カットしたファイルまたはフォルダを現在のディレクトリに貼り付け。

---

## 技術スタック (Technical Stack)

- **バックエンド**: Python (FastAPI, Uvicorn, Jinja2, WebSockets)
- **フロントエンド**: HTML5, Vanilla JavaScript, Tailwind CSS
- **サニタイザー**: DOMPurify (XSS 防止)
- **Markdown パーサー**: Marked.js
- **LaTeX 数式レンダラー**: KaTeX (`$` および `$$` 記法をサポート)
- **コードハイライト**: Highlight.js
- **ベクター絵文字**: Twemoji

---

## 自動テストの実行 (Running Automated Tests)

Python 標準の `unittest` を使用して、バックエンドおよびパーサーのテストを実行できます：

```bash
python3 -m unittest discover tests
```

---

## ライセンス (License)

MIT License
