with open('server.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'data/' in line.lower() or 'data\\' in line.lower():
            print(f"L{i}: {line.strip()[:100]}")
