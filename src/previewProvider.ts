import * as vscode from 'vscode';

export class TranslatedDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChange.event;

  setContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  hasContent(uri: vscode.Uri): boolean {
    return this.contents.has(uri.toString());
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return (
      this.contents.get(uri.toString()) ??
      '> *No translation yet. Run **Markdown Translator: Open Translated Preview** to translate.*'
    );
  }
}
