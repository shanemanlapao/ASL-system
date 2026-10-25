import psycopg2
import psycopg2.extras

conn = psycopg2.connect('postgresql://postgres.dtyvgpweriwzyjahkcyk:superbokeeer03@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT id, title, order_index FROM lesson_groups WHERE topic_id = %s ORDER BY order_index', ('english-literacy',))
groups = cur.fetchall()
print('English Literacy Groups:', groups)
for g in groups:
    cur.execute('SELECT id, title, difficulty FROM lessons WHERE group_id = %s', (g['id'],))
    print(f"  Group {g['id']} lessons:", cur.fetchall())

cur.close()
conn.close()
