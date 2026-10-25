import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

tables_to_check = [
    ('knowledge_components', 'topic_id'),
    ('lesson_groups', 'topic_id'),
    ('quizzes', 'topic_id'),
    ('student_quiz_attempts', 'topic_id'),
    ('student_lesson_progress', 'topic_id'),
]

print("Checking references to 'english-literacy':")
for table, col in tables_to_check:
    try:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {table} WHERE {col} = 'english-literacy'")
        cnt = cur.fetchone()['cnt']
        print(f"  {table}.{col}: {cnt}")
    except Exception as e:
        print(f"  {table}: error {e}")
        conn.rollback()

cur.execute("SELECT id, title FROM lesson_groups WHERE topic_id = 'english-literacy'")
groups = cur.fetchall()
print("English Lesson Groups:", groups)
g_ids = [g['id'] for g in groups]
if g_ids:
    cur.execute("SELECT COUNT(*) as cnt FROM lessons WHERE lesson_group_id = ANY(%s)", (g_ids,))
    print(f"  lessons in groups: {cur.fetchone()['cnt']}")

cur.close()
conn.close()
