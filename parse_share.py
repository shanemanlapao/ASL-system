import re

with open('gemini_share.html', 'r', encoding='utf-8') as f:
    text = f.read()

print("File size:", len(text))
# Check for AF_initDataCallback
callbacks = re.findall(r'AF_initDataCallback\((.*?)\);</script>', text, re.DOTALL)
print("Number of AF_initDataCallback:", len(callbacks))

for idx, cb in enumerate(callbacks):
    print(f"Callback {idx} length: {len(cb)}")
    if "BKT" in cb or "mBART" in cb or "evaluat" in cb.lower() or "aslg" in cb.lower():
        print(f"--> Found keywords in Callback {idx}!")
        with open(f"callback_{idx}.txt", "w", encoding="utf-8") as out:
            out.write(cb)

# Also check for any script containing 'Validating'
for line in text.splitlines():
    if "Validating" in line:
        print("Found line with Validating:", line[:200])
