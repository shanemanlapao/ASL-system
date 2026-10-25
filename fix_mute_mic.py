import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

OUT_PATH = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\tle_mute_mic.png"
DPI = 100

fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
fig.patch.set_facecolor('#FFFDF5')
ax.set_facecolor('#FFFDF5')
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.set_aspect('equal')
ax.axis('off')

# 1. Title Pill (Clean & Minimalist)
bbox_title = dict(boxstyle="round,pad=0.35", fc="#FEF2F2", ec="#DC2626", lw=1.5)
ax.text(5.0, 9.1, 'Mute Microphone (Audio Off)', fontsize=14, fontweight='bold', color='#991B1B', ha='center', bbox=bbox_title)

# 2. Sleek Modern Desktop Microphone (Centered around x=5.0, y=5.0)
# Mic Capsule (Upper Mesh)
mesh_capsule = patches.FancyBboxPatch((4.0, 5.2), 2.0, 2.4, boxstyle="round,pad=0.3",
                                      facecolor='#94A3B8', edgecolor='#334155', lw=2.5)
ax.add_patch(mesh_capsule)

# Mesh horizontal grille lines
for y in [5.6, 6.2, 6.8]:
    ax.plot([4.2, 5.8], [y, y], color='#F1F5F9', lw=1.5)
    
# Mic Lower Body
body = patches.FancyBboxPatch((4.0, 3.8), 2.0, 1.4, boxstyle="round,pad=0.15",
                              facecolor='#1E293B', edgecolor='#0F172A', lw=2.5)
ax.add_patch(body)

# Mic U-Shaped Cradle
cradle = patches.Arc((5.0, 4.8), 3.2, 3.4, theta1=180, theta2=360, color='#334155', lw=3.5)
ax.add_patch(cradle)

# Mic Stand Stem
ax.plot([5.0, 5.0], [3.1, 2.0], color='#334155', lw=4.0)

# Mic Stand Base (Sleek Rounded Oval)
base = patches.FancyBboxPatch((3.0, 1.6), 4.0, 0.5, boxstyle="round,pad=0.15",
                              facecolor='#1E293B', edgecolor='#0F172A', lw=2.5)
ax.add_patch(base)

# 3. Muted Red Indicator Badge at Bottom-Right or Clean Centered Prohibition Slash
# A neat, perfectly centered Red Mute Prohibition Ring:
ring_center = (5.0, 5.4)
ring_radius = 2.4
prohibition_ring = patches.Circle(ring_center, ring_radius, facecolor='none', edgecolor='#DC2626', lw=4.5)
ax.add_patch(prohibition_ring)

# Red Diagonal Slash cleanly contained INSIDE the ring (from 135 deg to 315 deg)
slash_r = ring_radius * 0.96
ax.plot([ring_center[0] - slash_r * 0.707, ring_center[0] + slash_r * 0.707],
        [ring_center[1] + slash_r * 0.707, ring_center[1] - slash_r * 0.707],
        color='#DC2626', lw=4.5, solid_capstyle='round')

# 4. Small "MIC OFF" Status Pill at bottom center
bbox_status = dict(boxstyle="round,pad=0.25", fc="#FEF2F2", ec="#DC2626", lw=1.2)
ax.text(5.0, 0.9, 'Microphone Muted', fontsize=12, fontweight='bold', color='#DC2626', ha='center', bbox=bbox_status)

plt.tight_layout(pad=0.1)
plt.savefig(OUT_PATH, dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
plt.close(fig)
print("Updated:", OUT_PATH)
