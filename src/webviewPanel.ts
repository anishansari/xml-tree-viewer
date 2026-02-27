import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { XmlNode, parseXml, generateTextTree } from './xmlParser';
import { generateMermaidMarkup } from './mermaidGenerator';
import { generateXmlFromDtd } from './dtdToXml';

type WebviewToExtensionMessage =
  | { type: 'requestSaveMermaidImage' }
  | { type: 'saveMermaidImageChunk'; saveId: string; index: number; total: number; chunk: string }
  | { type: 'saveMermaidImageAbort'; saveId: string }
  // Backwards compatible: older webview implementation sends the full data URL.
  | { type: 'saveMermaidImage'; pngDataUrl?: string };

type ExtensionToWebviewMessage =
  | { type: 'saveMermaidImageCancelled' }
  | { type: 'saveMermaidImageSession'; saveId: string }
  | { type: 'saveMermaidImageSaved' }
  | { type: 'saveMermaidImageError'; message: string };

interface PendingImageSave {
  uri: vscode.Uri;
  total?: number;
  received: number;
  chunks: string[];
  timeout?: NodeJS.Timeout;
}

export class XmlTreePanel {
  public static currentPanel: XmlTreePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _pendingImageSaves = new Map<string, PendingImageSave>();

  public static createOrShow(extensionUri: vscode.Uri, xmlContent: string, fileName: string) {
    const column = vscode.ViewColumn.Beside;

    if (XmlTreePanel.currentPanel) {
      XmlTreePanel.currentPanel._panel.reveal(column);
      XmlTreePanel.currentPanel._update(xmlContent, fileName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'xmlTreeViewer',
      `XML Tree: ${fileName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    XmlTreePanel.currentPanel = new XmlTreePanel(panel, xmlContent, fileName);
  }

  private constructor(panel: vscode.WebviewPanel, xmlContent: string, fileName: string) {
    this._panel = panel;
    this._update(xmlContent, fileName);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (msg: WebviewToExtensionMessage) => {
        const armTimeout = (saveId: string): NodeJS.Timeout => {
          return setTimeout(() => {
            const pending = this._pendingImageSaves.get(saveId);
            if (!pending) return;

            this._pendingImageSaves.delete(saveId);
            try {
              if (pending.timeout) { clearTimeout(pending.timeout); }
            } catch {
              // ignore
            }

            const err: ExtensionToWebviewMessage = { type: 'saveMermaidImageError', message: 'Image export timed out. Try again.' };
            void this._panel.webview.postMessage(err);
          }, 60000);
        };

        if (msg.type === 'saveMermaidImageAbort') {
          const pending = this._pendingImageSaves.get(msg.saveId);
          if (pending?.timeout) { clearTimeout(pending.timeout); }
          this._pendingImageSaves.delete(msg.saveId);
          return;
        }

        // New flow: webview requests a save session, then streams the PNG base64 in chunks
        // to avoid webview message size limits (large diagrams would otherwise corrupt).
        if (msg.type === 'requestSaveMermaidImage') {
          const defaultName = fileName.replace(/\.(xml|dtd)$/i, '-diagram.png');
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: { 'PNG Image': ['png'] },
          });
          if (!uri) {
            const cancelled: ExtensionToWebviewMessage = { type: 'saveMermaidImageCancelled' };
            void this._panel.webview.postMessage(cancelled);
            return;
          }

          const saveId = crypto.randomBytes(8).toString('hex');
          this._pendingImageSaves.set(saveId, { uri, received: 0, chunks: [], timeout: armTimeout(saveId) });

          const session: ExtensionToWebviewMessage = { type: 'saveMermaidImageSession', saveId };
          void this._panel.webview.postMessage(session);
          return;
        }

        if (msg.type === 'saveMermaidImageChunk') {
          const save = this._pendingImageSaves.get(msg.saveId);
          if (!save) {
            const err: ExtensionToWebviewMessage = { type: 'saveMermaidImageError', message: 'No active save session. Try again.' };
            void this._panel.webview.postMessage(err);
            return;
          }

          // Keep the session alive as chunks stream in.
          if (save.timeout) { clearTimeout(save.timeout); }
          save.timeout = armTimeout(msg.saveId);

          if (!Number.isFinite(msg.index) || !Number.isFinite(msg.total) || msg.total <= 0 || msg.index < 0 || msg.index >= msg.total) {
            if (save.timeout) { clearTimeout(save.timeout); }
            this._pendingImageSaves.delete(msg.saveId);
            const err: ExtensionToWebviewMessage = { type: 'saveMermaidImageError', message: 'Invalid image data received.' };
            void this._panel.webview.postMessage(err);
            return;
          }

          if (save.total === undefined) {
            save.total = msg.total;
            save.chunks = new Array(msg.total);
          } else if (save.total !== msg.total) {
            if (save.timeout) { clearTimeout(save.timeout); }
            this._pendingImageSaves.delete(msg.saveId);
            const err: ExtensionToWebviewMessage = { type: 'saveMermaidImageError', message: 'Image transfer interrupted. Try again.' };
            void this._panel.webview.postMessage(err);
            return;
          }

          if (save.chunks[msg.index] === undefined) {
            save.received += 1;
          }
          save.chunks[msg.index] = msg.chunk;

          if (save.total !== undefined && save.received === save.total) {
            try {
              const base64 = save.chunks.join('');
              const bytes = Buffer.from(base64, 'base64');

              // Quick validation: PNG signature.
              const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
              if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSig)) {
                throw new Error('Corrupted PNG data');
              }

              await vscode.workspace.fs.writeFile(save.uri, bytes);
              vscode.window.showInformationMessage(`Diagram saved to ${save.uri.fsPath}`);
              const ok: ExtensionToWebviewMessage = { type: 'saveMermaidImageSaved' };
              void this._panel.webview.postMessage(ok);
            } catch (e: any) {
              const err: ExtensionToWebviewMessage = { type: 'saveMermaidImageError', message: e?.message || 'Failed to save image.' };
              void this._panel.webview.postMessage(err);
            } finally {
              if (save.timeout) { clearTimeout(save.timeout); }
              this._pendingImageSaves.delete(msg.saveId);
            }
          }
          return;
        }

        // Legacy flow: receive full PNG data URL from the webview.
        if (msg.type === 'saveMermaidImage' && msg.pngDataUrl) {
          const defaultName = fileName.replace(/\.(xml|dtd)$/i, '-diagram.png');
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: { 'PNG Image': ['png'] },
          });
          if (uri) {
            const base64 = msg.pngDataUrl.replace(/^data:image\/png;base64,/, '');
            await vscode.workspace.fs.writeFile(uri, Buffer.from(base64, 'base64'));
            vscode.window.showInformationMessage(`Diagram saved to ${uri.fsPath}`);
          }
          return;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    XmlTreePanel.currentPanel = undefined;
    for (const pending of this._pendingImageSaves.values()) {
      if (pending.timeout) { clearTimeout(pending.timeout); }
    }
    this._pendingImageSaves.clear();
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _update(xmlContent: string, fileName: string) {
    this._panel.title = `XML Tree: ${fileName}`;
    // If DTD file, show DTD-to-XML skeleton preview
    if (fileName.toLowerCase().endsWith('.dtd')) {
      try {
        const xmlSkeleton = generateXmlFromDtd(xmlContent);
        this._panel.webview.html = this._getDtdHtml(xmlSkeleton, fileName);
      } catch (err: any) {
        this._panel.webview.html = this._getErrorHtml('DTD Parse Error: ' + err.message);
      }
      return;
    }
    try {
      const tree = parseXml(xmlContent);
      const textTree = generateTextTree(tree);
      const mermaidMarkup = generateMermaidMarkup(tree);
      const jsonObject = xmlNodeToObject(tree);
      this._panel.webview.html = this._getHtml(textTree, mermaidMarkup, jsonObject, fileName);
    } catch (err: any) {
      this._panel.webview.html = this._getErrorHtml(err.message);
    }
  }

  private _getDtdHtml(xmlSkeleton: string, fileName: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const escapedXml = xmlSkeleton
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>DTD to XML Preview</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 0; }
    .header { background: linear-gradient(135deg, #16213e, #0f3460); padding: 16px 24px; border-bottom: 2px solid #533483; display: flex; align-items: center; gap: 12px; }
    .header h1 { font-size: 18px; font-weight: 600; color: #e94560; }
    .header .filename { color: #a8a8b3; font-size: 14px; font-weight: 400; }
    .content { padding: 24px; }
    .xml-preview { background: #0f0f23; border: 1px solid #2a2a4a; border-radius: 8px; padding: 20px; overflow-x: auto; font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 14px; line-height: 1.8; white-space: pre; color: #c5c8c6; }
    .controls { display: flex; gap: 8px; margin-bottom: 16px; }
    .btn { padding: 8px 16px; border: 1px solid #533483; background: #16213e; color: #e0e0e0; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .btn.primary { background: #e94560; border-color: #e94560; color: #fff; }
    .btn.primary:hover { background: #c73a52; }
    .btn:hover { background: #533483; color: #fff; }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #5ba85b; color: #fff; padding: 12px 24px; border-radius: 8px; font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 1000; }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DTD → XML Skeleton</h1>
    <span class="filename">${fileName}</span>
  </div>
  <div class="content">
    <div class="controls">
      <button class="btn primary" id="copyXmlBtn">📋 Copy XML</button>
    </div>
    <div class="xml-preview" id="xmlPreview">${escapedXml}</div>
  </div>
  <div class="toast" id="toast">Copied to clipboard!</div>
  <script nonce="${nonce}">
    (function() {
      document.getElementById('copyXmlBtn').addEventListener('click', function() {
        var xml = "" +
          "" +
          "${xmlSkeleton.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}";
        navigator.clipboard.writeText(xml);
        var toast = document.getElementById('toast');
        toast.textContent = 'XML copied to clipboard!';
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 2000);
      });
    })();
  </script>
</body>
</html>`;
  }

  private _getErrorHtml(error: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    .error { color: #f44747; border: 1px solid #f44747; padding: 16px; border-radius: 8px; background: #2d1515; }
  </style>
</head>
<body>
  <div class="error">
    <h2>⚠ XML Parse Error</h2>
    <p>${error}</p>
  </div>
</body>
</html>`;
  }

  private _getHtml(textTree: string, mermaidMarkup: string, jsonObject: any, fileName: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');

    const escapedTextTree = textTree
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const jsonString = JSON.stringify(jsonObject, null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src data: blob:; font-src data:; connect-src https://cdn.jsdelivr.net;">
  <title>XML Tree Viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 0;
      overflow-x: hidden;
    }

    .header {
      background: linear-gradient(135deg, #16213e, #0f3460);
      padding: 16px 24px;
      border-bottom: 2px solid #533483;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header h1 { font-size: 18px; font-weight: 600; color: #e94560; }
    .header .filename { color: #a8a8b3; font-size: 14px; font-weight: 400; }

    .tabs {
      display: flex;
      background: #16213e;
      border-bottom: 1px solid #2a2a4a;
      flex-wrap: wrap;
    }

    .tab {
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #a8a8b3;
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
      user-select: none;
    }

    .tab:hover { color: #e0e0e0; background: rgba(233, 69, 96, 0.1); }
    .tab.active { color: #e94560; border-bottom-color: #e94560; }

    .content { padding: 24px; min-height: calc(100vh - 110px); }
    .panel { display: none; }
    .panel.active { display: block; }

    /* Parsed Tree */
    .text-tree {
      background: #0f0f23;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.8;
      white-space: pre;
      color: #c5c8c6;
    }

    .text-tree .tag { color: #e94560; }
    .text-tree .attr { color: #f5a623; }
    .text-tree .value { color: #5ba85b; }
    .text-tree .connector { color: #533483; }

    /* Mermaid Diagram */
    .mermaid-container {
      background: #ffffff;
      border-radius: 8px;
      padding: 24px;
      overflow: auto;
      min-height: 400px;
    }

    .mermaid-wrapper {
      transform-origin: top left;
      transition: transform 0.2s;
    }

    /* JSON Object View */
    .json-tree {
      background: #0f0f23;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      padding: 20px;
      overflow-x: auto;
      font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
    }

    .json-item { padding-left: 20px; }

    .json-key { color: #e94560; }
    .json-string { color: #5ba85b; }
    .json-number { color: #f5a623; }
    .json-bracket { color: #a8a8b3; }
    .json-null { color: #888; }
    .json-bool { color: #c678dd; }

    .json-toggle {
      cursor: pointer;
      user-select: none;
      display: inline-block;
      width: 16px;
      color: #888;
      font-size: 11px;
    }

    .json-toggle:hover { color: #e94560; }

    .json-collapsible { }
    .json-collapsible.collapsed > .json-item { display: none; }
    .json-collapsible.collapsed > .json-summary { display: inline; }

    .json-summary {
      display: none;
      color: #666;
      font-style: italic;
    }

    /* Controls */
    .controls { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }

    .btn {
      padding: 8px 16px;
      border: 1px solid #533483;
      background: #16213e;
      color: #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .btn:hover { background: #533483; color: #fff; }
    .btn.primary { background: #e94560; border-color: #e94560; color: #fff; }
    .btn.primary:hover { background: #c73a52; }

    .zoom-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .zoom-level { color: #a8a8b3; font-size: 13px; min-width: 50px; text-align: center; }

    .toast {
      position: fixed; bottom: 20px; right: 20px;
      background: #5ba85b; color: #fff;
      padding: 12px 24px; border-radius: 8px;
      font-size: 14px; opacity: 0; transition: opacity 0.3s; z-index: 1000;
    }
    .toast.show { opacity: 1; }

    .split-view {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      height: calc(100vh - 160px);
    }

    .split-view .text-tree,
    .split-view .mermaid-container { height: 100%; overflow: auto; }

    @media (max-width: 800px) {
      .split-view { grid-template-columns: 1fr; }
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #a8a8b3;
      font-size: 16px;
    }

    .loading .spinner {
      display: inline-block;
      width: 40px; height: 40px;
      border: 4px solid #2a2a4a;
      border-top: 4px solid #e94560;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌳 XML Tree Viewer</h1>
    <span class="filename">${fileName}</span>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="parsed">📋 Parsed Tree</div>
    <div class="tab" data-tab="object">🔣 Object View</div>
    <div class="tab" data-tab="diagram">🔀 Graphical Tree</div>
    <div class="tab" data-tab="split">📊 Split View</div>
  </div>

  <div class="content">
    <!-- Parsed Tree Panel -->
    <div id="parsed" class="panel active">
      <div class="controls">
        <button class="btn primary" id="copyTreeBtn">📋 Copy Tree</button>
      </div>
      <div class="text-tree" id="textTreeContent">${formatTextTreeHtml(escapedTextTree)}</div>
    </div>

    <!-- Object View Panel -->
    <div id="object" class="panel">
      <div class="controls">
        <button class="btn primary" id="copyJsonBtn">📋 Copy JSON</button>
        <button class="btn" id="expandAllBtn">▶ Expand All</button>
        <button class="btn" id="collapseAllBtn">◀ Collapse All</button>
      </div>
      <div class="json-tree" id="jsonTreeContent"></div>
    </div>

    <!-- Graphical Diagram Panel -->
    <div id="diagram" class="panel">
      <div class="zoom-controls">
        <button class="btn" id="zoomOutBtn">−</button>
        <span class="zoom-level" id="zoomLevel">100%</span>
        <button class="btn" id="zoomInBtn">+</button>
        <button class="btn" id="resetZoomBtn">Reset</button>
        <button class="btn primary" id="copyMermaidBtn">📋 Copy Mermaid Code</button>
        <button class="btn primary" id="saveMermaidImageBtn">💾 Save as Image</button>
      </div>
      <div class="mermaid-container" id="mermaidContainer">
        <div class="loading" id="mermaidLoading">
          <div class="spinner"></div>
          <div>Rendering diagram...</div>
        </div>
        <div class="mermaid-wrapper" id="mermaidWrapper" style="display:none;"></div>
      </div>
    </div>

    <!-- Split View Panel -->
    <div id="split" class="panel">
      <div class="split-view">
        <div class="text-tree">${formatTextTreeHtml(escapedTextTree)}</div>
        <div class="mermaid-container">
          <div class="mermaid-wrapper" id="mermaidWrapperSplit"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Copied to clipboard!</div>

  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();
      var mermaidCode = ${JSON.stringify(mermaidMarkup)};
      var textTreeRaw = ${JSON.stringify(textTree)};
      var jsonObjectData = ${JSON.stringify(jsonObject)};
      var jsonStringForCopy = ${JSON.stringify(jsonString)};
      var currentZoom = 1;
      var mermaidRendered = false;
      var isSavingImage = false;

      // Listen for extension host messages (save workflow).
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (!msg || !msg.type) return;

        if (msg.type === 'saveMermaidImageSession' && msg.saveId) {
          streamMermaidPngToExtension(msg.saveId);
          return;
        }

        if (msg.type === 'saveMermaidImageCancelled') {
          isSavingImage = false;
          showToast('Save cancelled.');
          return;
        }

        if (msg.type === 'saveMermaidImageSaved') {
          isSavingImage = false;
          showToast('Image saved.');
          return;
        }

        if (msg.type === 'saveMermaidImageError') {
          isSavingImage = false;
          showToast(msg.message || 'Failed to save image.');
          return;
        }
      });

      // ============================================================
      // Tab switching
      // ============================================================
      function switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
        document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
        document.getElementById(tabName).classList.add('active');

        if (tabName === 'diagram' || tabName === 'split') {
          renderMermaid();
        }
      }

      // Add click listeners to tabs
      document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          var tabName = this.getAttribute('data-tab');
          switchTab(tabName);
        });
      });

      // ============================================================
      // Mermaid Rendering
      // ============================================================
      async function renderMermaid() {
        if (mermaidRendered) return;
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {
              useMaxWidth: false,
              htmlLabels: true,
              curve: 'basis',
              rankSpacing: 50,
              nodeSpacing: 30,
            }
          });

          var result = await mermaid.render('mermaid-svg', mermaidCode);
          document.getElementById('mermaidWrapper').innerHTML = result.svg;
          document.getElementById('mermaidWrapper').style.display = 'block';
          document.getElementById('mermaidLoading').style.display = 'none';

          var splitWrapper = document.getElementById('mermaidWrapperSplit');
          if (splitWrapper) { splitWrapper.innerHTML = result.svg; }

          mermaidRendered = true;
        } catch (err) {
          document.getElementById('mermaidLoading').innerHTML =
            '<div style="color:#f44747;">Error rendering diagram: ' + err.message + '</div>' +
            '<pre style="color:#888;margin-top:12px;font-size:12px;white-space:pre-wrap;">' +
            mermaidCode.replace(/</g, '&lt;') + '</pre>';
        }
      }

      // ============================================================
      // JSON Object Tree Rendering
      // ============================================================
      function renderJsonTree(data, container, depth) {
        depth = depth || 0;
        if (data === null || data === undefined) {
          container.innerHTML += '<span class="json-null">null</span>';
          return;
        }
        if (Array.isArray(data)) {
          renderArray(data, container, depth);
        } else if (typeof data === 'object') {
          renderObject(data, container, depth);
        } else if (typeof data === 'string') {
          container.innerHTML += '<span class="json-string">"' + escHtml(data) + '"</span>';
        } else if (typeof data === 'number') {
          container.innerHTML += '<span class="json-number">' + data + '</span>';
        } else if (typeof data === 'boolean') {
          container.innerHTML += '<span class="json-bool">' + data + '</span>';
        }
      }

      function renderObject(obj, container, depth) {
        var keys = Object.keys(obj);
        var wrapper = document.createElement('div');
        wrapper.className = 'json-collapsible';

        var toggle = document.createElement('span');
        toggle.className = 'json-toggle';
        toggle.textContent = '▼';
        toggle.addEventListener('click', function() { toggleNode(wrapper, toggle); });

        var header = document.createElement('span');
        header.innerHTML = '<span class="json-bracket">{' + keys.length + '}</span>';

        var summary = document.createElement('span');
        summary.className = 'json-summary';
        summary.textContent = ' {...}';

        wrapper.appendChild(toggle);
        wrapper.appendChild(header);
        wrapper.appendChild(summary);

        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var item = document.createElement('div');
          item.className = 'json-item';

          var keySpan = document.createElement('span');
          keySpan.className = 'json-key';
          keySpan.textContent = '"' + key + '"';
          item.appendChild(keySpan);

          item.appendChild(document.createTextNode(': '));

          var val = obj[key];
          if (val !== null && typeof val === 'object') {
            var nested = document.createElement('span');
            renderJsonTree(val, nested, depth + 1);
            item.appendChild(nested);
          } else {
            var valSpan = document.createElement('span');
            if (typeof val === 'string') {
              valSpan.className = 'json-string';
              valSpan.textContent = '"' + val + '"';
            } else if (typeof val === 'number') {
              valSpan.className = 'json-number';
              valSpan.textContent = String(val);
            } else if (typeof val === 'boolean') {
              valSpan.className = 'json-bool';
              valSpan.textContent = String(val);
            } else {
              valSpan.className = 'json-null';
              valSpan.textContent = 'null';
            }
            item.appendChild(valSpan);
          }
          wrapper.appendChild(item);
        }
        container.appendChild(wrapper);
      }

      function renderArray(arr, container, depth) {
        var wrapper = document.createElement('div');
        wrapper.className = 'json-collapsible';

        var toggle = document.createElement('span');
        toggle.className = 'json-toggle';
        toggle.textContent = '▼';
        toggle.addEventListener('click', function() { toggleNode(wrapper, toggle); });

        var header = document.createElement('span');
        header.innerHTML = '<span class="json-bracket">[' + arr.length + ']</span>';

        var summary = document.createElement('span');
        summary.className = 'json-summary';
        summary.textContent = ' [...]';

        wrapper.appendChild(toggle);
        wrapper.appendChild(header);
        wrapper.appendChild(summary);

        for (var i = 0; i < arr.length; i++) {
          var item = document.createElement('div');
          item.className = 'json-item';

          var idx = document.createElement('span');
          idx.className = 'json-number';
          idx.textContent = String(i);
          item.appendChild(idx);

          item.appendChild(document.createTextNode(': '));

          var val = arr[i];
          if (val !== null && typeof val === 'object') {
            var nested = document.createElement('span');
            renderJsonTree(val, nested, depth + 1);
            item.appendChild(nested);
          } else {
            var valSpan = document.createElement('span');
            if (typeof val === 'string') {
              valSpan.className = 'json-string';
              valSpan.textContent = '"' + val + '"';
            } else if (typeof val === 'number') {
              valSpan.className = 'json-number';
              valSpan.textContent = String(val);
            } else {
              valSpan.className = 'json-null';
              valSpan.textContent = String(val);
            }
            item.appendChild(valSpan);
          }
          wrapper.appendChild(item);
        }
        container.appendChild(wrapper);
      }

      function toggleNode(wrapper, toggle) {
        wrapper.classList.toggle('collapsed');
        toggle.textContent = wrapper.classList.contains('collapsed') ? '▶' : '▼';
      }

      function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }

      function expandAll() {
        document.querySelectorAll('.json-collapsible.collapsed').forEach(function(el) {
          el.classList.remove('collapsed');
        });
        document.querySelectorAll('.json-toggle').forEach(function(el) {
          el.textContent = '▼';
        });
      }

      function collapseAll() {
        document.querySelectorAll('.json-collapsible').forEach(function(el) {
          el.classList.add('collapsed');
        });
        document.querySelectorAll('.json-toggle').forEach(function(el) {
          el.textContent = '▶';
        });
      }

      // Build JSON tree on load
      var jsonContainer = document.getElementById('jsonTreeContent');
      renderJsonTree(jsonObjectData, jsonContainer, 0);

      // ============================================================
      // Zoom functions
      // ============================================================
      function zoomDiagram(delta) {
        currentZoom = Math.max(0.3, Math.min(3, currentZoom + delta));
        var wrapper = document.getElementById('mermaidWrapper');
        if (wrapper) { wrapper.style.transform = 'scale(' + currentZoom + ')'; }
        document.getElementById('zoomLevel').textContent = Math.round(currentZoom * 100) + '%';
      }

      function resetZoom() {
        currentZoom = 1;
        var wrapper = document.getElementById('mermaidWrapper');
        if (wrapper) { wrapper.style.transform = 'scale(1)'; }
        document.getElementById('zoomLevel').textContent = '100%';
      }

      // ============================================================
      // Copy functions
      // ============================================================
      function copyTextTree() {
        navigator.clipboard.writeText(textTreeRaw);
        showToast('Tree copied to clipboard!');
      }

      function copyMermaid() {
        navigator.clipboard.writeText(mermaidCode);
        showToast('Mermaid code copied to clipboard!');
      }

      function requestSaveMermaidAsImage() {
        if (isSavingImage) return;

        var wrapper = document.getElementById('mermaidWrapper');
        var svgEl = wrapper ? wrapper.querySelector('svg') : null;
        if (!svgEl) {
          showToast('No diagram to save. Switch to Graphical Tree first.');
          return;
        }

        isSavingImage = true;
        vscode.postMessage({ type: 'requestSaveMermaidImage' });
        showToast('Choose where to save the image...');
      }

      function sanitizeSvgForExport(svgEl) {
        var svg = svgEl.cloneNode(true);
        var foreignObjects = svg.querySelectorAll ? svg.querySelectorAll('foreignObject') : [];
        if (foreignObjects && foreignObjects.length) {
          foreignObjects.forEach(function(el) { el.remove(); });
        }

        if (!svg.getAttribute('xmlns')) { svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); }
        if (!svg.getAttribute('xmlns:xlink')) { svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink'); }
        return svg;
      }

      function computeSvgBounds(svgEl) {
        var bbox = null;
        try {
          bbox = svgEl.getBBox();
        } catch (e) {
          bbox = null;
        }

        if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
          var viewBox = svgEl.getAttribute('viewBox');
          if (viewBox) {
            var parts = viewBox.trim().split(/\\s+/).map(function(v) { return Number(v); });
            if (parts.length === 4 && parts.every(function(v) { return isFinite(v); }) && parts[2] > 0 && parts[3] > 0) {
              bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
          }
        }

        if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
          var rect = svgEl.getBoundingClientRect();
          if (rect && isFinite(rect.width) && isFinite(rect.height) && rect.width > 0 && rect.height > 0) {
            bbox = { x: 0, y: 0, width: rect.width, height: rect.height };
          }
        }

        if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
          bbox = { x: 0, y: 0, width: 1024, height: 768 };
        }

        return {
          x: Math.floor(bbox.x || 0),
          y: Math.floor(bbox.y || 0),
          width: Math.max(1, Math.ceil(bbox.width)),
          height: Math.max(1, Math.ceil(bbox.height)),
        };
      }

      async function renderMermaidSvgForExport() {
        // Mermaid diagrams rendered with htmlLabels/foreignObject frequently fail to load as an <img>
        // when serialized. For export, render a "plain SVG" version with htmlLabels disabled.
        var sandbox = document.getElementById('mermaidExportSandbox');
        if (!sandbox) {
          sandbox = document.createElement('div');
          sandbox.id = 'mermaidExportSandbox';
          sandbox.style.position = 'fixed';
          sandbox.style.left = '-10000px';
          sandbox.style.top = '-10000px';
          sandbox.style.width = '1px';
          sandbox.style.height = '1px';
          sandbox.style.opacity = '0';
          sandbox.style.pointerEvents = 'none';
          sandbox.style.overflow = 'visible';
          document.body.appendChild(sandbox);
        }

        // Keep styles similar to on-screen rendering but disable htmlLabels.
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            curve: 'basis',
            rankSpacing: 50,
            nodeSpacing: 30,
          }
        });

        // Strip HTML from labels for the export render (avoids foreignObject/HTML serialization issues).
        var exportCode = mermaidCode.replace(/<br\\s*\\/?>/gi, ' ').replace(/<\\/?b>/gi, '');

        var exportId = 'mermaid-export-' + Date.now().toString(16) + Math.random().toString(16).slice(2);
        var result = await mermaid.render(exportId, exportCode);
        sandbox.innerHTML = result.svg;

        var svgEl = sandbox.querySelector('svg');
        if (!svgEl) {
          throw new Error('Could not generate export SVG.');
        }
        return svgEl;
      }

      async function streamMermaidPngToExtension(saveId) {
        var wrapper = document.getElementById('mermaidWrapper');
        var svgOnScreen = wrapper ? wrapper.querySelector('svg') : null;
        if (!svgOnScreen) {
          isSavingImage = false;
          showToast('No diagram to save. Switch to Graphical Tree first.');
          vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
          return;
        }

        var svgEl;
        var usedFallbackSvg = false;
        try {
          svgEl = await renderMermaidSvgForExport();
        } catch (e) {
          // Fall back to the currently rendered SVG if export render fails.
          svgEl = svgOnScreen;
          usedFallbackSvg = true;
        }

        var bbox = computeSvgBounds(svgEl);
        var width = bbox.width;
        var height = bbox.height;

        // Cap exported image size to keep message sizes reasonable and avoid huge PNGs.
        var maxDim = 4096;
        var targetW = width;
        var targetH = height;
        if (targetW > maxDim || targetH > maxDim) {
          var ratio = Math.min(maxDim / targetW, maxDim / targetH);
          targetW = Math.max(1, Math.floor(targetW * ratio));
          targetH = Math.max(1, Math.floor(targetH * ratio));
        }

        try {
          var svg = sanitizeSvgForExport(svgEl);

          // Ensure the exported SVG is cropped to content bounds.
          svg.setAttribute('viewBox', bbox.x + ' ' + bbox.y + ' ' + bbox.width + ' ' + bbox.height);
          svg.setAttribute('width', String(width));
          svg.setAttribute('height', String(height));

          // Add a white background so the PNG isn't transparent.
          var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bg.setAttribute('x', String(bbox.x));
          bg.setAttribute('y', String(bbox.y));
          bg.setAttribute('width', String(bbox.width));
          bg.setAttribute('height', String(bbox.height));
          bg.setAttribute('fill', '#ffffff');
          svg.insertBefore(bg, svg.firstChild);

          var svgString = new XMLSerializer().serializeToString(svg);
          var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

          // Prefer blob URLs when possible (faster / less memory), but fall back to data: URLs.
          var blobUrl = null;
          try {
            var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            blobUrl = URL.createObjectURL(svgBlob);
          } catch (e) {
            blobUrl = null;
          }

          var img = new Image();
          var triedFallback = false;
          img.onload = function() {
            if (blobUrl) { URL.revokeObjectURL(blobUrl); }

            try {
              var canvas = document.createElement('canvas');
              canvas.width = targetW;
              canvas.height = targetH;
              var ctx = canvas.getContext('2d');
              if (!ctx) {
                isSavingImage = false;
                showToast('Canvas not supported.');
                vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
                return;
              }

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, targetW, targetH);
              ctx.drawImage(img, 0, 0, targetW, targetH);

              var pngDataUrl = canvas.toDataURL('image/png');
              var base64 = (pngDataUrl.split(',')[1] || '');
              if (!base64) {
                isSavingImage = false;
                showToast('Export failed: could not encode PNG.');
                vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
                return;
              }

              sendBase64InChunks(saveId, base64);
            } catch (e) {
              isSavingImage = false;
              showToast('Export failed: ' + (e && e.message ? e.message : 'Could not draw to canvas.'));
              vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
            }
          };

          img.onerror = function() {
            if (!triedFallback && blobUrl) {
              triedFallback = true;
              try { URL.revokeObjectURL(blobUrl); } catch (e) {}
              img.src = svgDataUrl;
              return;
            }

            if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }
            isSavingImage = false;
            showToast(usedFallbackSvg ? 'Export failed: could not load fallback SVG.' : 'Export failed: could not load SVG.');
            vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
          };

          img.src = blobUrl || svgDataUrl;
        } catch (e) {
          isSavingImage = false;
          showToast('Export failed: ' + (e && e.message ? e.message : 'Unexpected error.'));
          vscode.postMessage({ type: 'saveMermaidImageAbort', saveId: saveId });
        }
      }

      function sendBase64InChunks(saveId, base64) {
        // Chunked transfer prevents corruption when the PNG is larger than the webview IPC limit.
        // Keep this comfortably under common IPC limits (varies by VS Code/electron).
        var chunkSize = 16000; // characters
        var total = Math.ceil(base64.length / chunkSize);
        var index = 0;

        function sendNext() {
          if (index >= total) return;
          var chunk = base64.slice(index * chunkSize, (index + 1) * chunkSize);
          vscode.postMessage({ type: 'saveMermaidImageChunk', saveId: saveId, index: index, total: total, chunk: chunk });
          index += 1;
          if (index < total) { setTimeout(sendNext, 0); }
        }

        sendNext();
      }

      function copyJsonObject() {
        navigator.clipboard.writeText(jsonStringForCopy);
        showToast('JSON copied to clipboard!');
      }

      function showToast(message) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 2000);
      }

      // ============================================================
      // Button event listeners
      // ============================================================
      document.getElementById('copyTreeBtn').addEventListener('click', copyTextTree);
      document.getElementById('copyJsonBtn').addEventListener('click', copyJsonObject);
      document.getElementById('expandAllBtn').addEventListener('click', expandAll);
      document.getElementById('collapseAllBtn').addEventListener('click', collapseAll);
      document.getElementById('zoomOutBtn').addEventListener('click', function() { zoomDiagram(-0.1); });
      document.getElementById('zoomInBtn').addEventListener('click', function() { zoomDiagram(0.1); });
      document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);
      document.getElementById('copyMermaidBtn').addEventListener('click', copyMermaid);
      document.getElementById('saveMermaidImageBtn').addEventListener('click', requestSaveMermaidAsImage);

    })();
  </script>
</body>
</html>`;
  }
}

/**
 * Convert XmlNode tree to a plain JS object (like browser console representation)
 */
function xmlNodeToObject(node: XmlNode): any {
  const obj: any = {};

  if (node.children.length === 0 && node.textContent) {
    return node.textContent;
  }

  // Group children by tag name
  const childGroups: Record<string, any[]> = {};
  for (const child of node.children) {
    if (!childGroups[child.tagName]) {
      childGroups[child.tagName] = [];
    }
    childGroups[child.tagName].push(child);
  }

  for (const [tagName, children] of Object.entries(childGroups)) {
    if (children.length === 1) {
      obj[tagName] = xmlNodeToObject(children[0]);
    } else {
      obj[tagName] = children.map((c: XmlNode) => xmlNodeToObject(c));
    }
  }

  // Add attributes with _ prefix
  for (const [key, value] of Object.entries(node.attributes)) {
    obj[`_${key}`] = value;
  }

  // Add text content if also has children (mixed content)
  if (node.textContent && node.children.length > 0) {
    obj['#text'] = node.textContent;
  }

  return obj;
}

function formatTextTreeHtml(escapedTree: string): string {
  return escapedTree
    .replace(/(&lt;\/?[\w:.-]+(?:\s[^&]*?)?&gt;)/g, '<span class="tag">$1</span>')
    .replace(/([\w]+)=(&quot;[^&]*?&quot;)/g, '<span class="attr">$1</span>=<span class="value">$2</span>')
    .replace(/(→\s*&quot;[^&]*?&quot;)/g, '<span class="value">$1</span>')
    .replace(/([├└│─]+)/g, '<span class="connector">$1</span>');
}
