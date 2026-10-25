with open('server.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if any(w in line for w in ['lesson_progress', 'student_progress', 'flashcard', 'completed_lessons']):
            print(f"L{i}: {line.strip()[:100]}")
