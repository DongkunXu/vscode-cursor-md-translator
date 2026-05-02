import * as vscode from 'vscode';
import { TranslatedDocumentProvider } from './previewProvider';
import { translateMarkdown, TranslationConfig } from './translator';

const SCHEME = 'md-translated';

const LANGUAGES = [
  'Chinese (Simplified)', 'Chinese (Traditional)', 'English',
  'Japanese', 'Korean', 'French', 'German', 'Spanish',
  'Portuguese (Brazil)', 'Russian', 'Arabic', 'Italian',
  'Dutch', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian',
];

const provider = new TranslatedDocumentProvider();

// Remembers the last active markdown editor so commands still work when
// a preview panel or non-markdown editor is focused.
let lastMarkdownEditor: vscode.TextEditor | undefined;

// Two status bar items (right-aligned, higher priority = further left).
// translateBtn  (priority 101) – one-click translate
// langBtn       (priority 100) – shows/changes target language
let translateBtn: vscode.StatusBarItem;
let langBtn: vscode.StatusBarItem;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider)
  );

  // Primary action button: always-visible, one click to translate.
  translateBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  translateBtn.text = '$(globe) Translate';
  translateBtn.command = 'mdTranslator.openTranslatedPreview';
  translateBtn.tooltip = 'Markdown Translator: open translated preview to the side';
  context.subscriptions.push(translateBtn);

  // Secondary button: shows current target language, click to change.
  langBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  langBtn.command = 'mdTranslator.selectTargetLanguage';
  context.subscriptions.push(langBtn);
  refreshLangBtn();

  context.subscriptions.push(
    vscode.commands.registerCommand('mdTranslator.openTranslatedPreview', () =>
      withMarkdownEditor(openTranslatedPreview)
    ),
    vscode.commands.registerCommand('mdTranslator.translateToNewDocument', () =>
      withMarkdownEditor(translateToNewDocument)
    ),
    vscode.commands.registerCommand('mdTranslator.refreshTranslation', () =>
      withMarkdownEditor(openTranslatedPreview)
    ),
    vscode.commands.registerCommand('mdTranslator.selectTargetLanguage', selectTargetLanguage)
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === 'markdown') {
        lastMarkdownEditor = editor;
        showStatusBar();
      } else {
        // Keep buttons visible as long as any markdown file is still open somewhere.
        const anyMarkdownOpen = vscode.window.visibleTextEditors.some(
          (e) => e.document.languageId === 'markdown'
        );
        anyMarkdownOpen ? showStatusBar() : hideStatusBar();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mdTranslator.targetLanguage')) {
        refreshLangBtn();
      }
    })
  );

  // Seed on activation.
  const initial = vscode.window.activeTextEditor;
  if (initial?.document.languageId === 'markdown') {
    lastMarkdownEditor = initial;
    showStatusBar();
  }
}

export function deactivate(): void {
  translateBtn?.dispose();
  langBtn?.dispose();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function openTranslatedPreview(document: vscode.TextDocument): Promise<void> {
  const translatedUri = document.uri.with({ scheme: SCHEME });
  const translated = await runWithProgress('Markdown Translator: translating…', () =>
    callTranslate(document)
  );
  if (translated === undefined) { return; }
  provider.setContent(translatedUri, translated);
  await vscode.commands.executeCommand('markdown.showPreviewToSide', translatedUri);
}

async function translateToNewDocument(document: vscode.TextDocument): Promise<void> {
  const translated = await runWithProgress('Markdown Translator: translating…', () =>
    callTranslate(document)
  );
  if (translated === undefined) { return; }
  const newDoc = await vscode.workspace.openTextDocument({
    content: translated,
    language: 'markdown',
  });
  await vscode.window.showTextDocument(newDoc, vscode.ViewColumn.Beside);
}

async function selectTargetLanguage(): Promise<void> {
  const current = getConfig().targetLanguage;
  const picked = await vscode.window.showQuickPick(
    LANGUAGES.map((lang) => ({
      label: lang,
      description: lang === current ? '(current)' : undefined,
    })),
    { title: 'Markdown Translator — Select Target Language', placeHolder: 'Choose a language' }
  );
  if (picked) {
    await vscode.workspace
      .getConfiguration('mdTranslator')
      .update('targetLanguage', picked.label, vscode.ConfigurationTarget.Global);
    refreshLangBtn();
  }
}

// ---------------------------------------------------------------------------
// Editor resolution — three-level fallback so preview focus never breaks things
// ---------------------------------------------------------------------------

async function withMarkdownEditor(
  fn: (doc: vscode.TextDocument) => Promise<void>
): Promise<void> {
  // 1. Active editor is markdown — ideal path.
  const active = vscode.window.activeTextEditor;
  if (active?.document.languageId === 'markdown') {
    return fn(active.document);
  }

  // 2. A preview panel / non-markdown editor is focused.
  //    Use the last markdown editor the user had open.
  if (lastMarkdownEditor && !lastMarkdownEditor.document.isClosed) {
    return fn(lastMarkdownEditor.document);
  }

  // 3. Scan all visible editors for any markdown file.
  const visible = vscode.window.visibleTextEditors.find(
    (e) => e.document.languageId === 'markdown'
  );
  if (visible) {
    return fn(visible.document);
  }

  // 4. Nothing open — guide the user.
  vscode.window.showInformationMessage(
    'Markdown Translator: No Markdown file is open. Please open an .md file first.',
    'Got it'
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callTranslate(document: vscode.TextDocument): Promise<string | undefined> {
  try {
    return await translateMarkdown(document.getText(), document.uri.fsPath, getConfig());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('API key')) {
      const choice = await vscode.window.showErrorMessage(
        `Markdown Translator: ${message}`,
        'Open Settings'
      );
      if (choice === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'mdTranslator');
      }
    } else {
      vscode.window.showErrorMessage(`Markdown Translator: ${message}`);
    }
    return undefined;
  }
}

async function runWithProgress<T>(title: string, task: () => Promise<T>): Promise<T | undefined> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title, cancellable: false },
    task
  );
}

function showStatusBar(): void {
  translateBtn.show();
  langBtn.show();
}

function hideStatusBar(): void {
  translateBtn.hide();
  langBtn.hide();
}

function getConfig(): TranslationConfig {
  const cfg = vscode.workspace.getConfiguration('mdTranslator');
  return {
    apiBaseUrl: cfg.get('apiBaseUrl', 'https://api.openai.com/v1'),
    apiKey: cfg.get('apiKey', ''),
    model: cfg.get('model', 'gpt-4o'),
    targetLanguage: cfg.get('targetLanguage', 'Chinese (Simplified)'),
    chunkSize: cfg.get('chunkSize', 3000),
    requestTimeoutMs: cfg.get('requestTimeoutMs', 90000),
  };
}

function refreshLangBtn(): void {
  const lang = getConfig().targetLanguage;
  langBtn.text = `→ ${lang}`;
  langBtn.tooltip = `Markdown Translator: target language is "${lang}". Click to change.`;
}
