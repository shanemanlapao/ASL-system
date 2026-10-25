import os
import psycopg2
import psycopg2.pool
import psycopg2.extras

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

print(f"Connecting to {host}:{port} with sslmode={sslmode}...")
pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=5,
    host=host,
    database=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
    port=port,
    connect_timeout=10,
    sslmode=sslmode,
)

conn = pool.getconn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute("SELECT 1 as test")
row = cur.fetchone()
print(f"Pool test query result: {row}")
cur.close()
pool.putconn(conn)
print("Returned connection to pool successfully!")
pool.closeall()
