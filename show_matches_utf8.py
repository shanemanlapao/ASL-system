with open('share_direct.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('mBART', text, re.IGNORECASE)]
with open('matches_out.txt', 'w', encoding='utf-8') as out:
    for idx in matches:
        out.write(f"\n--- MATCH AT {idx} ---\n")
        out.write(text[max(0, idx-500):min(len(text), idx+2000)])
print("Saved matches_out.txt!")
