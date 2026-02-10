# XML Tree Viewer

<p align="center">
  <img src="images/icon.svg" width="128" alt="XML Tree Viewer Logo">
</p>

<p align="center">
  <strong>Visualize XML files as interactive tree structures with multiple views</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=xml-tree-viewer.xml-tree-viewer">
    <img src="https://img.shields.io/visual-studio-marketplace/v/xml-tree-viewer.xml-tree-viewer?style=flat-square" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=xml-tree-viewer.xml-tree-viewer">
    <img src="https://img.shields.io/visual-studio-marketplace/i/xml-tree-viewer.xml-tree-viewer?style=flat-square" alt="Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=xml-tree-viewer.xml-tree-viewer">
    <img src="https://img.shields.io/visual-studio-marketplace/r/xml-tree-viewer.xml-tree-viewer?style=flat-square" alt="Rating">
  </a>
</p>

---

## ✨ Features

### 📋 Parsed Tree View
Beautiful indented text representation of your XML structure with syntax highlighting.

![Parsed Tree](https://raw.githubusercontent.com/YOUR_USERNAME/xml-tree-viewer/main/screenshots/parsed-tree.png)

### 🔣 Object View
Interactive JSON-like collapsible tree. Expand/collapse nodes, copy as JSON.

![Object View](https://raw.githubusercontent.com/YOUR_USERNAME/xml-tree-viewer/main/screenshots/object-view.png)

### 🔀 Graphical Tree (Mermaid Diagram)
Visual flowchart representation of your XML hierarchy with zoom controls.

![Graphical Tree](https://raw.githubusercontent.com/YOUR_USERNAME/xml-tree-viewer/main/screenshots/graphical-tree.png)

### 📊 Split View
Side-by-side view of parsed tree and graphical diagram.

![Split View](https://raw.githubusercontent.com/YOUR_USERNAME/xml-tree-viewer/main/screenshots/split-view.png)

### 🌳 Sidebar Integration
Always-visible XML structure in the activity bar with live updates as you edit.

---

## 🚀 Getting Started

1. Open any `.xml` file in VS Code
2. Click the **tree icon** in the editor title bar, or
3. Right-click in the editor and select **"XML Tree Viewer: Open Tree View"**, or
4. Use the sidebar panel (tree icon in the activity bar)

---

## 📖 Usage

| Action | How |
|--------|-----|
| Open Tree View | Click tree icon in title bar or right-click → "XML Tree Viewer: Open Tree View" |
| Switch Views | Click tabs: Parsed Tree, Object View, Graphical Tree, Split View |
| Copy Content | Use the "Copy" buttons in each view |
| Zoom Diagram | Use +/- buttons or Reset in Graphical Tree view |
| Expand/Collapse | Click ▼/▶ toggles in Object View, or use Expand All / Collapse All |
| Refresh Sidebar | Click refresh icon in sidebar title |

---

## ⚙️ Commands

| Command | Description |
|---------|-------------|
| `XML Tree Viewer: Open Tree View` | Open the graphical tree viewer panel |
| `XML Tree Viewer: Refresh Sidebar` | Manually refresh the sidebar tree |

---

## 🎨 Views Explained

### Parsed Tree
- Indented text representation
- Shows tag names, attributes, and text content
- Color-coded: tags (red), attributes (orange), values (green)
- Copy to clipboard with one click

### Object View
- JSON-like hierarchical view
- Collapsible nodes for easy navigation
- Shows element counts for arrays/objects
- Expand All / Collapse All buttons
- Copy as formatted JSON

### Graphical Tree
- Mermaid-powered flowchart diagram
- Color-coded nodes: root (blue), branches (green), leaves (orange)
- Zoom in/out and reset controls
- Copy Mermaid code for use elsewhere

### Split View
- Parsed tree and graphical diagram side-by-side
- Great for large XML files
- Responsive layout

---

## 🔧 Requirements

- VS Code 1.85.0 or higher
- No additional dependencies required

---

## 📝 Release Notes

### 0.0.1
- Initial release
- Four view modes: Parsed Tree, Object View, Graphical Tree, Split View
- Sidebar integration with live updates
- Copy to clipboard functionality
- Zoom controls for diagrams

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Mermaid](https://mermaid.js.org/) for diagram rendering
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for XML parsing

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/YOUR_USERNAME">Your Name</a>
</p>
