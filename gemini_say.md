`md_editor` のソースコード一式を解析しました。Vanilla JSとFastAPIを組み合わせ、ビルドステップなしで3ペイン分割・タブ管理・Vim風ナビゲーション・インライン置換・コメントハイライトまで実装されており、設計方針（`AGENTS.md`）に忠実で完成度の高い構成です。

現在の「Vanilla JS単一ファイル＋FastAPI」のアーキテクチャを維持したまま、修正すべき**バグ・セキュリティリスク・改善点**を重要度順にまとめました。

---

## 1. フロントエンド (`app.js` / `style.css`) のバグと修正点

### ① コードブロック内の `$` や `<!-- cell -->` が破壊される問題（重要度：高）

* **原因1（数式と絵文字の先行置換）**: `renderMarkdownWithMath()` 内で、`marked.parse(text)` を呼ぶ**前**に正規表現で `$$...$$` や `$...$`、`:emoji:` を置換しています。そのため、コードブロック（````bash` や ``inline``）の中に `$PATH` と `$HOME` のように `$` が2つ登場すると、コードブロック内にもかかわらず数式プレースホルダー（`MATHINLINEPH0`）に置換され、KaTeXのHTMLタグがコードブロック内に展開されてしまいます。


* **原因2（`String.prototype.replace` の特殊パターン解釈）**: `html = html.replace(ph.id, mathHtml)` でプレースホルダーを戻す際、JavaScriptの `replace` 第2引数では `$$` や `$&` が特殊文字として解釈されるため、数式内に `$` が含まれると出力が壊れます。


* **原因3（セル分割タグの単純 `split`）**: `createDocumentModel()` で `content.split('<!-- cell -->')` を行っているため、コードブロック内に `<!-- cell -->` と記述したドキュメントを保存・再読み込みすると、コードブロックの途中でセルが分断されます。



**【推奨する修正（`renderMarkdownWithMath`）】**
コードブロック（````...```` と ``...``）を先にプレースホルダーへ退避させてから数式を抽出し、復元時は関数渡し `() => mathHtml` を使用します。

```javascript
function renderMarkdownWithMath(text, currentDirPath = '') {
    if (!text) return '';
    text = text.replace(/\r\n/g, '\n');

    // 1. コードブロックとインラインコードを先に退避して保護
    const codePlaceholders = [];
    text = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
        const id = `CODEBLOCKPH${codePlaceholders.length}END`;
        codePlaceholders.push({ id, content: match });
        return id;
    });

    // 2. 数式を退避
    const mathPlaceholders = [];
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        const id = `MATHBLOCKPH${mathPlaceholders.length}END`;
        mathPlaceholders.push({ id, formula: formula.trim(), displayMode: true });
        return id;
    });
    text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        const id = `MATHINLINEPH${mathPlaceholders.length}END`;
        mathPlaceholders.push({ id, formula: formula.trim(), displayMode: false });
        return id;
    });

    text = replaceEmojiShortcodes(text);

    // 3. コードブロックを戻してから marked でパース
    codePlaceholders.forEach(cp => {
        text = text.replace(cp.id, () => cp.content);
    });
    let html = marked.parse(text);

    // 4. 数式を KaTeX でレンダリングして復元（第2引数は関数にする）
    mathPlaceholders.forEach(ph => {
        try {
            const mathHtml = katex.renderToString(ph.formula, {
                displayMode: ph.displayMode,
                throwOnError: false
            });
            html = html.replace(ph.id, () => mathHtml);
        } catch (e) {
            html = html.replace(ph.id, () => `<span class="text-red-500">LaTeX Error: ${escapeHtml(ph.formula)}</span>`);
        }
    });

    if (currentDirPath !== null) {
        html = html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, prefix, src, suffix) => {
            const newSrc = resolveImageSource(src, currentDirPath);
            return `<img ${prefix}src="${newSrc}"${suffix}>`;
        });
    }
    return html;
}

