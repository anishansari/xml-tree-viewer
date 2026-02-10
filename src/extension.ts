import * as vscode from 'vscode';
import * as path from 'path';
import { XmlTreePanel } from './webviewPanel';
import { XmlTreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('XML Tree Viewer is now active!');

  // Create sidebar tree data provider
  const treeDataProvider = new XmlTreeDataProvider();
  vscode.window.createTreeView('xmlTreeViewerSidebar', {
    treeDataProvider,
    showCollapseAll: true,
  });

  // Auto-refresh sidebar when active editor changes
  const updateSidebar = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.fileName.endsWith('.xml')) {
      treeDataProvider.refresh(editor.document.getText());
    } else {
      treeDataProvider.refresh(undefined);
    }
  };

  // Refresh on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateSidebar())
  );

  // Refresh on document save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith('.xml')) {
        updateSidebar();
      }
    })
  );

  // Refresh on document change (live update)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document && e.document.fileName.endsWith('.xml')) {
        treeDataProvider.refresh(e.document.getText());
      }
    })
  );

  // Command: Open graphical tree view (webview)
  const openTreeViewCmd = vscode.commands.registerCommand('xmlTreeViewer.openTreeView', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor. Open an XML file first.');
      return;
    }

    const doc = editor.document;
    if (!doc.fileName.endsWith('.xml')) {
      vscode.window.showWarningMessage('Active file is not an XML file.');
      return;
    }

    const xmlContent = doc.getText();
    const fileName = path.basename(doc.fileName);

    XmlTreePanel.createOrShow(context.extensionUri, xmlContent, fileName);
  });

  // Command: Refresh sidebar manually
  const refreshSidebarCmd = vscode.commands.registerCommand('xmlTreeViewer.refreshSidebar', () => {
    updateSidebar();
  });

  context.subscriptions.push(openTreeViewCmd, refreshSidebarCmd);

  // Initial sidebar update
  updateSidebar();
}

export function deactivate() {}
