import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

OUT_PATH = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\tle_mute_mic.png"
DPI = 100

fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
fig.patch.set_facecolor('#F8FAFC')
ax.set_facecolor('#F8FAFC')
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.set_aspect('equal')
ax.axis('off')

# Title Pill (Minimalist)
bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF2F2", ec="#EF4444", lw=1.5)
ax.text(5.0, 9.2, 'Mute Microphone', fontsize=14, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_title)

ICON_COLOR = '#4B5563' # Sleek flat dark grey from user reference image
SLASH_RED = '#EF4444' # Vibrant red from user reference
BG_COLOR = '#F8FAFC'

# 1. Main Capsule (Rounded Pill)
# Width: 2.2, Height: 3.6, Center: (5.0, 5.7)
# Racetrack pill with semicircle top and bottom
capsule = patches.FancyBboxPatch((3.9, 4.0), 2.2, 3.4, boxstyle="round,pad=0.0,rounding_size=1.1",
                                 facecolor=ICON_COLOR, edgecolor='none')
ax.add_patch(capsule)

# 2. U-Shaped Cradle
# Outer curve around capsule from theta=180 to 360
theta = np.linspace(np.pi, 2*np.pi, 50)
cradle_r = 1.85
cx, cy = 5.0, 5.3
# Arc path
arc_x = cx + cradle_r * np.cos(theta)
arc_y = cy + cradle_r * np.sin(theta)
# Left and right vertical tips extending up to y=6.2
left_tip_x = np.array([cx - cradle_r, cx - cradle_r])
left_tip_y = np.array([cy, 6.1])
right_tip_x = np.array([cx + cradle_r, cx + cradle_r])
right_tip_y = np.array([cy, 6.1])

cradle_x = np.concatenate([left_tip_x[::-1], arc_x, right_tip_x])
cradle_y = np.concatenate([left_tip_y[::-1], arc_y, right_tip_y])

ax.plot(cradle_x, cradle_y, color=ICON_COLOR, lw=7.0, solid_capstyle='round', solid_joinstyle='round')

# 3. Stem & Base
# Vertical stem down from bottom of cradle (5.0, 5.3 - 1.85 = 3.45) down to base at y=2.5
ax.plot([5.0, 5.0], [3.45, 2.5], color=ICON_COLOR, lw=6.5, solid_capstyle='butt')

# Horizontal Base Pill
ax.plot([3.8, 6.2], [2.5, 2.5], color=ICON_COLOR, lw=7.0, solid_capstyle='round')

# 4. Red Diagonal Mute Slash with White Cutout Gap
# Starts top-left (3.0, 7.8), ends bottom-right (7.1, 3.4)
slash_p1 = (3.0, 7.8)
slash_p2 = (7.1, 3.4)

# White/Background separator outline to match user reference image exactly
ax.plot([slash_p1[0], slash_p2[0]], [slash_p1[1], slash_p2[1]],
        color=BG_COLOR, lw=15.0, solid_capstyle='round', zorder=10)

# Red Slash Line
ax.plot([slash_p1[0], slash_p2[0]], [slash_p1[1], slash_p2[1]],
        color=SLASH_RED, lw=9.0, solid_capstyle='round', zorder=11)

plt.tight_layout(pad=0.1)
plt.savefig(OUT_PATH, dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
plt.close(fig)
print("Generated exact match mute mic to:", OUT_PATH)
