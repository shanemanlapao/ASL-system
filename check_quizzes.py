import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT id, title, topic_id FROM quizzes WHERE id IN (1, 2, 3)")
print('Quizzes 1, 2, 3:', cur.fetchall())

cur.close()
conn.close()
