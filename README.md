# XML Tree Viewer

<p align="center">
  <img src="https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/icon.png" width="128" alt="XML Tree Viewer Logo">
</p>

<p align="center">
  <strong>Visualize XML/DTD files as interactive structures with multiple views</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=AnishMiyaAnsari.xml-tree-viewer">VS Code Marketplace</a>
  •
  <a href="https://github.com/anishansari/xml-tree-viewer">GitHub Repository</a>
</p>

---

## ✨ Features

### 📋 Parsed Tree View
Beautiful indented text representation of your XML structure with syntax highlighting.

![Parsed Tree](https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/s1.png)

### 🔣 Object View
Interactive JSON-like collapsible tree. Expand/collapse nodes, copy as JSON.

![Object View](https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/s2.png)

### 🔀 Graphical Tree (Mermaid Diagram)
Visual flowchart representation of your XML hierarchy with zoom controls and **Save as Image** (PNG export) button.

![Graphical Tree](https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/s3.png)

### 📊 Split View
Side-by-side view of parsed tree and graphical diagram.

![Split View](https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/s4.png)

### 🌳 Sidebar Integration
Always-visible XML structure in the activity bar with live updates as you edit.

![Sidebar](https://raw.githubusercontent.com/anishansari/xml-tree-viewer/main/images/s5.png)

### 🧩 DTD Support
Open `.dtd` files to generate a starter XML skeleton preview and copy it with one click.

---

## 🚀 Getting Started

1. Open any `.xml` or `.dtd` file in VS Code
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
| **Save Diagram as Image** | Click **Save as Image** button in Graphical Tree view |
| **Generate XML from DTD** | Open a `.dtd` file and use the **Copy XML** button |

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
- **Save as Image**: Export the diagram as a PNG file with one click

### Split View
- Parsed tree and graphical diagram side-by-side
- Great for large XML files
- Responsive layout

### DTD Preview
- Converts DTD declarations to a minimal XML skeleton
- Handles required/default attributes
- Includes a one-click "Copy XML" action

---

## 🔧 Requirements

- VS Code 1.85.0 or higher
- No additional dependencies required

---

## 📝 Release Notes

### 0.0.3
- Added `.dtd` file support in editor title/context actions
- Added DTD to XML skeleton preview with copy button
- Improved PNG export reliability for graphical diagram view

### 0.0.1
- Initial release
- Four view modes: Parsed Tree, Object View, Graphical Tree, Split View
- Sidebar integration with live updates
- Copy to clipboard functionality
- Zoom controls for diagrams
- **Save as Image** button in Graphical Tree view

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
- [typesxml](https://www.npmjs.com/package/typesxml) for DTD parsing support

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/anishansari">anishansari</a>
</p>
