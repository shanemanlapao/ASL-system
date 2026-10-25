import os
import psycopg2
import psycopg2.pool
import psycopg2.extras
import time
from datetime import date

# Load .env
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

host = os.getenv("DB_HOST")
port = int(os.getenv("DB_PORT", "5432"))
sslmode = os.getenv("DB_SSLMODE", "require")

pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1, maxconn=5,
    host=host, database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASSWORD"),
    port=port, connect_timeout=10, sslmode=sslmode,
)

conn = pool.getconn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

user_id = 7
t0 = time.time()

# 1. Total Stars
cur.execute("SELECT COALESCE(SUM(total_stars), 0) AS stars FROM student_profiles WHERE user_id = %s", (user_id,))
total_stars = cur.fetchone()["stars"]

# 2. Streak
cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
streak_row = cur.fetchone()

# 3. Topic progress
cur.execute("""
    SELECT 
        lg.topic_id,
        COUNT(DISTINCT l.id) AS total_lessons,
        COUNT(DISTINCT CASE 
            WHEN l.difficulty = 'easy' AND slp.easy_passed THEN l.id
            WHEN l.difficulty = 'medium' AND slp.medium_passed THEN l.id
            WHEN l.difficulty = 'hard' AND slp.hard_passed THEN l.id
            ELSE NULL 
        END) AS passed_lessons
    FROM lessons l
    JOIN lesson_groups lg ON l.lesson_group_id = lg.id
    LEFT JOIN student_lesson_progress slp ON lg.id = slp.lesson_group_id AND slp.user_id = %s
    GROUP BY lg.topic_id
""", (user_id,))
progress_rows = cur.fetchall()

duration = time.time() - t0
print(f"Executed home-summary DB queries in {duration:.3f}s!")
print(f"Total stars: {total_stars}, Progress rows count: {len(progress_rows)}")

cur.close()
pool.putconn(conn)
pool.closeall()
