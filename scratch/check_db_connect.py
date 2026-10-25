with open('server.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'psycopg2.connect' in line:
            print(f"L{i}: {line.strip()[:100]}")
            if i < 200: # top-level or early?
                print(f"Early DB connect at L{i}")
