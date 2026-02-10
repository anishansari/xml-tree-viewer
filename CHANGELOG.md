# Changelog

All notable changes to the "XML Tree Viewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-02-10

### Added
- **Parsed Tree View**: Indented text representation with syntax highlighting
- **Object View**: Interactive JSON-like collapsible tree
- **Graphical Tree View**: Mermaid-powered flowchart diagram with zoom controls
- **Split View**: Side-by-side parsed tree and diagram
- **Sidebar Integration**: Activity bar panel with live XML structure updates
- **Copy Functions**: Copy tree, JSON, or Mermaid code to clipboard
- **Auto-refresh**: Updates when switching editors or saving files
- Context menu integration for XML files
- Editor title bar button for quick access

### Technical
- Built with TypeScript
- Uses [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for XML parsing
- Uses [Mermaid](https://mermaid.js.org/) for diagram rendering
- VS Code Webview API for rich UI

---

## [Unreleased]

### Planned
- Search/filter within tree
- XML validation and error highlighting
- XPath query support
- Export diagram as PNG/SVG
- Theme customization options
- Large file optimization
