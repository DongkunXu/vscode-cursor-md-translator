<p align="center">
  <img src="images/icon.png" width="96" alt="Markdown Translator">
</p>

<h1 align="center">vscode-cursor-md-translator</h1>

<p align="center">
  <b>English</b> &nbsp;|&nbsp;
  <a href="README_zh.md">中文</a> &nbsp;|&nbsp;
  <a href="README_ja.md">日本語</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.80+-blue?logo=visualstudiocode&logoColor=white" alt="VS Code">
  <img src="https://img.shields.io/badge/Cursor-compatible-green" alt="Cursor">
  <a href="https://github.com/DongkunXu/vscode-cursor-md-translator/releases"><img src="https://img.shields.io/github/v/release/DongkunXu/vscode-cursor-md-translator" alt="Release"></a>
</p>

<p align="center">
  Translate any Markdown file without losing a single character of formatting.<br>
  Works with <b>VS Code</b>, <b>Cursor</b>, and any VS Code-based editor.<br>
  Powered by any OpenAI-compatible API — OpenAI, DeepSeek, Ollama, and more.
</p>

---

## Features

- **Format-preserving** — fenced code blocks, inline code, math (`$$` / `$`), tables, blockquotes, task lists, footnotes: all protected via placeholders, never touched by the model
- **Native preview** — side-by-side translated preview using VS Code's built-in Markdown renderer (full syntax highlighting, themes, plugins)
- **Any OpenAI-compatible API** — OpenAI, DeepSeek, Azure OpenAI, Ollama (local), or any service implementing `/chat/completions`
- **Smart chunking** — splits large documents at heading and paragraph boundaries; no file size limit
- **Status bar access** — `$(globe) Translate` button always visible regardless of focused panel
- **18 target languages** — switch with one click from the status bar

## Installation

**From GitHub Releases (recommended)**

1. Download the latest `.vsix` from [**Releases**](https://github.com/DongkunXu/vscode-cursor-md-translator/releases)
2. `Cmd+Shift+P` → **Extensions: Install from VSIX…** → select the file
3. `Cmd+Shift+P` → **Developer: Reload Window**

**From source**

```bash
git clone https://github.com/DongkunXu/vscode-cursor-md-translator.git
cd vscode-cursor-md-translator
npm install && npm run generate-icon && npm run compile && npm run package
# Install the generated .vsix as above
```

## Configuration

Search **"Markdown Translator"** in Settings (`Cmd+,`), or edit `settings.json` directly:

| Setting | Default | Description |
|---|---|---|
| `mdTranslator.apiBaseUrl` | `https://api.openai.com/v1` | API base URL |
| `mdTranslator.apiKey` | *(empty)* | Your API key |
| `mdTranslator.model` | `gpt-4o` | Model name |
| `mdTranslator.targetLanguage` | `Chinese (Simplified)` | Target language |
| `mdTranslator.chunkSize` | `3000` | Characters per API call |
| `mdTranslator.requestTimeoutMs` | `90000` | Request timeout (ms) |

**Provider examples**

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
<summary>Ollama (local, no key required)</summary>

```jsonc
"mdTranslator.apiBaseUrl": "http://localhost:11434/v1",
"mdTranslator.apiKey": "ollama",
"mdTranslator.model": "llama3"
```
</details>

## Usage

Open any `.md` file. Three entry points:

| Entry point | How |
|---|---|
| **Status bar** | Click `$(globe) Translate` in the bottom-right corner |
| **Right-click** | Right-click in editor → *Markdown Translator: Open Translated Preview* |
| **Command palette** | `Cmd+Shift+P` → *Markdown Translator: …* |

**Change language** — click the `→ Chinese (Simplified)` pill next to the Translate button.

**Translate to a new file** — *Markdown Translator: Translate to New Document* opens the result as an editable, saveable document.

## How it works

```
Original .md
    │
    ├─ 1. Extract YAML front matter (preserved verbatim)
    ├─ 2. Replace code blocks / inline code / math with placeholders
    ├─ 3. Resolve relative image paths → absolute file:// URIs
    ├─ 4. Split at heading / paragraph boundaries
    ├─ 5. Translate each chunk via LLM  (temperature 0.1)
    └─ 6. Restore placeholders → VS Code built-in preview
```

## Contributing

PRs are welcome. Please open an issue first for major changes.

```bash
git clone https://github.com/DongkunXu/vscode-cursor-md-translator.git
npm install
npm run watch   # TypeScript watch mode
# Press F5 in VS Code to launch Extension Development Host
```

## License

[MIT](LICENSE) © 2025 [Dongkun Xu](https://github.com/DongkunXu)
