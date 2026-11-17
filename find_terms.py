with open('share_direct.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer('ASLG', text, re.IGNORECASE)]
print("Matches for ASLG:", len(matches))
if matches:
    print(text[matches[0]-100:matches[0]+500])
else:
    print("No ASLG found in share_direct.html")
    # Search for other terms from the screenshot
    for term in ["mBART", "LoRA", "PHOENIX", "How2Sign", "DepEd", "SPED", "evaluat"]:
        m2 = [m.start() for m in re.finditer(term, text, re.IGNORECASE)]
        print(f"Term '{term}': {len(m2)} matches")
