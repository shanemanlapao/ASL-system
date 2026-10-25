import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT topic_id, name, display_name FROM knowledge_components ORDER BY topic_id, name')
rows = cur.fetchall()
print(f"Total active KCs in table: {len(rows)}")
by_topic = {}
for r in rows:
    by_topic.setdefault(r['topic_id'], []).append(r)

for t, kcs in by_topic.items():
    print(f"\n[{t}] ({len(kcs)} KCs):")
    for k in kcs:
        print(f"  - {k['name']:32s} : {k['display_name']}")

cur.close()
conn.close()
