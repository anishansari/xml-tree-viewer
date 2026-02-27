import { ContentModelType, DTDGrammar, DTDParser } from 'typesxml';

/**
 * Parse a DTD string and generate a minimal XML skeleton.
 */
export function generateXmlFromDtd(dtdString: string): string {
  const parser = new DTDParser();
  const grammar = parser.parseString(normalizeDtdSource(dtdString));

  if (grammar.getElementDeclMap().size === 0) {
    throw new Error('No <!ELEMENT ...> declarations found in DTD.');
  }

  const rootElementName = inferRootElementName(grammar);
  return buildElement(rootElementName, grammar, new Set<string>(), 0);
}

function normalizeDtdSource(source: string): string {
  const withoutXmlDecl = source.replace(/<\?xml[\s\S]*?\?>/gi, '').trim();
  const doctypeInternalSubset = withoutXmlDecl.match(/<!DOCTYPE[\s\S]*?\[([\s\S]*?)\]\s*>/i);
  if (doctypeInternalSubset?.[1]) {
    return doctypeInternalSubset[1].trim();
  }
  return withoutXmlDecl;
}

function inferRootElementName(grammar: DTDGrammar): string {
  const declaredElements = [...grammar.getElementDeclMap().keys()];
  const referencedChildren = new Set<string>();

  for (const elementName of declaredElements) {
    const contentModel = grammar.getContentModel(elementName);
    if (!contentModel) {
      continue;
    }

    for (const childName of contentModel.getChildren()) {
      if (grammar.getElementDeclMap().has(childName)) {
        referencedChildren.add(childName);
      }
    }
  }

  for (const candidate of declaredElements) {
    if (!referencedChildren.has(candidate)) {
      return candidate;
    }
  }

  return declaredElements[0];
}

function buildElement(
  elementName: string,
  grammar: DTDGrammar,
  ancestors: Set<string>,
  depth: number
): string {
  const indent = '  '.repeat(depth);
  const attributes = buildAttributes(elementName, grammar);
  const contentModel = grammar.getContentModel(elementName);

  if (ancestors.has(elementName)) {
    return `${indent}<${elementName}${attributes}/>`;
  }

  if (!contentModel || contentModel.getType() === ContentModelType.EMPTY) {
    return `${indent}<${elementName}${attributes}/>`;
  }

  if (contentModel.getType() === ContentModelType.PCDATA) {
    return `${indent}<${elementName}${attributes}>text</${elementName}>`;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(elementName);

  const children = [...contentModel.getChildren()].filter((name) =>
    grammar.getElementDeclMap().has(name)
  );

  if (children.length === 0) {
    if (contentModel.getType() === ContentModelType.ANY || contentModel.getType() === ContentModelType.MIXED) {
      return `${indent}<${elementName}${attributes}>text</${elementName}>`;
    }
    return `${indent}<${elementName}${attributes}/>`;
  }

  const renderedChildren = children.map((childName) =>
    buildElement(childName, grammar, nextAncestors, depth + 1)
  );

  return `${indent}<${elementName}${attributes}>\n${renderedChildren.join('\n')}\n${indent}</${elementName}>`;
}

function buildAttributes(elementName: string, grammar: DTDGrammar): string {
  const attributes = grammar.getElementAttributesMap(elementName);
  if (!attributes || attributes.size === 0) {
    return '';
  }

  const rendered: string[] = [];
  attributes.forEach((attribute, name) => {
    const defaultDecl = attribute.getDefaultDecl();
    const defaultValue = attribute.getDefaultValue();

    if (defaultDecl === '#IMPLIED') {
      return;
    }

    if (defaultDecl === '#REQUIRED') {
      rendered.push(`${name}=""`);
      return;
    }

    if (defaultValue.length > 0) {
      rendered.push(`${name}="${escapeAttribute(defaultValue)}"`);
    }
  });

  return rendered.length > 0 ? ` ${rendered.join(' ')}` : '';
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}
