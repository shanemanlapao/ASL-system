import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

OUT_PATH = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\tle_mute_mic.png"
DPI = 150 # High crisp resolution

# Canvas: 5.12 x 5.12 in at 150 DPI = 768 x 768 px
fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
fig.patch.set_facecolor('#F8FAFC')
ax.set_facecolor('#F8FAFC')
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.set_aspect('equal')
ax.axis('off')

ICON_COLOR = '#52525B' # Neutral dark charcoal grey matching reference
SLASH_RED = '#EF4444'  # Vibrant coral red matching reference
BG_COLOR = '#F8FAFC'

# 1. Main Capsule (Centered at x=5.0, y=5.3)
# Width = 2.2, Height = 3.6, semicircle rounding = 1.1
capsule = patches.FancyBboxPatch(
    (3.9, 3.5), 2.2, 3.6,
    boxstyle="round,pad=0.0,rounding_size=1.1",
    facecolor=ICON_COLOR, edgecolor='none', zorder=2
)
ax.add_patch(capsule)

# 2. U-Shaped Cradle
# Centered arc below capsule with radius 1.9
cx, cy = 5.0, 4.8
cradle_r = 1.9
theta = np.linspace(np.pi, 2 * np.pi, 60)
arc_x = cx + cradle_r * np.cos(theta)
arc_y = cy + cradle_r * np.sin(theta)

# Left & Right vertical tips extending straight up to y = 5.7
left_tip_x = np.array([cx - cradle_r, cx - cradle_r])
left_tip_y = np.array([cy, 5.7])
right_tip_x = np.array([cx + cradle_r, cx + cradle_r])
right_tip_y = np.array([cy, 5.7])

cradle_x = np.concatenate([left_tip_x[::-1], arc_x, right_tip_x])
cradle_y = np.concatenate([left_tip_y[::-1], arc_y, right_tip_y])

ax.plot(cradle_x, cradle_y, color=ICON_COLOR, lw=9.0,
        solid_capstyle='round', solid_joinstyle='round', zorder=2)

# 3. Stem & Base
# Vertical stem from bottom of cradle (y = 4.8 - 1.9 = 2.9) down to y = 2.1
ax.plot([5.0, 5.0], [2.9, 2.1], color=ICON_COLOR, lw=8.0,
        solid_capstyle='butt', zorder=2)

# Horizontal Base Pill from x = 3.7 to 6.3 at y = 2.1
ax.plot([3.7, 6.3], [2.1, 2.1], color=ICON_COLOR, lw=9.0,
        solid_capstyle='round', zorder=2)

# 4. Diagonal Red Slash with White Cutout Gap
# Starts top-left at (2.9, 7.8), ends bottom-right at (7.1, 3.6)
p1 = (2.9, 7.8)
p2 = (7.1, 3.6)

# White Cutout Gap (Separator)
ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=BG_COLOR, lw=18.0,
        solid_capstyle='round', zorder=10)

# Solid Red Slash
ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=SLASH_RED, lw=10.0,
        solid_capstyle='round', zorder=11)

plt.tight_layout(pad=0.0)
plt.savefig(OUT_PATH, dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
plt.close(fig)
print("Exact reference mute mic rendered successfully to:", OUT_PATH)
