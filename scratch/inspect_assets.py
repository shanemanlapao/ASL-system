import os

total = 0
for root, dirs, files in os.walk('assets'):
    for f in files:
        fp = os.path.join(root, f)
        sz = os.path.getsize(fp)
        total += sz
        if sz > 500 * 1024: # > 500 KB
            print(f"{fp}: {sz / (1024*1024):.2f} MB")
print(f"Total in assets: {total / (1024*1024):.2f} MB")
