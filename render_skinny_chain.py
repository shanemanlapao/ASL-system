import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

OUT_PATH = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\tle_meeting_link.png"
DPI = 100

fig, ax = plt.subplots(figsize=(5.12, 5.12), dpi=DPI)
fig.patch.set_facecolor('#F8FAFC')
ax.set_facecolor('#F8FAFC')
ax.set_xlim(0, 10)
ax.set_ylim(0, 10)
ax.set_aspect('equal')
ax.axis('off')

# Title Pill
bbox_title = dict(boxstyle="round,pad=0.35", fc="#EFF6FF", ec="#3B82F6", lw=1.5)
ax.text(5.0, 9.2, 'Meeting Link', fontsize=14, fontweight='bold', color='#1E40AF', ha='center', bbox=bbox_title)

# Classic Iconic Link (Two interlocking C-shaped loops with middle bridge)
# Left Link (Capsule with opening facing right)
# Center: (3.6, 5.5), rotated 45 deg
# Or classic horizontal chain:
# Let's draw the standard URL Link vector icon tilted at 45 degrees:
cx, cy = 5.0, 5.2
rad = np.radians(45)
cos_a, sin_a = np.cos(rad), np.sin(rad)

# A standard link icon has two U-hooks facing each other along the diagonal axis, joined by a center bar:
# Along axis: u from -2.8 to +2.8
# Left loop: u from -2.8 to -0.6, width w = 1.6
# Right loop: u from +0.6 to +2.8, width w = 1.6
# Center bar: u from -1.0 to +1.0

# Parametric Left Hook:
t_left = np.linspace(np.pi/2, 3*np.pi/2, 30)
r = 0.8
left_cap_x = -2.0 + r * np.cos(t_left)
left_cap_y = r * np.sin(t_left)
# Straight legs to u = -0.6
left_upper_x = np.array([left_cap_x[0], -0.6])
left_upper_y = np.array([r, r])
left_lower_x = np.array([-0.6, left_cap_x[-1]])
left_lower_y = np.array([-r, -r])

left_x = np.concatenate([left_upper_x[::-1], left_cap_x, left_lower_x])
left_y = np.concatenate([left_upper_y[::-1], left_cap_y, left_lower_y])

# Rotate Left Hook by 45 deg
lx_rot = cx + left_x * cos_a - left_y * sin_a
ly_rot = cy + left_x * sin_a + left_y * cos_a
ax.plot(lx_rot, ly_rot, color='#2563EB', lw=5.0, solid_capstyle='round')

# Parametric Right Hook (Facing left):
t_right = np.linspace(-np.pi/2, np.pi/2, 30)
right_cap_x = 2.0 + r * np.cos(t_right)
right_cap_y = r * np.sin(t_right)
right_upper_x = np.array([0.6, right_cap_x[-1]])
right_upper_y = np.array([r, r])
right_lower_x = np.array([right_cap_x[0], 0.6])
right_lower_y = np.array([-r, -r])

right_x = np.concatenate([right_lower_x[::-1], right_cap_x, right_upper_x])
right_y = np.concatenate([right_lower_y[::-1], right_cap_y, right_upper_y])

rx_rot = cx + right_x * cos_a - right_y * sin_a
ry_rot = cy + right_x * sin_a + right_y * cos_a
ax.plot(rx_rot, ry_rot, color='#2563EB', lw=5.0, solid_capstyle='round')

# Center connecting bar (Skinny diagonal link bridge)
bar_x = np.array([-1.2, 1.2])
bar_y = np.array([0.0, 0.0])
bx_rot = cx + bar_x * cos_a - bar_y * sin_a
by_rot = cy + bar_x * sin_a + bar_y * cos_a
ax.plot(bx_rot, by_rot, color='#2563EB', lw=5.0, solid_capstyle='round')

# Gold Security Padlock at Bottom-Right (Locking the link)
lock_body = patches.FancyBboxPatch((6.4, 2.0), 1.8, 1.5, boxstyle="round,pad=0.15",
                                   facecolor='#F59E0B', edgecolor='#D97706', lw=2.2)
ax.add_patch(lock_body)
# Shackle
lock_shackle = patches.Arc((7.3, 3.5), 1.0, 1.3, theta1=0, theta2=180, color='#475569', lw=2.8)
ax.add_patch(lock_shackle)
ax.plot([6.8, 6.8], [3.5, 3.2], color='#475569', lw=2.8)
ax.plot([7.8, 7.8], [3.5, 3.2], color='#475569', lw=2.8)
# Keyhole
ax.plot(7.3, 2.8, marker='o', markersize=5, color='#78350F')
ax.plot([7.3, 7.3], [2.8, 2.4], color='#78350F', lw=2.2)

plt.tight_layout(pad=0.1)
plt.savefig(OUT_PATH, dpi=DPI, facecolor=fig.get_facecolor(), edgecolor='none')
plt.close(fig)
print("Saved perfect iconic URL link to:", OUT_PATH)
