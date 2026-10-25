import zipfile, sys

sys.stdout.reconfigure(encoding='utf-8')
with zipfile.ZipFile('logs_latest.zip', 'r') as z:
    infolist = z.infolist()
    # Sort by date_time descending
    infolist.sort(key=lambda x: x.date_time, reverse=True)
    print("Top 10 most recent files:")
    for info in infolist[:10]:
        print(info.filename, info.date_time, f"{info.file_size} bytes")
    
    print("\n" + "="*50 + "\n")
    for info in infolist:
        if ('failure' in info.filename or 'container' in info.filename or 'docker' in info.filename.lower()) and info.file_size > 0:
            print(f"=== {info.filename} ({info.file_size} bytes) ===")
            content = z.read(info.filename).decode('utf-8', errors='replace')
            print(content[-2500:])
            print("\n" + "="*50 + "\n")
            break
