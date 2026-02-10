import * as vscode from 'vscode';
import { XmlNode, parseXml } from './xmlParser';

/**
 * TreeDataProvider for the VS Code sidebar showing XML structure
 */
export class XmlTreeDataProvider implements vscode.TreeDataProvider<XmlTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<XmlTreeItem | undefined | null | void> =
    new vscode.EventEmitter<XmlTreeItem | undefined | null | void>();

  readonly onDidChangeTreeData: vscode.Event<XmlTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private _rootNode: XmlNode | undefined;

  refresh(xmlContent?: string): void {
    if (xmlContent) {
      try {
        this._rootNode = parseXml(xmlContent);
      } catch {
        this._rootNode = undefined;
      }
    } else {
      this._rootNode = undefined;
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: XmlTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: XmlTreeItem): XmlTreeItem[] {
    if (!this._rootNode) {
      return [];
    }

    if (!element) {
      // Root level
      return [this._createTreeItem(this._rootNode)];
    }

    // Return children of the given element
    return element.xmlNode.children.map(child => this._createTreeItem(child));
  }

  private _createTreeItem(node: XmlNode): XmlTreeItem {
    const hasChildren = node.children.length > 0;
    const collapsibleState = hasChildren
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;

    return new XmlTreeItem(node, collapsibleState);
  }
}

export class XmlTreeItem extends vscode.TreeItem {
  constructor(
    public readonly xmlNode: XmlNode,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    // Build the label
    let label = xmlNode.tagName;
    const attrs = Object.entries(xmlNode.attributes);
    if (attrs.length > 0) {
      const attrStr = attrs.map(([k, v]) => `${k}="${v}"`).join(' ');
      label += ` [${attrStr}]`;
    }

    super(label, collapsibleState);

    // Show text content as description
    if (xmlNode.textContent && xmlNode.children.length === 0) {
      this.description = xmlNode.textContent;
    }

    // Set icon based on node type
    if (xmlNode.children.length > 0) {
      this.iconPath = new vscode.ThemeIcon('symbol-class');
    } else if (xmlNode.textContent) {
      this.iconPath = new vscode.ThemeIcon('symbol-string');
    } else {
      this.iconPath = new vscode.ThemeIcon('symbol-field');
    }

    this.tooltip = this._buildTooltip();
  }

  private _buildTooltip(): string {
    let tip = `<${this.xmlNode.tagName}>`;
    const attrs = Object.entries(this.xmlNode.attributes);
    if (attrs.length > 0) {
      tip += '\n\nAttributes:';
      for (const [k, v] of attrs) {
        tip += `\n  ${k} = "${v}"`;
      }
    }
    if (this.xmlNode.textContent) {
      tip += `\n\nValue: ${this.xmlNode.textContent}`;
    }
    if (this.xmlNode.children.length > 0) {
      tip += `\n\nChildren: ${this.xmlNode.children.length}`;
    }
    return tip;
  }
}
