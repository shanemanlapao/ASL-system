import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.lines as lines
import numpy as np
import os

# Output directory
OUT_DIR = os.path.join(os.getcwd(), "assets", "images", "flashcards")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_FAMILY = 'sans-serif'
plt.rcParams['font.family'] = FONT_FAMILY

def setup_canvas():
    fig, ax = plt.subplots(figsize=(6.83, 6.83), dpi=150) # 1024 x 1024 px
    fig.patch.set_facecolor('#F8FAFC') # Clean light background
    ax.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    return fig, ax

# -------------------------------------------------------------
# 1. TRANSLATION (SLIDE)
# -------------------------------------------------------------
def generate_translation():
    fig, ax = setup_canvas()
    
    # Background subtle grid
    for i in range(1, 10):
        ax.axhline(i, color='#E2E8F0', lw=1.2, ls=':')
        ax.axvline(i, color='#E2E8F0', lw=1.2, ls=':')
        
    # Original Triangle (Left, Start)
    pts_start = np.array([[1.5, 3.0], [4.5, 3.0], [1.5, 7.0]])
    poly_start = patches.Polygon(pts_start, closed=True, facecolor='#BFDBFE', edgecolor='#3B82F6', lw=2.5, ls='--', alpha=0.85)
    ax.add_patch(poly_start)
    
    # Translated Triangle (Right, 4 units slide)
    pts_end = np.array([[5.5, 3.0], [8.5, 3.0], [5.5, 7.0]])
    poly_end = patches.Polygon(pts_end, closed=True, facecolor='#2563EB', edgecolor='#1D4ED8', lw=3.5, alpha=0.95)
    ax.add_patch(poly_end)
    
    # Translation Vectors (Slide arrows)
    arrow1 = patches.FancyArrowPatch((1.5, 7.0), (5.5, 7.0), arrowstyle='-|>', mutation_scale=22, color='#1E40AF', lw=3, ls='-')
    arrow2 = patches.FancyArrowPatch((4.5, 3.0), (8.5, 3.0), arrowstyle='-|>', mutation_scale=22, color='#1E40AF', lw=3, ls='-')
    ax.add_patch(arrow1)
    ax.add_patch(arrow2)
    
    # Clean text labels
    ax.text(2.3, 4.2, 'Start', fontsize=18, fontweight='bold', color='#1E40AF', ha='center')
    ax.text(6.3, 4.2, 'Slide', fontsize=18, fontweight='bold', color='white', ha='center')
    
    # Bottom banner / vector instruction
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#EFF6FF", ec="#3B82F6", lw=1.8)
    ax.text(5.0, 1.2, 'Straight Line Move (Slide 4 Units Right)', fontsize=15, fontweight='bold', color='#1E3A8A', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_translation.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

# -------------------------------------------------------------
# 2. REFLECTION (FLIP)
# -------------------------------------------------------------
def generate_reflection():
    fig, ax = setup_canvas()
    
    # Vertical mirror line
    ax.axvline(5.0, color='#DC2626', lw=3.0, ls='--')
    
    # Mirror line label
    bbox_line = dict(boxstyle="round,pad=0.3", fc="#FEF2F2", ec="#DC2626", lw=1.5)
    ax.text(5.0, 9.3, 'Mirror Line of Symmetry', fontsize=13, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_line)
    
    # Left Asymmetric Trapezoid / Flag
    pts_left = np.array([[1.5, 3.0], [4.0, 3.0], [4.0, 7.5], [2.5, 6.0], [1.5, 6.0]])
    poly_left = patches.Polygon(pts_left, closed=True, facecolor='#0284C7', edgecolor='#0369A1', lw=3.5)
    ax.add_patch(poly_left)
    
    # Right Flipped Trapezoid / Flag (reflected across x=5.0: x' = 5 + (5 - x))
    pts_right = np.array([[8.5, 3.0], [6.0, 3.0], [6.0, 7.5], [7.5, 6.0], [8.5, 6.0]])
    poly_right = patches.Polygon(pts_right, closed=True, facecolor='#0284C7', edgecolor='#0369A1', lw=3.5)
    ax.add_patch(poly_right)
    
    # Dashed reflection guide lines connecting vertices
    for y in [3.0, 6.0, 7.5]:
        ax.plot([4.0 if y != 6.0 else 2.5, 6.0 if y != 6.0 else 7.5], [y, y], color='#94A3B8', lw=1.8, ls=':')
        
    # Flip circular arrows showing mirror action
    arrow_flip = patches.FancyArrowPatch((3.8, 8.2), (6.2, 8.2), connectionstyle="arc3,rad=-0.4",
                                         arrowstyle='<|-|>', mutation_scale=20, color='#DC2626', lw=2.5)
    ax.add_patch(arrow_flip)
    ax.text(5.0, 7.8, 'FLIP', fontsize=14, fontweight='bold', color='#DC2626', ha='center')
    
    # Labels
    ax.text(2.8, 4.5, 'Original', fontsize=16, fontweight='bold', color='white', ha='center')
    ax.text(7.2, 4.5, 'Mirror', fontsize=16, fontweight='bold', color='white', ha='center')
    
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#F0F9FF", ec="#0284C7", lw=1.8)
    ax.text(5.0, 1.2, 'Flips Across the Line (Mirror Opposite)', fontsize=15, fontweight='bold', color='#075985', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_reflection.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

# -------------------------------------------------------------
# 3. ROTATION (TURN)
# -------------------------------------------------------------
def generate_rotation():
    fig, ax = setup_canvas()
    
    cx, cy = 5.0, 4.0
    
    # Center Point of Rotation
    ax.plot(cx, cy, marker='o', markersize=14, color='#DC2626', zorder=10)
    ax.text(cx, cy - 0.7, 'Center Point', fontsize=13, fontweight='bold', color='#991B1B', ha='center')
    
    # Shape 1: Upright Arrow Shape (Start: pointing up)
    pts_start = np.array([
        [4.3, 4.0], [5.7, 4.0], [5.7, 7.0], [6.5, 7.0], [5.0, 8.8], [3.5, 7.0], [4.3, 7.0]
    ])
    poly_start = patches.Polygon(pts_start, closed=True, facecolor='#DDD6FE', edgecolor='#7C3AED', lw=2.5, ls='--', alpha=0.85)
    ax.add_patch(poly_start)
    
    # Rotate 90 degrees clockwise around (cx, cy):
    # (x', y') = (cx + (y - cy), cy - (x - cx))
    pts_rot = np.zeros_like(pts_start)
    for i, (x, y) in enumerate(pts_start):
        pts_rot[i] = [cx + (y - cy), cy - (x - cx)]
        
    poly_rot = patches.Polygon(pts_rot, closed=True, facecolor='#7C3AED', edgecolor='#5B21B6', lw=3.5, alpha=0.95)
    ax.add_patch(poly_rot)
    
    # Curved Rotation Arrow (from 12 o'clock to 3 o'clock)
    arc_arrow = patches.FancyArrowPatch((5.0, 7.8), (8.8, 4.0), connectionstyle="arc3,rad=-0.5",
                                        arrowstyle='-|>', mutation_scale=24, color='#DC2626', lw=3.2)
    ax.add_patch(arc_arrow)
    
    # 90° Badge
    bbox_angle = dict(boxstyle="round,pad=0.4", fc="#FEF2F2", ec="#DC2626", lw=1.8)
    ax.text(7.6, 6.8, 'Turn 90° Clockwise', fontsize=13, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_angle)
    
    ax.text(5.0, 5.5, 'Start', fontsize=15, fontweight='bold', color='#5B21B6', ha='center')
    ax.text(6.5, 4.0, 'Turned', fontsize=15, fontweight='bold', color='white', ha='center')
    
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#F5F3FF", ec="#7C3AED", lw=1.8)
    ax.text(5.0, 1.2, 'Spins Around a Center Point (90° Turn)', fontsize=15, fontweight='bold', color='#4C1D95', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_rotation.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

# -------------------------------------------------------------
# 4. LINE OF SYMMETRY
# -------------------------------------------------------------
def generate_symmetry():
    fig, ax = setup_canvas()
    
    # Symmetrical Geometric Hexagon / Kite Shape
    pts_shape = np.array([
        [5.0, 8.5],  # top point
        [8.0, 6.0],  # right upper
        [7.2, 3.0],  # right lower
        [5.0, 2.2],  # bottom point
        [2.8, 3.0],  # left lower
        [2.0, 6.0],  # left upper
    ])
    poly_shape = patches.Polygon(pts_shape, closed=True, facecolor='#C7D2FE', edgecolor='#4338CA', lw=3.5)
    ax.add_patch(poly_shape)
    
    # Prominent Center Line of Symmetry
    ax.plot([5.0, 5.0], [1.5, 9.2], color='#DC2626', lw=3.5, ls='--', zorder=10)
    
    # Matching fold arrows on left and right
    arrow_left = patches.FancyArrowPatch((2.2, 5.0), (4.5, 5.0), arrowstyle='->', mutation_scale=18, color='#4338CA', lw=2.5)
    arrow_right = patches.FancyArrowPatch((7.8, 5.0), (5.5, 5.0), arrowstyle='->', mutation_scale=18, color='#4338CA', lw=2.5)
    ax.add_patch(arrow_left)
    ax.add_patch(arrow_right)
    
    # Labels
    ax.text(3.5, 6.0, 'Left\nHalf', fontsize=16, fontweight='bold', color='#1E1B4B', ha='center')
    ax.text(6.5, 6.0, 'Right\nHalf', fontsize=16, fontweight='bold', color='#1E1B4B', ha='center')
    
    bbox_sym = dict(boxstyle="round,pad=0.4", fc="#FEF2F2", ec="#DC2626", lw=1.8)
    ax.text(5.0, 9.3, 'Line of Symmetry (Fold Line)', fontsize=14, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_sym)
    
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#EEF2FF", ec="#4F46E5", lw=1.8)
    ax.text(5.0, 0.9, 'Both Halves Match Exactly When Folded', fontsize=15, fontweight='bold', color='#312E81', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_symmetry.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

# -------------------------------------------------------------
# 5. CONGRUENT SHAPES
# -------------------------------------------------------------
def generate_congruent():
    fig, ax = setup_canvas()
    
    # Shape 1: Emerald Polygon (Left)
    pts1 = np.array([[1.2, 3.2], [4.2, 3.2], [3.6, 6.8], [1.8, 6.8]])
    poly1 = patches.Polygon(pts1, closed=True, facecolor='#10B981', edgecolor='#047857', lw=3.5)
    ax.add_patch(poly1)
    
    # Shape 2: Identical Emerald Polygon (Right)
    pts2 = pts1 + np.array([4.6, 0.0])
    poly2 = patches.Polygon(pts2, closed=True, facecolor='#10B981', edgecolor='#047857', lw=3.5)
    ax.add_patch(poly2)
    
    # Congruence Symbol in between
    bbox_sym = dict(boxstyle="circle,pad=0.5", fc="#ECFDF5", ec="#059669", lw=2.5)
    ax.text(5.0, 5.0, '≅', fontsize=36, fontweight='bold', color='#047857', ha='center', va='center', bbox=bbox_sym)
    ax.text(5.0, 3.8, 'Congruent', fontsize=13, fontweight='bold', color='#065F46', ha='center')
    
    # Side length indicators (Tick marks)
    # Bottom side ticks
    ax.plot([2.7, 2.7], [3.0, 3.4], color='white', lw=3)
    ax.plot([7.3, 7.3], [3.0, 3.4], color='white', lw=3)
    
    # Top side ticks
    ax.plot([2.7, 2.7], [6.6, 7.0], color='white', lw=3)
    ax.plot([7.3, 7.3], [6.6, 7.0], color='white', lw=3)
    
    # Labels inside shapes
    ax.text(2.7, 5.0, 'Shape A', fontsize=16, fontweight='bold', color='white', ha='center')
    ax.text(7.3, 5.0, 'Shape B', fontsize=16, fontweight='bold', color='white', ha='center')
    
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#ECFDF5", ec="#059669", lw=1.8)
    ax.text(5.0, 1.2, 'Same Size and Same Shape (Shape A ≅ Shape B)', fontsize=15, fontweight='bold', color='#064E3B', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_congruent.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

# -------------------------------------------------------------
# 6. COORDINATE GRID
# -------------------------------------------------------------
def generate_grid():
    fig, ax = setup_canvas()
    
    # Draw Grid Area from 1.5 to 8.5
    ox, oy = 2.0, 2.0
    scale = 1.0 # 6 units grid
    
    for i in range(0, 7):
        ax.axhline(oy + i*scale, xmin=0.18, xmax=0.82, color='#CBD5E1', lw=1.2, ls='-')
        ax.axvline(ox + i*scale, ymin=0.18, ymax=0.82, color='#CBD5E1', lw=1.2, ls='-')
        
    # Main Axes
    ax.annotate('', xy=(ox + 6.3*scale, oy), xytext=(ox - 0.2*scale, oy),
                arrowprops=dict(arrowstyle="->", color='#0F172A', lw=2.5))
    ax.annotate('', xy=(ox, oy + 6.3*scale), xytext=(ox, oy - 0.2*scale),
                arrowprops=dict(arrowstyle="->", color='#0F172A', lw=2.5))
    
    # Axis Labels
    ax.text(ox + 6.5*scale, oy, 'X', fontsize=16, fontweight='bold', color='#0F172A', va='center')
    ax.text(ox, oy + 6.5*scale, 'Y', fontsize=16, fontweight='bold', color='#0F172A', ha='center')
    
    # Tick Numbers
    for i in range(0, 7):
        ax.text(ox + i*scale, oy - 0.4, str(i), fontsize=11, fontweight='bold', color='#475569', ha='center')
        if i > 0:
            ax.text(ox - 0.4, oy + i*scale, str(i), fontsize=11, fontweight='bold', color='#475569', va='center', ha='right')
            
    # Plotted Triangle Vertices: A(1, 1), B(5, 1), C(2, 4)
    vx = np.array([1, 5, 2])
    vy = np.array([1, 1, 4])
    gx = ox + vx * scale
    gy = oy + vy * scale
    
    pts_triangle = np.column_stack([gx, gy])
    poly_tri = patches.Polygon(pts_triangle, closed=True, facecolor='#93C5FD', edgecolor='#1D4ED8', lw=3.0, alpha=0.6)
    ax.add_patch(poly_tri)
    
    # Highlight Points & Coordinates
    labels = ['(1, 1)', '(5, 1)', '(2, 4)']
    offsets = [(0, -0.6), (0, -0.6), (0, 0.4)]
    
    for x, y, lbl, (dx, dy) in zip(gx, gy, labels, offsets):
        ax.plot(x, y, marker='o', markersize=10, color='#1D4ED8', zorder=10)
        bbox_pt = dict(boxstyle="round,pad=0.2", fc="#EFF6FF", ec="#3B82F6", lw=1.2)
        ax.text(x + dx, y + dy, lbl, fontsize=11, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox_pt, zorder=11)
        
    bbox_props = dict(boxstyle="round,pad=0.5", fc="#F8FAFC", ec="#64748B", lw=1.8)
    ax.text(5.0, 0.7, 'Horizontal (X) and Vertical (Y) Grid Lines', fontsize=15, fontweight='bold', color='#1E293B', ha='center', bbox=bbox_props)
    
    out_path = os.path.join(OUT_DIR, "math_grid.jpg")
    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    print("Generated:", out_path)

if __name__ == "__main__":
    generate_translation()
    generate_reflection()
    generate_rotation()
    generate_symmetry()
    generate_congruent()
    generate_grid()
    print("All 6 Math flashcard images generated successfully!")
