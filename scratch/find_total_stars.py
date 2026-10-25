with open('server.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if '_get_total_stars' in line:
            print(f"L{i}: {line.strip()[:100]}")
