with open('share_direct.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer('mBART', text, re.IGNORECASE):
    idx = m.start()
    print("--- MATCH AT", idx, "---")
    print(text[max(0, idx-200):min(len(text), idx+1000)])
