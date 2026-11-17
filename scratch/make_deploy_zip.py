import os
import zipfile

EXCLUDE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.docx', '.pdf', '.zip', '.tar', '.gz'}

output_zip = 'deploy.zip'
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
    for single_file in ['server.py', 'requirements.txt']:
        if os.path.exists(single_file):
            print(f"Adding {single_file}")
            zipf.write(single_file, single_file)

    if os.path.exists('dist'):
        print("Adding folder dist (excluding images and large media)...")
        for root, dirs, files in os.walk('dist'):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in EXCLUDE_EXT:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, os.getcwd())
                zipf.write(full_path, rel_path)

print(f"Created {output_zip} ({os.path.getsize(output_zip) / (1024*1024):.2f} MB)")
