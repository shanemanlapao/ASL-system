import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from PIL import Image
import io
import os

OUT_DIR = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08"
os.makedirs(OUT_DIR, exist_ok=True)

DPI = 100 # 5.12 * 100 = 512 x 512 px
TOTAL_FRAMES = 28
FRAME_DURATION = 90 # 90 ms per frame -> 2.52 seconds total

def ease_in_out(t):
    return (1 - np.cos(np.pi * np.clip(t, 0, 1))) / 2

def setup_canvas(bg='#F8FAFC'):
    fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
    fig.patch.set_facecolor(bg)
    ax.set_facecolor(bg)
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
# 1. WEBCAM PRIVACY (Sliding Privacy Shutter)
# =============================================================
def make_webcam_privacy_gif():
    frames = []
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Desktop Monitor Bezel
        bezel = patches.FancyBboxPatch((1.6, 2.8), 6.8, 4.8, boxstyle="round,pad=0.25",
                                       facecolor='#1E293B', edgecolor='#0F172A', lw=2.5)
        ax.add_patch(bezel)
        
        # Inner Screen Glass
        screen = patches.FancyBboxPatch((1.9, 3.1), 6.2, 4.2, boxstyle="round,pad=0.08",
                                        facecolor='#F1F5F9', edgecolor='none')
        ax.add_patch(screen)
        
        # Person silhouette inside screen
        head = patches.Circle((5.0, 5.2), 0.8, facecolor='#94A3B8')
        ax.add_patch(head)
        pts_body = np.array([[3.5, 3.1], [6.5, 3.1], [5.9, 4.2], [4.1, 4.2]])
        body = patches.Polygon(pts_body, closed=True, facecolor='#94A3B8')
        ax.add_patch(body)
        
        # Animation: Shutter slide progress (0.0 to 1.0)
        if f < 4:
            progress = 0.0 # Open
        elif f < 18:
            progress = ease_in_out((f - 4) / 14.0) # Sliding closed
        elif f < 25:
            progress = 1.0 # Closed
        else:
            progress = 1.0 - ease_in_out((f - 25) / 3.0) # Reset open
            
        # Screen background blur stripes fade in with progress
        blur_alpha = progress * 0.9
        for y in [3.6, 4.1, 4.6, 5.1, 5.6, 6.1, 6.6, 7.0]:
            ax.plot([2.1, 7.9], [y, y], color='#CBD5E1', lw=1.5, ls='--', alpha=blur_alpha)
            
        # Webcam module sitting on top bezel
        cam_housing = patches.FancyBboxPatch((3.8, 7.5), 2.4, 0.55, boxstyle="round,pad=0.08",
                                             facecolor='#334155', edgecolor='#0F172A', lw=1.8)
        ax.add_patch(cam_housing)
        
        # Camera Lens (Blue dot at x=5.0)
        lens = patches.Circle((5.0, 7.77), 0.18, facecolor='#0F172A', edgecolor='#38BDF8', lw=1.2)
        ax.add_patch(lens)
        
        # Sliding Red Shutter (slides from x=4.0 to cover x=5.0)
        shutter_x = 3.9 + progress * 0.95
        shutter = patches.FancyBboxPatch((shutter_x, 7.56), 1.15, 0.43, boxstyle="round,pad=0.05",
                                         facecolor='#EF4444', edgecolor='#B91C1C', lw=1.5, zorder=10)
        ax.add_patch(shutter)
        
        # Monitor Stand
        neck = patches.Rectangle((4.55, 1.8), 0.9, 1.1, facecolor='#64748B', edgecolor='#475569', lw=2.0)
        ax.add_patch(neck)
        pts_base = np.array([[3.0, 1.6], [7.0, 1.6], [6.5, 1.9], [3.5, 1.9]])
        base = patches.Polygon(pts_base, closed=True, facecolor='#475569', edgecolor='#334155', lw=2.0)
        ax.add_patch(base)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_webcam_privacy.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 2. MUTE MICROPHONE (Drawing Red Diagonal Slash)
