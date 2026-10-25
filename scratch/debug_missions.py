import os
import psycopg2
import psycopg2.extras
from datetime import date

with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
    port=int(os.getenv("DB_PORT", "5432")),
    sslmode=os.getenv("DB_SSLMODE", "require")
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

user_id = 7
client_date = None

try:
    target_date = client_date if client_date else str(date.today())
    print("1. Querying student_daily_missions...")
    cur.execute(
        "SELECT mission_id, claimed, stars_earned FROM student_daily_missions WHERE user_id = %s AND (mission_date = %s OR mission_date = %s)",
        (user_id, target_date, date.today())
    )
    rows = cur.fetchall()
    print("Missions rows:", rows)

    print("2. Querying daily_quiz_slots...")
    cur.execute(
        "SELECT COUNT(*) as cnt FROM daily_quiz_slots WHERE user_id = %s AND (slot_date = %s OR slot_date = %s) AND completed = TRUE",
        (user_id, target_date, date.today())
    )
    q_row = cur.fetchone()
    print("Quiz slots row:", q_row)

    print("3. Querying student_quiz_attempts with completed_at IS NOT NULL...")
    cur.execute(
        """SELECT COUNT(*) as cnt FROM student_quiz_attempts 
           WHERE user_id = %s AND (DATE(started_at) = %s OR DATE(started_at) = %s) AND completed_at IS NOT NULL""",
        (user_id, target_date, date.today())
    )
    s_row = cur.fetchone()
    print("Quiz attempts row:", s_row)

    print("4. Total stars...")
    cur.execute(
        "SELECT COALESCE(SUM(total_stars), 0) AS stars FROM student_profiles WHERE user_id = %s",
        (user_id,)
    )
    row = cur.fetchone()
    print("Stars row:", row)

except Exception as e:
    import traceback
    traceback.print_exc()
