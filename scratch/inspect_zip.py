import zipfile
import os

if os.path.exists('deploy.zip'):
    with zipfile.ZipFile('deploy.zip', 'r') as z:
        sizes = {}
        for info in z.infolist():
            top = info.filename.split('/')[0] if '/' in info.filename else info.filename
            sizes[top] = sizes.get(top, 0) + info.file_size
        for k, v in sorted(sizes.items(), key=lambda x: x[1], reverse=True):
            print(f"{k}: {v / (1024*1024):.2f} MB uncompressed")
