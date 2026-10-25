with open('server.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if any(w in line.lower() for w in ['mbart', 'torch', 'transformers', 'sentencepiece']):
            print(f"L{i}: {line.strip()[:100]}")
