// Show the UI floating window
figma.showUI(__html__, { width: 340, height: 260 });

function hexToRgb(hex) {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

async function renderNode(spec, parent) {
  if (!spec || !spec.type) return null;

  let node = null;

  if (spec.type === 'FRAME') {
    const frame = figma.createFrame();
    frame.name = spec.name || 'Frame';
    frame.resize(spec.width || 300, spec.height || 200);

    if (spec.x !== undefined && spec.y !== undefined) {
      frame.x = spec.x;
      frame.y = spec.y;
    }

    if (spec.backgroundColor) {
      const rgb = hexToRgb(spec.backgroundColor);
      frame.fills = [{ type: 'SOLID', color: rgb }];
    } else if (spec.fills) {
      frame.fills = spec.fills;
    }

    if (spec.cornerRadius) {
      frame.cornerRadius = spec.cornerRadius;
    }

    // Auto layout options
    if (spec.layoutMode) {
      frame.layoutMode = spec.layoutMode; // 'HORIZONTAL' | 'VERTICAL' | 'NONE'
      frame.primaryAxisAlignItems = spec.primaryAxisAlignItems || 'MIN';
      frame.counterAxisAlignItems = spec.counterAxisAlignItems || 'MIN';
      frame.itemSpacing = spec.itemSpacing || 0;
      frame.paddingLeft = spec.paddingLeft || spec.padding || 0;
      frame.paddingRight = spec.paddingRight || spec.padding || 0;
      frame.paddingTop = spec.paddingTop || spec.padding || 0;
      frame.paddingBottom = spec.paddingBottom || spec.padding || 0;
    }

    if (spec.strokeColor) {
      const rgb = hexToRgb(spec.strokeColor);
      frame.strokes = [{ type: 'SOLID', color: rgb }];
      frame.strokeWeight = spec.strokeWeight || 1;
    }

    // Append to parent before processing children
    parent.appendChild(frame);

    if (spec.children && Array.isArray(spec.children)) {
      for (const childSpec of spec.children) {
        await renderNode(childSpec, frame);
      }
    }
    node = frame;
  } else if (spec.type === 'RECTANGLE') {
    const rect = figma.createRectangle();
    rect.name = spec.name || 'Rectangle';
    rect.resize(spec.width || 100, spec.height || 100);
    if (spec.x !== undefined && spec.y !== undefined) {
      rect.x = spec.x;
      rect.y = spec.y;
    }
    if (spec.backgroundColor) {
      const rgb = hexToRgb(spec.backgroundColor);
      rect.fills = [{ type: 'SOLID', color: rgb }];
    }
    if (spec.cornerRadius) {
      rect.cornerRadius = spec.cornerRadius;
    }
    if (spec.strokeColor) {
      const rgb = hexToRgb(spec.strokeColor);
      rect.strokes = [{ type: 'SOLID', color: rgb }];
      rect.strokeWeight = spec.strokeWeight || 1;
    }
    parent.appendChild(rect);
    node = rect;
  } else if (spec.type === 'TEXT') {
    const textNode = figma.createText();
    textNode.name = spec.name || spec.text || 'Text';

    const targetFamily = spec.fontFamily || "Inter";
    const targetStyle = spec.fontStyle || "Regular";
    try {
      await figma.loadFontAsync({ family: targetFamily, style: targetStyle });
      textNode.fontName = { family: targetFamily, style: targetStyle };
    } catch (e) {
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        textNode.fontName = { family: "Inter", style: "Regular" };
      } catch (e2) {
        console.warn("Could not load fallback font");
      }
    }

    textNode.characters = String(spec.text || '');
    textNode.fontSize = spec.fontSize || 14;

    if (spec.color) {
      const rgb = hexToRgb(spec.color);
      textNode.fills = [{ type: 'SOLID', color: rgb }];
    }

    if (spec.x !== undefined && spec.y !== undefined) {
      textNode.x = spec.x;
      textNode.y = spec.y;
    }

    parent.appendChild(textNode);
    node = textNode;
  }

  return node;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'CLEAR_CANVAS') {
    figma.ui.postMessage({ type: 'STATUS_LOG', text: 'Clearing canvas...' });
    const nodes = figma.currentPage.children.slice();
    for (const node of nodes) {
      node.remove();
    }
    figma.ui.postMessage({ type: 'STATUS_LOG', text: 'Canvas cleared!' });
    return;
  }

  if (msg.type === 'RENDER_SPEC') {
    if (msg.clearBeforeRender) {
      const nodes = figma.currentPage.children.slice();
      for (const node of nodes) {
        node.remove();
      }
    }
    const spec = msg.spec;
    figma.ui.postMessage({ type: 'STATUS_LOG', text: 'Rendering design into canvas...' });

    try {
      const currentPage = figma.currentPage;
      const created = await renderNode(spec, currentPage);
      if (created) {
        figma.viewport.scrollAndZoomIntoView([created]);
        figma.currentPage.selection = [created];
        figma.ui.postMessage({ type: 'STATUS_LOG', text: 'Design created successfully!' });
      }
    } catch (err) {
      figma.ui.postMessage({ type: 'STATUS_LOG', text: 'Render error: ' + (err.message || String(err)) });
    }
  }
};
