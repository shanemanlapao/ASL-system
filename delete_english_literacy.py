import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("Starting clean removal of English Literacy...")

# 1. Find English Quizzes
cur.execute("SELECT id FROM quizzes WHERE topic_id = 'english-literacy'")
quiz_ids = [r['id'] for r in cur.fetchall()]
print(f"Found {len(quiz_ids)} English quizzes: {quiz_ids}")

if quiz_ids:
    cur.execute("SELECT id FROM questions WHERE quiz_id = ANY(%s)", (quiz_ids,))
    q_ids = [r['id'] for r in cur.fetchall()]
    print(f"Found {len(q_ids)} questions in English quizzes")

    if q_ids:
        cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (q_ids,))
        print(f"  Deleted {cur.rowcount} question_options")

        cur.execute("DELETE FROM questions WHERE id = ANY(%s)", (q_ids,))
        print(f"  Deleted {cur.rowcount} questions")

    cur.execute("DELETE FROM student_quiz_attempts WHERE quiz_id = ANY(%s)", (quiz_ids,))
    print(f"  Deleted {cur.rowcount} student_quiz_attempts")

    cur.execute("DELETE FROM quizzes WHERE id = ANY(%s)", (quiz_ids,))
    print(f"  Deleted {cur.rowcount} quizzes")

# 2. Find English Lesson Groups & Lessons
cur.execute("SELECT id FROM lesson_groups WHERE topic_id = 'english-literacy'")
group_ids = [r['id'] for r in cur.fetchall()]
print(f"Found {len(group_ids)} English lesson groups: {group_ids}")

if group_ids:
    cur.execute("DELETE FROM student_lesson_progress WHERE lesson_group_id = ANY(%s)", (group_ids,))
    print(f"  Deleted {cur.rowcount} student_lesson_progress")

    cur.execute("SELECT id FROM lessons WHERE lesson_group_id = ANY(%s)", (group_ids,))
    lesson_ids = [r['id'] for r in cur.fetchall()]
    print(f"Found {len(lesson_ids)} lessons: {lesson_ids}")

    if lesson_ids:
        cur.execute("DELETE FROM lesson_slides WHERE lesson_id = ANY(%s)", (lesson_ids,))
        print(f"  Deleted {cur.rowcount} lesson_slides")

        cur.execute("DELETE FROM lessons WHERE id = ANY(%s)", (lesson_ids,))
        print(f"  Deleted {cur.rowcount} lessons")

    cur.execute("DELETE FROM lesson_groups WHERE id = ANY(%s)", (group_ids,))
    print(f"  Deleted {cur.rowcount} lesson_groups")

# 3. Delete English KCs and Student Mastery records
english_kcs = ['KC_SYNTAX_PREPOSITION', 'KC_VOCAB_ADJECTIVE', 'KC_SYNTAX_SENTENCE', 'KC_VOCAB_VERB']
cur.execute("DELETE FROM student_kc_mastery WHERE kc_name = ANY(%s)", (english_kcs,))
print(f"Deleted {cur.rowcount} student_kc_mastery rows for English KCs")

cur.execute("DELETE FROM knowledge_components WHERE topic_id = 'english-literacy' OR name = ANY(%s)", (english_kcs,))
print(f"Deleted {cur.rowcount} knowledge_components for english-literacy")

# 4. Also check if any orphaned records exist
cur.execute("DELETE FROM knowledge_components WHERE topic_id = 'english-literacy'")
cur.execute("DELETE FROM lesson_groups WHERE topic_id = 'english-literacy'")
cur.execute("DELETE FROM quizzes WHERE topic_id = 'english-literacy'")

conn.commit()
cur.close()
conn.close()
print("\n[SUCCESS] English Literacy completely removed from PostgreSQL database!")