```

---

### ② 未保存変更モーダル（`unsaved-modal`）の対象ドキュメント取り違えバグ（重要度：高）

* **問題点**: 非アクティブなタブや別ペインのタブの「×」ボタンを押して `closeTab(paneIdx, docId)` が呼ばれた際、`checkUnsavedChangesForDoc(doc, ...)` でモーダルが表示されます。しかし、`unsaved-dont-save-btn` と `unsaved-save-btn` のクリックハンドラ内では **`const doc = getActiveDocument();`** を参照しています。


* **影響**: 非アクティブなタブを閉じようとして「Save as」や「Don't Save」をクリックすると、**閉じようとしたタブではなく、現在アクティブな別タブが保存されたり、未保存フラグ（`isModified`）が消去されたりします**。


* **修正案**: `pendingAction` と同じように `let pendingDoc = null;` を用意し、`checkUnsavedChangesForDoc(doc, onConfirm)` で `pendingDoc = doc;` を保持してモーダル内で参照するように修正してください。



---

### ③ CSSのプロパティ名ミスによるスタイル未適用 (`style.css`)（重要度：中）

`md_editor/static/css/style.css` 内にブラウザで無効となる記述が2箇所あります。

1. **12行目・22行目（`.markdown-preview h1`, `h2`）**:
```css
border-b-width: 1px; /* ← Tailwindのクラス名と混同されており無効 */

```


正しくは `border-bottom-width: 1px; border-bottom-style: solid;`（または `border-bottom: 1px solid #e5e7eb;`）です。現在、エディタ上のプレビューでは `h1`, `h2` の下線が表示されていません（HTMLエクスポート側では正しく `border-bottom` と記述されています）。


2. **443行目（`.cell-comment-backdrop`）**:
```css
z-index: 1.5; /* ← CSSのz-indexは整数のみ有効。小数はブラウザに無視される */

```


正しくは整数値（`1`, `2`, `10` など）で階層を整理する必要があります。



---

### ④ デッドコードと機能の一貫性（重要度：低〜中）

* **`saveNotebook()` 内の `doc.isNew` 判定**:
`if (doc.isNew && !doc.relPath && fileExists)` というコードがありますが、`createDocumentModel()` は `isNew` プロパティをオブジェクトに持たせていません（常に `undefined` になります）。


* **通常プレビューでの Twemoji 未適用**:
HTMLエクスポートやPDFエクスポート時には `applyTwemojiToElement()` が呼ばれていますが、`renderCells()` および `renderCellAt()` の通常プレビュー時には呼ばれていません。エディタ上の表示とエクスポート結果の絵文字デザインを揃える場合は、プレビュー描画後にも `applyTwemojiToElement(previewEl)` を呼ぶのが適切です。



---

## 2. バックエンド (`main.py`) とクロスプラットフォーム互換性の問題点

### ① Windows環境におけるパス区切り文字（`\` vs `/`）の不整合（重要度：高）

* **問題点**: `main.py` の各エンドポイントでは `os.path.relpath(file_path, BASE_DIR)` をそのまま返しています。Windows環境で実行した場合、`rel_path` は `subfolder\note.md` のようにバックスラッシュ区切りになります。一方、フロントエンド（`app.js`）はすべて `relPath.includes('/')` や `relPath.split('/')` のようにスラッシュ（`/`）前提で実装されています。


* **影響**: Windows上でサブフォルダ内のファイルを操作（作成・リネーム・移動・削除・画像参照）すると、パスの比較や親ディレクトリの抽出が失敗します。


* **修正案**: `main.py` で相対パスを生成するヘルパー関数を作り、常に `/` 区切り（POSIX形式）に正規化してフロントエンドへ返すように統一してください。


```python
def to_posix_relpath(target_path: str, base_dir: str) -> str:
    return os.path.relpath(target_path, base_dir).replace("\\", "/")

```



---

### ② `async def` 内でのブロッキングI/Oによるサーバーフリーズ（重要度：中〜高）

* **問題点**: FastAPIで `async def` として定義されたエンドポイント内で同期的なブロッキング処理を行うと、メインのイベントループ全体が停止します。特に `@app.post("/api/convert-images-base64")` は `async def` の中で `urllib.request.urlopen(url_req, timeout=6)` をループ実行しているため、外部画像の取得に時間がかかると最大 `6秒 × 画像枚数` のあいだサーバー全体（WebSocket等を含む）が完全にブロックされます。


* **修正案**:
* `await` を使用していないエンドポイント（`convert_images_base64`, `get_files`, `create_folder`, `create_file`, `save_file`, `load_file`, `delete_item`, `rename_item`, `copy_file_item`）は、`async def` ではなく通常の **`def`** に変更してください。FastAPIは通常の `def` エンドポイントを自動的に外部スレッドプールで実行するため、イベントループがブロックされなくなります。


