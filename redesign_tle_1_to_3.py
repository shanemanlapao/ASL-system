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
# 1. WEBCAM PRIVACY (Sleek Desktop Monitor + Webcam Shutter)
# =============================================================
def draw_webcam_privacy():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF3C7", ec="#F59E0B", lw=1.5)
    ax.text(5.0, 9.2, 'Webcam Privacy', fontsize=14, fontweight='bold', color='#92400E', ha='center', bbox=bbox_title)
    
    # Desktop Monitor Frame
    # Outer bezel
    bezel = patches.FancyBboxPatch((1.8, 3.2), 6.4, 4.4, boxstyle="round,pad=0.2",
                                   facecolor='#1E293B', edgecolor='#0F172A', lw=2.5)
    ax.add_patch(bezel)
    
    # Inner Screen Glass
    screen = patches.FancyBboxPatch((2.1, 3.5), 5.8, 3.8, boxstyle="square,pad=0.0",
                                    facecolor='#F1F5F9', edgecolor='none')
    ax.add_patch(screen)
    
    # Person silhouette inside screen
    head = patches.Circle((5.0, 5.4), 0.75, facecolor='#94A3B8')
    ax.add_patch(head)
    pts_body = np.array([[3.6, 3.5], [6.4, 3.5], [5.9, 4.4], [4.1, 4.4]])
    body = patches.Polygon(pts_body, closed=True, facecolor='#94A3B8')
    ax.add_patch(body)
    
    # Privacy Blur / Slats overlay on background
    for y in [3.8, 4.2, 4.6, 5.0, 5.4, 5.8, 6.2, 6.6, 7.0]:
        ax.plot([2.3, 7.7], [y, y], color='#E2E8F0', lw=1.2, ls=':')
        
    # Webcam module sitting on top bezel
    cam_housing = patches.FancyBboxPatch((4.2, 7.5), 1.6, 0.45, boxstyle="round,pad=0.08",
                                         facecolor='#334155', edgecolor='#0F172A', lw=1.5)
    ax.add_patch(cam_housing)
    # Lens
    lens = patches.Circle((5.0, 7.72), 0.16, facecolor='#0F172A', edgecolor='#38BDF8', lw=1.2)
    ax.add_patch(lens)
    
    # Red Privacy Shutter Slider closing over the lens
    shutter = patches.FancyBboxPatch((4.6, 7.55), 0.8, 0.35, boxstyle="round,pad=0.05",
                                     facecolor='#EF4444', edgecolor='#B91C1C', lw=1.5)
    ax.add_patch(shutter)
    ax.text(5.0, 7.72, 'SLIDE', fontsize=6.5, fontweight='bold', color='white', ha='center', va='center')
    
    # Monitor Neck Stand
    neck = patches.Rectangle((4.6, 2.2), 0.8, 1.2, facecolor='#64748B', edgecolor='#475569', lw=2.0)
    ax.add_patch(neck)
    
    # Monitor Base
    pts_base = np.array([[3.2, 2.0], [6.8, 2.0], [6.4, 2.3], [3.6, 2.3]])
    base = patches.Polygon(pts_base, closed=True, facecolor='#475569', edgecolor='#334155', lw=2.0)
    ax.add_patch(base)
    
    save_fig(fig, "tle_webcam_privacy.png")

