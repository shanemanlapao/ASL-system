with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines, 1):
    if '/quiz/session/{quiz_id}' in line:
        for j in range(i-1, min(i+40, len(lines))):
            print(f"L{j+1}: {lines[j].rstrip()}")
        break
