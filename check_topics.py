import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT DISTINCT topic_id FROM lesson_groups')
print('Lesson groups topic_ids:', [r['topic_id'] for r in cur.fetchall()])

try:
    cur.execute('SELECT id, name FROM topics')
    print('Topics table:', cur.fetchall())
except Exception as e:
    print('Topics error:', e)

cur.close()
conn.close()
