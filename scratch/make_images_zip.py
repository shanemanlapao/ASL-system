import os
import zipfile

# Active database images
active_files = [
    '4b5d387a-dc6f-4287-8268-d6f89078059c',
    'c1417a36-8a01-4368-95bb-2a10546bd537',
    '4aa6d983-ddbb-4827-a759-dd78e11f877d',
    '8058140e-2645-4102-af02-d67b850fbb06',
    '9e322fd5-9704-47c1-8253-2d3cc39a4c09',
    '11697344-512d-44b7-85ad-ce798b610176.png'
]

output_zip = 'images.zip'
with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for f in os.listdir('assets/uploads'):
        full_path = os.path.join('assets/uploads', f)
        if os.path.isfile(full_path):
            zipf.write(full_path, f)

print(f"Created {output_zip} ({os.path.getsize(output_zip) / (1024*1024):.2f} MB)")