* また、`convert_images_base64` の `resp.read()` にはサイズ上限（例：`resp.read(10 * 1024 * 1024)` で10MBまで）を設けないと、巨大なURLが指定された際にメモリ枯渇を起こすリスクがあります。





---

### ③ 既存セッション検出時（`start()`）のUXとWebSocket切断シャットダウン（重要度：中）

* **既存セッション検出時**: `main.py` の `start()` で同一ディレクトリの起動済みポートを見つけた際、メッセージを出して `return` するだけになっています。誤ってブラウザのタブを閉じた直後（3秒の猶予期間内）に再度コマンドを叩いた場合などに備え、`webbrowser.open(f"http://127.0.0.1:{port}")` を実行してから `return` する方が親切です。


* **WebSocket切断時の自動終了リスク**: 現在、WebSocketが切断されて3秒経過するとサーバーが自動終了します。しかし、PCのスリープ復帰時やブラウザのバックグラウンドスロットリング等でWebSocketが一時切断された場合、**未保存の編集データがあってもバックエンドが勝手に終了してしまい、その後 Ctrl+S を押しても保存エラーになる**危険があります。


* フロントエンドの `connectWebSocket()` に `ws.onclose` 時の自動再接続（リトライ）処理を入れることを強く推奨します。





---

### ④ 文字コードエラーへの耐性（重要度：低〜中）

* `load_file` で `open(real_path, "r", encoding="utf-8")` としていますが、Shift_JIS（CP932）等で保存された既存の `.md` ファイルを開くと `UnicodeDecodeError` で `500 Internal Server Error` になります。`utf-8` で失敗した場合は `cp932` を試すか、`errors="replace"` を指定すると堅牢になります。



---

## 3. セキュリティ面の注意点

### ローカルXSSによる任意ファイル操作のリスク（重要度：高）

* **問題点**:
1. `marked.parse()` の出力をサニタイズせずに `innerHTML` に挿入しています。


2. `renderFileList()` や `renderTabs()` でも、ファイル名・フォルダ名を `escapeHtml()` を通さずにテンプレートリテラルで `innerHTML` に展開している箇所があります。




* **リスク**: 本アプリはローカルのファイル削除（`/api/delete`）や書き換え（`/api/save`）を行うAPIを認証なしで公開しています。そのため、インターネットからダウンロードした第三者の `.md` ファイルをこのエディタで開いた場合、そのファイル内に `<img src=x onerror="fetch('/api/delete/...', {method:'DELETE'})">` のようなスクリプトが仕込まれていると、ワークスペース内のファイルが削除・流出する危険があります。


* **修正案**:
* CDNに **`DOMPurify`**（`https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js`）を1行追加し、`DOMPurify.sanitize(html)` を通してから描画するようにすると安全です。


* ファイルリストやタブの描画時は `escapeHtml(file)` を徹底してください。





---

## 4. ビルド・パッケージング・構成管理の改善点

1. **リポジトリ内の `dist/md-editor` バイナリの削除**:
`.gitignore` に `dist/` が指定されていますが、パッケージ内にビルド済みのELFバイナリ（`dist/md-editor`）が残っています。配布アーカイブやGit管理からは削除することをお勧めします。


2. **CDNライブラリのバージョン固定 (`index.html`)**:
Marked.js（`npm/marked/marked.min.js`）と Twemoji（`@twemoji/api@latest`）がバージョン未指定（最新取得）になっています。Marked.js はメジャーアップデートでAPIの破壊的変更（例：v4→v5→v12でのオプション廃止やレンダラー仕様変更）が頻繁に行われるため、`marked@9.1.6` のようにバージョンを固定しないと、将来突然動かなくなるリスクがあります。


3. **PyInstaller ビルド (`build.py`) での Hidden Import 対策**:
`uvicorn` を `--onefile` で固める際、環境によってはWebSocketプロトコル実装がバンドルから漏れて `/ws` エンドポイントが `404` または `500` になることがあります。`build.py` の `cmd` に `--hidden-import uvicorn.protocols.websockets.auto`（または `websockets`）を追加しておくと確実です。



---

特に優先して修正したい箇所（例：数式とコードブロックのパーサー修正、未保存モーダルのバグ修正など）があれば、そのまま貼り付けて使える修正コードを作成しますのでお知らせください。