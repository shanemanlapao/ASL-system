import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.lines as lines
import numpy as np
import os

OUT_DIR = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08"
os.makedirs(OUT_DIR, exist_ok=True)

DPI = 100 # 5.12 * 100 = 512 x 512 px

def setup_canvas(bg='#FFFDF5'):
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

# -------------------------------------------------------------
# 1. WEBCAM PRIVACY (ID 301)
# -------------------------------------------------------------
def make_webcam_privacy():
    fig, ax = setup_canvas()
    
    # Laptop screen frame
    laptop_body = patches.FancyBboxPatch((1.8, 2.5), 6.4, 4.8, boxstyle="round,pad=0.2",
                                         facecolor='#0F172A', edgecolor='#334155', lw=3.0)
    ax.add_patch(laptop_body)
    
    # Inner display
    display = patches.Rectangle((2.1, 2.8), 5.8, 4.0, facecolor='#1E293B', edgecolor='none')
    ax.add_patch(display)
    
    # Blurred/Shielded Background Area (stripes)
    for y in np.linspace(3.0, 6.6, 9):
        ax.plot([2.3, 7.7], [y, y], color='#334155', lw=1.5, ls='--')
        
    # User Silhouette (Head and Shoulders)
    head = patches.Circle((5.0, 5.2), 0.85, facecolor='#F59E0B', edgecolor='#D97706', lw=2.0)
    ax.add_patch(head)
    pts_shoulders = np.array([[3.2, 2.8], [6.8, 2.8], [6.2, 4.0], [3.8, 4.0]])
    shoulders = patches.Polygon(pts_shoulders, closed=True, facecolor='#F59E0B', edgecolor='#D97706', lw=2.0)
    ax.add_patch(shoulders)
    
    # Privacy Shutter / Shield Overlay (top camera)
    shutter_box = patches.FancyBboxPatch((4.3, 7.0), 1.4, 0.45, boxstyle="round,pad=0.08",
                                         facecolor='#DC2626', edgecolor='#991B1B', lw=1.8)
    ax.add_patch(shutter_box)
    ax.text(5.0, 7.22, 'SHUTTER', fontsize=7, fontweight='bold', color='white', ha='center', va='center')
    
    # Laptop base
    pts_base = np.array([[1.2, 2.0], [8.8, 2.0], [8.2, 2.5], [1.8, 2.5]])
    base = patches.Polygon(pts_base, closed=True, facecolor='#64748B', edgecolor='#475569', lw=2.5)
    ax.add_patch(base)
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF3C7", ec="#D97706", lw=1.5)
    ax.text(5.0, 9.1, 'Webcam Privacy (Shutter / Blur)', fontsize=13, fontweight='bold', color='#92400E', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_webcam_privacy.png")

# -------------------------------------------------------------
# 2. MUTE MICROPHONE (ID 302)
# -------------------------------------------------------------
def make_mute_mic():
    fig, ax = setup_canvas()
    
    # Mic Capsule
    capsule = patches.FancyBboxPatch((4.2, 4.2), 1.6, 2.8, boxstyle="round,pad=0.25",
                                     facecolor='#D97706', edgecolor='#B45309', lw=2.8)
    ax.add_patch(capsule)
    
    # Mic Grille lines
    for y in [4.8, 5.4, 6.0, 6.6]:
        ax.plot([4.4, 5.6], [y, y], color='#FDE68A', lw=2.0)
        
    # U-shaped mic cradle
    cradle = patches.Arc((5.0, 4.6), 2.8, 3.2, theta1=180, theta2=360, color='#64748B', lw=3.2)
    ax.add_patch(cradle)
    
    # Mic Stem & Stand Base
    ax.plot([5.0, 5.0], [3.0, 2.0], color='#64748B', lw=4.0)
    base = patches.FancyBboxPatch((3.2, 1.6), 3.6, 0.45, boxstyle="round,pad=0.1",
                                  facecolor='#475569', edgecolor='#334155', lw=2.5)
    ax.add_patch(base)
    
    # Red Mute Prohibition Circle & Slash
    slash_circle = patches.Circle((5.0, 5.2), 2.4, facecolor='none', edgecolor='#DC2626', lw=4.5)
    ax.add_patch(slash_circle)
    # Diagonal line from top-left to bottom-right
    r = 2.4 / np.sqrt(2)
    ax.plot([5.0 - r, 5.0 + r], [5.2 + r, 5.2 - r], color='#DC2626', lw=4.5)
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF2F2", ec="#DC2626", lw=1.5)
    ax.text(5.0, 9.1, 'Mute Microphone (Audio Off)', fontsize=13, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_mute_mic.png")

# -------------------------------------------------------------
# 3. MEETING LINK (ID 303)
# -------------------------------------------------------------
def make_meeting_link():
    fig, ax = setup_canvas()
    
    # Hyperlink Chain Loop Left
    link1 = patches.FancyBboxPatch((2.2, 4.6), 2.6, 1.4, boxstyle="round,pad=0.3",
                                   facecolor='none', edgecolor='#2563EB', lw=4.0)
    ax.add_patch(link1)
    
    # Hyperlink Chain Loop Right
    link2 = patches.FancyBboxPatch((5.2, 4.6), 2.6, 1.4, boxstyle="round,pad=0.3",
                                   facecolor='none', edgecolor='#2563EB', lw=4.0)
    ax.add_patch(link2)
    
    # Gold Security Padlock Locking the Center Link
    body = patches.FancyBboxPatch((4.0, 2.2), 2.0, 1.8, boxstyle="round,pad=0.15",
                                  facecolor='#F59E0B', edgecolor='#D97706', lw=2.8)
    ax.add_patch(body)
    
    # Shackle
    shackle = patches.Arc((5.0, 4.0), 1.2, 1.6, theta1=0, theta2=180, color='#475569', lw=3.5)
    ax.add_patch(shackle)
    
    # Keyhole
    key_dot = patches.Circle((5.0, 3.2), 0.22, facecolor='#78350F')
    ax.add_patch(key_dot)
    pts_kh = np.array([[4.9, 3.2], [5.1, 3.2], [5.18, 2.6], [4.82, 2.6]])
    key_slot = patches.Polygon(pts_kh, closed=True, facecolor='#78350F')
    ax.add_patch(key_slot)
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
    ax.text(5.0, 9.1, 'Private Meeting Link (Secure URL)', fontsize=13, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_meeting_link.png")

# -------------------------------------------------------------
# 4. PASSWORD PROTECTION (ID 304)
# -------------------------------------------------------------
def make_password_protection():
    fig, ax = setup_canvas()
    
    # Input field box
    input_box = patches.FancyBboxPatch((1.6, 3.5), 6.8, 1.5, boxstyle="round,pad=0.25",
                                       facecolor='#F8FAFC', edgecolor='#CBD5E1', lw=2.5)
    ax.add_patch(input_box)
    
    # Secret Dots (••••••)
    for x in np.linspace(2.5, 5.8, 6):
        dot = patches.Circle((x, 4.25), 0.28, facecolor='#1E293B')
        ax.add_patch(dot)
        
    # Closed Green Lock inside the box
    lock_body = patches.FancyBboxPatch((6.8, 3.7), 1.0, 0.9, boxstyle="round,pad=0.1",
                                       facecolor='#10B981', edgecolor='#047857', lw=2.0)
    ax.add_patch(lock_body)
    lock_shackle = patches.Arc((7.3, 4.6), 0.6, 0.8, theta1=0, theta2=180, color='#047857', lw=2.5)
    ax.add_patch(lock_shackle)
    
    # Large Shield Icon in Background / Center
    pts_shield = np.array([[5.0, 8.2], [7.2, 7.2], [6.8, 5.6], [5.0, 4.5], [3.2, 5.6], [2.8, 7.2]])
    shield = patches.Polygon(pts_shield, closed=True, facecolor='#FEF3C7', edgecolor='#F59E0B', lw=2.5, alpha=0.85)
    ax.add_patch(shield)
    
    # Checkmark inside shield
    ax.plot([4.2, 4.8, 6.0], [6.2, 5.6, 7.2], color='#D97706', lw=4.0)
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF3C7", ec="#D97706", lw=1.5)
    ax.text(5.0, 9.1, 'Password Protection (Confidential Code)', fontsize=13, fontweight='bold', color='#92400E', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_password_protection.png")

# -------------------------------------------------------------
# 5. VISUAL CLARITY / LIGHTING (ID 305)
# -------------------------------------------------------------
def make_visual_clarity():
    fig, ax = setup_canvas()
    
    # Ring Light / Bright Warm Sun Source
    center_light = patches.Circle((5.0, 6.6), 1.6, facecolor='#FEF08A', edgecolor='#F59E0B', lw=3.5)
    ax.add_patch(center_light)
    inner_light = patches.Circle((5.0, 6.6), 0.9, facecolor='#FFFDF5', edgecolor='#FDE047', lw=2.0)
    ax.add_patch(inner_light)
    
    # Radiating Light Rays downward onto signing area
    for angle in np.linspace(200, 340, 7):
        rad = np.radians(angle)
        x1 = 5.0 + 1.8 * np.cos(rad)
        y1 = 6.6 + 1.8 * np.sin(rad)
        x2 = 5.0 + 3.0 * np.cos(rad)
        y2 = 6.6 + 3.0 * np.sin(rad)
        ax.plot([x1, x2], [y1, y2], color='#FBBF24', lw=2.5, ls='--')
        
    # Clear Signing Hands (2D Vector Silhouettes)
    # Left hand
    pts_hand_left = np.array([[2.8, 1.8], [3.6, 2.8], [3.2, 3.8], [2.2, 3.2]])
    hand_l = patches.Polygon(pts_hand_left, closed=True, facecolor='#D97706', edgecolor='#B45309', lw=2.5)
    ax.add_patch(hand_l)
    
    # Right hand (open sign)
    pts_hand_right = np.array([[7.2, 1.8], [6.4, 2.8], [6.8, 3.8], [7.8, 3.2]])
    hand_r = patches.Polygon(pts_hand_right, closed=True, facecolor='#D97706', edgecolor='#B45309', lw=2.5)
    ax.add_patch(hand_r)
    
    # Sparkle / Clarity stars
    ax.plot(5.0, 3.0, marker='*', markersize=14, color='#F59E0B')
    ax.plot(3.8, 4.4, marker='*', markersize=10, color='#F59E0B')
    ax.plot(6.2, 4.4, marker='*', markersize=10, color='#F59E0B')
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF9C3", ec="#EAB308", lw=1.5)
    ax.text(5.0, 9.1, 'Visual Clarity (Face & Hands Lighted)', fontsize=13, fontweight='bold', color='#854D0E', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_visual_clarity.png")

# -------------------------------------------------------------
# 6. CHAT ETIQUETTE (ID 306)
# -------------------------------------------------------------
def make_chat_etiquette():
    fig, ax = setup_canvas()
    
    # Chat Bubble 1 (Left, Blue, Question/Topic)
    bubble1 = patches.FancyBboxPatch((1.6, 4.8), 4.5, 2.2, boxstyle="round,pad=0.3",
                                     facecolor='#EFF6FF', edgecolor='#3B82F6', lw=2.5)
    ax.add_patch(bubble1)
    # Tail
    pts_tail1 = np.array([[2.2, 4.8], [1.6, 4.0], [2.8, 4.8]])
    tail1 = patches.Polygon(pts_tail1, closed=True, facecolor='#EFF6FF', edgecolor='#3B82F6', lw=2.0)
    ax.add_patch(tail1)
    ax.text(3.8, 5.9, 'Lesson Question?', fontsize=12, fontweight='bold', color='#1D4ED8', ha='center')
    
    # Chat Bubble 2 (Right, Amber, Polite Response)
    bubble2 = patches.FancyBboxPatch((4.0, 2.2), 4.4, 2.0, boxstyle="round,pad=0.3",
                                     facecolor='#FEF3C7', edgecolor='#D97706', lw=2.5)
    ax.add_patch(bubble2)
    # Tail
    pts_tail2 = np.array([[7.4, 2.2], [8.0, 1.4], [6.8, 2.2]])
    tail2 = patches.Polygon(pts_tail2, closed=True, facecolor='#FEF3C7', edgecolor='#D97706', lw=2.0)
    ax.add_patch(tail2)
    ax.text(6.2, 3.2, 'Polite & Relevant ✓', fontsize=12, fontweight='bold', color='#92400E', ha='center')
    
    # Star / Respect badge in upper right
    ax.plot(8.0, 7.8, marker='*', markersize=18, color='#F59E0B')
    
    # Title Pill
    bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF3C7", ec="#D97706", lw=1.5)
    ax.text(5.0, 9.1, 'Chat Etiquette (Polite & School-Focused)', fontsize=13, fontweight='bold', color='#92400E', ha='center', bbox=bbox_title)
    
    save_fig(fig, "tle_chat_etiquette.png")

if __name__ == "__main__":
    make_webcam_privacy()
    make_mute_mic()
    make_meeting_link()
    make_password_protection()
    make_visual_clarity()
    make_chat_etiquette()
    print("All 6 TLE 2D Vector images created in artifact directory!")
