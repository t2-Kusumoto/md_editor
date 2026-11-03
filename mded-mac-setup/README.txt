================================================================================
 MD Editor (mded) - macOS Installation Package
================================================================================

[English]
This package provides a standalone, user-space installation of MD Editor (mded)
for macOS (OS X 10.15 Catalina or later, including macOS 11+ on Intel and Apple Silicon).

No root/administrator privileges (sudo) are required. All components are installed
cleanly into your user directory:
  - Command-Line Binary : ~/.local/bin/mded
  - Application Bundle  : ~/Applications/MD Editor.app

--------------------------------------------------------------------------------
 1. Package Contents
--------------------------------------------------------------------------------
- mded                  : Standalone macOS binary (place your compiled binary here)
- mded_icon.icns        : High-resolution macOS application icon (.icns)
- mded_icon.png         : Original PNG icon
- Info.plist            : macOS bundle metadata and .md file type association
- mded-launcher         : Launch wrapper script for the .app bundle
- setup.sh              : Installation script
- uninstall.sh          : Uninstallation script
- mded.placeholder      : Placement instructions for the 'mded' binary
- README.txt            : This document

--------------------------------------------------------------------------------
 2. Preparation (Placing the Executable Binary)
--------------------------------------------------------------------------------
Before running setup.sh, please place the compiled macOS executable binary named
'mded' in this folder:

    mded_setup_and_uninstall_mac/mded

(e.g., built on macOS using `python3 build.py` from the project repository)

Make sure it has execution permissions:
    chmod +x mded

--------------------------------------------------------------------------------
 3. Installation
--------------------------------------------------------------------------------
Open Terminal, navigate to this folder, and run:

    ./setup.sh

What setup.sh does:
  1. Copies 'mded' to ~/.local/bin/mded (for terminal usage).
  2. Creates ~/Applications/MD Editor.app with high-resolution icon and
     file associations for Markdown documents (.md, .markdown).
  3. Registers the application with macOS Launch Services for Finder and Spotlight.

--------------------------------------------------------------------------------
 4. How to Launch
--------------------------------------------------------------------------------
- From Terminal:
    mded                       # Launch with current directory as workspace
    mded document.md           # Directly open a specific Markdown file

  * Note: If 'mded' is not recognized, add ~/.local/bin to your PATH by adding
    the following line to ~/.zshrc (or ~/.bash_profile):
      export PATH="$HOME/.local/bin:$PATH"

- From Desktop GUI:
  - Open Launchpad or press Cmd + Space (Spotlight) and type "MD Editor".
  - In Finder, right-click any .md file -> "Open With" -> "MD Editor".

--------------------------------------------------------------------------------
 5. macOS Security (Gatekeeper Notice)
--------------------------------------------------------------------------------
If macOS displays a warning such as "MD Editor cannot be opened because the
developer cannot be verified":
  1. Open System Settings -> "Privacy & Security".
  2. Scroll to "Security" and click "Open Anyway" for MD Editor.
  (Or in terminal: xattr -dr com.apple.quarantine ~/Applications/"MD Editor.app")

--------------------------------------------------------------------------------
 6. Uninstallation
--------------------------------------------------------------------------------
To cleanly remove MD Editor, run:

    ./uninstall.sh


================================================================================
 [日本語] MD Editor (mded) - macOS 向け導入パッケージ
================================================================================

本パッケージは、macOS (macOS 10.15 Catalina 以降、Intel および Apple Silicon 対応)
向けに、MD Editor (mded) の CLI コマンドおよび GUI アプリケーションをセットアップ
するためのツールキットです。

管理者権限 (sudo) は一切不要で、ユーザー環境 ($HOME) 内に安全にインストールされます。
  - CLI コマンド       : ~/.local/bin/mded
  - アプリケーション   : ~/Applications/MD Editor.app

--------------------------------------------------------------------------------
 1. 同梱ファイル一覧
--------------------------------------------------------------------------------
- mded                  : macOS 用実行可能バイナリ (ここに配置してください)
- mded_icon.icns        : 高解像度 macOS アイコンファイル (.icns)
- mded_icon.png         : 元の PNG アイコン
- Info.plist            : macOS .app 用メタデータおよび Markdown ファイル関連付け設定
- mded-launcher         : .app 用起動ラッパースクリプト
- setup.sh              : macOS セットアップスクリプト
- uninstall.sh          : macOS アンインストールスクリプト
- mded.placeholder      : バイナリ配置に関する説明ファイル
- README.txt            : 本説明書

--------------------------------------------------------------------------------
 2. 事前準備 (実行ファイル mded の配置)
--------------------------------------------------------------------------------
setup.sh を実行する前に、macOS 環境でビルドした実行ファイル 'mded' を本フォルダに
配置してください:

    mded_setup_and_uninstall_mac/mded

(プロジェクトルートで `python3 build.py` を実行すると dist/mded が生成されます)

実行権限を付与します:
    chmod +x mded

--------------------------------------------------------------------------------
 3. インストール手順
--------------------------------------------------------------------------------
ターミナルで本ディレクトリを開き、以下を実行します:

    ./setup.sh

【行われる処理】
  1. ~/.local/bin/mded に実行ファイルを配置 (ターミナルからの利用用)
  2. ~/Applications/MD Editor.app を自動構築 (アイコン・ファイル関連付けを設定)
  3. Launch Services に登録し、Spotlight や Finder から即時利用可能にします。

--------------------------------------------------------------------------------
 4. 起動方法
--------------------------------------------------------------------------------
- ターミナルから起動:
    mded                       # カレントディレクトリをワークスペースとして起動
    mded document.md           # 指定した Markdown ファイルを開いて起動

  ※ コマンドが見つからない場合は、~/.zshrc に以下を追記してください:
      export PATH="$HOME/.local/bin:$PATH"

- デスクトップ GUI から起動:
  - Spotlight (Cmd + Space) または Launchpad で「MD Editor」を検索して起動。
  - Finder で .md ファイルを右クリック ->「このアプリケーションで開く」->「MD Editor」

--------------------------------------------------------------------------------
 5. macOS セキュリティ (Gatekeeper) について
--------------------------------------------------------------------------------
初回起動時に「開発元が未確認のため開けません」と警告が出た場合:
  1. 「システム設定」->「プライバシーとセキュリティ」を開きます。
  2. 「セキュリティ」項目の「このまま開く」をクリックして許可します。
  (またはターミナルで `xattr -dr com.apple.quarantine ~/Applications/"MD Editor.app"` を実行)

--------------------------------------------------------------------------------
 6. アンインストール手順
--------------------------------------------------------------------------------
アンインストールしたい場合は、本ディレクトリで以下を実行します:

    ./uninstall.sh

配置された ~/.local/bin/mded および ~/Applications/MD Editor.app が安全に削除されます。
================================================================================
