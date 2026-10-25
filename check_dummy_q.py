import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT q.id, q.quiz_id, q.question_text, q.knowledge_component 
    FROM questions q 
    WHERE q.knowledge_component IN ('kc_123', 'kc_test_title', 'kc_test_2', 'kc_sample')
""")
print('Dummy questions:', cur.fetchall())

cur.close()
conn.close()
