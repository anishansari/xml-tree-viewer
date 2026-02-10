import { XMLParser } from 'fast-xml-parser';

export interface XmlNode {
  tagName: string;
  attributes: Record<string, string>;
  textContent: string;
  children: XmlNode[];
}

/**
 * Parse XML string into a simplified tree structure
 */
export function parseXml(xmlString: string): XmlNode {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    preserveOrder: true,
    commentPropName: '#comment',
    trimValues: true,
  });

  const parsed = parser.parse(xmlString);
  const rootNodes = convertOrderedToTree(parsed);

  // If there's a processing instruction + root, return the root element
  if (rootNodes.length === 1) {
    return rootNodes[0];
  }

  // Wrap multiple top-level nodes
  return {
    tagName: '(document)',
    attributes: {},
    textContent: '',
    children: rootNodes,
  };
}

function convertOrderedToTree(orderedArray: any[]): XmlNode[] {
  const nodes: XmlNode[] = [];

  for (const item of orderedArray) {
    for (const key of Object.keys(item)) {
      if (key === '?xml') {
        // Skip XML declaration
        continue;
      }

      if (key === ':@') {
        // Attributes are handled by the parent
        continue;
      }

      if (key === '#text') {
        // Text node — skip standalone, handled by parent
        continue;
      }

      const node: XmlNode = {
        tagName: key,
        attributes: {},
        textContent: '',
        children: [],
      };

      // Extract attributes from the item's :@ property
      if (item[':@']) {
        for (const [attrKey, attrValue] of Object.entries(item[':@'])) {
          const cleanKey = attrKey.replace('@_', '');
          node.attributes[cleanKey] = String(attrValue);
        }
      }

      // Process children
      const childArray = item[key];
      if (Array.isArray(childArray)) {
        for (const child of childArray) {
          if (child['#text'] !== undefined) {
            node.textContent = String(child['#text']);
          } else {
            const childNodes = convertOrderedToTree([child]);
            node.children.push(...childNodes);
          }
        }
      }

      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Generate a text-based indented tree representation
 */
export function generateTextTree(node: XmlNode, indent: string = '', isLast: boolean = true, isRoot: boolean = true): string {
  let result = '';

  const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
  const childIndent = isRoot ? '' : (isLast ? '    ' : '│   ');

  // Build tag display
  let display = `<${node.tagName}>`;

  // Add attributes
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  if (attrs) {
    display = `<${node.tagName} ${attrs}>`;
  }

  // Add text content
  if (node.textContent && node.children.length === 0) {
    display += ` → "${node.textContent}"`;
  }

  result += `${indent}${connector}${display}\n`;

  // Process children
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const childIsLast = i === node.children.length - 1;
    result += generateTextTree(child, indent + childIndent, childIsLast, false);
  }

  return result;
}
