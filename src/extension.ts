import * as vscode from 'vscode';
import * as path from 'path';
import { XmlTreePanel } from './webviewPanel';
import { XmlTreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('XML Tree Viewer is now active!');

  const isXmlFile = (fileName: string): boolean => path.extname(fileName).toLowerCase() === '.xml';
  const isXmlOrDtdFile = (fileName: string): boolean => {
    const ext = path.extname(fileName).toLowerCase();
    return ext === '.xml' || ext === '.dtd';
  };

  // Create sidebar tree data provider
  const treeDataProvider = new XmlTreeDataProvider();
  vscode.window.createTreeView('xmlTreeViewerSidebar', {
    treeDataProvider,
    showCollapseAll: true,
  });

  // Auto-refresh sidebar when active editor changes
  const updateSidebar = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && isXmlFile(editor.document.fileName)) {
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
      if (isXmlFile(doc.fileName)) {
        updateSidebar();
      }
    })
  );

  // Refresh on document change (live update)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document && isXmlFile(e.document.fileName)) {
        treeDataProvider.refresh(e.document.getText());
      }
    })
  );

  // Command: Open graphical tree view (webview)
  const openTreeViewCmd = vscode.commands.registerCommand('xmlTreeViewer.openTreeView', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor. Open an XML or DTD file first.');
      return;
    }

    const doc = editor.document;
    if (!isXmlOrDtdFile(doc.fileName)) {
      vscode.window.showWarningMessage('Active file is not an XML or DTD file.');
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
