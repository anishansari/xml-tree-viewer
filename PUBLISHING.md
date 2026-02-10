# Publishing Guide for XML Tree Viewer

## 📋 Pre-Publishing Checklist

### 1. Update Your Info
Before publishing, update these files with your actual information:

**package.json** - Update these fields:
```json
{
  "publisher": "your-publisher-id",  // Your VS Code Marketplace publisher ID
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/xml-tree-viewer"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/xml-tree-viewer/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/xml-tree-viewer#readme"
}
```

**README.md** - Replace:
- `YOUR_USERNAME` with your GitHub username
- `Your Name` with your actual name
- Update screenshot URLs once you have them

### 2. Take Screenshots
Create a `screenshots` folder and capture:
1. `parsed-tree.png` - The Parsed Tree view
2. `object-view.png` - The Object View with some nodes expanded
3. `graphical-tree.png` - The Mermaid diagram view
4. `split-view.png` - The Split View

Recommended size: 1200x800 pixels

### 3. Create Publisher Account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Create a publisher if you don't have one
4. Note your **Publisher ID** (e.g., `anish-ansari`)

### 4. Get Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click User Settings (top right) → Personal Access Tokens
3. Create new token:
   - Name: `vscode-marketplace`
   - Organization: `All accessible organizations`
   - Expiration: 1 year (or custom)
   - Scopes: Select "Custom defined" → Check **Marketplace > Manage**
4. Copy and save the token securely!

---

## 🚀 Publishing Steps

### Option A: Command Line (Recommended)

```bash
# 1. Install vsce globally (if not already)
npm install -g @vscode/vsce

# 2. Login with your PAT
vsce login your-publisher-id
# Paste your Personal Access Token when prompted

# 3. Update version (if needed)
cd ~/Desktop/xml_extension
npm version patch  # or minor, or major

# 4. Package and publish
vsce publish

# Or publish with specific version
vsce publish 0.1.0
```

### Option B: Web Upload

1. Package the extension:
   ```bash
   cd ~/Desktop/xml_extension
   vsce package
   ```

2. Go to https://marketplace.visualstudio.com/manage
3. Click your publisher → New Extension → VS Code
4. Upload the `.vsix` file
5. Fill in details and submit

---

## 📝 Marketplace Listing Details

Use these for the marketplace listing:

### Short Description (200 chars max)
```
Visualize XML files as interactive trees with multiple views: parsed tree, JSON object view, Mermaid diagrams, and split view. Includes sidebar integration.
```

### Tags/Keywords
```
xml, tree, viewer, visualizer, mermaid, diagram, parser, structure, hierarchy, formatter
```

### Categories
- Visualization
- Formatters
- Other

### Pricing
- Free

---

## 🔄 Updating the Extension

When you want to release updates:

```bash
# 1. Make your changes

# 2. Update version
npm version patch  # 0.0.1 → 0.0.2
# or
npm version minor  # 0.0.1 → 0.1.0
# or
npm version major  # 0.0.1 → 1.0.0

# 3. Update CHANGELOG.md with changes

# 4. Publish
vsce publish
```

---

## ✅ Final Checklist Before Publishing

- [ ] Updated `publisher` in package.json
- [ ] Added repository URL to package.json
- [ ] Replaced placeholders in README.md
- [ ] Added screenshots (optional but recommended)
- [ ] LICENSE file present
- [ ] CHANGELOG.md updated
- [ ] Tested extension works correctly
- [ ] Version number is correct
- [ ] Created publisher account
- [ ] Have Personal Access Token ready

---

## 🆘 Troubleshooting

**"Missing publisher"**
→ Make sure `publisher` in package.json matches your marketplace publisher ID exactly.

**"Invalid token"**
→ Regenerate your PAT and ensure it has Marketplace > Manage scope.

**"Extension already exists"**
→ The extension name must be unique. Change `name` in package.json.

**"Icon not found"**
→ Ensure icon.png is 128x128 pixels minimum and path is correct.

---

## 📚 Resources

- [Publishing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)

---

Good luck with your extension! 🎉