# =============================================================
def make_mute_mic_gif():
    frames = []
    ICON_COLOR = '#52525B'
    SLASH_RED = '#EF4444'
    BG_COLOR = '#F8FAFC'
    
    # Slash endpoints
    p1 = np.array([2.9, 7.8])
    p2 = np.array([7.1, 3.6])
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # 1. Main Capsule
        capsule = patches.FancyBboxPatch(
            (3.9, 3.5), 2.2, 3.6,
            boxstyle="round,pad=0.0,rounding_size=1.1",
            facecolor=ICON_COLOR, edgecolor='none', zorder=2
        )
        ax.add_patch(capsule)
        
        # 2. U-Shaped Cradle
        cx, cy = 5.0, 4.8
        cradle_r = 1.9
        theta = np.linspace(np.pi, 2 * np.pi, 60)
        arc_x = cx + cradle_r * np.cos(theta)
        arc_y = cy + cradle_r * np.sin(theta)
        
        left_tip_x = np.array([cx - cradle_r, cx - cradle_r])
        left_tip_y = np.array([cy, 5.7])
        right_tip_x = np.array([cx + cradle_r, cx + cradle_r])
        right_tip_y = np.array([cy, 5.7])
        
        cradle_x = np.concatenate([left_tip_x[::-1], arc_x, right_tip_x])
        cradle_y = np.concatenate([left_tip_y[::-1], arc_y, right_tip_y])
        ax.plot(cradle_x, cradle_y, color=ICON_COLOR, lw=9.0,
                solid_capstyle='round', solid_joinstyle='round', zorder=2)
        
        # 3. Stem & Base
        ax.plot([5.0, 5.0], [2.9, 2.1], color=ICON_COLOR, lw=8.0,
                solid_capstyle='butt', zorder=2)
        ax.plot([3.7, 6.3], [2.1, 2.1], color=ICON_COLOR, lw=9.0,
                solid_capstyle='round', zorder=2)
        
        # Animation: Slash drawing progress
        if f < 4:
            slash_t = 0.0 # Unmuted
        elif f < 18:
            slash_t = ease_in_out((f - 4) / 14.0) # Drawing slash
        elif f < 25:
            slash_t = 1.0 # Muted hold
        else:
            slash_t = 1.0 - ease_in_out((f - 25) / 3.0) # Unmuting
            
        if slash_t > 0.05:
            cur_p2 = p1 + slash_t * (p2 - p1)
            # White Cutout Gap
            ax.plot([p1[0], cur_p2[0]], [p1[1], cur_p2[1]], color=BG_COLOR, lw=18.0,
                    solid_capstyle='round', zorder=10)
            # Red Slash
            ax.plot([p1[0], cur_p2[0]], [p1[1], cur_p2[1]], color=SLASH_RED, lw=10.0,
                    solid_capstyle='round', zorder=11)
            
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_mute_mic.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 3. MEETING LINK (Interlocking Chain & Padlock Snap)
# =============================================================
def make_meeting_link_gif():
    frames = []
    
    # 45-degree angle setup
    cx, cy = 5.0, 5.2
    rad = np.radians(45)
    cos_a, sin_a = np.cos(rad), np.sin(rad)
    r = 0.85
    
    t_left = np.linspace(np.pi/2, 3*np.pi/2, 30)
    left_cap_x = -2.0 + r * np.cos(t_left)
    left_cap_y = r * np.sin(t_left)
    left_x = np.concatenate([np.array([left_cap_x[0], -0.6]), left_cap_x, np.array([-0.6, left_cap_x[-1]])])
    left_y = np.concatenate([np.array([r, r]), left_cap_y, np.array([-r, -r])])
    
    t_right = np.linspace(-np.pi/2, np.pi/2, 30)
    right_cap_x = 2.0 + r * np.cos(t_right)
    right_cap_y = r * np.sin(t_right)
    right_x = np.concatenate([np.array([right_cap_x[0], 0.6]), right_cap_x, np.array([0.6, right_cap_x[-1]])])
    right_y = np.concatenate([np.array([-r, -r]), right_cap_y, np.array([r, r])])
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Animation: Links glide together
        if f < 4:
            progress = 0.0 # Apart
        elif f < 18:
            progress = ease_in_out((f - 4) / 14.0) # Connecting
        elif f < 25:
            progress = 1.0 # Locked
        else:
            progress = 1.0 - ease_in_out((f - 25) / 3.0) # Separating
            
        sep = (1.0 - progress) * 0.9 # Offset distance
        
        # Left Hook
        lx = left_x - sep
        lx_rot = cx + lx * cos_a - left_y * sin_a
        ly_rot = cy + lx * sin_a + left_y * cos_a
        ax.plot(lx_rot, ly_rot, color='#2563EB', lw=5.5, solid_capstyle='round')
        
        # Right Hook
        rx = right_x + sep
        rx_rot = cx + rx * cos_a - right_y * sin_a
        ry_rot = cy + rx * sin_a + right_y * cos_a
        ax.plot(rx_rot, ry_rot, color='#2563EB', lw=5.5, solid_capstyle='round')
        
        # Center connecting bar appears as progress increases
        if progress > 0.4:
            bar_len = min(1.2, 1.2 * (progress - 0.4) / 0.6)
            bar_x = np.array([-bar_len, bar_len])
            bar_y = np.array([0.0, 0.0])
            bx_rot = cx + bar_x * cos_a - bar_y * sin_a
            by_rot = cy + bar_x * sin_a + bar_y * cos_a
            ax.plot(bx_rot, by_rot, color='#2563EB', lw=5.5, solid_capstyle='round')
            
        # Security Padlock
        lock_body = patches.FancyBboxPatch((6.4, 2.0), 1.8, 1.5, boxstyle="round,pad=0.15",
                                           facecolor='#F59E0B', edgecolor='#D97706', lw=2.2)
        ax.add_patch(lock_body)
        
        # Shackle snaps shut as progress -> 1
        shackle_y = 3.8 if progress > 0.8 else 4.1
        lock_shackle = patches.Arc((7.3, shackle_y), 1.0, 1.3, theta1=0, theta2=180, color='#475569', lw=2.8)
        ax.add_patch(lock_shackle)
        ax.plot([6.8, 6.8], [shackle_y, 3.2], color='#475569', lw=2.8)
        ax.plot([7.8, 7.8], [shackle_y, 3.2], color='#475569', lw=2.8)
        
        ax.plot(7.3, 2.8, marker='o', markersize=5, color='#78350F')
        ax.plot([7.3, 7.3], [2.8, 2.4], color='#78350F', lw=2.2)
        
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_meeting_link.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 4. PASSWORD PROTECTION (Typing Dots & Lock Snap)
# =============================================================
def make_password_protection_gif():
    frames = []
    dot_x_positions = np.linspace(2.5, 5.8, 6)
    
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Input Field Box
        input_box = patches.FancyBboxPatch((1.6, 3.5), 6.8, 1.5, boxstyle="round,pad=0.25",
                                           facecolor='#F8FAFC', edgecolor='#CBD5E1', lw=2.5)
        ax.add_patch(input_box)
        
        # Shield in background
        pts_shield = np.array([[5.0, 8.2], [7.2, 7.2], [6.8, 5.6], [5.0, 4.5], [3.2, 5.6], [2.8, 7.2]])
        shield = patches.Polygon(pts_shield, closed=True, facecolor='#FEF3C7', edgecolor='#F59E0B', lw=2.5, alpha=0.85)
        ax.add_patch(shield)
        
        # Animation: Dots typing in sequence (0 to 6 dots)
        if f < 2:
            num_dots = 0
        elif f < 16:
            num_dots = int((f - 2) / 2.3) # 1 dot every ~2.3 frames
        elif f < 25:
            num_dots = 6 # All dots entered
        else:
            num_dots = 0 # Reset
            
        for i in range(min(num_dots, 6)):
            dot = patches.Circle((dot_x_positions[i], 4.25), 0.28, facecolor='#1E293B')
            ax.add_patch(dot)
            
        # Green Lock & Checkmark appear once all dots typed
        if num_dots >= 6:
            lock_body = patches.FancyBboxPatch((6.8, 3.7), 1.0, 0.9, boxstyle="round,pad=0.1",
                                               facecolor='#10B981', edgecolor='#047857', lw=2.0)
            ax.add_patch(lock_body)
            lock_shackle = patches.Arc((7.3, 4.6), 0.6, 0.8, theta1=0, theta2=180, color='#047857', lw=2.5)
            ax.add_patch(lock_shackle)
            # Checkmark inside shield
            ax.plot([4.2, 4.8, 6.0], [6.2, 5.6, 7.2], color='#059669', lw=4.5)
        else:
            # Unlocked state
            lock_body = patches.FancyBboxPatch((6.8, 3.7), 1.0, 0.9, boxstyle="round,pad=0.1",
                                               facecolor='#94A3B8', edgecolor='#64748B', lw=2.0)
            ax.add_patch(lock_body)
            lock_shackle = patches.Arc((7.3, 4.9), 0.6, 0.8, theta1=0, theta2=180, color='#64748B', lw=2.5)
            ax.add_patch(lock_shackle)
            
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_password_protection.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 5. VISUAL CLARITY (Ring Light Pulsing & Brightening Hands)
# =============================================================
def make_visual_clarity_gif():
    frames = []
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Animation: Light power on (progress 0.0 to 1.0)
        if f < 4:
            progress = 0.1 # Dim
        elif f < 18:
            progress = 0.1 + 0.9 * ease_in_out((f - 4) / 14.0) # Powering on
        elif f < 25:
            progress = 1.0 # Full brightness
        else:
            progress = 1.0 - 0.9 * ease_in_out((f - 25) / 3.0)
            
        # Ring Light
        ring_col = '#FEF08A' if progress > 0.5 else '#E2E8F0'
        center_light = patches.Circle((5.0, 6.8), 1.6, facecolor=ring_col, edgecolor='#F59E0B', lw=3.0)
        ax.add_patch(center_light)
        inner_light = patches.Circle((5.0, 6.8), 0.9, facecolor='#FFFDF5', edgecolor='#FDE047', lw=2.0)
        ax.add_patch(inner_light)
        
        # Radiating Light Rays downward
        ray_alpha = progress
        for angle in np.linspace(200, 340, 7):
            rad = np.radians(angle)
            x1 = 5.0 + 1.8 * np.cos(rad)
            y1 = 6.8 + 1.8 * np.sin(rad)
            x2 = 5.0 + 3.2 * np.cos(rad)
            y2 = 6.8 + 3.2 * np.sin(rad)
            ax.plot([x1, x2], [y1, y2], color='#FBBF24', lw=2.5, ls='--', alpha=ray_alpha)
            
        # Signing Hands (Illuminate from dim to warm amber)
        hand_col = '#F59E0B' if progress > 0.6 else '#94A3B8'
        edge_col = '#D97706' if progress > 0.6 else '#64748B'
        
        # Left Hand
        pts_hand_l = np.array([[2.8, 1.8], [3.6, 2.8], [3.2, 3.8], [2.2, 3.2]])
        hand_l = patches.Polygon(pts_hand_l, closed=True, facecolor=hand_col, edgecolor=edge_col, lw=2.5)
        ax.add_patch(hand_l)
        
        # Right Hand
        pts_hand_r = np.array([[7.2, 1.8], [6.4, 2.8], [6.8, 3.8], [7.8, 3.2]])
        hand_r = patches.Polygon(pts_hand_r, closed=True, facecolor=hand_col, edgecolor=edge_col, lw=2.5)
        ax.add_patch(hand_r)
        
        # Clarity Sparkles appear when fully lit
        if progress > 0.7:
            sparkle_alpha = float(np.clip((progress - 0.7) / 0.3, 0.0, 1.0))
            ax.plot(5.0, 3.2, marker='*', markersize=14, color='#F59E0B', alpha=sparkle_alpha)
            ax.plot(3.8, 4.4, marker='*', markersize=10, color='#F59E0B', alpha=sparkle_alpha)
            ax.plot(6.2, 4.4, marker='*', markersize=10, color='#F59E0B', alpha=sparkle_alpha)
            
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_visual_clarity.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