# =============================================================
# 2. MUTE MICROPHONE (Simple, Sleek 2D Mic + Proportional Slash)
# =============================================================
def draw_mute_mic():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF2F2", ec="#EF4444", lw=1.5)
    ax.text(5.0, 9.2, 'Mute Microphone', fontsize=14, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_title)
    
    # Mic Capsule (Upper Mesh) - sleek rounded vertical capsule
    capsule = patches.FancyBboxPatch((4.1, 4.5), 1.8, 2.8, boxstyle="round,pad=0.3",
                                     facecolor='#334155', edgecolor='#1E293B', lw=2.5)
    ax.add_patch(capsule)
    
    # Subtle horizontal grille slits
    for y in [5.2, 5.8, 6.4]:
        ax.plot([4.4, 5.6], [y, y], color='#64748B', lw=1.5)
        
    # U-shaped cradle holder
    cradle = patches.Arc((5.0, 4.6), 2.8, 3.2, theta1=180, theta2=360, color='#64748B', lw=3.0)
    ax.add_patch(cradle)
    
    # Mic Vertical Stem
    ax.plot([5.0, 5.0], [3.0, 2.0], color='#64748B', lw=3.5)
    
    # Round Flat Desktop Base
    base = patches.FancyBboxPatch((3.2, 1.7), 3.6, 0.45, boxstyle="round,pad=0.1",
                                  facecolor='#334155', edgecolor='#1E293B', lw=2.0)
    ax.add_patch(base)
    
    # Red Prohibition Circle - cleanly sized and centered over the capsule
    center_y = 5.2
    radius = 2.2
    ring = patches.Circle((5.0, center_y), radius, facecolor='none', edgecolor='#EF4444', lw=4.0)
    ax.add_patch(ring)
    
    # Clean Red Diagonal Slash - strictly contained inside the circle
    slash_len = radius * 0.92
    dx = slash_len * 0.707
    dy = slash_len * 0.707
    ax.plot([5.0 - dx, 5.0 + dx], [center_y + dy, center_y - dy], color='#EF4444', lw=4.0, solid_capstyle='round')
    
    save_fig(fig, "tle_mute_mic.png")

# =============================================================
# 3. MEETING LINK (Clean, Skinny Interlocking Chain + Padlock)
# =============================================================
def draw_meeting_link():
    fig, ax = setup_canvas()
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
    ax.text(5.0, 9.2, 'Meeting Link', fontsize=14, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox_title)
    
    # Skinny Interlocking Chain Links (Iconic 45-degree angle link)
    # Link 1 (Top-Left): tilted oval / pill
    # We can draw using an Arc or FancyBbox with rotation or parametric curve
    # Left skinny link:
    pts_link1 = patches.FancyBboxPatch((2.2, 4.4), 2.8, 1.4, boxstyle="round,pad=0.25",
                                       facecolor='none', edgecolor='#2563EB', lw=3.2)
    ax.add_patch(pts_link1)
    
    # Right skinny link (interlocking):
    pts_link2 = patches.FancyBboxPatch((5.0, 4.4), 2.8, 1.4, boxstyle="round,pad=0.25",
                                       facecolor='none', edgecolor='#2563EB', lw=3.2)
    ax.add_patch(pts_link2)
    
    # Connecting middle bridge to show they are interlinked
    ax.plot([4.3, 5.7], [5.1, 5.1], color='#1D4ED8', lw=3.2, ls='-')
    
    # Gold Security Padlock locked at the center of the link
    # Lock Body
    lock_body = patches.FancyBboxPatch((4.1, 2.2), 1.8, 1.6, boxstyle="round,pad=0.15",
                                       facecolor='#F59E0B', edgecolor='#D97706', lw=2.2)
    ax.add_patch(lock_body)
    
    # Lock Shackle (Arched loop hooking through the chain)
    lock_shackle = patches.Arc((5.0, 3.8), 1.1, 1.4, theta1=0, theta2=180, color='#475569', lw=3.0)
    ax.add_patch(lock_shackle)
    # Shackle legs down into body
    ax.plot([4.45, 4.45], [3.8, 3.5], color='#475569', lw=3.0)
    ax.plot([5.55, 5.55], [3.8, 3.5], color='#475569', lw=3.0)
    
    # Keyhole
    ax.plot(5.0, 3.1, marker='o', markersize=6, color='#78350F')
    ax.plot([5.0, 5.0], [3.1, 2.7], color='#78350F', lw=2.5)
    
    save_fig(fig, "tle_meeting_link.png")

if __name__ == "__main__":
    draw_webcam_privacy()
    draw_mute_mic()
    draw_meeting_link()
    print("Redesigned numbers 1-3 successfully!")
