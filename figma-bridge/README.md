# Figma Local Bridge

This setup enables the AI Agent to directly generate UI frames, vector components, layouts, and typography inside your Figma canvas.

## Architecture

1. **Local Bridge Server (`server.js`)**: Runs on `http://localhost:4321` (HTTP endpoint for the AI) and `ws://localhost:4322` (WebSocket for Figma).
2. **Figma Dev Plugin (`plugin/manifest.json`)**: Runs locally inside your Figma app/browser tab. It connects to the bridge via WebSocket and renders nodes into the active Figma page.

---

## How to Connect Figma (One-Time 30-Second Setup)

### In the Figma Desktop App or Browser:
1. Open any Figma design file (or create a new blank file).
2. Right-click anywhere on the canvas (or open the top menu) and go to:
   **Plugins** → **Development** → **Import plugin from manifest...**
3. In the file picker, select:
   `c:\react_projects\tutorial\figma-bridge\plugin\manifest.json`
4. Once imported, run the plugin:
   Right-click → **Plugins** → **Development** → **Local AI Canvas Bridge**.
5. A small window will appear with a green indicator:
   `🟢 Connected & Listening for AI commands`

---

## Testing / Triggering Designs

Once your plugin shows green, ask me anytime:
- *"Create a modern hero section"*
- *"Design a clean SaaS pricing card"*
- *"Generate a login screen with social auth buttons"*

The AI will post the design schema to `http://localhost:4321/render`, and Figma will draw it instantly!
