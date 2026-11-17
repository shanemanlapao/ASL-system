with open('rest_of_share.txt', 'r', encoding='utf-8') as f:
    text = f.read()

import re
# Look for script tags or data-initial-data
print("Lines in rest:", len(text.splitlines()))

# Let's search for any strings or json in rest
for m in re.finditer(r'<script.*?>', text):
    print(m.group(0)[:100])

# Find all JSON-like arrays or text
for line in text.splitlines():
    if "data:" in line or "init" in line.lower() or "bkt" in line.lower():
        print("Candidate line:", line[:200])