# =============================================================
# 6. CHAT ETIQUETTE (Sequential Chat Bubbles Popping In)
# =============================================================
def make_chat_etiquette_gif():
    frames = []
    for f in range(TOTAL_FRAMES):
        fig, ax = setup_canvas()
        
        # Bubble 1: Lesson Question (Appears frames 2 to 24)
        if f >= 3:
            bubble1 = patches.FancyBboxPatch((1.6, 5.0), 4.5, 2.2, boxstyle="round,pad=0.3",
                                             facecolor='#EFF6FF', edgecolor='#3B82F6', lw=2.5)
            ax.add_patch(bubble1)
            pts_tail1 = np.array([[2.2, 5.0], [1.6, 4.2], [2.8, 5.0]])
            tail1 = patches.Polygon(pts_tail1, closed=True, facecolor='#EFF6FF', edgecolor='#3B82F6', lw=2.0)
            ax.add_patch(tail1)
            ax.text(3.8, 6.1, 'Lesson Question?', fontsize=12, fontweight='bold', color='#1D4ED8', ha='center')
            
        # Bubble 2: Polite Response (Appears frames 10 to 24)
        if f >= 10:
            bubble2 = patches.FancyBboxPatch((4.0, 2.4), 4.4, 2.0, boxstyle="round,pad=0.3",
                                             facecolor='#FEF3C7', edgecolor='#D97706', lw=2.5)
            ax.add_patch(bubble2)
            pts_tail2 = np.array([[7.4, 2.4], [8.0, 1.6], [6.8, 2.4]])
            tail2 = patches.Polygon(pts_tail2, closed=True, facecolor='#FEF3C7', edgecolor='#D97706', lw=2.0)
            ax.add_patch(tail2)
            ax.text(6.2, 3.4, 'Polite & Relevant ✓', fontsize=12, fontweight='bold', color='#92400E', ha='center')
            
            # Gold Respect Star
            ax.plot(8.0, 7.8, marker='*', markersize=18, color='#F59E0B')
            
        frames.append(fig_to_quantized_img(fig))
        
    out_path = os.path.join(OUT_DIR, "tle_chat_etiquette.gif")
    frames[0].save(out_path, save_all=True, append_images=frames[1:], duration=FRAME_DURATION, loop=0, optimize=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)/1024:.1f} KB)")

if __name__ == "__main__":
    make_webcam_privacy_gif()
    make_mute_mic_gif()
    make_meeting_link_gif()
    make_password_protection_gif()
    make_visual_clarity_gif()
    make_chat_etiquette_gif()
    print("All 6 TLE Animated GIFs generated in artifact directory!")
