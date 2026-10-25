import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from PIL import Image
import io
import os

OUT_DIR = os.path.join(os.getcwd(), "assets", "images", "flashcards")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "math_translation.gif")

# Animation settings
TOTAL_FRAMES = 28
FRAME_DURATION = 90  # 90 ms per frame -> 2.52 seconds total
DPI = 100  # 5.12 * 100 = 512 x 512 px

def ease_in_out(t):
    return (1 - np.cos(np.pi * t)) / 2

frames = []

for frame_idx in range(TOTAL_FRAMES):
    fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    
    # 1. Subtle Background Grid
    for i in range(1, 10):
        ax.axhline(i, color='#E2E8F0', lw=1.0, ls=':')
        ax.axvline(i, color='#E2E8F0', lw=1.0, ls=':')
        
    # Calculate translation progress (dx from 0.0 to 4.0)
    if frame_idx < 4:
        # Pause at start (0.36s)
        progress = 0.0
    elif frame_idx < 18:
        # Moving (1.26s)
        t = (frame_idx - 4) / 14.0
        progress = ease_in_out(t)
    elif frame_idx < 25:
        # Pause at end (0.63s)
        progress = 1.0
    else:
        # Smooth reset back (0.27s)
        t = (frame_idx - 25) / 3.0
        progress = 1.0 - ease_in_out(t)
        
    dx = progress * 4.0
    
    # 2. Ghost Outline at Starting Position
    pts_start = np.array([[1.5, 3.0], [4.5, 3.0], [1.5, 7.0]])
    poly_ghost = patches.Polygon(pts_start, closed=True, facecolor='#DBEAFE', edgecolor='#93C5FD', lw=2.0, ls='--', alpha=0.7)
    ax.add_patch(poly_ghost)
    ax.text(2.3, 4.0, 'Start', fontsize=12, fontweight='bold', color='#60A5FA', ha='center')
    
    # 3. Active Sliding Triangle
    pts_moving = pts_start + np.array([dx, 0.0])
    poly_moving = patches.Polygon(pts_moving, closed=True, facecolor='#2563EB', edgecolor='#1D4ED8', lw=3.0, alpha=0.95)
    ax.add_patch(poly_moving)
    
    # 4. Straight Slide Vector Arrow
    # Arrow tip dynamically tracks the moving triangle
    arrow_end_x = max(1.6, 1.5 + dx)
    if dx > 0.3:
        arrow_top = patches.FancyArrowPatch((1.5, 7.0), (arrow_end_x, 7.0), arrowstyle='-|>', mutation_scale=18, color='#1E40AF', lw=2.5)
        arrow_bot = patches.FancyArrowPatch((4.5, 3.0), (4.5 + dx, 3.0), arrowstyle='-|>', mutation_scale=18, color='#1E40AF', lw=2.5)
        ax.add_patch(arrow_top)
        ax.add_patch(arrow_bot)
        
    # Text inside moving triangle
    ax.text(2.3 + dx, 4.0, 'Slide', fontsize=13, fontweight='bold', color='white', ha='center')
    
    # 5. Badges & Labels
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
    ax.text(5.0, 9.1, 'Translation (Slide Movement)', fontsize=13, fontweight='bold', color='#1E3A8A', ha='center', bbox=bbox_title)
    

    
    plt.tight_layout(pad=0.1)
    
    # Save figure to in-memory PIL image
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    img = Image.open(buf).convert('RGB')
    # Convert to adaptive 256-color palette for compact GIF
    img_quant = img.quantize(colors=64, method=Image.Quantize.FASTOCTREE)
    frames.append(img_quant)

# Save as animated GIF
frames[0].save(
    OUT_PATH,
    save_all=True,
    append_images=frames[1:],
    duration=FRAME_DURATION,
    loop=0,
    optimize=True
)

file_size_kb = os.path.getsize(OUT_PATH) / 1024
print(f"Generated {OUT_PATH}")
print(f"Total Frames: {len(frames)}, Total Duration: {len(frames)*FRAME_DURATION} ms ({len(frames)*FRAME_DURATION/1000:.2f}s)")
print(f"File Size: {file_size_kb:.1f} KB")
