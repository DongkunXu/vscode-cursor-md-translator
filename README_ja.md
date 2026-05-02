<p align="center">
  <img src="images/icon.png" width="96" alt="Markdown Translator">
</p>

<h1 align="center">vscode-cursor-md-translator</h1>

<p align="center">
  <a href="README.md">English</a> &nbsp;|&nbsp;
  <a href="README_zh.md">中文</a> &nbsp;|&nbsp;
  <b>日本語</b>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.80+-blue?logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/Cursor-compatible-green" alt="Cursor">
  <a href="https://github.com/DongkunXu/vscode-cursor-md-translator/releases"><img src="https://img.shields.io/github/v/release/DongkunXu/vscode-cursor-md-translator" alt="Release"></a>
</p>

<p align="center">
  Markdown ファイルのフォーマットを一切損なわずに翻訳します。<br>
  <b>VS Code</b>・<b>Cursor</b> およびすべての VS Code ベースのエディタに対応。<br>
  OpenAI 互換 API（OpenAI・DeepSeek・Ollama など）を幅広くサポート。
</p>

---

<p align="center">
  <img src="images/Japanese%20Demo.png" width="80%" alt="翻訳デモ">
</p>

## 機能

- **フォーマット完全保持** — コードブロック・インラインコード・数式（`$$` / `$`）・テーブル・引用・タスクリスト・脚注をすべてプレースホルダーで保護し、LLM による改変を防止
- **ネイティブプレビュー** — VS Code 組み込みの Markdown プレビューで翻訳結果を表示。シンタックスハイライト・テーマ・プラグインがそのまま動作
- **あらゆる OpenAI 互換 API** — OpenAI・DeepSeek・Azure OpenAI・Ollama（ローカル）など `/chat/completions` を実装したサービスに対応
- **スマートチャンク分割** — 見出しや段落の区切りでドキュメントを分割。ファイルサイズの制限なし
- **ステータスバーからワンクリック** — どのパネルにフォーカスがあっても、底部の `$(globe) Translate` ボタンから常に起動可能
- **18 言語対応** — ステータスバーのタグをクリックするだけで翻訳先言語を切り替え

## インストール

**GitHub Releases からインストール（推奨）**

1. [**Releases**](https://github.com/DongkunXu/vscode-cursor-md-translator/releases) から最新の `.vsix` をダウンロード
2. `Cmd+Shift+P` → **Extensions: Install from VSIX…** → ファイルを選択
3. `Cmd+Shift+P` → **Developer: Reload Window**

**ソースからビルド**

```bash
git clone https://github.com/DongkunXu/vscode-cursor-md-translator.git
cd vscode-cursor-md-translator
npm install && npm run generate-icon && npm run compile && npm run package
# 生成された .vsix を上記手順でインストール
```

## 設定

設定（`Cmd+,`）で **"Markdown Translator"** を検索するか、`settings.json` に直接追記します。

| 設定キー | デフォルト値 | 説明 |
|---|---|---|
| `mdTranslator.apiBaseUrl` | `https://api.openai.com/v1` | API ベース URL |
| `mdTranslator.apiKey` | *(空)* | API キー |
| `mdTranslator.model` | `gpt-4o` | モデル名 |
| `mdTranslator.targetLanguage` | `Chinese (Simplified)` | 翻訳先言語 |
| `mdTranslator.chunkSize` | `3000` | 1 回の API 呼び出しの最大文字数 |
| `mdTranslator.requestTimeoutMs` | `90000` | タイムアウト（ミリ秒） |

**プロバイダー設定例**

<details>
<summary>OpenAI</summary>

```jsonc
"mdTranslator.apiBaseUrl": "https://api.openai.com/v1",
"mdTranslator.apiKey": "sk-...",
"mdTranslator.model": "gpt-4o"
```
</details>

<details>
<summary>DeepSeek</summary>

```jsonc
"mdTranslator.apiBaseUrl": "https://api.deepseek.com/v1",
"mdTranslator.apiKey": "sk-...",
"mdTranslator.model": "deepseek-chat"
```
</details>

<details>
<summary>Ollama（ローカル・API キー不要）</summary>

```jsonc
"mdTranslator.apiBaseUrl": "http://localhost:11434/v1",
"mdTranslator.apiKey": "ollama",
"mdTranslator.model": "llama3"
```
</details>

## 使い方

`.md` ファイルを開いた状態で、以下のいずれかの方法で翻訳を開始します。

| 起動方法 | 操作 |
|---|---|
| **ステータスバー** | 右下の `$(globe) Translate` ボタンをクリック |
| **右クリックメニュー** | エディタ内で右クリック → *Markdown Translator: Open Translated Preview* |
| **コマンドパレット** | `Cmd+Shift+P` → *Markdown Translator: …* |

**翻訳先言語の変更** — ステータスバーの `→ Chinese (Simplified)` ラベルをクリックすると言語選択ピッカーが開きます。

**新規ドキュメントとして翻訳** — *Markdown Translator: Translate to New Document* で翻訳結果を編集可能な新規ドキュメントとして開き、任意のパスに保存できます。

## 仕組み

```
元の .md ファイル
    │
    ├─ 1. YAML フロントマターを抽出（そのまま保持）
    ├─ 2. コードブロック / インラインコード / 数式をプレースホルダーに置換
    ├─ 3. 相対パスの画像 URL を絶対 file:// URI に変換
    ├─ 4. 見出し / 段落の境界でチャンク分割
    ├─ 5. 各チャンクを LLM で翻訳（temperature 0.1）
    └─ 6. プレースホルダーを復元 → VS Code 組み込みプレビューで表示
```

## コントリビューション

PR 歓迎です。大きな変更の場合は、先に Issue を開いてご相談ください。

## ライセンス

[MIT](LICENSE) © 2025 [Dongkun Xu](https://github.com/DongkunXu)
