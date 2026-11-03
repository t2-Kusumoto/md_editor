================================================================================
 MD Editor (mded) - Linux Standalone Installation Package
================================================================================

[English]
This package provides a standalone, user-space installation of MD Editor (mded)
for Linux desktop environments (such as Ubuntu).

No root privileges (sudo) are required. All files are installed cleanly into
your user directory ($HOME/.local/).

--------------------------------------------------------------------------------
 1. System Requirements & Binary Compatibility
--------------------------------------------------------------------------------
- Architecture: x86_64 (64-bit Intel/AMD)
- Build Environment: Built on Ubuntu 22.04 LTS (glibc 2.35)
- Compatible Systems: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12+,
  Fedora 36+, or any modern Linux distribution with glibc >= 2.35.

--------------------------------------------------------------------------------
 2. Package Contents
--------------------------------------------------------------------------------
- mded            : Standalone executable binary (built with PyInstaller)
- mded_icon.png   : Application icon image
- mded.desktop    : FreeDesktop-compliant desktop entry file
- setup.sh        : Installation script
- uninstall.sh    : Uninstallation script
- README.txt      : This document

--------------------------------------------------------------------------------
 3. Installation
--------------------------------------------------------------------------------
Open a terminal in this extracted directory and run:

    ./setup.sh

What setup.sh does:
  1. Installs the executable to:
       ~/.local/bin/mded
  2. Installs the application icon to:
       ~/.local/share/icons/mded_icon.png
  3. Configures and installs the desktop entry to:
       ~/.local/share/applications/mded.desktop
  4. Updates the desktop database for immediate GUI application menu integration.

--------------------------------------------------------------------------------
 4. How to Launch
--------------------------------------------------------------------------------
- From Terminal:
    mded                       # Launch with current directory as workspace
    mded document.md           # Directly open a specific Markdown file

  * Note: If 'mded' is not recognized in terminal, ensure ~/.local/bin is in
    your PATH by adding the following to your ~/.bashrc or ~/.profile:
      export PATH="$HOME/.local/bin:$PATH"

- From Desktop GUI:
  - Search for "MD Editor" in your application launcher / start menu.
  - Right-click any .md file in your file manager and select:
      "Open With" -> "MD Editor"

--------------------------------------------------------------------------------
 5. Uninstallation
--------------------------------------------------------------------------------
To cleanly remove MD Editor, run from this directory:

    ./uninstall.sh

Or manually remove the installed files:
    rm -f ~/.local/bin/mded
    rm -f ~/.local/share/icons/mded_icon.png
    rm -f ~/.local/share/applications/mded.desktop


================================================================================
 [日本語] MD Editor (mded) - Linux スタンドアロン導入パッケージ
================================================================================

本パッケージは、Ubuntu をはじめとする Linux デスクトップ環境向けに、
MD Editor (mded) の単体実行ファイルを手軽にセットアップ・アンインストールするためのものです。

管理者権限 (sudo) は一切不要で、ユーザーのホームディレクトリ ($HOME/.local/) 内に
安全に配置されます。

--------------------------------------------------------------------------------
 1. 動作環境・バイナリビルド環境
--------------------------------------------------------------------------------
- アーキテクチャ: x86_64 (64bit Intel/AMD)
- ビルド環境: Ubuntu 22.04 LTS (glibc 2.35) 上でビルドされた実行ファイルです。
- 対象OS: Ubuntu 22.04 LTS 以降（Ubuntu 24.04 等）、Debian 12+、Fedora 36+ 等、
  glibc 2.35 以上が動作する x86_64 Linux 環境。

--------------------------------------------------------------------------------
 2. 同梱ファイル一覧
--------------------------------------------------------------------------------
- mded            : アプリケーション本体（PyInstaller 単一実行バイナリ）
- mded_icon.png   : アプリアイコン画像
- mded.desktop    : デスクトップエントリ設定ファイル
- setup.sh        : セットアップ用スクリプト
- uninstall.sh    : アンインストール用スクリプト
- README.txt      : 本説明ファイル

--------------------------------------------------------------------------------
 3. インストール手順
--------------------------------------------------------------------------------
本ディレクトリ内でターミナルを開き、以下を実行してください:

    ./setup.sh

【配置先】
  1. 実行ファイル: ~/.local/bin/mded
  2. アイコン画像: ~/.local/share/icons/mded_icon.png
  3. デスクトップエントリ: ~/.local/share/applications/mded.desktop

--------------------------------------------------------------------------------
 4. 起動方法
--------------------------------------------------------------------------------
- ターミナルから起動:
    mded                       # カレントディレクトリをワークスペースとして起動
    mded document.md           # 指定した Markdown ファイルを開いて起動

  ※ コマンドが見つからないと表示される場合は、~/.bashrc に以下を追記してください:
      export PATH="$HOME/.local/bin:$PATH"

- デスクトップ GUI から起動:
  - アプリケーションメニュー / ランチャーから「MD Editor」を選択
  - ファイルマネージャーで .md ファイルを右クリック ->「別のアプリケーションで開く」
    から「MD Editor」を選択

--------------------------------------------------------------------------------
 5. アンインストール手順
--------------------------------------------------------------------------------
アンインストールしたい場合は、本ディレクトリで以下を実行します:

    ./uninstall.sh

配置されたファイル（~/.local/bin/mded 等）が綺麗に削除されます。
================================================================================
