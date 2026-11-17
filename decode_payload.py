import html
import json
import re

with open('gemini_share.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'<script id="bard-initial-data" data-payload="(.*?)">', text)
if m:
    raw_payload = m.group(1)
    decoded_payload = html.unescape(raw_payload)
    print("Found payload! Decoded length:", len(decoded_payload))
    data = json.loads(decoded_payload)
    with open('bard_payload.json', 'w', encoding='utf-8') as out:
        json.dump(data, out, indent=2, ensure_ascii=False)
    print("Dumped bard_payload.json successfully!")
else:
    print("Could not find bard-initial-data tag")
