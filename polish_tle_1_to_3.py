import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

OUT_DIR = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08"
os.makedirs(OUT_DIR, exist_ok=True)
DPI = 100

def setup_canvas(bg='#F8FAFC'):
    fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.set_aspect('equal')
    ax.axis('off')
    return fig, ax

def save_fig(fig, filename):
    plt.tight_layout(pad=0.1)
    out_path = os.path.join(OUT_DIR, filename)
    plt.savefig(out_path, dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    print("Saved:", out_path)

# =============================================================
# 1. WEBCAM PRIVACY (Clean Desktop Monitor + Webcam Slider)
# =============================================================
def draw_webcam_privacy():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF3C7", ec="#F59E0B", lw=1.5)
    ax.text(5.0, 9.2, 'Webcam Privacy', fontsize=14, fontweight='bold', color='#92400E', ha='center', bbox=bbox_title)
    
    # Desktop Monitor Frame
    bezel = patches.FancyBboxPatch((1.6, 3.0), 6.8, 4.6, boxstyle="round,pad=0.25",
                                   facecolor='#1E293B', edgecolor='#0F172A', lw=2.5)
    ax.add_patch(bezel)
    
    # Inner Screen Glass
    screen = patches.FancyBboxPatch((1.9, 3.3), 6.2, 4.0, boxstyle="round,pad=0.08",
                                    facecolor='#F1F5F9', edgecolor='none')
    ax.add_patch(screen)
    
    # Clean Person Silhouette inside screen
    head = patches.Circle((5.0, 5.3), 0.8, facecolor='#94A3B8')
    ax.add_patch(head)
    pts_body = np.array([[3.5, 3.3], [6.5, 3.3], [5.9, 4.3], [4.1, 4.3]])
    body = patches.Polygon(pts_body, closed=True, facecolor='#94A3B8')
    ax.add_patch(body)
    
    # Privacy stripes / blur lines across background
    for y in [3.8, 4.3, 4.8, 5.3, 5.8, 6.3, 6.8]:
        ax.plot([2.1, 7.9], [y, y], color='#E2E8F0', lw=1.5, ls=':')
        
    # Webcam module sitting on top bezel
    cam_housing = patches.FancyBboxPatch((4.1, 7.5), 1.8, 0.5, boxstyle="round,pad=0.08",
                                         facecolor='#334155', edgecolor='#0F172A', lw=1.5)
    ax.add_patch(cam_housing)
    # Lens
    lens = patches.Circle((5.0, 7.75), 0.17, facecolor='#0F172A', edgecolor='#38BDF8', lw=1.2)
    ax.add_patch(lens)
    
    # Red Privacy Shutter Slider
    shutter = patches.FancyBboxPatch((4.55, 7.55), 0.9, 0.4, boxstyle="round,pad=0.05",
                                     facecolor='#EF4444', edgecolor='#B91C1C', lw=1.5)
    ax.add_patch(shutter)
    ax.text(5.0, 7.75, 'SHUTTER', fontsize=6.5, fontweight='bold', color='white', ha='center', va='center')
    
    # Monitor Stand Neck & Base
    neck = patches.Rectangle((4.55, 2.0), 0.9, 1.1, facecolor='#64748B', edgecolor='#475569', lw=2.0)
    ax.add_patch(neck)
    pts_base = np.array([[3.0, 1.8], [7.0, 1.8], [6.5, 2.1], [3.5, 2.1]])
    base = patches.Polygon(pts_base, closed=True, facecolor='#475569', edgecolor='#334155', lw=2.0)
    ax.add_patch(base)
    
    save_fig(fig, "tle_webcam_privacy.png")

# =============================================================
# 2. MUTE MICROPHONE (Clean, Beautiful Mic + Centered Red Slash)
# =============================================================
def draw_mute_mic():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF2F2", ec="#EF4444", lw=1.5)
    ax.text(5.0, 9.2, 'Mute Microphone', fontsize=14, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_title)
    
    # Mic Upper Mesh Capsule (Rounded Top, Slate Blue)
    capsule = patches.FancyBboxPatch((4.0, 4.3), 2.0, 2.8, boxstyle="round,pad=0.35",
                                     facecolor='#3B82F6', edgecolor='#1D4ED8', lw=2.5)
    ax.add_patch(capsule)
    
    # Mesh Grille Lines
    for y in [5.1, 5.7, 6.3]:
        ax.plot([4.3, 5.7], [y, y], color='#93C5FD', lw=1.8)
    ax.plot([5.0, 5.0], [4.6, 6.8], color='#93C5FD', lw=1.8)
    
    # U-shaped cradle holder
    cradle = patches.Arc((5.0, 4.6), 3.4, 3.6, theta1=180, theta2=360, color='#334155', lw=3.2)
    ax.add_patch(cradle)
    # Side pivots
    ax.plot([3.3, 3.3], [4.6, 4.6], marker='o', markersize=6, color='#334155')
    ax.plot([6.7, 6.7], [4.6, 4.6], marker='o', markersize=6, color='#334155')
    
    # Mic Stem
    ax.plot([5.0, 5.0], [2.8, 1.9], color='#334155', lw=4.0)
    
    # Round Desktop Base
    base = patches.FancyBboxPatch((3.0, 1.5), 4.0, 0.45, boxstyle="round,pad=0.15",
                                  facecolor='#1E293B', edgecolor='#0F172A', lw=2.2)
    ax.add_patch(base)
    
    # Red Mute Prohibition Ring (Centered neatly on the mic body)
    ring_center = (5.0, 5.3)
    ring_radius = 2.4
    ring = patches.Circle(ring_center, ring_radius, facecolor='none', edgecolor='#EF4444', lw=4.2)
    ax.add_patch(ring)
    
    # Red Diagonal Slash strictly inside the circle
    slash_d = ring_radius * 0.94
    dx = slash_d * 0.707
    dy = slash_d * 0.707
    ax.plot([ring_center[0] - dx, ring_center[0] + dx],
            [ring_center[1] + dy, ring_center[1] - dy],
            color='#EF4444', lw=4.2, solid_capstyle='round')
    
    save_fig(fig, "tle_mute_mic.png")

# =============================================================
# 3. MEETING LINK (Real Skinny Interlocking 45-degree Chain)
# =============================================================
def draw_meeting_link():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
    ax.text(5.0, 9.2, 'Meeting Link', fontsize=14, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox_title)
    
    # To draw a real 45-degree tilted skinny chain link:
    # A chain link consists of two parallel sides and two semicircular ends.
    # Center of link 1: (3.7, 4.7) tilted at 45 degrees
    # Center of link 2: (6.3, 5.7) tilted at 45 degrees
    
    def create_link_contour(center, angle_deg, length=2.4, width=1.1):
        # Parametric points of a rounded racetrack pill
        t_semi = np.linspace(-np.pi/2, np.pi/2, 25)
        r = width / 2.0
        d = length / 2.0 - r
        # Right cap
        x1 = d + r * np.cos(t_semi)
        y1 = r * np.sin(t_semi)
        # Left cap
        x2 = -d - r * np.cos(t_semi)
        y2 = -r * np.sin(t_semi)
        
        xs = np.concatenate([x1, x2])
        ys = np.concatenate([y1, y2])
        
        # Rotate by angle_deg
        rad = np.radians(angle_deg)
        rot = np.array([[np.cos(rad), -np.sin(rad)], [np.sin(rad), np.cos(rad)]])
        pts = np.column_stack([xs, ys]).dot(rot.T) + center
        return pts
    
    # Outer and inner paths for Link 1 (Lower-left)
    c1 = np.array([4.0, 5.0])
    pts_link1 = create_link_contour(c1, 45, length=3.4, width=1.5)
    poly1 = patches.Polygon(pts_link1, closed=True, facecolor='none', edgecolor='#2563EB', lw=4.0)
    ax.add_patch(poly1)
    
    # Outer and inner paths for Link 2 (Upper-right)
    c2 = np.array([6.0, 5.0])
    pts_link2 = create_link_contour(c2, -45, length=3.4, width=1.5)
    poly2 = patches.Polygon(pts_link2, closed=True, facecolor='none', edgecolor='#2563EB', lw=4.0)
    ax.add_patch(poly2)
    
    # Gold Security Padlock locked right in the center intersection
    # Lock Body
    lock_body = patches.FancyBboxPatch((4.0, 2.2), 2.0, 1.7, boxstyle="round,pad=0.15",
                                       facecolor='#F59E0B', edgecolor='#D97706', lw=2.5)
    ax.add_patch(lock_body)
    
    # Lock Shackle (Arched loop looping into chain)
    lock_shackle = patches.Arc((5.0, 3.8), 1.2, 1.5, theta1=0, theta2=180, color='#475569', lw=3.2)
    ax.add_patch(lock_shackle)
    ax.plot([4.4, 4.4], [3.8, 3.5], color='#475569', lw=3.2)
    ax.plot([5.6, 5.6], [3.8, 3.5], color='#475569', lw=3.2)
    
    # Keyhole
    ax.plot(5.0, 3.2, marker='o', markersize=6, color='#78350F')
    ax.plot([5.0, 5.0], [3.2, 2.7], color='#78350F', lw=2.5)
    
    save_fig(fig, "tle_meeting_link.png")

if __name__ == "__main__":
    draw_webcam_privacy()
    draw_mute_mic()
    draw_meeting_link()
    print("Polished TLE 1-3 generated successfully!")
