import { XmlNode } from './xmlParser';

/**
 * Generate Mermaid graph markup from an XmlNode tree
 */
export function generateMermaidMarkup(root: XmlNode): string {
  const lines: string[] = ['graph TD'];
  let counter = 0;

  function getNodeId(): string {
    return `N${counter++}`;
  }

  function escapeLabel(text: string): string {
    return text
      .replace(/"/g, '#quot;')
      .replace(/</g, '#lt;')
      .replace(/>/g, '#gt;')
      .replace(/&/g, '#amp;');
  }

  function buildLabel(node: XmlNode): string {
    let label = escapeLabel(node.tagName);

    // Add attributes
    const attrs = Object.entries(node.attributes);
    if (attrs.length > 0) {
      const attrStr = attrs.map(([k, v]) => `${escapeLabel(k)}=${escapeLabel(v)}`).join('<br/>');
      label += `<br/>${attrStr}`;
    }

    // Add text content for leaf nodes
    if (node.textContent && node.children.length === 0) {
      label += `<br/><b>${escapeLabel(node.textContent)}</b>`;
    }

    return label;
  }

  function processNode(node: XmlNode, parentId?: string): void {
    const nodeId = getNodeId();
    const label = buildLabel(node);

    // Determine node shape based on whether it has children
    if (node.children.length === 0 && node.textContent) {
      // Leaf node with value — rounded box
      lines.push(`    ${nodeId}("${label}")`);
    } else if (node.children.length > 0) {
      // Branch node — box
      lines.push(`    ${nodeId}["${label}"]`);
    } else {
      // Empty node
      lines.push(`    ${nodeId}["${label}"]`);
    }

    // Connect to parent
    if (parentId !== undefined) {
      lines.push(`    ${parentId} --> ${nodeId}`);
    }

    // Process children
    for (const child of node.children) {
      processNode(child, nodeId);
    }
  }

  processNode(root);

  // Add styling
  lines.push('');
  lines.push('    classDef root fill:#4a90d9,stroke:#2c5f8a,color:#fff,font-weight:bold');
  lines.push('    classDef branch fill:#5ba85b,stroke:#3d7a3d,color:#fff');
  lines.push('    classDef leaf fill:#f5a623,stroke:#c4841d,color:#fff');
  lines.push('    class N0 root');

  // Apply styles: branches and leaves
  const branchIds: string[] = [];
  const leafIds: string[] = [];

  function classifyNodes(node: XmlNode, id: { current: number }, isRoot: boolean = true): void {
    const currentId = id.current++;
    if (!isRoot) {
      if (node.children.length > 0) {
        branchIds.push(`N${currentId}`);
      } else {
        leafIds.push(`N${currentId}`);
      }
    }
    for (const child of node.children) {
      classifyNodes(child, id, false);
    }
  }

  classifyNodes(root, { current: 0 });

  if (branchIds.length > 0) {
    lines.push(`    class ${branchIds.join(',')} branch`);
  }
  if (leafIds.length > 0) {
    lines.push(`    class ${leafIds.join(',')} leaf`);
  }

  return lines.join('\n');
}
