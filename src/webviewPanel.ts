import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { XmlNode, parseXml, generateTextTree } from './xmlParser';
import { generateMermaidMarkup } from './mermaidGenerator';

export class XmlTreePanel {
  public static currentPanel: XmlTreePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

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
  }

  public dispose() {
    XmlTreePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _update(xmlContent: string, fileName: string) {
    this._panel.title = `XML Tree: ${fileName}`;
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src data:; font-src data:; connect-src https://cdn.jsdelivr.net;">
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
      var mermaidCode = ${JSON.stringify(mermaidMarkup)};
      var textTreeRaw = ${JSON.stringify(textTree)};
      var jsonObjectData = ${JSON.stringify(jsonObject)};
      var jsonStringForCopy = ${JSON.stringify(jsonString)};
      var currentZoom = 1;
      var mermaidRendered = false;

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
