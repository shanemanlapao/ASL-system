import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT DISTINCT knowledge_component, COUNT(*) as cnt FROM questions GROUP BY knowledge_component ORDER BY cnt DESC')
rows = cur.fetchall()
print('All distinct knowledge_component in questions table:')
for r in rows:
    print(f"  {r['knowledge_component']}: {r['cnt']} questions")

cur.close()
conn.close()
