import os
import zipfile

def zipdir(path, ziph, root_dir):
    for root, dirs, files in os.walk(path):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, root_dir)
            ziph.write(full_path, rel_path)

output_zip = 'deploy.zip'
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    # 1. Single files
    for single_file in ['server.py', 'requirements.txt']:
        if os.path.exists(single_file):
            print(f"Adding {single_file}")
            zipf.write(single_file, single_file)
    
    # 2. Web frontend bundle
    if os.path.exists('dist'):
        print("Adding folder dist")
        zipdir('dist', zipf, os.getcwd())

print(f"Created {output_zip} ({os.path.getsize(output_zip) / (1024*1024):.2f} MB)")
