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

DPI = 100 # 5.12 * 100 = 512 x 512 px
TOTAL_FRAMES = 28
FRAME_DURATION = 90 # 90 ms per frame -> 2.52 seconds total

def ease_in_out(t):
    return (1 - np.cos(np.pi * np.clip(t, 0, 1))) / 2

def setup_canvas():
    fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    return fig, ax

def fig_to_quantized_img(fig):
    buf = io.BytesIO()
    plt.tight_layout(pad=0.1)
    plt.savefig(buf, format='png', dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    buf.seek(0)
    img = Image.open(buf).convert('RGB')
    return img.quantize(colors=64, method=Image.Quantize.FASTOCTREE)

# =============================================================
# 1. TRANSLATION (SLIDE)
# =============================================================
def generate_translation_gif():
    frames = []
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        for i in range(1, 10):
            ax.axhline(i, color='#E2E8F0', lw=1.0, ls=':')
            ax.axvline(i, color='#E2E8F0', lw=1.0, ls=':')
            
        if f < 4:
            progress = 0.0
        elif f < 18:
            progress = ease_in_out((f - 4) / 14.0)
        elif f < 25:
            progress = 1.0
        else:
            progress = 1.0 - ease_in_out((f - 25) / 3.0)
            
        dx = progress * 4.0
        
        # Ghost Start
        pts_start = np.array([[1.5, 3.0], [4.5, 3.0], [1.5, 7.0]])
        poly_ghost = patches.Polygon(pts_start, closed=True, facecolor='#DBEAFE', edgecolor='#93C5FD', lw=2.0, ls='--', alpha=0.7)
        ax.add_patch(poly_ghost)
        ax.text(2.3, 4.0, 'Start', fontsize=12, fontweight='bold', color='#60A5FA', ha='center')
        
        # Moving Triangle
        pts_moving = pts_start + np.array([dx, 0.0])
        poly_moving = patches.Polygon(pts_moving, closed=True, facecolor='#2563EB', edgecolor='#1D4ED8', lw=3.0, alpha=0.95)
        ax.add_patch(poly_moving)
        ax.text(2.3 + dx, 4.0, 'Slide', fontsize=13, fontweight='bold', color='white', ha='center')
        
        # Vectors
        if dx > 0.3:
            arrow_top = patches.FancyArrowPatch((1.5, 7.0), (1.5 + dx, 7.0), arrowstyle='-|>', mutation_scale=18, color='#1E40AF', lw=2.5)
            arrow_bot = patches.FancyArrowPatch((4.5, 3.0), (4.5 + dx, 3.0), arrowstyle='-|>', mutation_scale=18, color='#1E40AF', lw=2.5)
            ax.add_patch(arrow_top)
            ax.add_patch(arrow_bot)
            
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
        ax.text(5.0, 9.1, 'Translation (Slide)', fontsize=14, fontweight='bold', color='#1E3A8A', ha='center', bbox=bbox_title)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_translation.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 2. REFLECTION (FLIP)
# =============================================================
def generate_reflection_gif():
    frames = []
    # Left original polygon relative to mirror line x=5.0
    # Original coordinates (x in [1.5, 4.0]):
    pts_left = np.array([[1.5, 3.0], [4.0, 3.0], [4.0, 7.5], [2.5, 6.0], [1.5, 6.0]])
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Mirror line
        ax.axvline(5.0, color='#DC2626', lw=2.8, ls='--')
        
        # Reflection guide dashed lines
        for y in [3.0, 6.0, 7.5]:
            ax.plot([1.5, 8.5], [y, y], color='#E2E8F0', lw=1.2, ls=':')
            
        # Left Original Shape (Always visible)
        poly_orig = patches.Polygon(pts_left, closed=True, facecolor='#BAE6FD', edgecolor='#38BDF8', lw=2.0, ls='--', alpha=0.7)
        ax.add_patch(poly_orig)
        ax.text(2.8, 4.5, 'Original', fontsize=12, fontweight='bold', color='#0284C7', ha='center')
        
        # Motion: Flip angle from 0 to 180 degrees
        if f < 4:
            angle = 0.0 # Pause start
        elif f < 18:
            angle = ease_in_out((f - 4) / 14.0) * 180.0
        elif f < 25:
            angle = 180.0 # Pause flipped
        else:
            angle = (1.0 - ease_in_out((f - 25) / 3.0)) * 180.0
            
        rad = np.radians(angle)
        cos_val = np.cos(rad)
        
        # Compute 3D page-flip projection:
        # Distance from mirror line (x=5.0): dx_rel = x - 5.0 (negative for left)
        # Transformed x: 5.0 + dx_rel * cos(angle)
        # Note: when angle=0, cos=1 -> x = 5 + dx_rel = x (left).
        # When angle=180, cos=-1 -> x = 5 - dx_rel = 5 + (5 - x) (right, flipped).
        pts_flipping = pts_left.copy()
        for i, (x, y) in enumerate(pts_left):
            dx_rel = x - 5.0
            pts_flipping[i, 0] = 5.0 - dx_rel * cos_val # Flip over mirror line
            
        # Active flipping shape color
        fill_col = '#0284C7' if cos_val <= 0 else '#0EA5E9'
        poly_flip = patches.Polygon(pts_flipping, closed=True, facecolor=fill_col, edgecolor='#0369A1', lw=3.0, alpha=0.95)
        ax.add_patch(poly_flip)
        
        # If flipped across mirror line, show "Mirror" label
        if angle > 90:
            center_x = 5.0 - (2.8 - 5.0) * cos_val
            ax.text(center_x, 4.5, 'Mirror', fontsize=13, fontweight='bold', color='white', ha='center')
        elif angle < 45:
            ax.text(2.8, 4.5, 'Original', fontsize=13, fontweight='bold', color='white', ha='center')
            
        # Curved flip arrow indicator
        if angle > 10 and angle < 170:
            flip_arrow = patches.FancyArrowPatch((3.8, 8.2), (6.2, 8.2), connectionstyle="arc3,rad=-0.4",
                                                 arrowstyle='<|-|>', mutation_scale=16, color='#DC2626', lw=2.2)
            ax.add_patch(flip_arrow)
            
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#F0F9FF", ec="#0284C7", lw=1.5)
        ax.text(5.0, 9.1, 'Reflection (Flip)', fontsize=14, fontweight='bold', color='#075985', ha='center', bbox=bbox_title)
        
        bbox_line = dict(boxstyle="round,pad=0.2", fc="#FEF2F2", ec="#DC2626", lw=1.2)
        ax.text(5.0, 1.2, 'Mirror Line', fontsize=11, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_line)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_reflection.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 3. ROTATION (TURN)
# =============================================================
def generate_rotation_gif():
    frames = []
    cx, cy = 5.0, 4.5
    
    # Base arrow pointing up
    pts_base = np.array([
        [4.4, 4.5], [5.6, 4.5], [5.6, 7.2], [6.4, 7.2], [5.0, 8.8], [3.6, 7.2], [4.4, 7.2]
    ])
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Center Pivot Dot
        ax.plot(cx, cy, marker='o', markersize=14, color='#DC2626', zorder=10)
        ax.text(cx, cy - 0.7, 'Center', fontsize=11, fontweight='bold', color='#991B1B', ha='center')
        
        # Ghost Start (upright)
        poly_ghost = patches.Polygon(pts_base, closed=True, facecolor='#EDE9FE', edgecolor='#C4B5FD', lw=2.0, ls='--', alpha=0.7)
        ax.add_patch(poly_ghost)
        
        # Rotation angle (0 to 90 degrees clockwise = negative mathematical angle)
        if f < 4:
            cur_deg = 0.0
        elif f < 18:
            cur_deg = ease_in_out((f - 4) / 14.0) * 90.0
        elif f < 25:
            cur_deg = 90.0
        else:
            cur_deg = (1.0 - ease_in_out((f - 25) / 3.0)) * 90.0
            
        rad = np.radians(-cur_deg) # clockwise
        rot_matrix = np.array([[np.cos(rad), -np.sin(rad)], [np.sin(rad), np.cos(rad)]])
        
        pts_rotated = np.zeros_like(pts_base)
        for i, pt in enumerate(pts_base):
            pts_rotated[i] = [cx, cy] + rot_matrix.dot(pt - np.array([cx, cy]))
            
        poly_active = patches.Polygon(pts_rotated, closed=True, facecolor='#7C3AED', edgecolor='#5B21B6', lw=3.0, alpha=0.95)
        ax.add_patch(poly_active)
        
        # Dynamic arc arrow
        if cur_deg > 8:
            # Draw circular trajectory arc
            arc_arrow = patches.FancyArrowPatch((5.0, 8.2), (cx + 3.7*np.sin(np.radians(cur_deg)), cy + 3.7*np.cos(np.radians(cur_deg))),
                                                connectionstyle="arc3,rad=-0.35",
                                                arrowstyle='-|>', mutation_scale=18, color='#DC2626', lw=2.5)
            ax.add_patch(arc_arrow)
            
        # Angle Pill
        bbox_deg = dict(boxstyle="round,pad=0.25", fc="#FEF2F2", ec="#DC2626", lw=1.2)
        ax.text(7.6, 7.8, f"Turn {cur_deg:.0f}°", fontsize=12, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_deg)
        
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#F5F3FF", ec="#7C3AED", lw=1.5)
        ax.text(5.0, 9.3, 'Rotation (Turn 90°)', fontsize=14, fontweight='bold', color='#4C1D95', ha='center', bbox=bbox_title)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_rotation.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 4. LINE OF SYMMETRY (FOLD)
# =============================================================
def generate_symmetry_gif():
    frames = []
    
    # Symmetrical kite/hexagon
    pts_left_half = np.array([[5.0, 8.5], [2.2, 5.5], [3.2, 2.5], [5.0, 1.8]])
    pts_right_half = np.array([[5.0, 8.5], [7.8, 5.5], [6.8, 2.5], [5.0, 1.8]])
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Center Line of Symmetry
        ax.plot([5.0, 5.0], [1.2, 9.0], color='#DC2626', lw=2.8, ls='--', zorder=10)
        
        # Left half is always steady
        poly_left = patches.Polygon(pts_left_half, closed=True, facecolor='#C7D2FE', edgecolor='#4338CA', lw=3.0)
        ax.add_patch(poly_left)
        ax.text(3.5, 5.2, 'Left\nHalf', fontsize=12, fontweight='bold', color='#312E81', ha='center')
        
        # Right half folds over the vertical axis
        if f < 4:
            fold_progress = 0.0 # Flat open
        elif f < 18:
            fold_progress = ease_in_out((f - 4) / 14.0) # Folding in
        elif f < 25:
            fold_progress = 1.0 # Folded fully
        else:
            fold_progress = 1.0 - ease_in_out((f - 25) / 3.0) # Unfolding
            
        # Cosine projection for 3D page fold:
        # width_scale goes from 1.0 (open right) down to 0.0 (edge on) to -1.0 (folded onto left half)
        fold_angle = fold_progress * 180.0
        width_scale = np.cos(np.radians(fold_angle))
        
        pts_folding = pts_right_half.copy()
        for i, (x, y) in enumerate(pts_right_half):
            dx = x - 5.0
            pts_folding[i, 0] = 5.0 + dx * width_scale
            
        fill_col = '#818CF8' if width_scale < 0 else '#A5B4FC'
        poly_folding = patches.Polygon(pts_folding, closed=True, facecolor=fill_col, edgecolor='#4338CA', lw=2.5, alpha=0.9)
        ax.add_patch(poly_folding)
        
        if width_scale > 0.3:
            ax.text(6.5, 5.2, 'Right\nHalf', fontsize=12, fontweight='bold', color='#312E81', ha='center')
        elif width_scale < -0.7:
            ax.text(3.5, 3.5, 'MATCH!', fontsize=12, fontweight='bold', color='#DC2626', ha='center')
            
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#EEF2FF", ec="#4F46E5", lw=1.5)
        ax.text(5.0, 9.3, 'Line of Symmetry', fontsize=14, fontweight='bold', color='#312E81', ha='center', bbox=bbox_title)
        
        bbox_line = dict(boxstyle="round,pad=0.2", fc="#FEF2F2", ec="#DC2626", lw=1.2)
        ax.text(5.0, 1.2, 'Fold Line', fontsize=11, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_line)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_symmetry.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 5. CONGRUENT SHAPES (SUPERIMPOSE)
# =============================================================
def generate_congruent_gif():
    frames = []
    
    # Shape A (Left fixed): Trapezoid
    pts_A = np.array([[1.5, 3.2], [4.2, 3.2], [3.7, 6.8], [2.0, 6.8]])
    # Shape B starts 4.3 units right
    shift_start = 4.3
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Motion: Shape B glides left to superimpose directly on Shape A
        if f < 4:
            progress = 0.0 # Apart
        elif f < 18:
            progress = ease_in_out((f - 4) / 14.0) # Moving together
        elif f < 25:
            progress = 1.0 # Superimposed perfectly
        else:
            progress = 1.0 - ease_in_out((f - 25) / 3.0) # Moving apart
            
        cur_shift = shift_start * (1.0 - progress)
        
        # Shape A
        poly_A = patches.Polygon(pts_A, closed=True, facecolor='#10B981', edgecolor='#047857', lw=3.0, alpha=0.85)
        ax.add_patch(poly_A)
        
        # Shape B (gliding)
        pts_B = pts_A + np.array([cur_shift, 0.0])
        border_col = '#DC2626' if progress > 0.9 else '#047857'
        poly_B = patches.Polygon(pts_B, closed=True, facecolor='#34D399', edgecolor=border_col, lw=3.0, alpha=0.7)
        ax.add_patch(poly_B)
        
        # Labels
        if progress < 0.6:
            ax.text(2.8, 5.0, 'Shape A', fontsize=12, fontweight='bold', color='white', ha='center')
            ax.text(2.8 + cur_shift, 5.0, 'Shape B', fontsize=12, fontweight='bold', color='white', ha='center')
            # Congruence badge in center
            bbox_sym = dict(boxstyle="circle,pad=0.35", fc="#ECFDF5", ec="#059669", lw=2.0)
            ax.text(5.0, 5.0, '≅', fontsize=26, fontweight='bold', color='#047857', ha='center', va='center', bbox=bbox_sym)
        else:
            bbox_exact = dict(boxstyle="round,pad=0.3", fc="#FEF2F2", ec="#DC2626", lw=1.5)
            ax.text(2.8, 5.0, 'Shape A ≅ Shape B\n(Exact Fit!)', fontsize=12, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_exact)
            
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#ECFDF5", ec="#059669", lw=1.5)
        ax.text(5.0, 9.1, 'Congruent Shapes (Same Size & Shape)', fontsize=13, fontweight='bold', color='#065F46', ha='center', bbox=bbox_title)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_congruent.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 6. COORDINATE GRID (PLOTTING)
# =============================================================
def generate_grid_gif():
    frames = []
    ox, oy = 2.0, 2.0
    scale = 1.0
    
    # Vertices on grid: (1, 1), (5, 1), (2, 5)
    vx = np.array([1, 5, 2])
    vy = np.array([1, 1, 5])
    gx = ox + vx * scale
    gy = oy + vy * scale
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Grid lines
        for i in range(0, 7):
            ax.axhline(oy + i*scale, xmin=0.18, xmax=0.82, color='#CBD5E1', lw=1.0, ls='-')
            ax.axvline(ox + i*scale, ymin=0.18, ymax=0.82, color='#CBD5E1', lw=1.0, ls='-')
            
        # Axes
        ax.annotate('', xy=(ox + 6.3*scale, oy), xytext=(ox - 0.2*scale, oy),
                    arrowprops=dict(arrowstyle="->", color='#0F172A', lw=2.2))
        ax.annotate('', xy=(ox, oy + 6.3*scale), xytext=(ox, oy - 0.2*scale),
                    arrowprops=dict(arrowstyle="->", color='#0F172A', lw=2.2))
        ax.text(ox + 6.5*scale, oy, 'X', fontsize=14, fontweight='bold', color='#0F172A', va='center')
        ax.text(ox, oy + 6.5*scale, 'Y', fontsize=14, fontweight='bold', color='#0F172A', ha='center')
        
        # Axis numbers
        for i in range(0, 7):
            ax.text(ox + i*scale, oy - 0.35, str(i), fontsize=10, fontweight='bold', color='#475569', ha='center')
            if i > 0:
                ax.text(ox - 0.35, oy + i*scale, str(i), fontsize=10, fontweight='bold', color='#475569', va='center', ha='right')
                
        # Phased plotting animation
        # Frames 0-5: Point 1 (1,1) appears
        # Frames 6-11: Point 2 (5,1) appears, line 1-2 draws
        # Frames 12-17: Point 3 (2,5) appears, lines 2-3 and 3-1 draw, triangle fills
        # Frames 18-24: Hold
        # Frames 25-27: Reset
        
        if f >= 2:
            ax.plot(gx[0], gy[0], marker='o', markersize=9, color='#1D4ED8', zorder=10)
            bbox1 = dict(boxstyle="round,pad=0.2", fc="#EFF6FF", ec="#3B82F6", lw=1.0)
            ax.text(gx[0], gy[0] - 0.5, '(1, 1)', fontsize=10, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox1)
            
        if f >= 6:
            ax.plot(gx[1], gy[1], marker='o', markersize=9, color='#1D4ED8', zorder=10)
            bbox2 = dict(boxstyle="round,pad=0.2", fc="#EFF6FF", ec="#3B82F6", lw=1.0)
            ax.text(gx[1], gy[1] - 0.5, '(5, 1)', fontsize=10, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox2)
            # Line 0->1
            ax.plot([gx[0], gx[1]], [gy[0], gy[1]], color='#1D4ED8', lw=2.5)
            
        if f >= 11:
            ax.plot(gx[2], gy[2], marker='o', markersize=9, color='#1D4ED8', zorder=10)
            bbox3 = dict(boxstyle="round,pad=0.2", fc="#EFF6FF", ec="#3B82F6", lw=1.0)
            ax.text(gx[2], gy[2] + 0.4, '(2, 5)', fontsize=10, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox3)
            # Lines 1->2 and 2->0
            ax.plot([gx[1], gx[2]], [gy[1], gy[2]], color='#1D4ED8', lw=2.5)
            ax.plot([gx[2], gx[0]], [gy[2], gy[0]], color='#1D4ED8', lw=2.5)
            
        if f >= 14:
            pts_tri = np.column_stack([gx, gy])
            poly_tri = patches.Polygon(pts_tri, closed=True, facecolor='#93C5FD', edgecolor='#1D4ED8', lw=2.5, alpha=0.5)
            ax.add_patch(poly_tri)
            
        bbox_title = dict(boxstyle="round,pad=0.35", fc="#F8FAFC", ec="#64748B", lw=1.5)
        ax.text(5.0, 9.3, 'Coordinate Grid', fontsize=14, fontweight='bold', color='#1E293B', ha='center', bbox=bbox_title)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "math_grid.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

if __name__ == "__main__":
    generate_translation_gif()
    generate_reflection_gif()
    generate_rotation_gif()
    generate_symmetry_gif()
    generate_congruent_gif()
    generate_grid_gif()
    print("All 6 Math animated GIFs generated successfully!")
