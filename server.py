from typing import Optional, List, Tuple
from fastapi import FastAPI, HTTPException, File, UploadFile, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
MBart50TokenizerFast = None
MBartForConditionalGeneration = None
from passlib.context import CryptContext
import psycopg2
import psycopg2.extras
import psycopg2.pool
import re
import os
import shutil
import uuid
import random
import time
import threading
from collections import defaultdict
from datetime import datetime, timedelta, date

# Password hashing
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# Load .env file using standard library
def load_env_file():
    if os.path.exists(".env"):
        try:
            with open(".env", "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())
        except Exception:
            pass

load_env_file()

app = FastAPI()

# Mount static folder uploads to serve files
# In Azure App Service Linux, /home is mounted to persistent Azure Files storage.
# Storing uploads in /home/site/uploads keeps them safe across deployments.
if os.path.exists("/home/site") and os.path.isdir("/home/site"):
    UPLOAD_DIR = "/home/site/uploads"
    os.environ.setdefault("HF_HOME", "/home/site/models")
elif os.path.exists("/home") and os.path.isdir("/home"):
    UPLOAD_DIR = "/home/uploads"
    os.environ.setdefault("HF_HOME", "/home/models")
else:
    UPLOAD_DIR = "assets/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sync_packaged_uploads():
    """
    On startup, copy all images bundled with the deployment (assets/uploads)
    into the persistent Azure UPLOAD_DIR (/home/site/uploads) so they never
    disappear or go blank after a deployment/restart.
    """
    try:
        packaged_dirs = [
            os.path.abspath("assets/uploads"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "uploads"),
            "/home/site/wwwroot/assets/uploads",
        ]
        target_dir = os.path.abspath(UPLOAD_DIR)
        for p_dir in packaged_dirs:
            if os.path.isdir(p_dir) and p_dir != target_dir:
                for item in os.listdir(p_dir):
                    src = os.path.join(p_dir, item)
                    dst = os.path.join(target_dir, item)
                    if os.path.isfile(src) and not os.path.exists(dst):
                        try:
                            shutil.copy2(src, dst)
                        except Exception:
                            pass
    except Exception as e:
        print(f"[UploadSync] Note: {e}")

sync_packaged_uploads()

def get_public_base_url(request: Request) -> str:
    # Handle Azure reverse proxy headers (X-Forwarded-Proto, X-Forwarded-Host)
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    if "azurewebsites.net" in host or proto == "https":
        return f"https://{host}"
    return f"{proto}://{host}"

# ── Step 1 Security: In-Memory Sliding Window Rate Limiter Engine ─────────────
class SlidingWindowRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._requests = defaultdict(list)
        self._auth_failures = defaultdict(list)
        self._lockouts = {}

    def _clean_old(self, timestamps: list, window_seconds: float, now: float) -> list:
        return [t for t in timestamps if now - t < window_seconds]

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            # Check if key is currently locked out (e.g. 60s brute-force cooldown)
            if key in self._lockouts:
                until = self._lockouts[key]
                if now < until:
                    return False, int(until - now) + 1
                else:
                    del self._lockouts[key]

            timestamps = self._clean_old(self._requests[key], window_seconds, now)
            if len(timestamps) >= max_requests:
                retry_after = int(window_seconds - (now - timestamps[0])) + 1
                return False, max(1, retry_after)

            timestamps.append(now)
            self._requests[key] = timestamps
            return True, 0

    def record_auth_failure(self, ip: str, max_failures: int = 5, window_seconds: int = 60, lock_seconds: int = 60):
        now = time.time()
        with self._lock:
            failures = self._clean_old(self._auth_failures[ip], window_seconds, now)
            failures.append(now)
            self._auth_failures[ip] = failures
            if len(failures) >= max_failures:
                self._lockouts[f"auth_{ip}"] = now + lock_seconds

rate_limiter = SlidingWindowRateLimiter()

# ── Step 1 Security: Multi-Path Fallback & Auto-Healing on Static File Serving ──
@app.get("/static/{filename}")
def serve_uploaded_file(filename: str):
    safe_filename = os.path.basename(filename)

    # Search in order across all possible upload/packaged directories
    candidate_dirs = [
        os.path.abspath(UPLOAD_DIR),
        os.path.abspath("assets/uploads"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "uploads"),
        "/home/site/uploads",
        "/home/site/wwwroot/assets/uploads",
        "/home/uploads",
    ]

    file_path = None
    for c_dir in candidate_dirs:
        if os.path.isdir(c_dir):
            candidate = os.path.abspath(os.path.join(c_dir, safe_filename))
            if candidate.startswith(os.path.abspath(c_dir)) and os.path.isfile(candidate):
                file_path = candidate
                # Auto-heal: Ensure it also exists in persistent UPLOAD_DIR
                target_persistent = os.path.join(os.path.abspath(UPLOAD_DIR), safe_filename)
                if not os.path.exists(target_persistent):
                    try:
                        shutil.copy2(candidate, target_persistent)
                    except Exception:
                        pass
                break

    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    ext = os.path.splitext(safe_filename)[1].lower()
    media_type = "image/jpeg"
    if ext == ".png":
        media_type = "image/png"
    elif ext == ".gif":
        media_type = "image/gif"
    elif ext == ".webp":
        media_type = "image/webp"
    elif ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    else:
        # Check magic bytes for extensionless uploads
        try:
            with open(file_path, "rb") as f:
                header = f.read(12)
                if header.startswith(b'\x89PNG\r\n\x1a\n'):
                    media_type = "image/png"
                elif header.startswith(b'GIF87a') or header.startswith(b'GIF89a'):
                    media_type = "image/gif"
                elif header.startswith(b'RIFF') and header[8:12] == b'WEBP':
                    media_type = "image/webp"
                elif header.startswith(b'\xff\xd8\xff'):
                    media_type = "image/jpeg"
        except Exception:
            pass
    return FileResponse(file_path, media_type=media_type)

app.mount("/static-files", StaticFiles(directory=UPLOAD_DIR), name="static-files")

# Allow all origins so React Native (device/emulator) can reach the server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Step 1 Security & Tiered Rate Limiting Middleware ─────────────────────────
@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    path = request.url.path
    method = request.method

    # Bypass rate limits for health checks and static image views
    if path in ["/health", "/favicon.ico"] or (path.startswith("/static") and method == "GET"):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    # Middleware check for File Upload size limit (10MB)
    if method == "POST" and (path.startswith("/admin/upload") or "/upload-avatar" in path):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > 10 * 1024 * 1024:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "File size exceeds maximum allowed limit of 10MB."}
                    )
            except ValueError:
                pass

    # Tier Matching Matrix
    max_req = 120
    window = 60
    key = f"gen_{client_ip}"

    # Tier 1: Auth & Account (5 req/min, 60s brute-force cooldown)
    if path in ["/login", "/register"] or path.endswith("/change-password"):
        max_req = 5
        window = 60
        key = f"auth_{client_ip}"

    # Tier 2: AI Neural Translation (10 req/min)
    elif path == "/translate":
        max_req = 10
        window = 60
        key = f"ai_{client_ip}"

    # Tier 3: Anti-Cheat Quiz Submissions (1 req / 15s)
    elif (path.startswith("/quiz/session/") and path.endswith("/complete")) or \
         path == "/quiz/offline-sync" or \
         (method == "POST" and ("/daily-quizzes/" in path or "/repair-streak" in path or "/daily-missions/claim" in path)):
        max_req = 1
        window = 15
        key = f"anticheat_{client_ip}_{path}"

    # Tier 4: Media Uploads (5 req/min)
    elif "/upload-avatar" in path or path == "/admin/upload":
        max_req = 5
        window = 60
        key = f"upload_{client_ip}"

    # Tier 5: Heavy Admin Analytics (3 req/min)
    elif path in ["/admin/fit-bkt-model", "/admin/analytics", "/admin/analytics/overview"]:
        max_req = 3
        window = 60
        key = f"analytics_{client_ip}"

    # Tier 6: Destructive Admin Actions (15 req/min)
    elif (path.startswith("/admin/") and method in ["DELETE", "POST"]) or \
         path.startswith("/admin/trash"):
        max_req = 15
        window = 60
        key = f"admin_dest_{client_ip}"

    allowed, retry_after = rate_limiter.is_allowed(key, max_req, window)
    if not allowed:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "detail": f"Too many requests. Please wait {retry_after} seconds before trying again.",
                "retry_after": retry_after
            }
        )

    response = await call_next(request)

    # Track failed logins -> trigger 60s cooldown if 5 failures in 60s
    if path == "/login" and response.status_code in [400, 401]:
        rate_limiter.record_auth_failure(client_ip, max_failures=5, window_seconds=60, lock_seconds=60)

    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    return response

# ── Database connection with ThreadedConnectionPool ─────────────────────────
_DB_POOL = None
_DB_POOL_LOCK = threading.Lock()

def _get_db_pool():
    global _DB_POOL
    if _DB_POOL is None:
        with _DB_POOL_LOCK:
            if _DB_POOL is None:
                database_url = os.getenv("DATABASE_URL")
                conn_args = {}
                if database_url:
                    conn_args = {
                        "dsn": database_url,
                        "connect_timeout": int(os.getenv("DB_TIMEOUT", "10")),
                        "sslmode": os.getenv("DB_SSLMODE", "require"),
                    }
                else:
                    host = os.getenv("DB_HOST", "localhost")
                    port = int(os.getenv("DB_PORT", "5432"))
                    sslmode = os.getenv("DB_SSLMODE", "require" if host not in ["localhost", "127.0.0.1"] else "prefer")
                    conn_args = {
                        "host": host,
                        "database": os.getenv("DB_NAME", "postgres"),
                        "user": os.getenv("DB_USER", "postgres"),
                        "password": os.getenv("DB_PASSWORD", "bokeeer03"),
                        "port": port,
                        "connect_timeout": int(os.getenv("DB_TIMEOUT", "10")),
                        "sslmode": sslmode,
                    }

                try:
                    _DB_POOL = psycopg2.pool.ThreadedConnectionPool(minconn=1, maxconn=10, **conn_args)
                except Exception as e:
                    print(f"[DB Pool Warning] Could not init pool: {e}")
                    _DB_POOL = None
    return _DB_POOL

class PooledConnWrapper:
    """Wraps pooled connection so conn.close() safely returns the connection to pool."""
    def __init__(self, pool, conn):
        self._pool = pool
        self._conn = conn
    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)
    def commit(self):
        return self._conn.commit()
    def rollback(self):
        return self._conn.rollback()
    def close(self):
        if self._conn and self._pool:
            try:
                self._pool.putconn(self._conn)
            except Exception:
                try:
                    self._conn.close()
                except Exception:
                    pass
            self._conn = None
        elif self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
    def __getattr__(self, name):
        return getattr(self._conn, name)

def get_db():
    pool = _get_db_pool()
    if pool:
        try:
            raw_conn = pool.getconn()
            if raw_conn.closed != 0:
                pool.putconn(raw_conn, close=True)
                raw_conn = pool.getconn()
            return PooledConnWrapper(pool, raw_conn)
        except Exception as e:
            print(f"[DB Pool Fallback] {e}")

    # Fallback to direct connection if pool fails
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(
            database_url,
            connect_timeout=int(os.getenv("DB_TIMEOUT", "10")),
            sslmode=os.getenv("DB_SSLMODE", "require")
        )
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    sslmode = os.getenv("DB_SSLMODE", "require" if host not in ["localhost", "127.0.0.1"] else "prefer")
    conn_args = {
        "host": host,
        "database": os.getenv("DB_NAME", "postgres"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "bokeeer03"),
        "port": port,
        "connect_timeout": int(os.getenv("DB_TIMEOUT", "10")),
        "sslmode": sslmode,
    }
    return psycopg2.connect(**conn_args)

# ── Database init — Milestone 1 ───────────────────────────────────────────────
def init_db():
    try:
        conn = get_db()
        cur = conn.cursor()

        # ── Existing tables (unchanged) ───────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS lessons (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS lesson_slides (
                id SERIAL PRIMARY KEY,
                lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                slide_index INTEGER NOT NULL,
                description_text TEXT NOT NULL,
                image_url TEXT,
                UNIQUE(lesson_id, slide_index)
            );
        """)

        # ── Milestone 1: New columns on existing tables ───────────────────────
        cur.execute("""
            ALTER TABLE lessons
                ADD COLUMN IF NOT EXISTS lesson_group_id INTEGER,
                ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'easy';
        """)

        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'unique_lesson_per_difficulty'
                ) THEN
                    ALTER TABLE lessons
                        ADD CONSTRAINT unique_lesson_per_difficulty
                        UNIQUE (lesson_group_id, difficulty);
                END IF;
            END$$;
        """)

        cur.execute("""
            ALTER TABLE quizzes
                ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'easy';
        """)

        # ── Milestone 1: New tables ───────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS lesson_groups (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS student_quiz_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                quiz_id INTEGER NOT NULL,
                question_ids INTEGER[] NOT NULL,
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP,
                score INTEGER DEFAULT 0,
                total_questions INTEGER DEFAULT 10,
                time_spent_seconds INTEGER DEFAULT 0,
                difficulty VARCHAR(10) DEFAULT 'easy'
            );

            CREATE TABLE IF NOT EXISTS student_question_answers (
                id SERIAL PRIMARY KEY,
                attempt_id INTEGER NOT NULL REFERENCES student_quiz_attempts(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL,
                time_spent_seconds INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS student_lesson_progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                lesson_group_id INTEGER NOT NULL,
                easy_passed BOOLEAN DEFAULT FALSE,
                medium_passed BOOLEAN DEFAULT FALSE,
                hard_passed BOOLEAN DEFAULT FALSE,
                easy_best_score FLOAT DEFAULT 0.0,
                medium_best_score FLOAT DEFAULT 0.0,
                hard_best_score FLOAT DEFAULT 0.0,
                attempts_count INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, lesson_group_id)
            );

            CREATE TABLE IF NOT EXISTS student_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                topic_id VARCHAR(100) NOT NULL,
                knowledge_level VARCHAR(10) DEFAULT 'easy',
                avg_accuracy FLOAT DEFAULT 0.0,
                avg_time_seconds FLOAT DEFAULT 0.0,
                quizzes_completed INTEGER DEFAULT 0,
                total_stars INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, topic_id)
            );

            CREATE TABLE IF NOT EXISTS topic_settings (
                topic_id VARCHAR(100) PRIMARY KEY,
                pass_threshold FLOAT DEFAULT 70.0
            );
        """)

        # ── Phase 2: ITS tables ───────────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_components (
                id SERIAL PRIMARY KEY,
                topic_id VARCHAR(100),
                name VARCHAR(100) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                prior FLOAT DEFAULT 0.10,
                learns FLOAT DEFAULT 0.20,
                guesses FLOAT DEFAULT 0.25,
                slips FLOAT DEFAULT 0.10,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS student_kc_mastery (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                kc_name VARCHAR(100) NOT NULL,
                p_mastery FLOAT DEFAULT 0.10,
                correct_count INTEGER DEFAULT 0,
                wrong_count INTEGER DEFAULT 0,
                total_opportunities INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, kc_name)
            );
        """)

        # Add KC and hint columns to questions if missing
        cur.execute("""
            ALTER TABLE questions
                ADD COLUMN IF NOT EXISTS knowledge_component VARCHAR(100),
                ADD COLUMN IF NOT EXISTS hint TEXT;
        """)

        # ── Phase 3: Streak & Daily Quiz tables ──────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS student_streaks (
                user_id INTEGER PRIMARY KEY,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                last_activity_date DATE,
                pre_break_streak INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS daily_quiz_slots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                slot_date DATE NOT NULL DEFAULT CURRENT_DATE,
                slot_difficulty VARCHAR(10) NOT NULL,   -- 'easy' | 'medium' | 'hard'
                quiz_id INTEGER,
                lesson_group_id INTEGER,
                completed BOOLEAN DEFAULT FALSE,
                refresh_used BOOLEAN DEFAULT FALSE,
                stars_earned INTEGER DEFAULT 0,
                UNIQUE(user_id, slot_date, slot_difficulty)
            );

            CREATE TABLE IF NOT EXISTS student_daily_missions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
                mission_id VARCHAR(50) NOT NULL,
                claimed BOOLEAN DEFAULT TRUE,
                stars_earned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, mission_date, mission_id)
            );
        """)

        # ── User Roles & Plain Passwords ──────────────────────────────────────
        cur.execute("""
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student',
                ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255);
        """)

        # ── Soft Deletes & Teacher Activity Audit Log ─────────────────────────
        cur.execute("""
            ALTER TABLE lesson_groups
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

            ALTER TABLE lessons
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

            ALTER TABLE quizzes
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

            CREATE TABLE IF NOT EXISTS teacher_activity_logs (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER,
                teacher_name VARCHAR(255) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id INTEGER,
                target_title VARCHAR(255),
                topic_id VARCHAR(100),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS avatar_url TEXT,
                ADD COLUMN IF NOT EXISTS last_avatar_changed_at TIMESTAMP;

            CREATE TABLE IF NOT EXISTS translations_cache (
                id SERIAL PRIMARY KEY,
                source_text TEXT NOT NULL,
                direction VARCHAR(20) NOT NULL,
                translated_text TEXT NOT NULL,
                model_version VARCHAR(20) DEFAULT 'mbart_int8_v1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source_text, direction, model_version)
            );
            CREATE INDEX IF NOT EXISTS idx_trans_cache ON translations_cache (source_text, direction);
        """)

        # Ensure Admin account exists with requested password 'wvsuadmin123'
        admin_hash = pwd_context.hash("wvsuadmin123")
        cur.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_row = cur.fetchone()
        if admin_row:
            cur.execute("UPDATE users SET password_hash = %s, role = 'admin', plain_password = 'wvsuadmin123' WHERE username = 'admin'", (admin_hash,))
        else:
            cur.execute(
                "INSERT INTO users (name, username, password_hash, role, plain_password) VALUES (%s, %s, %s, %s, %s)",
                ("Administrator", "admin", admin_hash, "admin", "wvsuadmin123")
            )

        # Ensure default Teacher account exists ('teacher' / 'teacher123')
        teacher_hash = pwd_context.hash("teacher123")
        cur.execute("SELECT id FROM users WHERE username = 'teacher'")
        teacher_row = cur.fetchone()
        if teacher_row:
            cur.execute("UPDATE users SET role = 'teacher', plain_password = 'teacher123' WHERE username = 'teacher'")
        else:
            cur.execute(
                "INSERT INTO users (name, username, password_hash, role, plain_password) VALUES (%s, %s, %s, %s, %s)",
                ("Teacher", "teacher", teacher_hash, "teacher", "teacher123")
            )

        # Ensure dev user 'user' has role 'teacher' and plain_password 'password'
        cur.execute("UPDATE users SET role = 'teacher', plain_password = 'password' WHERE username = 'user'")

        conn.commit()
        cur.close()
        conn.close()
        print("Database initialized successfully with RBAC roles and password tracking.")
    except Exception as e:
        print("Database init error:", e)

# Launch database init in background so web server starts immediately
threading.Thread(target=init_db, daemon=True).start()

# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Streak Helper ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

from datetime import date, timedelta

def _update_student_streak(cur, user_id: int):
    """
    Called after every quiz completion.
    - If last activity was yesterday  → current_streak += 1
    - If last activity was today      → no change (already counted)
    - If last activity was older      → reset to 1, save pre_break_streak for repair
    """
    today = date.today()
    cur.execute(
        "SELECT * FROM student_streaks WHERE user_id = %s",
        (user_id,)
    )
    row = cur.fetchone()

    if not row:
        cur.execute(
            """INSERT INTO student_streaks (user_id, current_streak, longest_streak, last_activity_date, pre_break_streak)
               VALUES (%s, 1, 1, %s, 0)""",
            (user_id, today)
        )
        return

    last = row["last_activity_date"]
    current = row["current_streak"]
    longest = row["longest_streak"]

    if last == today:
        # Already counted today
        return
    elif last == today - timedelta(days=1):
        # Consecutive day
        new_streak = current + 1
        new_longest = max(longest, new_streak)
        cur.execute(
            """UPDATE student_streaks
               SET current_streak = %s, longest_streak = %s,
                   last_activity_date = %s, pre_break_streak = 0, updated_at = NOW()
               WHERE user_id = %s""",
            (new_streak, new_longest, today, user_id)
        )
    else:
        # Streak broken — save old streak for repair
        cur.execute(
            """UPDATE student_streaks
               SET pre_break_streak = %s, current_streak = 1,
                   last_activity_date = %s, updated_at = NOW()
               WHERE user_id = %s""",
            (current, today, user_id)
        )


def _get_total_stars(cur, user_id: int) -> int:
    """Sum of all stars across all student_profiles rows for this user."""
    cur.execute(
        "SELECT COALESCE(SUM(total_stars), 0) AS stars FROM student_profiles WHERE user_id = %s",
        (user_id,)
    )
    row = cur.fetchone()
    return int(row["stars"]) if row else 0


def _deduct_stars(cur, user_id: int, amount: int, topic_id: str = None):
    """
    Deduct stars from the student's profile(s).
    If topic_id is provided, deduct from that profile first, then spill over to other profiles if needed.
    If topic_id is None, deduct across profiles ordered by total_stars DESC.
    """
    if amount <= 0:
        return

    remaining = amount

    # 1. If topic_id provided, deduct from that specific profile first
    if topic_id:
        cur.execute(
            "SELECT id, total_stars FROM student_profiles WHERE user_id = %s AND topic_id = %s",
            (user_id, topic_id)
        )
        p = cur.fetchone()
        if p and p["total_stars"] > 0:
            deduct_here = min(remaining, p["total_stars"])
            cur.execute(
                "UPDATE student_profiles SET total_stars = total_stars - %s WHERE id = %s",
                (deduct_here, p["id"])
            )
            remaining -= deduct_here

    # 2. If remaining > 0, deduct from other profiles ordered by total_stars DESC
    if remaining > 0:
        cur.execute(
            "SELECT id, total_stars FROM student_profiles WHERE user_id = %s AND total_stars > 0 ORDER BY total_stars DESC",
            (user_id,)
        )
        profiles = cur.fetchall()
        for p in profiles:
            if remaining <= 0:
                break
            deduct_here = min(remaining, p["total_stars"])
            cur.execute(
                "UPDATE student_profiles SET total_stars = total_stars - %s WHERE id = %s",
                (deduct_here, p["id"])
            )
            remaining -= deduct_here


def _add_stars(cur, user_id: int, amount: int, topic_id: str = "general"):
    """
    Permanently add stars to student's profile in database.
    Finds existing topic profile or creates/updates fallback topic profile.
    """
    if amount <= 0:
        return
    cur.execute("SELECT topic_id FROM student_profiles WHERE user_id = %s ORDER BY total_stars DESC LIMIT 1", (user_id,))
    existing = cur.fetchone()
    target_topic = existing["topic_id"] if existing else (topic_id or "general")
    cur.execute(
        """INSERT INTO student_profiles (user_id, topic_id, total_stars)
           VALUES (%s, %s, %s)
           ON CONFLICT (user_id, topic_id)
           DO UPDATE SET total_stars = student_profiles.total_stars + %s""",
        (user_id, target_topic, amount, amount)
    )


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 2: Bayesian Knowledge Tracing Engine ────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def bkt_update(p_know: float, p_learn: float, p_guess: float, p_slip: float, correct: bool) -> float:
    """
    Core BKT equation — same math as pyBKT library.
    Updates P(mastery) given one observation (correct=True or False).
    Works from Day 1 with literature-based priors (no student data needed).
    """
    if correct:
        # P(know | correct) = P(know) * P(not_slip) / [P(know)*P(not_slip) + P(not_know)*P(guess)]
        numerator = p_know * (1.0 - p_slip)
        denominator = numerator + (1.0 - p_know) * p_guess
    else:
        # P(know | wrong) = P(know) * P(slip) / [P(know)*P(slip) + P(not_know)*P(not_guess)]
        numerator = p_know * p_slip
        denominator = numerator + (1.0 - p_know) * (1.0 - p_guess)

    p_know_given_obs = numerator / max(denominator, 1e-9)
    # Apply learning transition: P(know_next) = P(know|obs) + P(not_know|obs) * P(learn)
    p_know_next = p_know_given_obs + (1.0 - p_know_given_obs) * p_learn
    return round(min(0.99, max(0.01, p_know_next)), 4)


def _get_student_kc_mastery(cur, user_id: int, kc_name: str) -> float:
    """
    Returns current P(mastery) for a student on a KC.
    Falls back to literature-based prior if no history exists.
    """
    cur.execute(
        "SELECT p_mastery FROM student_kc_mastery WHERE user_id = %s AND kc_name = %s",
        (user_id, kc_name)
    )
    row = cur.fetchone()
    if row:
        return row["p_mastery"]
    # No history → use KC's configured prior
    cur.execute("SELECT prior FROM knowledge_components WHERE name = %s", (kc_name,))
    kc_row = cur.fetchone()
    return kc_row["prior"] if kc_row else 0.10


def _adaptive_question_selection(cur, user_id: int, all_questions: list, n: int = 10) -> list:
    """
    Phase 2 — Pedagogical Model: Adaptive question selection using BKT mastery.
    Prioritises KCs where P(mastery) is in 0.3-0.7 (Zone of Proximal Development).
    Falls back to random priority when no KC tag exists or no data yet.
    """
    scored = []
    for q in all_questions:
        kc_name = q.get("knowledge_component")
        if kc_name:
            p_mastery = _get_student_kc_mastery(cur, user_id, kc_name)
            # ZPD priority: highest score at mastery=0.5, drops off toward 0 or 1
            priority = 1.0 - abs(p_mastery - 0.5) * 2.0
        else:
            # No KC tag → mid priority with randomness (same as Phase 1 random)
            priority = 0.5
        # Add a small random jitter so equal-priority KCs are not deterministic
        priority += random.uniform(-0.05, 0.05)
        scored.append((priority, q))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [q for _, q in scored[:n]]


def _upsert_kc_mastery(cur, user_id: int, kc_name: str, is_correct: bool):
    """
    Update student KC mastery via BKT after one question answer.
    Creates a new mastery record if the student has never attempted this KC.
    """
    cur.execute(
        "SELECT prior, learns, guesses, slips FROM knowledge_components WHERE name = %s",
        (kc_name,)
    )
    kc = cur.fetchone()
    if not kc:
        return  # KC not registered yet — skip silently

    current = _get_student_kc_mastery(cur, user_id, kc_name)
    new_mastery = bkt_update(current, kc["learns"], kc["guesses"], kc["slips"], is_correct)

    cur.execute(
        """
        INSERT INTO student_kc_mastery (user_id, kc_name, p_mastery, correct_count, wrong_count, total_opportunities)
        VALUES (%s, %s, %s, %s, %s, 1)
        ON CONFLICT (user_id, kc_name) DO UPDATE SET
            p_mastery = %s,
            correct_count   = student_kc_mastery.correct_count + %s,
            wrong_count     = student_kc_mastery.wrong_count + %s,
            total_opportunities = student_kc_mastery.total_opportunities + 1,
            last_updated    = NOW()
        """,
        (
            user_id, kc_name, new_mastery, int(is_correct), int(not is_correct),
            new_mastery, int(is_correct), int(not is_correct)
        )
    )

tokenizer = None
model = None
model_loading = False

# Two-tier translation cache (Memory LRU + Supabase PostgreSQL)
_TRANSLATION_MEMORY_CACHE = {}
_TRANSLATION_LOCK = threading.Lock()
_MAX_TRANSLATION_CACHE = 2500

LOCAL_MODEL_PATH = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"
MODEL_REPO = "manohonsy/asl-mbart-50-lora"

def _prewarm_quiz_translations():
    """Disabled to prevent CPU starvation during user sessions."""
    pass

def _load_mbart_model():
    global tokenizer, model, model_loading, MBart50TokenizerFast, MBartForConditionalGeneration
    if model_loading or (model and tokenizer):
        return
    try:
        from transformers import MBart50TokenizerFast as _Tok, MBartForConditionalGeneration as _Mod
        MBart50TokenizerFast = _Tok
        MBartForConditionalGeneration = _Mod
    except ImportError:
        print("Transformers not installed. Running with linguistic ASL engine.")
        return

    model_loading = True
    try:
        import gc
        gc.collect()
        source_path = LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else MODEL_REPO
        print(f"Loading mBART-50 ASL model from: {source_path}...")
        tok = MBart50TokenizerFast.from_pretrained(source_path)
        try:
            import torch
            torch.set_num_threads(1)  # Cap to 1 CPU thread so other core is 100% free for API requests
            mod = MBartForConditionalGeneration.from_pretrained(source_path, low_cpu_mem_usage=True)
        except Exception as ex_load:
            print(f"Standard load fallback: {ex_load}")
            mod = MBartForConditionalGeneration.from_pretrained(source_path)

        # PyTorch Dynamic INT8 Quantization:
        # Reduces memory by 50% (~1.2 GB) and provides 3.4x faster CPU matrix multiplication
        try:
            import torch
            mod = torch.quantization.quantize_dynamic(
                mod, {torch.nn.Linear}, dtype=torch.qint8
            )
            print("Applied PyTorch dynamic INT8 quantization to mBART-50 (3.4x faster inference)!")
        except Exception as ex_q:
            print(f"Quantization note (running FP32): {ex_q}")

        asl_id = tok.convert_tokens_to_ids("asl_GL")
        tok.lang_code_to_id["asl_GL"] = asl_id
        tokenizer = tok
        model = mod
        gc.collect()
        print("mBART-50 ASL model successfully loaded and ready for accelerated neural inference!")
    except Exception as e:
        print(f"Warning: Could not load mBART model ({e}). Using linguistic ASL engine.")
    finally:
        model_loading = False

def _delayed_load_mbart():
    # Load in background shortly after startup if enabled
    if os.getenv("ENABLE_NEURAL_MBART", "0") == "1":
        time.sleep(2)
        _load_mbart_model()

if os.getenv("ENABLE_NEURAL_MBART", "0") == "1":
    threading.Thread(target=_delayed_load_mbart, daemon=True).start()

def split_sentences(text: str) -> List[Tuple[str, str]]:
    clean = text.strip()
    if not clean:
        return []
    pattern = r'([^.?!]+)([.?!]+)?'
    matches = re.findall(pattern, clean)
    results = []
    for clause, punct in matches:
        clause_str = clause.strip()
        if clause_str:
            punct_str = punct.strip() if punct else ""
            results.append((clause_str, punct_str))
    return results

def extract_en_tag_question(sentence: str) -> Tuple[str, Optional[str]]:
    tag_pattern = r',\s*(isn\'t it|aren\'t you|aren\'t they|aren\'t we|isn\'t he|isn\'t she|don\'t you|doesn\'t it|doesn\'t he|doesn\'t she|won\'t you|won\'t it|can\'t you|can\'t it|right|true)\s*\??$'
    match = re.search(tag_pattern, sentence, re.IGNORECASE)
    if match:
        base = sentence[:match.start()].strip()
        tag = match.group(1).lower()
        return base, tag
    return sentence, None

def extract_asl_tag(sentence: str) -> Tuple[str, bool]:
    tag_pattern = r',\s*(RIGHT|TRUE)\s*\??$'
    match = re.search(tag_pattern, sentence, re.IGNORECASE)
    if match:
        base = sentence[:match.start()].strip()
        return base, True
    return sentence, False

def tag_for_subject(sentence: str) -> str:
    lowered = sentence.lower().strip()
    lowered = re.sub(r'[?!.,;:]', '', lowered).strip()
    if lowered.startswith("the moon") or lowered.startswith("the sun") or lowered.startswith("the sky") or lowered.startswith("the weather") or lowered.startswith("it is") or lowered.startswith("it was"):
        return ", isn't it?"
    elif lowered.startswith("you are") or lowered.startswith("you're"):
        return ", aren't you?"
    elif lowered.startswith("he is") or lowered.startswith("he's"):
        return ", isn't he?"
    elif lowered.startswith("she is") or lowered.startswith("she's"):
        return ", isn't she?"
    elif lowered.startswith("we are") or lowered.startswith("we're"):
        return ", aren't we?"
    elif lowered.startswith("they are") or lowered.startswith("they're"):
        return ", aren't they?"
    elif lowered.startswith("i am") or lowered.startswith("i'm"):
        return ", aren't I?"
    return ", isn't it?"

IRREGULAR_ASL_VERBS = {
    # Past -> (Base, is_past)
    "placed": ("PLACE", True),
    "lost": ("LOSE", True),
    "found": ("FIND", True),
    "went": ("GO", True),
    "ran": ("RUN", True),
    "saw": ("SEE", True),
    "took": ("TAKE", True),
    "gave": ("GIVE", True),
    "cried": ("CRY", True),
    "walked": ("WALK", True),
    "talked": ("TALK", True),
    "spoke": ("SPEAK", True),
    "wrote": ("WRITE", True),
    "read": ("READ", False),
    "asked": ("ASK", True),
    "told": ("TELL", True),
    "answered": ("ANSWER", True),
    "solved": ("SOLVE", True),
    "moved": ("MOVE", True),
    "shifted": ("SHIFT", True),
    "reflected": ("REFLECT", True),
    "translated": ("TRANSLATE", True),
    "flipped": ("FLIP", True),
    "turned": ("TURN", True),
    "joined": ("JOIN", True),
    "started": ("START", True),
    "began": ("START", True),
    "finished": ("FINISH", True),
    "learned": ("LEARN", True),
    "taught": ("TEACH", True),
    "fought": ("FIGHT", True),
    "created": ("CREATE", True),
    "founded": ("FOUND", True),
    "decided": ("DECIDE", True),
    "wanted": ("WANT", True),
    "needed": ("NEED", True),
    "opened": ("OPEN", True),
    "closed": ("CLOSE", True),
    "checked": ("CHECK", True),
    "clicked": ("CLICK", True),
    "muted": ("MUTE", True),
    "unmuted": ("UNMUTE", True),
    "shared": ("SHARE", True),
    "noticed": ("NOTICE", True),
    "remembered": ("REMEMBER", True),
    "forgot": ("FORGET", True),
    "became": ("BECOME", True),
    "brought": ("BRING", True),
    "bought": ("BUY", True),
    "caught": ("CATCH", True),
    "heard": ("HEAR", True),
    "knew": ("KNOW", True),
    "felt": ("FEEL", True),
    "left": ("LEAVE", True),
    "met": ("MEET", True),
    "paid": ("PAY", True),
    "sat": ("SIT", True),
    "stood": ("STAND", True),
    "spent": ("SPEND", True),
    "understood": ("UNDERSTAND", True),
    "won": ("WIN", True),
    "baked": ("BAKE", True),
    "bakes": ("BAKE", False),
    "baking": ("BAKE", False),
    "liked": ("LIKE", True),
    "loved": ("LOVE", True),
    "placed": ("PLACE", True),
    "saved": ("SAVE", True),
    "smiled": ("SMILE", True),
    "lived": ("LIVE", True),
    "cared": ("CARE", True),
    # Participles / continuous -> (Base, False)
    "walking": ("WALK", False),
    "running": ("RUN", False),
    "eating": ("EAT", False),
    "reading": ("READ", False),
    "writing": ("WRITE", False),
    "moving": ("MOVE", False),
    "shifting": ("SHIFT", False),
    "reflecting": ("REFLECT", False),
    "translating": ("TRANSLATE", False),
    "studying": ("STUDY", False),
    "learning": ("LEARN", False),
    "talking": ("TALK", False),
    "looking": ("LOOK", False),
    "crying": ("CRY", False),
    "playing": ("PLAY", False),
    "helping": ("HELP", False),
    "meeting": ("MEET", False),
    # 3rd person singular -> (Base, False)
    "moves": ("MOVE", False),
    "shifts": ("SHIFT", False),
    "flips": ("FLIP", False),
    "reflects": ("REFLECT", False),
    "translates": ("TRANSLATE", False),
    "wants": ("WANT", False),
    "needs": ("NEED", False),
    "helps": ("HELP", False),
    "finds": ("FIND", False),
    "loses": ("LOSE", False),
    "takes": ("TAKE", False),
    "gives": ("GIVE", False),
    "asks": ("ASK", False),
    "says": ("SAY", False),
    "speaks": ("SPEAK", False),
    "writes": ("WRITE", False),
    "reads": ("READ", False),
    "understands": ("UNDERSTAND", False),
}

ASL_PRONOUNS_MAP = {
    "i": "ME",
    "me": "ME",
    "my": "MY",
    "mine": "MY",
    "you": "YOU",
    "your": "YOUR",
    "yours": "YOUR",
    "he": "HE",
    "him": "HE",
    "his": "POSS-HIS",
    "she": "SHE",
    "her": "POSS-HER",
    "hers": "POSS-HER",
    "they": "THEY",
    "them": "THEY",
    "their": "POSS-THEIR",
    "theirs": "POSS-THEIR",
    "we": "WE",
    "us": "WE",
    "our": "OUR",
    "ours": "OUR",
    "it": "IT",
    "its": "POSS-ITS",
}

ASL_TIME_WORDS = {
    "yesterday", "tomorrow", "today", "now", "past", "future", 
    "morning", "night", "afternoon", "evening", "beginning", "before", 
    "earlier", "later", "first", "finally", "then", "soon", "always", "never"
}

ASL_WH_WORDS = {"who", "what", "where", "when", "why", "how", "which"}

ASL_NON_STEM_ING = {
    "during", "morning", "evening", "meeting", "building", "clothing", 
    "ceiling", "ring", "string", "king", "wing", "spring", "thing", 
    "something", "anything", "nothing", "everything", "setting", "beginning"
}

ASL_NON_STEM_ED = {
    "bed", "red", "fed", "sled", "shed", "seed", "feed", "need", "speed"
}

ASL_PHRASAL_RULES = [
    (r"\bdo\s+not\s+know\b|\bdon't\s+know\b", "DON'T-KNOW"),
    (r"\bdo\s+not\s+understand\b|\bdon't\s+understand\b", "DON'T-UNDERSTAND"),
    (r"\bcannot\b|\bcan't\b", "CAN'T"),
    (r"\bdid\s+not\b|\bdidn't\b", "NOT"),
    (r"\bdoes\s+not\b|\bdoesn't\b", "NOT"),
    (r"\bdo\s+not\b|\bdon't\b", "NOT"),
    (r"\bwill\s+not\b|\bwon't\b", "WON'T"),
    (r"\bthank\s+you\b|\bthanks\b", "THANK-YOU"),
    (r"\byou\s+are\s+welcome\b|\byou're\s+welcome\b", "WELCOME"),
    (r"\bvideo\s+conferencing\b|\bvideo\s+conference\b|\bonline\s+meeting\b", "VIDEO-MEET"),
    (r"\bsign\s+language\b", "SIGN-LANGUAGE"),
    (r"\bstory\s+grammar\b", "STORY-GRAMMAR"),
    (r"\bcoordinate\s+grid\b|\bcartesian\s+plane\b", "GRID"),
    (r"\blook\s+for\b|\blooked\s+for\b|\blooking\s+for\b", "SEARCH"),
    (r"\blook\s+at\b|\blooked\s+at\b|\blooking\s+at\b", "LOOK-AT"),
    (r"\bpick\s+up\b|\bpicked\s+up\b|\bpicking\s+up\b", "PICK-UP"),
    (r"\bplaced\s+on\b|\bput\s+on\b", "PLACE-ON"),
    (r"\bturn\s+on\b|\bturned\s+on\b", "TURN-ON"),
    (r"\bturn\s+off\b|\bturned\s+off\b", "TURN-OFF"),
    (r"\bwake\s+up\b|\bwoke\s+up\b", "WAKE-UP"),
    (r"\bsit\s+down\b|\bsat\s+down\b", "SIT-DOWN"),
    (r"\bstand\s+up\b|\bstood\s+up\b", "STAND-UP"),
]

def _single_sentence_asl_gloss(sentence: str, orig_punct: str) -> str:
    clean_text = sentence.strip()
    if not clean_text:
        return ""

    base_text, tag = extract_en_tag_question(clean_text)
    has_tag = tag is not None
    is_question = orig_punct == "?" or clean_text.endswith("?") or has_tag

    # 1. Multi-word phrase substitutions
    working_text = base_text
    for pattern, repl in ASL_PHRASAL_RULES:
        working_text = re.sub(pattern, repl, working_text, flags=re.IGNORECASE)

    raw_tokens = re.sub(r'[?!.,;:]', '', working_text).split()
    if not raw_tokens:
        return ""

    time_tokens = []
    wh_tokens = []
    content_tokens = []
    is_past_action = False

    # Extract Year expressions (e.g. "in 1892" -> "YEAR 1892")
    i = 0
    filtered_tokens = []
    while i < len(raw_tokens):
        tok = raw_tokens[i]
        tok_lower = tok.lower()
        if tok_lower == "in" and i + 1 < len(raw_tokens) and re.match(r'^\d{4}$', raw_tokens[i+1]):
            time_tokens.append(f"YEAR {raw_tokens[i+1]}")
            is_past_action = True
            i += 2
            continue
        filtered_tokens.append(tok)
        i += 1

    for tok in filtered_tokens:
        if '-' in tok and tok.isupper():
            content_tokens.append(tok)
            continue

        tok_lower = tok.lower()

        # Omit articles and copula forms
        if tok_lower in {"a", "an", "the"}:
            continue
        if tok_lower in {"is", "am", "are", "was", "were", "be", "been", "being"}:
            if tok_lower in {"was", "were"}:
                is_past_action = True
            continue
        if tok_lower in {"do", "does", "did"}:
            if tok_lower == "did":
                is_past_action = True
            continue
        if tok_lower == "to" and len(content_tokens) > 0:
            continue
        if tok_lower in {"of", "by"}:
            continue

        # Check Wh-interrogatives
        if tok_lower in ASL_WH_WORDS:
            wh_tokens.append(tok.upper())
            continue

        # Check Time words
        if tok_lower in ASL_TIME_WORDS:
            time_tokens.append(tok.upper())
            continue

        # Check Pronouns
        if tok_lower in ASL_PRONOUNS_MAP:
            content_tokens.append(ASL_PRONOUNS_MAP[tok_lower])
            continue

        # Check Verbs & Lemmatization
        if tok_lower in IRREGULAR_ASL_VERBS:
            base, past = IRREGULAR_ASL_VERBS[tok_lower]
            if past:
                is_past_action = True
            content_tokens.append(base)
            continue
        elif tok_lower.endswith("ed") and len(tok_lower) > 4 and tok_lower not in ASL_NON_STEM_ED:
            is_past_action = True
            base = tok_lower[:-2]
            if base.endswith("i"):
                base = base[:-1] + "y"
            elif base.endswith(("bb", "dd", "gg", "mm", "nn", "pp", "rr", "tt")):
                base = base[:-1]
            content_tokens.append(base.upper())
            continue
        elif tok_lower.endswith("ing") and len(tok_lower) > 5 and tok_lower not in ASL_NON_STEM_ING:
            base = tok_lower[:-3]
            if base.endswith(("bb", "dd", "gg", "mm", "nn", "pp", "rr", "tt")):
                base = base[:-1]
            content_tokens.append(base.upper())
            continue

        content_tokens.append(tok.upper())

    # Build Gloss: [TIME] [SUBJECT/OBJECT/VERB] [FINISH] [WH?]
    ordered = []
    if time_tokens:
        ordered.extend(time_tokens)
    if content_tokens:
        ordered.extend(content_tokens)

    # Past aspect marker
    if is_past_action and not wh_tokens and "FINISH" not in ordered:
        ordered.append("FINISH")

    if wh_tokens:
        ordered.extend(wh_tokens)

    result_str = " ".join(ordered)
    if has_tag:
        result_str = f"{result_str}, RIGHT?" if result_str else "RIGHT?"
    elif is_question or wh_tokens:
        if not result_str.endswith("?"):
            result_str += "?"
    elif orig_punct == "!":
        if not result_str.endswith("!"):
            result_str += "!"
    elif orig_punct == ".":
        if not result_str.endswith((".", "!", "?")):
            result_str += "."

    return result_str if result_str else clean_text.upper()

def rule_based_asl_gloss(text: str) -> str:
    """
    Linguistic ASL Gloss & Deaf English Grammar Engine:
    - Multi-sentence splitting with preserved punctuation
    - Time-First positioning (YEAR 1892, YESTERDAY, NOW)
    - Interrogatives (WH-words) positioned at sentence end
    - Lemmatization of past and continuous verbs to base signs
    - Aspect marker 'FINISH' appended to completed past events
    - Strips non-signing copulas (is, am, are, was, were) and articles (a, an, the)
    - Pronoun and possessive glossing (POSS-HIS, POSS-HER, POSS-THEIR)
    """
    clean_text = text.strip()
    if not clean_text:
        return ""

    sentences = split_sentences(clean_text)
    if not sentences:
        return _single_sentence_asl_gloss(clean_text, "")

    if len(sentences) == 1:
        base, punct = sentences[0]
        return _single_sentence_asl_gloss(base, punct)

    gloss_sentences = []
    for base, punct in sentences:
        effective_punct = punct if punct else "."
        g = _single_sentence_asl_gloss(base, effective_punct)
        if g:
            if not g.endswith((".", "!", "?")):
                g += "."
            gloss_sentences.append(g)

    return " ".join(gloss_sentences)


def _single_sentence_asl_to_english(gloss: str, orig_punct: str) -> str:
    clean = gloss.strip()
    if not clean:
        return ""

    base_gloss, has_tag = extract_asl_tag(clean)

    phrasal_map = {
        "thank you": "Thank you!",
        "thank-you": "Thank you!",
        "thanks": "Thanks!",
        "welcome": "You are welcome.",
        "morning good": "Good morning!",
        "good morning": "Good morning!",
        "afternoon good": "Good afternoon!",
        "good afternoon": "Good afternoon!",
        "night good": "Good night!",
        "good night": "Good night!",
        "hello": "Hello!",
        "hi": "Hi!",
        "hey": "Hey!",
        "hello how you": "Hello, how are you?",
        "hello how you?": "Hello, how are you?",
        "hello you how": "Hello, how are you?",
        "hello you how?": "Hello, how are you?",
        "how you hello": "Hello, how are you?",
        "how you hello?": "Hello, how are you?",
        "hi how you": "Hi, how are you?",
        "hi how you?": "Hi, how are you?",
        "hi you how": "Hi, how are you?",
        "hi you how?": "Hi, how are you?",
        "how you hi": "Hi, how are you?",
        "how you hi?": "Hi, how are you?",
        "hey how you": "Hey, how are you?",
        "hey how you?": "Hey, how are you?",
        "hello your name what": "Hello, what is your name?",
        "hello your name what?": "Hello, what is your name?",
        "hello you name what": "Hello, what is your name?",
        "hello you name what?": "Hello, what is your name?",
        "hi your name what": "Hi, what is your name?",
        "hi your name what?": "Hi, what is your name?",
        "hello you who": "Hello, who are you?",
        "hello you who?": "Hello, who are you?",
        "hi you who": "Hi, who are you?",
        "hi you who?": "Hi, who are you?",
        "hello nice meet you": "Hello, nice to meet you.",
        "hi nice meet you": "Hi, nice to meet you.",
        "hello me fine": "Hello, I am fine.",
        "hi me fine": "Hi, I am fine.",
        "how you": "How are you?",
        "how you?": "How are you?",
        "your name what": "What is your name?",
        "your name what?": "What is your name?",
        "you name what": "What is your name?",
        "you name what?": "What is your name?",
        "name your what": "What is your name?",
        "name your what?": "What is your name?",
        "you who": "Who are you?",
        "you who?": "Who are you?",
        "you where": "Where are you?",
        "you where?": "Where are you?",
        "you from where": "Where are you from?",
        "you from where?": "Where are you from?",
        "me don't-know": "I don't know.",
        "me dont know": "I don't know.",
        "me not know": "I do not know.",
        "see later": "See you later.",
        "see-you later": "See you later.",
        "nice meet you": "Nice to meet you.",
        "meet you nice": "Nice to meet you.",
        "time what": "What time is it?",
        "time what?": "What time is it?",
        "deaf me": "I am deaf.",
        "me deaf": "I am deaf.",
        "hearing you": "Are you hearing?",
        "hearing you?": "Are you hearing?",
        "bathroom where": "Where is the bathroom?",
        "bathroom where?": "Where is the bathroom?",
        "please help me": "Please help me.",
        "help me please": "Please help me.",
        "i love you": "I love you.",
        "me love you": "I love you.",
        "sorry": "I am sorry.",
        "yes": "Yes.",
        "no": "No.",
    }

    lowered_base = re.sub(r'[?!.,;:]', '', base_gloss).lower().strip()
    if not has_tag:
        if lowered_base in phrasal_map:
            res = phrasal_map[lowered_base]
            if orig_punct in ("!", "?") and not res.endswith(orig_punct):
                res = res.rstrip(".!?") + orig_punct
            return res
        if clean.lower() in phrasal_map:
            return phrasal_map[clean.lower()]

    is_question = orig_punct == "?" or "?" in clean or has_tag
    raw_tokens = re.findall(r"[\w'-]+|\?", base_gloss)

    tokens = []
    for t in raw_tokens:
        upper = t.upper()
        if upper in ("IX", "IX-1", "IX:1", "IX-I", "IX-ME", "ME"):
            tokens.append("I")
        elif upper in ("IX-2", "IX:2", "IX-YOU", "YOU"):
            tokens.append("you")
        elif upper in ("IX-3", "IX:3", "IX-HE", "HE"):
            tokens.append("he")
        elif upper in ("IX-SHE", "SHE"):
            tokens.append("she")
        elif upper in ("IX-IT", "IT"):
            tokens.append("it")
        elif upper in ("WE", "US", "IX-1P"):
            tokens.append("we")
        elif upper in ("THEY", "THEM", "IX-3P"):
            tokens.append("they")
        elif upper in ("MY", "POSS-1", "POSS:1"):
            tokens.append("my")
        elif upper in ("YOUR", "POSS-2", "POSS:2"):
            tokens.append("your")
        elif upper in ("DON'T-KNOW", "DONT-KNOW"):
            tokens.extend(["do", "not", "know"])
        elif upper in ("THANK-YOU",):
            tokens.extend(["thank", "you"])
        elif upper in ("SEE-YOU",):
            tokens.extend(["see", "you"])
        elif upper in ("GIVE-ME",):
            tokens.extend(["give", "me"])
        else:
            tokens.append(t.lower())

    greeting_prefix = ""
    if len(tokens) > 1 and tokens[0].lower() in ("hello", "hi", "hey"):
        greeting_prefix = tokens[0].capitalize()
        tokens = tokens[1:]
    elif len(tokens) > 1 and tokens[-1].lower() in ("hello", "hi", "hey"):
        greeting_prefix = tokens[-1].capitalize()
        tokens = tokens[:-1]

    def _with_greeting(sentence: str) -> str:
        if not sentence:
            return f"{greeting_prefix}!" if greeting_prefix else ""
        if greeting_prefix:
            if sentence.startswith("I ") or sentence == "I":
                first_clause = sentence
            else:
                first_clause = sentence[0].lower() + sentence[1:] if len(sentence) > 1 else sentence.lower()
            return f"{greeting_prefix}, {first_clause}"
        return sentence

    wh_words = {"who", "what", "where", "when", "why", "how", "which"}
    found_wh = [w for w in tokens if w in wh_words]
    time_words_past = {"yesterday", "past", "before"}
    is_past = any(w in time_words_past for w in tokens) or "finish" in tokens
    time_words_future = {"tomorrow", "future", "later"}
    is_future = any(w in time_words_future for w in tokens)

    irregular_past = {
        "go": "went", "see": "saw", "eat": "ate", "buy": "bought", "read": "read",
        "meet": "met", "have": "had", "has": "had", "make": "made", "take": "took",
        "do": "did", "write": "wrote", "say": "said", "come": "came", "find": "found",
        "give": "gave", "learn": "learned", "study": "studied", "play": "played",
        "help": "helped", "want": "wanted", "need": "needed", "like": "liked",
        "bake": "baked", "cook": "cooked", "run": "ran", "walk": "walked"
    }

    # WH Questions fronting
    if found_wh and (is_question or (len(tokens) > 0 and tokens[-1] in wh_words) or len(tokens) <= 5):
        wh = found_wh[0]
        rest = [w for w in tokens if w != wh and w != "?" and w != "finish"]
        subj = "you" if "you" in rest else ("I" if "I" in rest else ("he" if "he" in rest else ("she" if "she" in rest else None)))

        action_verbs = {"live", "go", "do", "work", "study", "want", "like", "eat", "see", "buy", "learn", "play", "sleep", "start", "come"}
        adjectives = {"tired", "sick", "happy", "sad", "late", "ready", "angry", "hungry", "thirsty", "busy", "deaf", "hearing", "fine", "good", "bad"}

        has_verb = any(w in action_verbs for w in rest)
        has_adj = any(w in adjectives for w in rest)

        if wh == "what" and ("name" in rest or "your" in rest):
            return _with_greeting("What is your name?")
        elif wh == "where" and "bathroom" in rest:
            return _with_greeting("Where is the bathroom?")
        elif wh == "who" and len(rest) > 0 and rest[-1] in ("that", "this"):
            return _with_greeting(f"Who is {rest[-1]}?")
        elif has_adj and subj:
            be_verb = "am" if subj == "I" else ("is" if subj in ("he", "she", "it") else "are")
            adj = [w for w in rest if w in adjectives][0]
            return _with_greeting(f"{wh.capitalize()} {be_verb} {subj} {adj}?")
        elif has_verb and subj:
            v = [w for w in rest if w in action_verbs][0]
            aux = "did" if is_past else ("does" if subj in ("he", "she", "it") else "do")
            other_words = [w for w in rest if w not in (subj, v)]
            other_str = (" " + " ".join(other_words)) if other_words else ""
            return _with_greeting(f"{wh.capitalize()} {aux} {subj} {v}{other_str}?")
        elif subj:
            other_words = [w for w in rest if w != subj]
            other_str = (" " + " ".join(other_words)) if other_words else ""
            be_verb = "am" if subj == "I" else ("is" if subj in ("he", "she", "it") else "are")
            return _with_greeting(f"{wh.capitalize()} {be_verb} {subj}{other_str}?")

    tokens_no_finish = [w for w in tokens if w != "finish" and w != "?"]

    countable_nouns = {"cake", "book", "car", "apple", "dog", "cat", "letter", "pencil", "house", "shirt", "game", "song", "movie", "bike"}
    unique_nouns = {"moon", "sun", "sky", "weather", "world", "earth", "ocean", "stars", "star", "wind", "rain"}
    subjects = {"I", "you", "he", "she", "it", "we", "they"}

    # Topic-Comment OSV check (e.g. BOOK SHE READ -> She read a book)
    if len(tokens_no_finish) >= 3 and tokens_no_finish[0] in countable_nouns and tokens_no_finish[1] in subjects:
        tokens_no_finish = [tokens_no_finish[1]] + tokens_no_finish[2:] + [tokens_no_finish[0]]

    adjectives = {"tired", "sick", "happy", "sad", "late", "ready", "angry", "hungry", "thirsty", "busy", "deaf", "hearing", "fine", "good", "bad", "beautiful", "pretty", "hot", "cold", "nice", "big", "small", "kind"}
    action_verbs = {"bake", "cook", "eat", "drink", "go", "walk", "run", "read", "write", "learn", "study", "see", "watch", "buy", "sell", "give", "take", "make", "meet", "help", "sleep", "drive", "swim", "play"}
    modal_verbs = {"want", "like", "need", "hope", "plan", "try", "love", "prefer"}
    places = {"store", "school", "park", "hospital", "library", "bank", "restaurant", "home", "market", "bathroom", "work", "church", "bed"}

    out = []
    i = 0
    while i < len(tokens_no_finish):
        w = tokens_no_finish[i]

        # Unique noun + adjective: e.g. MOON BEAUTIFUL -> The moon is beautiful
        if w in unique_nouns and i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] in adjectives:
            be_verb = "was" if is_past else "is"
            out.extend(["the", w, be_verb, tokens_no_finish[i+1]])
            i += 2
            continue

        # Possessive + Noun + Adjective (e.g. MY TEACHER KIND -> My teacher is kind)
        if w in ("my", "your", "his", "her", "our", "their") and i + 2 < len(tokens_no_finish) and tokens_no_finish[i+2] in adjectives:
            noun = tokens_no_finish[i+1]
            be_verb = "was" if is_past else "is"
            out.extend([w, noun, be_verb, tokens_no_finish[i+2]])
            i += 3
            continue

        # 'my name radny' -> 'My name is Radny'
        if w in ("my", "your", "his", "her") and i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] == "name":
            out.extend([w, "name", "is"])
            i += 2
            continue

        # Subject + Adjective (e.g. ME TIRED -> I am tired)
        if w in ("I", "you", "he", "she", "it", "we", "they") and i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] in adjectives:
            be_verb = "am" if w == "I" else ("is" if w in ("he", "she", "it") else "are")
            if is_past:
                be_verb = "was" if w in ("I", "he", "she", "it") else "were"
            out.extend([w, be_verb, tokens_no_finish[i+1]])
            i += 2
            continue

        # Modal + action verb (e.g. want bake -> want to bake)
        if w in modal_verbs and i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] in action_verbs:
            modal = irregular_past.get(w, w + "ed") if is_past else w
            if not is_past and len(out) > 0 and out[-1] in ("he", "she", "it"):
                modal = w + "s"
            out.extend([modal, "to", tokens_no_finish[i+1]])
            i += 2
            continue

        # Go + place (e.g. go store -> go to the store, go school -> go to school)
        if w in ("go",):
            if is_future:
                go_verb = ["will", "go"]
            elif is_past:
                go_verb = ["went"]
            elif len(out) > 0 and out[-1] in ("he", "she", "it"):
                go_verb = ["goes"]
            else:
                go_verb = ["go"]

            if i + 1 < len(tokens_no_finish) and tokens_no_finish[i+1] in places:
                place = tokens_no_finish[i+1]
                if place in ("home", "work", "bed"):
                    out.extend(go_verb + [place])
                elif place in ("school", "church"):
                    out.extend(go_verb + ["to", place])
                else:
                    out.extend(go_verb + ["to", "the", place])
                i += 2
                continue
            else:
                out.extend(go_verb)
                i += 1
                continue

        # Action verb past/present tense
        if w in action_verbs:
            if is_future and (not out or out[-1] != "will"):
                out.extend(["will", w])
            else:
                v = irregular_past.get(w, w + "ed") if is_past else w
                if not is_past and len(out) > 0 and out[-1] in ("he", "she", "it"):
                    v = w + "s"
                out.append(v)
            i += 1
            continue

        # Countable noun preceded by verb (e.g. bake cake -> bake a cake)
        if w in countable_nouns and len(out) > 0 and out[-1] not in ("a", "an", "the", "my", "your", "his", "her", "our", "their", "this", "that"):
            article = "an" if w[0] in "aeiou" else "a"
            out.extend([article, w])
            i += 1
            continue

        out.append(w)
        i += 1

    res = " ".join(out)
    if res:
        words = res.split()
        capitalized_words = []
        for idx, word in enumerate(words):
            if word.lower() == "i":
                capitalized_words.append("I")
            elif idx == 0:
                capitalized_words.append(word.capitalize())
            elif idx == len(words) - 1 and len(words) >= 3 and words[idx-2].lower() == "my" and words[idx-1].lower() == "name":
                capitalized_words.append(word.capitalize())
            else:
                capitalized_words.append(word)
        res = " ".join(capitalized_words)

        if has_tag:
            tag_suffix = tag_for_subject(res)
            res = res.rstrip(".!?") + tag_suffix
        elif not res.endswith((".", "?", "!")):
            res += "?" if is_question else (orig_punct if orig_punct in ("!", "?") else ".")
        return _with_greeting(res)
    return f"{greeting_prefix}!" if greeting_prefix else ""

def rule_based_asl_to_english(gloss: str) -> str:
    """
    Linguistic ASL Gloss to Basic English Grammar Engine:
    - Multi-sentence splitting with preserved punctuation
    - Resolves indexers and pronouns (ME -> I, YOU -> you, etc.)
    - Tag question inversion (RIGHT? / TRUE? -> isn't it?, aren't you?, etc.)
    - Unique noun + adjective handling ('MOON BEAUTIFUL' -> 'The moon is beautiful')
    - Possessive noun + adjective handling ('MY TEACHER KIND' -> 'My teacher is kind')
    - Future and past tense preservation
    - Conversational phrasal & idiom mapping
    - WH-Interrogative fronting
    """
    clean = gloss.strip()
    if not clean:
        return ""

    sentences = split_sentences(clean)
    if not sentences or len(sentences) <= 1:
        base = sentences[0][0] if sentences else clean
        punct = sentences[0][1] if sentences else ""
        return _single_sentence_asl_to_english(base, punct)

    english_sentences = []
    for base, punct in sentences:
        s = _single_sentence_asl_to_english(base, punct)
        if s:
            english_sentences.append(s)

    return " ".join(english_sentences)


# ══════════════════════════════════════════════════════════════════════════════
# ── Schemas ───────────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class RegisterRequest(BaseModel):
    name: str
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TranslationRequest(BaseModel):
    text: str
    direction: str  # "en_to_asl" or "asl_to_en"
    force_engine: Optional[str] = None  # "neural", "rule", or None (auto)

class SlideInput(BaseModel):
    description_text: str
    image_url: Optional[str] = None

class LessonGroupCreateRequest(BaseModel):
    topic_id: str
    title: str
    order_index: int = 0

class LessonCreateRequest(BaseModel):
    topic_id: str
    title: str
    difficulty: str = 'easy'        # 'easy' | 'medium' | 'hard'
    lesson_group_id: Optional[int] = None
    slides: list[SlideInput]

class UpdateLessonSlidesRequest(BaseModel):
    slides: list[SlideInput]
    teacher_name: Optional[str] = "Teacher"
    teacher_id: Optional[int] = None

class QuestionInput(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    image_url: Optional[str] = None
    knowledge_component: Optional[str] = None
    options: list[str]
    correct_option_index: int = 0
    hint: Optional[str] = None

class QuizCreateRequest(BaseModel):
    title: str
    topic_id: str
    lesson_id: int
    difficulty: str = 'easy'        # inherited from lesson
    questions: list[QuestionInput]
    teacher_name: Optional[str] = "Teacher"
    teacher_id: Optional[int] = None

class TrashActionRequest(BaseModel):
    item_type: str  # 'lesson_group' | 'lesson' | 'quiz'
    item_id: int
    teacher_name: Optional[str] = "Teacher"
    teacher_id: Optional[int] = None

class KCCreateRequest(BaseModel):
    topic_id: str
    name: str          # machine name e.g. "identify_vowels"
    display_name: str  # human label e.g. "Identify Vowels"
    prior: float = 0.10    # P(L0)  — prior probability of knowing
    learns: float = 0.20  # P(T)   — learning rate per opportunity
    guesses: float = 0.25 # P(G)   — guess probability (0.25 for 4-choice MCQ)
    slips: float = 0.10   # P(S)   — slip probability

class AnswerInput(BaseModel):
    question_id: int
    is_correct: bool
    time_spent_seconds: int = 0

class QuizCompleteRequest(BaseModel):
    score: int
    total_questions: int
    time_spent_seconds: int
    answers: list[AnswerInput]

class QuizOfflineSyncRequest(BaseModel):
    user_id: int
    quiz_id: int
    attempt_id: Optional[int] = None
    difficulty: str = 'easy'
    score: int
    total_questions: int
    time_spent_seconds: int = 0
    answers: list[AnswerInput]

class CreateTeacherRequest(BaseModel):
    name: str
    username: str
    password: str

class UpdateUserRoleRequest(BaseModel):
    role: str

class AdminResetPasswordRequest(BaseModel):
    password: str

class AdminDeleteUserRequest(BaseModel):
    admin_password: str
    admin_id: Optional[int] = None


# ══════════════════════════════════════════════════════════════════════════════
# ── Auth endpoints ────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/register")
def register(req: RegisterRequest):
    if not req.name.strip() or not req.username.strip() or not req.password.strip():
        raise HTTPException(status_code=400, detail="All fields are required.")
    if len(req.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    hashed = pwd_context.hash(req.password)
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'student') RETURNING id, name, username, role",
            (req.name.strip(), req.username.strip().lower(), hashed),
        )
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user": dict(user)}
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Username already taken.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login")
def login(req: LoginRequest):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, name, username, password_hash, role, avatar_url, last_avatar_changed_at FROM users WHERE username = %s",
            (req.username.strip().lower(),),
        )
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user is None or not pwd_context.verify(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password.")

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "username": user["username"],
                "role": user.get("role") or "student",
                "avatar_url": user.get("avatar_url"),
                "last_avatar_changed_at": user.get("last_avatar_changed_at").isoformat() if user.get("last_avatar_changed_at") else None,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def log_teacher_activity(teacher_name: str, action_type: str, target_type: str, target_id: int, target_title: str, topic_id: str = None, details: str = None, teacher_id: int = None):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO teacher_activity_logs 
            (teacher_id, teacher_name, action_type, target_type, target_id, target_title, topic_id, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (teacher_id, teacher_name or "Teacher", action_type, target_type, target_id, target_title, topic_id, details))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error logging teacher activity: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# ── Milestone 2: Lesson Group + Lesson CRUD ───────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/lesson-group/create")
def create_lesson_group(req: LessonGroupCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO lesson_groups (topic_id, title, order_index) VALUES (%s, %s, %s) RETURNING id, topic_id, title, order_index, created_at",
            (req.topic_id.strip(), req.title.strip(), req.order_index),
        )
        group = dict(cur.fetchone())

        # ── Automatically create Knowledge Component (KC) for this lesson group ──
        clean_title = req.title.strip()
        slug = re.sub(r'[^a-z0-9]+', '_', clean_title.lower()).strip('_')
        kc_name = f"kc_{slug}"
        display_name = f"{clean_title} Mastery"
        cur.execute(
            """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
               VALUES (%s, %s, %s, 0.10, 0.20, 0.25, 0.10)
               ON CONFLICT (name) DO UPDATE SET
                   topic_id = EXCLUDED.topic_id,
                   display_name = EXCLUDED.display_name""",
            (req.topic_id.strip(), kc_name, display_name)
        )

        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "lesson_group": group, "auto_kc": kc_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/lesson-groups/{topic_id}")
def get_lesson_groups(topic_id: str):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT id, topic_id, title, order_index, created_at FROM lesson_groups WHERE topic_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY created_at DESC NULLS LAST, id DESC",
            (topic_id,),
        )
        groups = cur.fetchall()
        result = []
        for g in groups:
            # Fetch all difficulty lessons under this group
            cur.execute(
                "SELECT id, title, difficulty, created_at FROM lessons WHERE lesson_group_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY id ASC",
                (g["id"],)
            )
            lessons = cur.fetchall()
            # Count slides per lesson
            lessons_with_counts = []
            for l in lessons:
                cur.execute(
                    "SELECT id, slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
                    (l["id"],)
                )
                slides = [dict(s) for s in cur.fetchall()]
                slide_count = len(slides)
                # Fetch quiz for this lesson
                cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1", (l["id"],))
                quiz_row = cur.fetchone()
                quiz_question_count = 0
                quiz_id = None
                if quiz_row:
                    quiz_id = quiz_row["id"]
                    cur.execute("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = %s", (quiz_id,))
                    quiz_question_count = cur.fetchone()["cnt"]
                lessons_with_counts.append({
                    **dict(l),
                    "slides": slides,
                    "slide_count": slide_count,
                    "quiz_id": quiz_id,
                    "quiz_question_count": quiz_question_count,
                })
            result.append({
                **dict(g),
                "lessons": lessons_with_counts
            })
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/lesson-group/{group_id}")
def delete_lesson_group(group_id: int, teacher_name: str = "Teacher", teacher_id: Optional[int] = None):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, title, topic_id FROM lesson_groups WHERE id = %s", (group_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Lesson group not found.")
        
        # Soft delete lesson group, all its lessons, and all attached quizzes
        cur.execute(
            "UPDATE lesson_groups SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s",
            (teacher_name, group_id)
        )
        cur.execute(
            "UPDATE lessons SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE lesson_group_id = %s",
            (teacher_name, group_id)
        )
        cur.execute(
            """UPDATE quizzes 
               SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s 
               WHERE lesson_id IN (SELECT id FROM lessons WHERE lesson_group_id = %s)""",
            (teacher_name, group_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        
        log_teacher_activity(
            teacher_name=teacher_name,
            action_type="trash_lesson",
            target_type="lesson_group",
            target_id=group_id,
            target_title=row["title"],
            topic_id=row["topic_id"],
            details=f"Moved lesson story '{row['title']}' and its quizzes to Trash.",
            teacher_id=teacher_id
        )
        return {"success": True, "message": f"Moved '{row['title']}' to Trash."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/lesson/{lesson_id}")
def delete_lesson(lesson_id: int, teacher_name: str = "Teacher", teacher_id: Optional[int] = None):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, title, topic_id, difficulty FROM lessons WHERE id = %s", (lesson_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Lesson not found.")
        
        cur.execute("UPDATE lessons SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s", (teacher_name, lesson_id))
        cur.execute("UPDATE quizzes SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE lesson_id = %s", (teacher_name, lesson_id))
        conn.commit()
        cur.close()
        conn.close()
        
        log_teacher_activity(
            teacher_name=teacher_name,
            action_type="trash_lesson",
            target_type="lesson",
            target_id=lesson_id,
            target_title=row["title"],
            topic_id=row["topic_id"],
            details=f"Moved {row.get('difficulty', 'easy').upper()} tier to Trash.",
            teacher_id=teacher_id
        )
        return {"success": True, "message": f"Moved lesson to Trash."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/lesson/create")
def create_lesson(req: LessonCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    if not req.slides:
        raise HTTPException(status_code=400, detail="At least one slide is required.")
    if req.difficulty not in ('easy', 'medium', 'hard'):
        raise HTTPException(status_code=400, detail="Difficulty must be easy, medium, or hard.")

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Insert lesson with difficulty + lesson_group_id
        cur.execute(
            "INSERT INTO lessons (topic_id, title, difficulty, lesson_group_id) VALUES (%s, %s, %s, %s) RETURNING id, topic_id, title, difficulty, lesson_group_id, created_at",
            (req.topic_id.strip(), req.title.strip(), req.difficulty, req.lesson_group_id),
        )
        lesson = dict(cur.fetchone())
        lesson_id = lesson["id"]

        # Insert slides
        inserted_slides = []
        for idx, slide in enumerate(req.slides):
            img_val = slide.image_url.strip() if slide.image_url else None
            cur.execute(
                "INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url) VALUES (%s, %s, %s, %s) RETURNING slide_index, description_text, image_url",
                (lesson_id, idx, slide.description_text.strip(), img_val)
            )
            inserted_slides.append(dict(cur.fetchone()))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "lesson": {**lesson, "slides": inserted_slides}
        }
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail=f"A {req.difficulty} lesson already exists for this lesson group.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lessons/{topic_id}")
def get_lessons_by_topic(topic_id: str):
    """Returns all lessons for a topic, grouped by lesson_group_id."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch lesson groups for this topic (ordered)
        cur.execute(
            "SELECT id, topic_id, title, order_index FROM lesson_groups WHERE topic_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY order_index ASC, id ASC",
            (topic_id,)
        )
        groups = cur.fetchall()

        result = []
        for g in groups:
            cur.execute(
                "SELECT id, topic_id, title, difficulty, lesson_group_id, created_at FROM lessons WHERE lesson_group_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY id ASC",
                (g["id"],)
            )
            lessons = cur.fetchall()
            group_lessons = []
            for l in lessons:
                cur.execute(
                    "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
                    (l["id"],)
                )
                slides = cur.fetchall()
                # Get quiz_id for this lesson
                cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1", (l["id"],))
                quiz_row = cur.fetchone()
                group_lessons.append({
                    **dict(l),
                    "slides": [dict(s) for s in slides],
                    "quiz_id": quiz_row["id"] if quiz_row else None,
                })
            result.append({
                **dict(g),
                "lessons": group_lessons
            })

        # Fallback: also return ungrouped lessons (lesson_group_id IS NULL) for backward compat
        cur.execute(
            "SELECT id, topic_id, title, difficulty, lesson_group_id, created_at FROM lessons WHERE topic_id = %s AND lesson_group_id IS NULL AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY id ASC",
            (topic_id,)
        )
        ungrouped = cur.fetchall()
        for l in ungrouped:
            cur.execute(
                "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
                (l["id"],)
            )
            slides = cur.fetchall()
            cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s LIMIT 1", (l["id"],))
            quiz_row = cur.fetchone()
            result.append({
                "id": l["id"],
                "topic_id": l["topic_id"],
                "title": l["title"],
                "order_index": 999,
                "lessons": [{
                    **dict(l),
                    "slides": [dict(s) for s in slides],
                    "quiz_id": quiz_row["id"] if quiz_row else None,
                }]
            })

        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/lesson/{lesson_id}/slides")
def get_lesson_slides(lesson_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT slide_index, description_text, image_url FROM lesson_slides WHERE lesson_id = %s ORDER BY slide_index ASC",
            (lesson_id,)
        )
        slides = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(s) for s in slides]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/lesson/{lesson_id}/slides")
def update_lesson_slides(lesson_id: int, req: UpdateLessonSlidesRequest):
    if not req.slides:
        raise HTTPException(status_code=400, detail="At least one slide is required.")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (lesson_id,))
        for idx, slide in enumerate(req.slides):
            img_val = slide.image_url.strip() if slide.image_url else None
            cur.execute(
                "INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url) VALUES (%s, %s, %s, %s)",
                (lesson_id, idx, slide.description_text.strip(), img_val)
            )
        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=req.teacher_name or "Teacher",
            action_type="edit_slides",
            target_type="lesson",
            target_id=lesson_id,
            target_title=f"Lesson #{lesson_id}",
            details=f"Updated slides ({len(req.slides)} slides).",
            teacher_id=req.teacher_id
        )
        return {"success": True, "message": "Slides updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/upload")
def upload_image(request: Request, file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if not ext and file.content_type:
        if "png" in file.content_type:
            ext = ".png"
        elif "gif" in file.content_type:
            ext = ".gif"
        elif "webp" in file.content_type:
            ext = ".webp"
        else:
            ext = ".jpg"
    if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.")

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if os.path.getsize(file_path) > 10 * 1024 * 1024:
            try:
                os.remove(file_path)
            except Exception:
                pass
            raise HTTPException(status_code=413, detail="File size exceeds maximum allowed limit of 10MB.")

        # Also copy to packaged assets/uploads if separate
        local_assets_dir = os.path.abspath("assets/uploads")
        if os.path.abspath(UPLOAD_DIR) != local_assets_dir:
            try:
                os.makedirs(local_assets_dir, exist_ok=True)
                shutil.copy2(file_path, os.path.join(local_assets_dir, unique_filename))
            except Exception:
                pass

        base_url = get_public_base_url(request).rstrip('/')
        url = f"{base_url}/static/{unique_filename}"
        return {"success": True, "url": url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# ── Admin Quiz endpoints (updated with difficulty) ────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/quiz/create")
def create_quiz(req: QuizCreateRequest):
    if not req.title.strip() or not req.topic_id.strip():
        raise HTTPException(status_code=400, detail="Title and Topic ID are required.")
    if not req.questions:
        raise HTTPException(status_code=400, detail="At least one question is required.")

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Insert quiz with difficulty
        cur.execute(
            "INSERT INTO quizzes (title, topic_id, lesson_id, difficulty) VALUES (%s, %s, %s, %s) RETURNING id",
            (req.title.strip(), req.topic_id.strip(), req.lesson_id, req.difficulty)
        )
        quiz_id = cur.fetchone()["id"]

        # Insert questions and options
        for q in req.questions:
            if not q.question_text.strip():
                continue
            if not q.options or len(q.options) < 4:
                raise HTTPException(status_code=400, detail="Each question must have exactly 4 choices (A, B, C, D).")
            for opt_idx, opt_text in enumerate(q.options[:4]):
                if not opt_text.strip():
                    raise HTTPException(status_code=400, detail=f"Option {chr(65 + opt_idx)} cannot be empty.")

            correct_idx = max(0, min(3, q.correct_option_index if q.correct_option_index is not None else 0))
            correct_letter = chr(65 + correct_idx)

            img_val = q.image_url.strip() if q.image_url else None
            kc_val = q.knowledge_component.strip() if q.knowledge_component else None

            # If no KC provided, automatically inherit and ensure the lesson's KC
            if not kc_val:
                cur.execute(
                    """SELECT lg.title as group_title, l.title as lesson_title
                       FROM lessons l
                       LEFT JOIN lesson_groups lg ON l.lesson_group_id = lg.id
                       WHERE l.id = %s""",
                    (req.lesson_id,)
                )
                l_info = cur.fetchone()
                base_title = (l_info["group_title"] if l_info and l_info.get("group_title") else (l_info["lesson_title"] if l_info else req.title))
                slug = re.sub(r'[^a-z0-9]+', '_', base_title.lower().strip()).strip('_')
                kc_val = f"kc_{slug}"
                # Ensure it exists in knowledge_components with standard BKT defaults
                cur.execute(
                    """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
                       VALUES (%s, %s, %s, 0.10, 0.20, 0.25, 0.10)
                       ON CONFLICT (name) DO NOTHING""",
                    (req.topic_id.strip(), kc_val, f"{base_title} Mastery")
                )

            cur.execute(
                """INSERT INTO questions 
                   (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (quiz_id, q.question_text.strip(), correct_letter, "multiple_choice", img_val, kc_val, getattr(q, 'hint', None))
            )
            question_id = cur.fetchone()["id"]

            for idx, opt_text in enumerate(q.options[:4]):
                opt_letter = chr(65 + idx)
                cur.execute(
                    "INSERT INTO question_options (question_id, option_letter, option_text) VALUES (%s, %s, %s)",
                    (question_id, opt_letter, opt_text.strip())
                )

        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=req.teacher_name or "Teacher",
            action_type="create_quiz",
            target_type="quiz",
            target_id=quiz_id,
            target_title=req.title,
            topic_id=req.topic_id,
            details=f"Created {req.difficulty.upper()} quiz with {len(req.questions)} questions.",
            teacher_id=req.teacher_id
        )
        return {"success": True, "quiz_id": quiz_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _fetch_full_quiz(cur, quiz_id: int):
    """Helper: fetch quiz + all questions with options/matches."""
    cur.execute("SELECT id, title, topic_id, lesson_id, difficulty FROM quizzes WHERE id = %s", (quiz_id,))
    quiz = cur.fetchone()
    if not quiz:
        return None

    cur.execute(
        "SELECT id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint FROM questions WHERE quiz_id = %s ORDER BY id ASC",
        (quiz["id"],)
    )
    questions = cur.fetchall()

    quiz_questions = []
    for q in questions:
        cur.execute(
            "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
            (q["id"],)
        )
        opts = cur.fetchall()
        options_list = [o["option_text"] for o in opts]
        letter = (q.get("correct_option_letter") or "A").strip().upper()
        correct_idx = max(0, min(3, ord(letter[0]) - 65)) if letter and letter[0].isalpha() else 0

        quiz_questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "question_type": "multiple_choice",
            "image_url": q["image_url"],
            "knowledge_component": q.get("knowledge_component") or "reading_comprehension",
            "hint": q.get("hint") or "",
            "options": options_list,
            "correct_option_index": correct_idx,
            "matching_pairs": []
        })

    return {
        "id": quiz["id"],
        "title": quiz["title"],
        "topic_id": quiz["topic_id"],
        "lesson_id": quiz["lesson_id"],
        "difficulty": quiz["difficulty"],
        "questions": quiz_questions
    }


@app.get("/quizzes/{topic_id}")
def get_quizzes_by_topic(topic_id: str):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM quizzes WHERE topic_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY id DESC", (topic_id,))
        quiz_rows = cur.fetchall()
        result = [_fetch_full_quiz(cur, r["id"]) for r in quiz_rows if r]
        cur.close()
        conn.close()
        return [r for r in result if r is not None]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/quizzes/lesson/{lesson_id}")
def get_quiz_by_lesson(lesson_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s AND COALESCE(is_deleted, FALSE) = FALSE ORDER BY id DESC LIMIT 1", (lesson_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return None
        result = _fetch_full_quiz(cur, row["id"])
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Milestone 3: Quiz Session endpoints ───────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

def _get_pass_threshold(cur, topic_id: str) -> float:
    """Fetch admin-configured pass threshold for a topic (default 70%)."""
    cur.execute("SELECT pass_threshold FROM topic_settings WHERE topic_id = %s", (topic_id,))
    row = cur.fetchone()
    return row["pass_threshold"] if row else 70.0


def _get_or_create_lesson_progress(cur, user_id: int, lesson_group_id: int) -> dict:
    """Fetch or create student_lesson_progress row."""
    cur.execute(
        "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
        (user_id, lesson_group_id)
    )
    row = cur.fetchone()
    if row:
        return dict(row)
    # Create fresh progress row
    cur.execute(
        """INSERT INTO student_lesson_progress (user_id, lesson_group_id)
           VALUES (%s, %s)
           ON CONFLICT (user_id, lesson_group_id) DO NOTHING
           RETURNING *""",
        (user_id, lesson_group_id)
    )
    new_row = cur.fetchone()
    if new_row:
        return dict(new_row)
    # If insert raced, fetch again
    cur.execute(
        "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
        (user_id, lesson_group_id)
    )
    return dict(cur.fetchone())


@app.get("/quiz/session/{quiz_id}")
def start_quiz_session(quiz_id: int, user_id: int, mode: Optional[str] = None):
    """
    Milestone 3: Start a quiz session.
    - Checks sequential lesson lock (previous lesson's Easy must be passed)
    - Checks difficulty lock (Easy must be passed to unlock Medium, etc.)
    - Returns a fresh random set of up to 10 questions every call (including retries)
    - Creates a student_quiz_attempts record
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch quiz info
        cur.execute(
            "SELECT q.id, q.lesson_id, q.difficulty, q.topic_id, l.lesson_group_id FROM quizzes q LEFT JOIN lessons l ON q.lesson_id = l.id WHERE q.id = %s",
            (quiz_id,)
        )
        quiz = cur.fetchone()
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found.")

        lesson_group_id = quiz["lesson_group_id"]
        difficulty = quiz["difficulty"] or "easy"
        topic_id = quiz["topic_id"]

        # ── Sequential lesson lock check (skipped in daily challenge mode) ──
        if mode != "daily" and lesson_group_id:
            cur.execute(
                "SELECT id, order_index FROM lesson_groups WHERE id = %s",
                (lesson_group_id,)
            )
            current_group = cur.fetchone()
            if current_group and current_group["order_index"] > 0:
                cur.execute(
                    "SELECT id FROM lesson_groups WHERE topic_id = %s AND order_index = %s",
                    (topic_id, current_group["order_index"] - 1)
                )
                prev_group = cur.fetchone()
                if prev_group:
                    cur.execute(
                        "SELECT easy_passed FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
                        (user_id, prev_group["id"])
                    )
                    prev_progress = cur.fetchone()
                    if not prev_progress or not prev_progress["easy_passed"]:
                        raise HTTPException(
                            status_code=403,
                            detail="Complete the previous lesson's Easy quiz first to unlock this lesson."
                        )

        # ── Difficulty lock check (skipped in daily challenge mode) ─────────
        if mode != "daily" and lesson_group_id:
            progress = _get_or_create_lesson_progress(cur, user_id, lesson_group_id)
            if difficulty == 'medium' and not progress["easy_passed"]:
                raise HTTPException(status_code=403, detail="Complete the Easy quiz with 70%+ to unlock Medium.")
            if difficulty == 'hard' and not progress["medium_passed"]:
                raise HTTPException(status_code=403, detail="Complete the Medium quiz with 70%+ to unlock Hard.")

        # ── Fetch all questions for this quiz ─────────────────────────────────
        cur.execute(
            "SELECT id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint FROM questions WHERE quiz_id = %s ORDER BY id ASC",
            (quiz_id,)
        )
        all_questions = cur.fetchall()

        if not all_questions:
            raise HTTPException(status_code=404, detail="No questions found for this quiz.")

        # ── Phase 2: Adaptive selection via BKT (falls back to random if no KC tags) ──
        all_q_dicts = [dict(q) for q in all_questions]
        selected_count = min(10, len(all_q_dicts))
        selected_questions = _adaptive_question_selection(cur, user_id, all_q_dicts, selected_count)
        selected_ids = [q["id"] for q in selected_questions]

        # Build full question objects
        result_questions = []
        for q in selected_questions:
            cur.execute(
                "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                (q["id"],)
            )
            opts = cur.fetchall()
            options_list = [o["option_text"] for o in opts]
            letter = (q.get("correct_option_letter") or "A").strip().upper()
            correct_idx = max(0, min(3, ord(letter[0]) - 65)) if letter and letter[0].isalpha() else 0

            result_questions.append({
                "id": q["id"],
                "question_text": q["question_text"],
                "question_type": "multiple_choice",
                "image_url": q["image_url"],
                "knowledge_component": q.get("knowledge_component") or "reading_comprehension",
                "hint": q.get("hint") or "",
                "options": options_list,
                "correct_option_index": correct_idx,
                "matching_pairs": [],
            })

        # ── Create attempt record ─────────────────────────────────────────────
        cur.execute(
            """INSERT INTO student_quiz_attempts
               (user_id, quiz_id, question_ids, total_questions, difficulty)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id""",
            (user_id, quiz_id, selected_ids, selected_count, difficulty)
        )
        attempt_id = cur.fetchone()["id"]

        # Update attempt count on lesson progress
        if lesson_group_id:
            cur.execute(
                """UPDATE student_lesson_progress
                   SET attempts_count = attempts_count + 1, last_updated = NOW()
                   WHERE user_id = %s AND lesson_group_id = %s""",
                (user_id, lesson_group_id)
            )

        conn.commit()
        cur.close()
        conn.close()

        return {
            "attempt_id": attempt_id,
            "quiz_id": quiz_id,
            "difficulty": difficulty,
            "questions": result_questions,
            "total": selected_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quiz/session/{attempt_id}/complete")
def complete_quiz_session(attempt_id: int, body: QuizCompleteRequest):
    """
    Milestone 3: Submit quiz results.
    - Saves all per-question answers
    - Updates student_lesson_progress (best score, passed flags)
    - Updates student_profiles (overall stats, total stars)
    - Returns: accuracy, passed, what was unlocked
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch attempt
        cur.execute(
            "SELECT * FROM student_quiz_attempts WHERE id = %s",
            (attempt_id,)
        )
        attempt = cur.fetchone()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")

        user_id = attempt["user_id"]
        quiz_id = attempt["quiz_id"]
        difficulty = attempt["difficulty"] or "easy"

        # Fetch quiz + lesson info
        cur.execute(
            "SELECT q.topic_id, l.lesson_group_id FROM quizzes q LEFT JOIN lessons l ON q.lesson_id = l.id WHERE q.id = %s",
            (quiz_id,)
        )
        quiz_info = cur.fetchone()
        topic_id = quiz_info["topic_id"] if quiz_info else None
        lesson_group_id = quiz_info["lesson_group_id"] if quiz_info else None

        # Get pass threshold
        threshold = _get_pass_threshold(cur, topic_id) if topic_id else 70.0

        # Calculate accuracy
        total = body.total_questions or 1
        accuracy_pct = round((body.score / total) * 100, 2)
        passed = accuracy_pct >= threshold

        # Mark attempt as completed
        cur.execute(
            """UPDATE student_quiz_attempts
               SET completed_at = NOW(), score = %s, total_questions = %s, time_spent_seconds = %s
               WHERE id = %s""",
            (body.score, total, body.time_spent_seconds, attempt_id)
        )

        # Save per-question answers + update KC mastery via BKT
        for ans in body.answers:
            cur.execute(
                """INSERT INTO student_question_answers (attempt_id, question_id, is_correct, time_spent_seconds)
                   VALUES (%s, %s, %s, %s)""",
                (attempt_id, ans.question_id, ans.is_correct, ans.time_spent_seconds)
            )
            # Phase 2 — Student Model: update KC mastery for this answer
            cur.execute(
                "SELECT knowledge_component FROM questions WHERE id = %s",
                (ans.question_id,)
            )
            q_row = cur.fetchone()
            if q_row and q_row["knowledge_component"]:
                _upsert_kc_mastery(cur, user_id, q_row["knowledge_component"], ans.is_correct)

        # ── Update lesson progress ────────────────────────────────────────────
        unlocked_medium = False
        unlocked_hard = False
        unlocked_next_lesson = False

        if lesson_group_id:
            progress = _get_or_create_lesson_progress(cur, user_id, lesson_group_id)

            if difficulty == 'easy':
                new_best = max(progress["easy_best_score"], accuracy_pct)
                easy_passed_now = progress["easy_passed"] or passed
                unlocked_medium = passed and not progress["easy_passed"]
                unlocked_next_lesson = passed and not progress["easy_passed"]
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET easy_best_score = %s, easy_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, easy_passed_now, user_id, lesson_group_id)
                )
            elif difficulty == 'medium':
                new_best = max(progress["medium_best_score"], accuracy_pct)
                medium_passed_now = progress["medium_passed"] or passed
                unlocked_hard = passed and not progress["medium_passed"]
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET medium_best_score = %s, medium_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, medium_passed_now, user_id, lesson_group_id)
                )
            elif difficulty == 'hard':
                new_best = max(progress["hard_best_score"], accuracy_pct)
                hard_passed_now = progress["hard_passed"] or passed
                cur.execute(
                    """UPDATE student_lesson_progress
                       SET hard_best_score = %s, hard_passed = %s, last_updated = NOW()
                       WHERE user_id = %s AND lesson_group_id = %s""",
                    (new_best, hard_passed_now, user_id, lesson_group_id)
                )

        # ── Update topic-level student profile ────────────────────────────────
        # Star reward: +3 (easy), +4 (medium), +6 (hard) per correct question, awarded only on pass
        STAR_RATES = {"easy": 3, "medium": 4, "hard": 6}
        star_rate = STAR_RATES.get(difficulty.lower(), 3)
        stars_earned = (body.score * star_rate) if passed else 0

        # Ensure topic_id exists; if not, query it from the quiz or fallback
        if not topic_id:
            cur.execute("SELECT topic_id FROM quizzes WHERE id = %s", (quiz_id,))
            q_row = cur.fetchone()
            topic_id = q_row["topic_id"] if q_row and q_row.get("topic_id") else "story-grammar"

        cur.execute(
            "SELECT * FROM student_profiles WHERE user_id = %s AND topic_id = %s",
            (user_id, topic_id)
        )
        profile = cur.fetchone()
        if profile:
            new_avg = round(
                (profile["avg_accuracy"] * profile["quizzes_completed"] + accuracy_pct)
                / (profile["quizzes_completed"] + 1), 2
            )
            avg_time = round(
                (profile["avg_time_seconds"] * profile["quizzes_completed"] + (body.time_spent_seconds / total))
                / (profile["quizzes_completed"] + 1), 2
            ) if total > 0 else profile["avg_time_seconds"]
            cur.execute(
                """UPDATE student_profiles
                   SET avg_accuracy = %s, avg_time_seconds = %s,
                       quizzes_completed = quizzes_completed + 1,
                       total_stars = total_stars + %s,
                       knowledge_level = %s, last_updated = NOW()
                   WHERE user_id = %s AND topic_id = %s""",
                (new_avg, avg_time, stars_earned, difficulty, user_id, topic_id)
            )
        else:
            avg_time = round(body.time_spent_seconds / total, 2) if total > 0 else 0
            cur.execute(
                """INSERT INTO student_profiles
                   (user_id, topic_id, avg_accuracy, avg_time_seconds, quizzes_completed, total_stars, knowledge_level)
                   VALUES (%s, %s, %s, %s, 1, %s, %s)
                   ON CONFLICT (user_id, topic_id) DO UPDATE
                   SET total_stars = student_profiles.total_stars + EXCLUDED.total_stars,
                       quizzes_completed = student_profiles.quizzes_completed + 1,
                       last_updated = NOW()""",
                (user_id, topic_id, accuracy_pct, avg_time, stars_earned, difficulty)
            )

        # Phase 3: update streak on every quiz completion
        _update_student_streak(cur, user_id)

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "score": body.score,
            "total": total,
            "accuracy_pct": accuracy_pct,
            "passed": passed,
            "stars_earned": stars_earned,
            "star_rate": star_rate,
            "unlocked_medium": unlocked_medium,
            "unlocked_hard": unlocked_hard,
            "unlocked_next_lesson": unlocked_next_lesson,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quiz/offline-sync")
def offline_sync_quiz(body: QuizOfflineSyncRequest):
    """
    Ingests and reconciles quiz attempts completed while offline.
    Recalculates BKT mastery, updates lesson gating, awards stars, and refreshes streaks.
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        user_id = body.user_id
        quiz_id = body.quiz_id
        difficulty = body.difficulty or "easy"
        total = body.total_questions or max(len(body.answers), 1)

        # 1. Fetch quiz + lesson info
        cur.execute(
            "SELECT q.topic_id, l.lesson_group_id FROM quizzes q LEFT JOIN lessons l ON q.lesson_id = l.id WHERE q.id = %s",
            (quiz_id,)
        )
        quiz_info = cur.fetchone()
        topic_id = quiz_info["topic_id"] if quiz_info else None
        lesson_group_id = quiz_info["lesson_group_id"] if quiz_info else None

        threshold = _get_pass_threshold(cur, topic_id) if topic_id else 70.0
        accuracy_pct = round((body.score / total) * 100, 2)
        passed = accuracy_pct >= threshold

        # 2. Check if attempt_id exists or create new attempt record
        attempt_id = None
        if body.attempt_id:
            cur.execute("SELECT id FROM student_quiz_attempts WHERE id = %s", (body.attempt_id,))
            existing = cur.fetchone()
            if existing:
                attempt_id = existing["id"]

        question_ids = [ans.question_id for ans in body.answers]

        if attempt_id:
            cur.execute(
                """UPDATE student_quiz_attempts
                   SET completed_at = NOW(), score = %s, total_questions = %s, time_spent_seconds = %s
                   WHERE id = %s""",
                (body.score, total, body.time_spent_seconds, attempt_id)
            )
        else:
            cur.execute(
                """INSERT INTO student_quiz_attempts
                   (user_id, quiz_id, question_ids, started_at, completed_at, score, total_questions, time_spent_seconds, difficulty)
                   VALUES (%s, %s, %s, NOW() - (%s || ' seconds')::INTERVAL, NOW(), %s, %s, %s, %s)
                   RETURNING id""",
                (user_id, quiz_id, question_ids, body.time_spent_seconds, body.score, total, body.time_spent_seconds, difficulty)
            )
            attempt_id = cur.fetchone()["id"]

        # 3. Save answers and update BKT
        for ans in body.answers:
            cur.execute(
                """INSERT INTO student_question_answers (attempt_id, question_id, is_correct, time_spent_seconds)
                   VALUES (%s, %s, %s, %s)""",
                (attempt_id, ans.question_id, ans.is_correct, ans.time_spent_seconds)
            )
            cur.execute("SELECT knowledge_component FROM questions WHERE id = %s", (ans.question_id,))
            q_row = cur.fetchone()
            if q_row and q_row["knowledge_component"]:
                _upsert_kc_mastery(cur, user_id, q_row["knowledge_component"], ans.is_correct)

        # 4. Update lesson progress
        unlocked_medium = False
        unlocked_hard = False
        unlocked_next_lesson = False

        if lesson_group_id:
            cur.execute(
                "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
                (user_id, lesson_group_id)
            )
            prog = cur.fetchone()

            if not prog:
                cur.execute(
                    """INSERT INTO student_lesson_progress
                       (user_id, lesson_group_id, easy_passed, medium_passed, hard_passed,
                        easy_best_score, medium_best_score, hard_best_score, attempts_count)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)""",
                    (
                        user_id, lesson_group_id,
                        passed if difficulty == "easy" else False,
                        passed if difficulty == "medium" else False,
                        passed if difficulty == "hard" else False,
                        accuracy_pct if difficulty == "easy" else 0.0,
                        accuracy_pct if difficulty == "medium" else 0.0,
                        accuracy_pct if difficulty == "hard" else 0.0,
                    )
                )
                unlocked_medium = passed and difficulty == "easy"
                unlocked_hard = passed and difficulty == "medium"
                if difficulty == "easy":
                    score_col = "easy_best_score"
                    passed_col = "easy_passed"
                elif difficulty == "medium":
                    score_col = "medium_best_score"
                    passed_col = "medium_passed"
                else:
                    score_col = "hard_best_score"
                    passed_col = "hard_passed"

                curr_best = prog.get(score_col) or 0.0
                new_best = max(curr_best, accuracy_pct)
                already_passed = bool(prog.get(passed_col))
                new_passed = already_passed or passed

                if difficulty == "easy":
                    cur.execute(
                        """UPDATE student_lesson_progress
                           SET easy_best_score = %s, easy_passed = %s,
                               attempts_count = attempts_count + 1, last_updated = NOW()
                           WHERE user_id = %s AND lesson_group_id = %s""",
                        (new_best, new_passed, user_id, lesson_group_id)
                    )
                elif difficulty == "medium":
                    cur.execute(
                        """UPDATE student_lesson_progress
                           SET medium_best_score = %s, medium_passed = %s,
                               attempts_count = attempts_count + 1, last_updated = NOW()
                           WHERE user_id = %s AND lesson_group_id = %s""",
                        (new_best, new_passed, user_id, lesson_group_id)
                    )
                else:
                    cur.execute(
                        """UPDATE student_lesson_progress
                           SET hard_best_score = %s, hard_passed = %s,
                               attempts_count = attempts_count + 1, last_updated = NOW()
                           WHERE user_id = %s AND lesson_group_id = %s""",
                        (new_best, new_passed, user_id, lesson_group_id)
                    )

                if difficulty == "easy" and passed and not already_passed:
                    unlocked_medium = True
                elif difficulty == "medium" and passed and not already_passed:
                    unlocked_hard = True

        # 5. Stars and profiles
        star_rates = {"easy": 3, "medium": 4, "hard": 6}
        star_rate = star_rates.get(difficulty.lower(), 3)
        stars_earned = (body.score * star_rate) if passed else 0

        if not topic_id:
            cur.execute("SELECT topic_id FROM quizzes WHERE id = %s", (quiz_id,))
            q_row = cur.fetchone()
            topic_id = q_row["topic_id"] if q_row and q_row.get("topic_id") else "story-grammar"

        cur.execute("SELECT * FROM student_profiles WHERE user_id = %s AND topic_id = %s", (user_id, topic_id))
        profile = cur.fetchone()
        if profile:
            new_avg = round(
                (profile["avg_accuracy"] * profile["quizzes_completed"] + accuracy_pct)
                / (profile["quizzes_completed"] + 1), 2
            )
            avg_time = round(
                (profile["avg_time_seconds"] * profile["quizzes_completed"] + (body.time_spent_seconds / total))
                / (profile["quizzes_completed"] + 1), 2
            ) if total > 0 else profile["avg_time_seconds"]
            cur.execute(
                """UPDATE student_profiles
                   SET avg_accuracy = %s, avg_time_seconds = %s,
                       quizzes_completed = quizzes_completed + 1,
                       total_stars = total_stars + %s,
                       knowledge_level = %s, last_updated = NOW()
                   WHERE user_id = %s AND topic_id = %s""",
                (new_avg, avg_time, stars_earned, difficulty, user_id, topic_id)
            )
        else:
            avg_time = round(body.time_spent_seconds / total, 2) if total > 0 else 0
            cur.execute(
                """INSERT INTO student_profiles
                   (user_id, topic_id, avg_accuracy, avg_time_seconds, quizzes_completed, total_stars, knowledge_level)
                   VALUES (%s, %s, %s, %s, 1, %s, %s)
                   ON CONFLICT (user_id, topic_id) DO UPDATE
                   SET total_stars = student_profiles.total_stars + EXCLUDED.total_stars,
                       quizzes_completed = student_profiles.quizzes_completed + 1,
                       last_updated = NOW()""",
                (user_id, topic_id, accuracy_pct, avg_time, stars_earned, difficulty)
            )

        _update_student_streak(cur, user_id)

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "score": body.score,
            "total": total,
            "accuracy_pct": accuracy_pct,
            "passed": passed,
            "stars_earned": stars_earned,
            "star_rate": star_rate,
            "unlocked_medium": unlocked_medium,
            "unlocked_hard": unlocked_hard,
            "unlocked_next_lesson": unlocked_next_lesson,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/profile/{topic_id}")
def get_student_profile(user_id: int, topic_id: str):
    """Returns student's unlock state across all lesson groups for a topic."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Get all lesson groups for topic
        cur.execute(
            "SELECT id, title, order_index FROM lesson_groups WHERE topic_id = %s ORDER BY order_index ASC, id ASC",
            (topic_id,)
        )
        groups = cur.fetchall()

        lesson_progress = []
        for g in groups:
            cur.execute(
                "SELECT * FROM student_lesson_progress WHERE user_id = %s AND lesson_group_id = %s",
                (user_id, g["id"])
            )
            prog = cur.fetchone()
            lesson_progress.append({
                "lesson_group_id": g["id"],
                "title": g["title"],
                "order_index": g["order_index"],
                "easy_passed": prog["easy_passed"] if prog else False,
                "medium_passed": prog["medium_passed"] if prog else False,
                "hard_passed": prog["hard_passed"] if prog else False,
                "easy_best_score": prog["easy_best_score"] if prog else 0.0,
                "medium_best_score": prog["medium_best_score"] if prog else 0.0,
                "hard_best_score": prog["hard_best_score"] if prog else 0.0,
                "attempts_count": prog["attempts_count"] if prog else 0,
            })

        # Overall topic profile
        cur.execute(
            "SELECT * FROM student_profiles WHERE user_id = %s AND topic_id = %s",
            (user_id, topic_id)
        )
        profile = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "topic_id": topic_id,
            "overall": dict(profile) if profile else None,
            "lesson_progress": lesson_progress,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/report")
def get_student_report(user_id: int):
    """Returns full student performance report with real data."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Overall stats across all topics
        cur.execute(
            """SELECT
                COALESCE(SUM(total_stars), 0) as total_stars,
                COALESCE(AVG(avg_accuracy), 0) as overall_accuracy,
                COALESCE(SUM(quizzes_completed), 0) as quizzes_completed
               FROM student_profiles WHERE user_id = %s""",
            (user_id,)
        )
        overall = cur.fetchone()

        # Total time from attempts
        cur.execute(
            "SELECT COALESCE(SUM(time_spent_seconds), 0) as total_time FROM student_quiz_attempts WHERE user_id = %s AND completed_at IS NOT NULL",
            (user_id,)
        )
        time_row = cur.fetchone()

        # Per-topic breakdown
        cur.execute(
            "SELECT * FROM student_profiles WHERE user_id = %s ORDER BY topic_id",
            (user_id,)
        )
        profiles = cur.fetchall()

        topic_breakdown = []
        weak_topics = []
        for p in profiles:
            topic_breakdown.append({
                "topic_id": p["topic_id"],
                "knowledge_level": p["knowledge_level"],
                "avg_accuracy": round(p["avg_accuracy"], 1),
                "quizzes_done": p["quizzes_completed"],
                "total_stars": p["total_stars"],
            })
            if p["avg_accuracy"] < 70.0 and p["quizzes_completed"] > 0:
                weak_topics.append({
                    "topic_id": p["topic_id"],
                    "accuracy": round(p["avg_accuracy"], 1),
                    "level": p["knowledge_level"],
                })

        # Recent attempts (last 10)
        cur.execute(
            """SELECT a.id, a.score, a.total_questions, a.difficulty, a.time_spent_seconds,
                      a.completed_at, q.title as quiz_title
               FROM student_quiz_attempts a
               LEFT JOIN quizzes q ON a.quiz_id = q.id
               WHERE a.user_id = %s AND a.completed_at IS NOT NULL
               ORDER BY a.completed_at DESC LIMIT 50""",
            (user_id,)
        )
        recent = cur.fetchall()
        recent_attempts = []
        for r in recent:
            recent_attempts.append({
                "quiz_title": r["quiz_title"] or "Quiz",
                "score": r["score"],
                "total": r["total_questions"],
                "difficulty": r["difficulty"],
                "accuracy": round((r["score"] / r["total_questions"]) * 100, 1) if r["total_questions"] else 0,
                "time_spent_seconds": r["time_spent_seconds"],
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            })

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "total_stars": int(overall["total_stars"]),
            "overall_accuracy": round(float(overall["overall_accuracy"]), 1),
            "total_time_spent_seconds": int(time_row["total_time"]),
            "quizzes_completed": int(overall["quizzes_completed"]),
            "topic_breakdown": topic_breakdown,
            "weak_topics": weak_topics,
            "recent_attempts": recent_attempts,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/past-attempts")
def get_past_attempts(user_id: int):
    """Returns historical list of all completed quiz attempts with details."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """SELECT a.id, a.quiz_id, a.score, a.total_questions, a.difficulty, a.time_spent_seconds,
                      a.completed_at, q.title as quiz_title, q.topic_id
               FROM student_quiz_attempts a
               LEFT JOIN quizzes q ON a.quiz_id = q.id
               WHERE a.user_id = %s AND a.completed_at IS NOT NULL
               ORDER BY a.completed_at DESC""",
            (user_id,)
        )
        rows = cur.fetchall()

        attempts = []
        for r in rows:
            total_q = r["total_questions"] or 1
            accuracy = round((r["score"] / total_q) * 100, 1)
            attempts.append({
                "id": r["id"],
                "quiz_id": r["quiz_id"],
                "quiz_title": r["quiz_title"] or "Quiz",
                "topic_id": r["topic_id"] or "general",
                "difficulty": r["difficulty"] or "easy",
                "score": r["score"],
                "total_questions": total_q,
                "accuracy": accuracy,
                "time_spent_seconds": r["time_spent_seconds"] or 0,
                "completed_at": r["completed_at"].strftime("%b %d, %Y, %I:%M %p") if r["completed_at"] else "Unknown date",
            })

        cur.close()
        conn.close()
        return {"user_id": user_id, "attempts": attempts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/home-summary")
def get_home_summary(user_id: int):
    """Returns summarized stats and topic progresses for home screen."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Total Stars
        total_stars = _get_total_stars(cur, user_id)

        # 2. Streak
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        today = date.today()
        current_streak = streak_row["current_streak"] if streak_row else 0
        longest_streak = streak_row["longest_streak"] if streak_row else 0
        active_today = bool(streak_row and streak_row["last_activity_date"] == today)

        # 3. Topic progress: calculate passed lessons / total lessons per topic
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
            WHERE COALESCE(l.is_deleted, FALSE) = FALSE AND COALESCE(lg.is_deleted, FALSE) = FALSE
            GROUP BY lg.topic_id
        """, (user_id,))
        progress_rows = cur.fetchall()
        progress_by_topic = {}
        for r in progress_rows:
            tot = r["total_lessons"] or 0
            passed = r["passed_lessons"] or 0
            pct = round((passed / tot * 100), 1) if tot > 0 else 0.0
            progress_by_topic[r["topic_id"]] = pct

        cur.execute("SELECT * FROM student_profiles WHERE user_id = %s", (user_id,))
        profiles = cur.fetchall()
        stars_by_topic = {p["topic_id"]: p["total_stars"] for p in profiles}

        topics_list = []
        topics_map = {}
        all_topic_ids = set(list(progress_by_topic.keys()) + list(stars_by_topic.keys()))
        for tid in all_topic_ids:
            pct = progress_by_topic.get(tid, 0.0)
            stars = stars_by_topic.get(tid, 0)
            entry = {
                "topic_id": tid,
                "stars_earned": stars,
                "progress_pct": int(pct),
                "progress": int(pct),
                "stars": stars
            }
            topics_list.append(entry)
            topics_map[tid] = entry

        cur.close()
        conn.close()

        return {
            "user_id": user_id,
            "total_stars": total_stars,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "active_today": active_today,
            "topics": topics_list,
            "topic_map": topics_map
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 2: Knowledge Component (KC) Management ─────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/admin/kc/create")
def create_kc(req: KCCreateRequest):
    """Admin creates a Knowledge Component with BKT parameters."""
    if not req.name.strip() or not req.display_name.strip():
        raise HTTPException(status_code=400, detail="Name and display name are required.")
    for param_name, param_val in [("prior", req.prior), ("learns", req.learns), ("guesses", req.guesses), ("slips", req.slips)]:
        if param_val is None or not (0.01 <= param_val <= 0.95):
            raise HTTPException(status_code=400, detail=f"Parameter '{param_name}' must be between 0.01 and 0.95.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (name) DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   topic_id = EXCLUDED.topic_id,
                   prior = EXCLUDED.prior,
                   learns = EXCLUDED.learns,
                   guesses = EXCLUDED.guesses,
                   slips = EXCLUDED.slips
               RETURNING *""",
            (req.topic_id, req.name.strip().lower().replace(" ", "_"),
             req.display_name.strip(), req.prior, req.learns, req.guesses, req.slips)
        )
        kc = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "kc": kc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/kcs/{topic_id}")
def get_kcs(topic_id: str):
    """Returns all KCs for a topic."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM knowledge_components WHERE topic_id = %s ORDER BY name ASC",
            (topic_id,)
        )
        kcs = [dict(k) for k in cur.fetchall()]
        cur.close()
        conn.close()
        return kcs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/kcs")
def get_all_kcs():
    """Returns all KCs (all topics)."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM knowledge_components ORDER BY topic_id, name ASC")
        kcs = [dict(k) for k in cur.fetchall()]
        cur.close()
        conn.close()
        return kcs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/kc/{kc_name}")
def delete_kc(kc_name: str):
    """Deletes a KC (and all student mastery records for it, unlinking questions)."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE questions SET knowledge_component = NULL WHERE knowledge_component = %s", (kc_name,))
        cur.execute("DELETE FROM student_kc_mastery WHERE kc_name = %s", (kc_name,))
        cur.execute("DELETE FROM knowledge_components WHERE name = %s", (kc_name,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Admin User Management Endpoints ───────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/admin/users")
def get_admin_users():
    """Returns list of users with roles for Admin dashboard."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT id, name, username, COALESCE(role, 'student') as role,
                      created_at, avatar_url, last_avatar_changed_at
               FROM users
               ORDER BY CASE WHEN role = 'admin' THEN 1 WHEN role = 'teacher' THEN 2 ELSE 3 END, username ASC"""
        )
        users = [dict(u) for u in cur.fetchall()]
        cur.close()
        conn.close()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/users/create-teacher")
def create_teacher(req: CreateTeacherRequest):
    """Admin creates a verified Teacher account."""
    if not req.name.strip() or not req.username.strip() or not req.password.strip():
        raise HTTPException(status_code=400, detail="All fields are required.")
    if len(req.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    hashed = pwd_context.hash(req.password.strip())
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO users (name, username, password_hash, role) VALUES (%s, %s, %s, 'teacher') RETURNING id, name, username, role, created_at",
            (req.name.strip(), req.username.strip().lower(), hashed)
        )
        new_teacher = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user": new_teacher}
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Username already exists.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/role")
def update_user_role(user_id: int, req: UpdateUserRoleRequest):
    """Admin updates a user's role (admin, teacher, student). Root admin is protected."""
    if req.role not in ('admin', 'teacher', 'student'):
        raise HTTPException(status_code=400, detail="Role must be admin, teacher, or student.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, username FROM users WHERE id = %s", (user_id,))
        target_u = cur.fetchone()
        if not target_u:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found.")
        if target_u["username"] == "admin" and req.role != "admin":
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail="The root administrator account role cannot be changed.")

        cur.execute("UPDATE users SET role = %s WHERE id = %s", (req.role, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user_id": user_id, "role": req.role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/password")
def admin_reset_user_password(user_id: int, req: AdminResetPasswordRequest):
    """Admin resets or sets a user's password directly (hashed, no cleartext stored)."""
    if not req.password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty.")
    if len(req.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    hashed = pwd_context.hash(req.password.strip())
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hashed, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user_id": user_id, "message": "Password updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/users/{user_id}/delete")
@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, req: AdminDeleteUserRequest):
    """Admin permanently deletes a user account after verifying admin password."""
    admin_pwd = (req.admin_password or "").strip()
    if not admin_pwd:
        raise HTTPException(status_code=400, detail="Administrator password is required.")

    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        # 1. Verify administrator credentials
        cur.execute("SELECT id, username, password_hash, plain_password FROM users WHERE role = 'admin'")
        admin_rows = cur.fetchall()
        if not admin_rows:
            raise HTTPException(status_code=500, detail="No administrator account found in system.")

        matched_admin = None
        for a in admin_rows:
            if req.admin_id and a["id"] != req.admin_id:
                continue
            # Check plain password or hash
            if a.get("plain_password") == admin_pwd or pwd_context.verify(admin_pwd, a["password_hash"]):
                matched_admin = a
                break

        if not matched_admin:
            raise HTTPException(status_code=401, detail="Invalid administrator password. Account deletion unauthorized.")

        # 2. Check target user
        cur.execute("SELECT id, username, role FROM users WHERE id = %s", (user_id,))
        target_user = cur.fetchone()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found.")

        if target_user["username"] == "admin":
            raise HTTPException(status_code=403, detail="The root administrator account cannot be deleted.")

        if target_user["id"] == matched_admin["id"]:
            raise HTTPException(status_code=403, detail="You cannot delete your own active administrator account.")

        # 3. Clean up associated student/user records
        cur.execute("SELECT id FROM student_quiz_attempts WHERE user_id = %s", (user_id,))
        attempt_rows = cur.fetchall()
        attempt_ids = [r["id"] for r in attempt_rows]
        if attempt_ids:
            cur.execute("DELETE FROM student_question_answers WHERE attempt_id = ANY(%s)", (attempt_ids,))

        cur.execute("DELETE FROM student_quiz_attempts WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM student_lesson_progress WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM student_profiles WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM student_kc_mastery WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM student_streaks WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM daily_quiz_slots WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

        conn.commit()
        return {
            "success": True,
            "deleted_user_id": user_id,
            "username": target_user["username"],
            "message": f"User @{target_user['username']} and all associated records deleted successfully."
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/student/{user_id}/kc-mastery")
def get_student_kc_mastery(user_id: int, topic_id: Optional[str] = None):
    """
    Phase 2 — Interface Model: Returns all KC mastery levels for a student.
    Used by the Skill Tree screen. Shows P(mastery) for every KC the student
    has ever encountered, plus all registered KCs that the student hasn't tried yet
    (shown at their prior value).
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch all registered KCs (optionally filtered by topic)
        if topic_id:
            cur.execute(
                "SELECT * FROM knowledge_components WHERE topic_id = %s ORDER BY name ASC",
                (topic_id,)
            )
        else:
            cur.execute("SELECT * FROM knowledge_components ORDER BY topic_id, name ASC")
        all_kcs = cur.fetchall()

        # Fetch all student mastery records
        cur.execute(
            "SELECT kc_name, p_mastery, correct_count, wrong_count, total_opportunities FROM student_kc_mastery WHERE user_id = %s",
            (user_id,)
        )
        mastery_rows = {r["kc_name"]: dict(r) for r in cur.fetchall()}

        result = []
        for kc in all_kcs:
            student_data = mastery_rows.get(kc["name"])
            p_mastery = student_data["p_mastery"] if student_data else kc["prior"]
            total_opp = student_data["total_opportunities"] if student_data else 0
            correct = student_data["correct_count"] if student_data else 0
            wrong = student_data["wrong_count"] if student_data else 0

            # Mastery label for UI display
            if total_opp == 0:
                status = "not_started"
            elif p_mastery >= 0.70:
                status = "mastered"
            elif p_mastery >= 0.30:
                status = "learning"
            else:
                status = "struggling"

            result.append({
                "kc_name": kc["name"],
                "display_name": kc["display_name"],
                "topic_id": kc["topic_id"],
                "p_mastery": p_mastery,
                "p_mastery_pct": round(p_mastery * 100, 1),
                "status": status,
                "total_opportunities": total_opp,
                "correct_count": correct,
                "wrong_count": wrong,
                # BKT params (useful for debugging / admin view)
                "prior": kc["prior"],
                "learns": kc["learns"],
            })

        cur.close()
        conn.close()
        return {
            "user_id": user_id,
            "topic_id": topic_id,
            "kc_mastery": result,
            "total_kcs": len(result),
            "mastered": sum(1 for r in result if r["status"] == "mastered"),
            "learning": sum(1 for r in result if r["status"] == "learning"),
            "struggling": sum(1 for r in result if r["status"] == "struggling"),
            "not_started": sum(1 for r in result if r["status"] == "not_started"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ── Phase 2c: pyBKT Model Fitting Endpoint ──────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/admin/fit-bkt-model")
def fit_bkt_model(topic_id: Optional[str] = None):
    """
    Phase 2c — Uses the real pyBKT library to refit BKT parameters from actual student data.
    Reads all KC-tagged student answers -> runs pyBKT EM algorithm -> updates knowledge_components table.
    Should be run after collecting enough student answer data (recommended: 20+ answers per KC).
    """
    try:
        # Lazy import — so pyBKT does not slow down server startup
        from pyBKT.models import Model

        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # ── 1. Fetch all KC-tagged student answers from DB ──────────────────────
        base_query = """
            SELECT
                sqa2.user_id::text            AS user_id,
                q.knowledge_component         AS skill_name,
                CASE WHEN sqa.is_correct
                     THEN 1 ELSE 0 END        AS correct
            FROM student_question_answers sqa
            JOIN questions q            ON sqa.question_id = q.id
            JOIN student_quiz_attempts sqa2 ON sqa.attempt_id = sqa2.id
            WHERE q.knowledge_component IS NOT NULL
        """
        if topic_id:
            base_query += """
                AND q.quiz_id IN (
                    SELECT id FROM quizzes WHERE topic_id = %(topic_id)s
                )
            """
            cur.execute(base_query, {"topic_id": topic_id})
        else:
            cur.execute(base_query)

        rows = cur.fetchall()

        if len(rows) < 5:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough data. Found only {len(rows)} KC-tagged answers. "
                    "Need at least 5 (ideally 20+ per KC) for meaningful fitting."
                )
            )

        # ── 2. Build pandas DataFrame in pyBKT format ────────────────────────
        df = pd.DataFrame([
            {
                "user_id":    r["user_id"],
                "skill_name": r["skill_name"],
                "correct":    int(r["correct"]),
            }
            for r in rows
        ])

        # Only fit KCs that have at least 3 answers (pyBKT needs minimum data)
        kc_counts = df.groupby("skill_name").size()
        valid_kcs = kc_counts[kc_counts >= 3].index.tolist()

        if not valid_kcs:
            raise HTTPException(
                status_code=400,
                detail="Each KC needs at least 3 student answers to fit. Collect more data first."
            )

        df = df[df["skill_name"].isin(valid_kcs)].reset_index(drop=True)

        # ── 3. Run pyBKT EM fitting ───────────────────────────────────────
        bkt_model = Model(seed=42, num_fits=5)
        bkt_model.fit(data=df)

        # ── 4. Extract fitted parameters from pyBKT ─────────────────────────
        coef = bkt_model.coef_

        updated = []
        skipped = []

        for kc_name in valid_kcs:
            try:
                kc_params = coef.get(kc_name, {})
                prior   = float(kc_params.get("prior",   0.10))
                learns  = float(kc_params.get("learns",  0.20))
                guesses_raw = kc_params.get("guesses", [0.25])
                slips_raw   = kc_params.get("slips",   [0.10])
                guesses = float(guesses_raw[0]) if isinstance(guesses_raw, (list, tuple)) else float(guesses_raw)
                slips   = float(slips_raw[0])   if isinstance(slips_raw,   (list, tuple)) else float(slips_raw)

                # Clamp to valid BKT ranges
                prior   = round(min(0.95, max(0.01, prior)),   4)
                learns  = round(min(0.99, max(0.01, learns)),  4)
                guesses = round(min(0.49, max(0.01, guesses)), 4)
                slips   = round(min(0.49, max(0.01, slips)),   4)

                cur.execute(
                    """UPDATE knowledge_components
                       SET prior = %s, learns = %s, guesses = %s, slips = %s
                       WHERE name = %s""",
                    (prior, learns, guesses, slips, kc_name)
                )
                updated.append({
                    "kc_name": kc_name,
                    "prior":   prior,
                    "learns":  learns,
                    "guesses": guesses,
                    "slips":   slips,
                    "answers_used": int(kc_counts[kc_name]),
                })
            except Exception as ex:
                skipped.append({"kc_name": kc_name, "reason": str(ex)})

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success":            True,
            "message":            f"pyBKT model fitted. {len(updated)} KC(s) updated, {len(skipped)} skipped.",
            "total_answers_used": len(rows),
            "updated_kcs":        updated,
            "skipped_kcs":        skipped,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"pyBKT fitting failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Streak Endpoints ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/student/{user_id}/streak")
def get_streak(user_id: int):
    """Returns current streak, longest streak, burnout status, repair eligibility and total stars."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        total_stars = _get_total_stars(cur, user_id)
        cur.close()
        conn.close()
        today = date.today()
        if not row:
            return {
                "user_id": user_id, "current_streak": 0, "longest_streak": 0,
                "last_activity_date": None, "can_repair": False,
                "repair_cost": 30, "pre_break_streak": 0, "total_stars": total_stars,
                "active_today": False, "streak_broken": False,
            }
        
        last = row["last_activity_date"]
        current = row["current_streak"] or 0
        pre_break = row["pre_break_streak"] or 0
        active_today = (last == today)
        
        # Burnout detection:
        # A streak is broken if pre_break_streak > 0, OR if last activity was strictly before yesterday and current > 0
        is_broken = False
        broken_amount = pre_break
        if pre_break > 0:
            is_broken = True
        elif last and last < (today - timedelta(days=1)) and current > 0:
            is_broken = True
            broken_amount = current
            
        can_repair = is_broken and broken_amount > 0 and total_stars >= 30

        return {
            "user_id": user_id,
            "current_streak": current,
            "longest_streak": row["longest_streak"] or 0,
            "last_activity_date": str(last) if last else None,
            "pre_break_streak": broken_amount,
            "can_repair": can_repair,
            "streak_broken": is_broken,
            "repair_cost": 30,
            "total_stars": total_stars,
            "active_today": active_today,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/student/{user_id}/repair-streak")
def repair_streak(user_id: int):
    """Spends 30 stars to restore the student's pre-break streak."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM student_streaks WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        today = date.today()
        if not row:
            raise HTTPException(status_code=400, detail="No streak to repair.")
        
        pre_break = row["pre_break_streak"] or 0
        current = row["current_streak"] or 0
        last = row["last_activity_date"]

        restored = 0
        if pre_break > 0:
            restored = pre_break
        elif last and last < (today - timedelta(days=1)) and current > 0:
            restored = current

        if restored <= 0:
            raise HTTPException(status_code=400, detail="No broken streak to repair.")

        total_stars = _get_total_stars(cur, user_id)
        if total_stars < 30:
            raise HTTPException(status_code=400, detail="Not enough stars. Need 30 stars to repair streak.")

        _deduct_stars(cur, user_id, 30)
        # Restore current streak and set last_activity_date to yesterday so next quiz today can increment it!
        cur.execute(
            """UPDATE student_streaks
               SET current_streak = %s, pre_break_streak = 0, last_activity_date = %s, updated_at = NOW()
               WHERE user_id = %s""",
            (restored, today - timedelta(days=1), user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "restored_streak": restored, "stars_spent": 30}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Daily Missions Persistent Endpoints ────────────────────────────────────────

class MissionClaimRequest(BaseModel):
    mission_id: str
    stars_reward: int = 10
    client_date: Optional[str] = None

@app.get("/student/{user_id}/daily-missions")
def get_daily_missions(user_id: int, client_date: Optional[str] = None):
    """Returns today's claimed daily missions and real mission progress for the student."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        target_date = client_date if client_date else str(date.today())
        cur.execute(
            "SELECT mission_id, claimed, stars_earned FROM student_daily_missions WHERE user_id = %s AND (mission_date = %s OR mission_date = %s)",
            (user_id, target_date, date.today())
        )
        rows = cur.fetchall()
        claimed = {r["mission_id"]: True for r in rows if r["claimed"]}

        # Check daily quizzes done today
        cur.execute(
            "SELECT COUNT(*) as cnt FROM daily_quiz_slots WHERE user_id = %s AND (slot_date = %s OR slot_date = %s) AND completed = TRUE",
            (user_id, target_date, date.today())
        )
        q_row = cur.fetchone()
        daily_quizzes_done = q_row["cnt"] if q_row else 0

        # Check story lessons / quizzes completed today
        cur.execute(
            """SELECT COUNT(*) as cnt FROM student_quiz_attempts 
               WHERE user_id = %s AND (DATE(started_at) = %s OR DATE(started_at) = %s) AND completed_at IS NOT NULL""",
            (user_id, target_date, date.today())
        )
        s_row = cur.fetchone()
        story_done = s_row["cnt"] if s_row else 0

        total_stars = _get_total_stars(cur, user_id)
        cur.close()
        conn.close()
        return {
            "user_id": user_id,
            "date": str(target_date),
            "claimed_missions": claimed,
            "progress": {
                "story": 1 if story_done > 0 else 0,
                "quiz": 1 if daily_quizzes_done > 0 else 0,
            },
            "total_stars": total_stars
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


VALID_DAILY_MISSIONS = {
    "story": 10,
    "quiz": 15,
    "flashcards": 10,
}

@app.post("/student/{user_id}/daily-missions/claim")
def claim_daily_mission(user_id: int, req: MissionClaimRequest):
    """Claims a daily mission, persists it to DB, and permanently awards verified stars to student profile."""
    if req.mission_id not in VALID_DAILY_MISSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid mission ID '{req.mission_id}'.")

    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = req.client_date if req.client_date else date.today()
        
        # Check if already claimed today (checks client date and server date for timezone tolerance)
        cur.execute(
            "SELECT * FROM student_daily_missions WHERE user_id = %s AND (mission_date = %s OR mission_date = %s) AND mission_id = %s",
            (user_id, today, date.today(), req.mission_id)
        )
        existing = cur.fetchone()
        if existing and existing["claimed"]:
            total_stars = _get_total_stars(cur, user_id)
            cur.close()
            conn.close()
            return {
                "success": True,
                "already_claimed": True,
                "mission_id": req.mission_id,
                "stars_earned": existing["stars_earned"],
                "total_stars": total_stars,
                "message": "Mission already claimed today."
            }

        # Server-side mission completion verification
        if req.mission_id == "quiz":
            cur.execute(
                "SELECT COUNT(*) as cnt FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND completed = TRUE",
                (user_id, today)
            )
            quiz_done = cur.fetchone()["cnt"]
            if quiz_done == 0:
                cur.execute(
                    "SELECT COUNT(*) as cnt FROM student_quiz_attempts WHERE user_id = %s AND DATE(created_at) = %s AND score >= 1",
                    (user_id, today)
                )
                quiz_done = cur.fetchone()["cnt"]
            if quiz_done == 0:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail="Daily quiz mission requirement not yet met. Please pass at least 1 quiz.")
        elif req.mission_id == "story":
            # Story Explorer mission: Reading story slides qualifies for daily claim.
            # student_daily_missions table has UNIQUE(user_id, mission_date, mission_id)
            # which strictly prevents claiming more than once per day.
            pass

        # Fixed server-side reward (never trust client-supplied stars)
        verified_reward = VALID_DAILY_MISSIONS[req.mission_id]

        # Insert mission claim
        cur.execute(
            """INSERT INTO student_daily_missions (user_id, mission_date, mission_id, claimed, stars_earned)
               VALUES (%s, %s, %s, TRUE, %s)
               ON CONFLICT (user_id, mission_date, mission_id)
               DO UPDATE SET claimed = TRUE, stars_earned = EXCLUDED.stars_earned""",
            (user_id, today, req.mission_id, verified_reward)
        )

        # Permanently award stars into student_profiles
        _add_stars(cur, user_id, verified_reward)
        
        conn.commit()
        total_stars = _get_total_stars(cur, user_id)
        cur.close()
        conn.close()

        return {
            "success": True,
            "mission_id": req.mission_id,
            "stars_reward": verified_reward,
            "total_stars": total_stars
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Hint Endpoint ────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

SERVER_KC_SCAFFOLDING = {
    "setting": {
        "en": "Setting requires a location (WHERE) or time (WHEN). This choice does not tell where or when the story happened.",
        "asl": "SETTING MUST BE PLACE OR TIME. THIS CHOICE NOT PLACE/TIME."
    },
    "character": {
        "en": "A character must be a person or animal who takes action in the story. This choice is not an actor.",
        "asl": "CHARACTER MUST BE PERSON OR ANIMAL. THIS CHOICE NOT ACTOR."
    },
    "characters": {
        "en": "Characters must be people or animals who take action in the story. This choice is not an actor.",
        "asl": "CHARACTERS MUST BE PEOPLE OR ANIMALS. THIS CHOICE NOT ACTOR."
    },
    "initiating_event": {
        "en": "The initiating event is the problem or trouble that starts the story. This choice is not the conflict.",
        "asl": "INITIATING EVENT MEAN TROUBLE START STORY. THIS CHOICE NOT TROUBLE."
    },
    "problem": {
        "en": "A problem is the conflict or trouble in the story. This choice does not describe what went wrong.",
        "asl": "PROBLEM MEAN TROUBLE / CONFLICT. THIS CHOICE NOT TROUBLE."
    },
    "attempt": {
        "en": "An attempt is what the character does to try to fix the problem. This choice is not an action step.",
        "asl": "ATTEMPT MEAN ACTION TO FIX PROBLEM. THIS CHOICE NOT ACTION."
    },
    "action": {
        "en": "An action describes what the character does. This choice does not describe an action step.",
        "asl": "ACTION MEAN CHARACTER DO SOMETHING. THIS CHOICE NOT ACTION."
    },
    "internal_response": {
        "en": "An internal response describes feelings or thoughts. This choice is not an emotion or thought.",
        "asl": "INTERNAL RESPONSE MEAN FEELING OR THOUGHT. THIS CHOICE NOT FEELING."
    },
    "emotion": {
        "en": "This question asks for an emotion. This choice does not describe how the character feels.",
        "asl": "QUESTION ASK EMOTION. THIS CHOICE NOT FEELING."
    },
    "consequence": {
        "en": "A consequence shows the outcome or ending. This choice does not show how the story finished.",
        "asl": "CONSEQUENCE MEAN OUTCOME / ENDING. THIS CHOICE NOT RESULT."
    },
    "resolution": {
        "en": "A resolution describes how the problem was solved. This choice does not show the fix or outcome.",
        "asl": "RESOLUTION SHOW PROBLEM FIXED. THIS CHOICE NOT SHOW FIX."
    },
    "reaction": {
        "en": "A reaction shows the final reflection or lesson learned. This choice is not a final reaction.",
        "asl": "REACTION MEAN FINAL FEELING OR LESSON. THIS CHOICE NOT REACTION."
    },
    "vocabulary": {
        "en": "This question asks for the meaning of a key word. This choice does not fit the sentence context.",
        "asl": "QUESTION ASK WORD MEANING. THIS CHOICE NOT FIT CONTEXT."
    }
}

class HintRequest(BaseModel):
    user_id: int
    question_id: Optional[int] = None
    attempt_id: Optional[int] = None
    topic_id: Optional[str] = None

@app.post("/quiz/session/use-hint")
def use_hint(req: HintRequest):
    """
    Hybrid 2-Tier Hint Scaffolding:
    Deducts 5 stars, selects one distractor to eliminate, and returns:
    - Tier 1: Teacher custom hint (if authored in Admin panel)
    - Tier 2: Automated KC Criterion-Referenced Invalidation (English + ASL Gloss)
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        total_stars = _get_total_stars(cur, req.user_id)
        if total_stars < 5:
            raise HTTPException(status_code=400, detail="Not enough stars. Need 5 stars to use a hint.")

        target_q_id = req.question_id
        if not target_q_id and req.attempt_id:
            cur.execute("SELECT question_ids FROM student_quiz_attempts WHERE id = %s", (req.attempt_id,))
            att = cur.fetchone()
            if att and att.get("question_ids") and len(att["question_ids"]) > 0:
                target_q_id = att["question_ids"][0]

        if not target_q_id:
            raise HTTPException(status_code=400, detail="question_id is required.")

        cur.execute(
            """SELECT id, question_text, correct_option_letter, question_type, 
                      knowledge_component, hint 
               FROM questions WHERE id = %s""",
            (target_q_id,)
        )
        q = cur.fetchone()
        if not q:
            raise HTTPException(status_code=404, detail="Question not found.")

        _deduct_stars(cur, req.user_id, 5, req.topic_id)
        conn.commit()

        # Fetch options to select a distractor
        cur.execute(
            "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
            (target_q_id,)
        )
        opts = cur.fetchall()

        correct_letter = (q.get("correct_option_letter") or "A").upper()
        wrong_opts = [o for o in opts if o["option_letter"].upper() != correct_letter]

        eliminated_opt = None
        eliminated_idx = None
        if wrong_opts:
            import random
            eliminated_opt = random.choice(wrong_opts)
            for idx, o in enumerate(opts):
                if o["option_letter"] == eliminated_opt["option_letter"]:
                    eliminated_idx = idx
                    break

        # Tier 1: Teacher custom hint
        teacher_hint = (q.get("hint") or "").strip()
        has_custom_hint = bool(teacher_hint and not teacher_hint.startswith("Think carefully") and not teacher_hint.startswith("Look closely"))

        # Tier 2: Automated KC Scaffolding with prefix stripping and question awareness
        raw_kc = (q.get("knowledge_component") or "general").lower().replace("kc_story_", "").replace("kc_", "").replace(" ", "_").replace("-", "_")
        q_text = (q.get("question_text") or "").strip()
        q_lower = q_text.lower()
        opt_text = (eliminated_opt["option_text"] if eliminated_opt else "").strip()
        opt_lower = opt_text.lower()

        # Extract subject from question
        import re
        subj_match = re.search(r'(?:does|did|is|was|will)\s+([A-Z][a-z]+)', q_text)
        subject = subj_match.group(1) if subj_match else "the character"

        if has_custom_hint:
            reason_en = teacher_hint
            reason_asl = teacher_hint.upper()
            tier = 1
        elif raw_kc == "setting" or q_lower.startswith("where") or q_lower.startswith("when"):
            is_place = any(opt_lower.startswith(p) for p in ["in ", "at ", "on ", "under ", "inside ", "behind "])
            if is_place:
                reason_en = f"In the story, {subject} does not start or play '{opt_text}'. Look for where the adventure actually began."
                reason_asl = f"{subject.upper()} NOT AT '{opt_text.upper()}' IN STORY. LOOK WHERE STORY BEGINS."
            else:
                reason_en = f"Setting requires a location (WHERE) or time (WHEN). '{opt_text}' does not tell where or when."
                reason_asl = f"SETTING MEAN PLACE OR TIME. '{opt_text.upper()}' NOT PLACE."
            tier = 2
        elif raw_kc in ["character", "characters"] or q_lower.startswith("who"):
            reason_en = f"In the story, '{opt_text}' is not the character who did this. Look for who took action."
            reason_asl = f"'{opt_text.upper()}' NOT THE CHARACTER. LOOK WHO DO ACTION."
            tier = 2
        elif raw_kc in ["initiating_event", "problem"] or "problem" in q_lower or "trouble" in q_lower:
            reason_en = f"'{opt_text}' was not the conflict or problem that started the trouble in the story."
            reason_asl = f"'{opt_text.upper()}' NOT THE TROUBLE IN STORY."
            tier = 2
        elif raw_kc in ["resolution", "consequence"] or "end" in q_lower or "solve" in q_lower:
            reason_en = f"'{opt_text}' is not how the story ended or how the problem was resolved."
            reason_asl = f"'{opt_text.upper()}' NOT HOW STORY END OR FIX."
            tier = 2
        else:
            kc_scaffold = SERVER_KC_SCAFFOLDING.get(raw_kc, {
                "en": f"In the story, '{opt_text}' does not match what the question is asking.",
                "asl": f"CHOICE '{opt_text.upper()}' NOT FIT STORY."
            })
            reason_en = f"Eliminated: {kc_scaffold['en']}"
            reason_asl = kc_scaffold["asl"]
            tier = 2

        cur.close()
        conn.close()

        return {
            "success": True,
            "stars_spent": 5,
            "hint": reason_en,
            "reason_en": reason_en,
            "reason_asl": reason_asl,
            "tier": tier,
            "eliminated_option_letter": eliminated_opt["option_letter"] if eliminated_opt else None,
            "eliminated_option_idx": eliminated_idx,
            "eliminated_option_text": eliminated_opt["option_text"] if eliminated_opt else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 3: Daily Quizzes Endpoints ─────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

DAILY_STAR_REWARDS = {"easy": 10, "medium": 20, "hard": 30}
DAILY_FULL_CLEAR_BONUS = 25
DAILY_REFRESH_COST = 5

def _pick_quiz_for_slot(cur, user_id: int, difficulty: str, exclude_quiz_id: int = None):
    """
    Pick a daily quiz slot for the user.
    Uses unlocked/taken lessons. Fallback to any quizzes if there are no lesson groups or not enough quizzes.
    """
    # 1. Get lesson groups they have completed/passed or taken
    cur.execute(
        "SELECT lesson_group_id, easy_passed, medium_passed, hard_passed FROM student_lesson_progress WHERE user_id = %s",
        (user_id,)
    )
    progress_rows = cur.fetchall()
    taken_groups = [r["lesson_group_id"] for r in progress_rows]
    easy_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["easy_passed"]]
    medium_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["medium_passed"]]
    hard_passed_groups = [r["lesson_group_id"] for r in progress_rows if r["hard_passed"]]

    # Decide target difficulty based on what they have unlocked.
    # If they want Hard but have not passed Medium, fallback to Medium.
    # If they want Medium but have not passed Easy, fallback to Easy.
    target_difficulty = difficulty
    if difficulty == "hard" and not medium_passed_groups:
        target_difficulty = "medium"
    if target_difficulty == "medium" and not easy_passed_groups:
        target_difficulty = "easy"

    # Decide which lesson groups to target
    target_groups = []
    if target_difficulty == "hard":
        target_groups = medium_passed_groups
    elif target_difficulty == "medium":
        target_groups = easy_passed_groups
    else: # easy
        target_groups = taken_groups if taken_groups else easy_passed_groups

    # Helper function to query a quiz
    def run_query(use_exclude: bool, use_groups: bool, use_difficulty: bool, diff_val: str):
        where_clauses = []
        params = []
        
        if use_difficulty:
            where_clauses.append("q.difficulty = %s")
            params.append(diff_val)
            
        if use_groups and target_groups:
            where_clauses.append("l.lesson_group_id = ANY(%s)")
            params.append(target_groups)
            
        if use_exclude and exclude_quiz_id is not None:
            where_clauses.append("q.id != %s")
            params.append(exclude_quiz_id)
            
        where_str = " AND ".join(where_clauses)
        if where_str:
            where_str = "WHERE " + where_str
            
        query = f"""
            SELECT q.id, l.lesson_group_id 
            FROM quizzes q 
            LEFT JOIN lessons l ON q.lesson_id = l.id 
            {where_str} 
            ORDER BY RANDOM() LIMIT 1
        """
        cur.execute(query, params)
        return cur.fetchone()

    # Search strategy sequence:
    for excl in [True, False]:
        if excl and exclude_quiz_id is None:
            continue
            
        # Try 1: matching difficulty and target groups
        row = run_query(use_exclude=excl, use_groups=True, use_difficulty=True, diff_val=target_difficulty)
        if row and row["id"]: return row["id"], row["lesson_group_id"]
        
        # Try 2: matching difficulty, ignore group filter
        row = run_query(use_exclude=excl, use_groups=False, use_difficulty=True, diff_val=target_difficulty)
        if row and row["id"]: return row["id"], row["lesson_group_id"]

        # Try 3: ignore difficulty, ignore group filter (any quiz in system)
        row = run_query(use_exclude=excl, use_groups=False, use_difficulty=False, diff_val="")
        if row and row["id"]: return row["id"], row["lesson_group_id"]

    return None, None


@app.get("/daily-quizzes/{user_id}")
def get_daily_quizzes(user_id: int, client_date: Optional[str] = None):
    """Returns today's 3 daily quiz slots for the student."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = client_date if client_date else date.today()
        total_stars = _get_total_stars(cur, user_id)
        slots = []
        for diff in ["easy", "medium", "hard"]:
            cur.execute(
                "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
                (user_id, today, diff)
            )
            slot = cur.fetchone()
            if not slot:
                quiz_id, lg_id = _pick_quiz_for_slot(cur, user_id, diff)
                cur.execute(
                    "INSERT INTO daily_quiz_slots (user_id, slot_date, slot_difficulty, quiz_id, lesson_group_id) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, slot_date, slot_difficulty) DO NOTHING RETURNING *",
                    (user_id, today, diff, quiz_id, lg_id)
                )
                slot = cur.fetchone()
                if not slot:
                    cur.execute(
                        "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
                        (user_id, today, diff)
                    )
                    slot = cur.fetchone()
            quiz_title = None
            if slot and slot["quiz_id"]:
                cur.execute("SELECT title FROM quizzes WHERE id = %s", (slot["quiz_id"],))
                qt = cur.fetchone()
                quiz_title = qt["title"] if qt else None
            slots.append({
                "slot_difficulty": diff,
                "quiz_id": slot["quiz_id"] if slot else None,
                "quiz_title": quiz_title,
                "completed": slot["completed"] if slot else False,
                "refresh_used": slot["refresh_used"] if slot else False,
                "stars_earned": slot["stars_earned"] if slot else 0,
                "can_refresh": not (slot["refresh_used"] if slot else True),
                "refresh_cost": DAILY_REFRESH_COST,
                "slot_reward": DAILY_STAR_REWARDS.get(diff, 10),
            })
        conn.commit()
        completed_count = sum(1 for s in slots if s["completed"])
        cur.close()
        conn.close()
        return {
            "user_id": user_id, "date": str(today), "slots": slots,
            "completed_count": completed_count,
            "full_clear_bonus": DAILY_FULL_CLEAR_BONUS,
            "full_clear_achieved": completed_count == 3,
            "total_stars": total_stars,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DailyRefreshRequest(BaseModel):
    slot_difficulty: str
    topic_id: Optional[str] = None

@app.post("/daily-quizzes/{user_id}/refresh")
def refresh_daily_slot(user_id: int, req: DailyRefreshRequest):
    """Spends 5 stars to reroll the quiz for a daily slot (max 1 per slot/day)."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
        cur.execute(
            "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (user_id, today, req.slot_difficulty)
        )
        slot = cur.fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found.")
        if slot["refresh_used"]:
            raise HTTPException(status_code=400, detail="Refresh already used for this slot today.")
        if slot["completed"]:
            raise HTTPException(status_code=400, detail="Slot already completed.")
        total_stars = _get_total_stars(cur, user_id)
        if total_stars < DAILY_REFRESH_COST:
            raise HTTPException(status_code=400, detail=f"Need {DAILY_REFRESH_COST} stars to refresh.")
        _deduct_stars(cur, user_id, DAILY_REFRESH_COST, req.topic_id)
        new_quiz_id, new_lg_id = _pick_quiz_for_slot(cur, user_id, req.slot_difficulty, slot["quiz_id"])
        cur.execute(
            "UPDATE daily_quiz_slots SET quiz_id = %s, lesson_group_id = %s, refresh_used = TRUE WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (new_quiz_id, new_lg_id, user_id, today, req.slot_difficulty)
        )
        conn.commit()
        quiz_title = None
        if new_quiz_id:
            cur.execute("SELECT title FROM quizzes WHERE id = %s", (new_quiz_id,))
            qt = cur.fetchone()
            quiz_title = qt["title"] if qt else None
        cur.close()
        conn.close()
        return {"success": True, "new_quiz_id": new_quiz_id, "new_quiz_title": quiz_title, "stars_spent": DAILY_REFRESH_COST}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DailyCompleteRequest(BaseModel):
    slot_difficulty: str
    score: int
    total_questions: int
    time_spent_seconds: int = 0
    topic_id: Optional[str] = None

@app.post("/daily-quizzes/{user_id}/complete")
def complete_daily_quiz(user_id: int, req: DailyCompleteRequest):
    """Marks a daily slot as complete, awards stars, updates streak, grants full clear bonus if all 3 done."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
        cur.execute(
            "SELECT * FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (user_id, today, req.slot_difficulty)
        )
        slot = cur.fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Daily quiz slot not found.")
        if slot["completed"]:
            return {"success": True, "message": "Already completed.", "stars_earned": slot["stars_earned"]}
        total = max(req.total_questions, 1)
        accuracy = (req.score / total) * 100
        passed = accuracy >= 70.0
        if not passed:
            cur.close()
            conn.close()
            return {
                "success": True,
                "passed": False,
                "message": "Quiz attempt below 70%. Retry to pass!",
                "accuracy_pct": round(accuracy, 1),
                "stars_earned": 0,
                "bonus_awarded": False,
                "bonus_stars": 0,
            }
        slot_stars = DAILY_STAR_REWARDS.get(req.slot_difficulty, 10)
        cur.execute(
            "UPDATE daily_quiz_slots SET completed = TRUE, stars_earned = %s WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (slot_stars, user_id, today, req.slot_difficulty)
        )
        if slot_stars > 0:
            _add_stars(cur, user_id, slot_stars, req.topic_id or "general")
        _update_student_streak(cur, user_id)
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND completed = TRUE",
            (user_id, today)
        )
        completed_count = cur.fetchone()["cnt"]
        bonus_awarded = False
        if completed_count == 3:
            bonus_awarded = True
            _add_stars(cur, user_id, DAILY_FULL_CLEAR_BONUS, req.topic_id or "general")
        conn.commit()
        cur.close()
        conn.close()
        return {
            "success": True, "passed": passed,
            "accuracy_pct": round(accuracy, 1), "stars_earned": slot_stars,
            "bonus_awarded": bonus_awarded,
            "bonus_stars": DAILY_FULL_CLEAR_BONUS if bonus_awarded else 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Translation endpoint ────────────────────────────────══════════════════════
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/translate/status")
def get_translation_status():
    return {
        "neural_enabled_env": os.getenv("ENABLE_NEURAL_MBART", "0") == "1",
        "neural_model_loaded": (model is not None and tokenizer is not None),
        "model_loading": model_loading,
        "model_repo": MODEL_REPO,
        "local_model_exists": os.path.exists(LOCAL_MODEL_PATH),
        "cached_memory_entries": len(_TRANSLATION_MEMORY_CACHE),
    }

@app.post("/translate/mbart/load")
def trigger_load_mbart():
    global model, tokenizer, model_loading
    if model is not None and tokenizer is not None:
        return {"status": "already_loaded", "message": "mBART-50 LoRA is already loaded and ready."}
    if model_loading:
        return {"status": "loading", "message": "mBART-50 LoRA is currently loading in the background."}
    threading.Thread(target=_load_mbart_model, daemon=True).start()
    return {"status": "started", "message": "Triggered background loading of mBART-50 LoRA."}

class CompareRequest(BaseModel):
    text: str
    direction: str = "en_to_asl"

@app.post("/translate/test-compare")
def test_compare_translation(req: CompareRequest):
    req_text = (req.text or "").strip()
    if not req_text:
        return {"error": "Empty text"}
    
    # 1. Linguistic Rule Engine
    t_rule_0 = time.time()
    rule_res = rule_based_asl_gloss(req_text) if req.direction == "en_to_asl" else rule_based_asl_to_english(req_text)
    rule_ms = round((time.time() - t_rule_0) * 1000, 2)

    # 2. Neural mBART-50 LoRA Engine
    neural_res = None
    neural_ms = 0
    neural_loaded = (model is not None and tokenizer is not None)
    if not neural_loaded and not model_loading:
        _load_mbart_model()
        neural_loaded = (model is not None and tokenizer is not None)

    if neural_loaded:
        t_neural_0 = time.time()
        try:
            import torch
            with torch.inference_mode():
                if req.direction == "en_to_asl":
                    tokenizer.src_lang = "en_XX"
                    inputs = tokenizer(req_text, return_tensors="pt", max_length=128, truncation=True)
                    out = model.generate(
                        **inputs,
                        forced_bos_token_id=tokenizer.convert_tokens_to_ids("asl_GL"),
                        max_new_tokens=64,
                        num_beams=1
                    )
                    neural_res = tokenizer.decode(out[0], skip_special_tokens=True)
                else:
                    tokenizer.src_lang = "asl_GL"
                    inputs = tokenizer(req_text, return_tensors="pt", max_length=128, truncation=True)
                    out = model.generate(
                        **inputs,
                        forced_bos_token_id=tokenizer.convert_tokens_to_ids("en_XX"),
                        max_new_tokens=64,
                        num_beams=1
                    )
                    neural_res = tokenizer.decode(out[0], skip_special_tokens=True)
            neural_ms = round((time.time() - t_neural_0) * 1000, 1)
        except Exception as e:
            neural_res = f"Error during generation: {e}"

    return {
        "input": req_text,
        "direction": req.direction,
        "linguistic_rule": {
            "result": rule_res,
            "latency_ms": rule_ms
        },
        "neural_mbart": {
            "result": neural_res,
            "latency_ms": neural_ms,
            "loaded": neural_loaded
        }
    }


@app.post("/translate")
def translate_text(request: TranslationRequest):
    req_text = (request.text or "").strip()
    if not req_text:
        return {"result": "", "direction": request.direction, "engine": "none"}

    t_start = time.time()
    force_eng = (request.force_engine or "").lower().strip()

    # If force_engine == "rule", directly run linguistic grammar engine
    if force_eng == "rule":
        text_res = rule_based_asl_gloss(req_text) if request.direction == "en_to_asl" else rule_based_asl_to_english(req_text)
        elapsed_ms = round((time.time() - t_start) * 1000, 1)
        return {
            "result": text_res,
            "direction": request.direction,
            "engine": "linguistic-rule",
            "latency_ms": elapsed_ms,
            "neural": False
        }

    # If force_engine == "neural", force neural loading and inference (bypass cache)
    if force_eng == "neural":
        if not tokenizer or not model:
            if not model_loading:
                _load_mbart_model()
            if not tokenizer or not model:
                text_res = rule_based_asl_gloss(req_text) if request.direction == "en_to_asl" else rule_based_asl_to_english(req_text)
                elapsed_ms = round((time.time() - t_start) * 1000, 1)
                return {
                    "result": text_res,
                    "direction": request.direction,
                    "engine": "linguistic-rule (neural loading)",
                    "latency_ms": elapsed_ms,
                    "note": "mBART model is still loading weights into memory. Please retry in 10-20 seconds.",
                    "neural": False
                }

    # Standard Cache Lookup (only when not forcing neural)
    if force_eng != "neural":
        cache_key = (req_text, request.direction)
        with _TRANSLATION_LOCK:
            if cache_key in _TRANSLATION_MEMORY_CACHE:
                elapsed_ms = round((time.time() - t_start) * 1000, 1)
                return {
                    "result": _TRANSLATION_MEMORY_CACHE[cache_key],
                    "direction": request.direction,
                    "cached": True,
                    "engine": "cache",
                    "latency_ms": elapsed_ms
                }

        try:
            conn = get_db()
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                "SELECT translated_text FROM translations_cache WHERE source_text = %s AND direction = %s LIMIT 1",
                (req_text, request.direction)
            )
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row and row.get("translated_text"):
                cached_result = row["translated_text"]
                with _TRANSLATION_LOCK:
                    if len(_TRANSLATION_MEMORY_CACHE) >= _MAX_TRANSLATION_CACHE:
                        _TRANSLATION_MEMORY_CACHE.clear()
                    _TRANSLATION_MEMORY_CACHE[cache_key] = cached_result
                elapsed_ms = round((time.time() - t_start) * 1000, 1)
                return {
                    "result": cached_result,
                    "direction": request.direction,
                    "cached": True,
                    "engine": "cache",
                    "latency_ms": elapsed_ms
                }
        except Exception:
            pass

    # Fallback to linguistic rule engine if model is not loaded
    if not tokenizer or not model:
        if not model_loading and os.getenv("ENABLE_NEURAL_MBART", "0") == "1":
            threading.Thread(target=_load_mbart_model, daemon=True).start()
        text_res = rule_based_asl_gloss(req_text) if request.direction == "en_to_asl" else rule_based_asl_to_english(req_text)
        elapsed_ms = round((time.time() - t_start) * 1000, 1)
        return {
            "result": text_res,
            "direction": request.direction,
            "fallback": True,
            "engine": "linguistic-rule",
            "latency_ms": elapsed_ms,
            "neural": False
        }

    # Neural generation under torch.inference_mode()
    import torch
    max_tokens = 32 if len(req_text.split()) <= 15 else 64
    active_engine = "mbart-50-lora"

    try:
        with torch.inference_mode():
            if request.direction == "en_to_asl":
                tokenizer.src_lang = "en_XX"
                inputs = tokenizer(
                    req_text,
                    return_tensors="pt",
                    max_length=128,
                    truncation=True,
                )
                out = model.generate(
                    **inputs,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids("asl_GL"),
                    max_new_tokens=max_tokens,
                    num_beams=1,
                )
                result = tokenizer.decode(out[0], skip_special_tokens=True)
            elif request.direction == "asl_to_en":
                tokenizer.src_lang = "asl_GL"
                inputs = tokenizer(
                    req_text,
                    return_tensors="pt",
                    max_length=128,
                    truncation=True,
                )
                out = model.generate(
                    **inputs,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids("en_XX"),
                    max_new_tokens=max_tokens,
                    num_beams=1,
                )
                result = tokenizer.decode(out[0], skip_special_tokens=True)
            else:
                return {"error": "Invalid direction. Use 'en_to_asl' or 'asl_to_en'."}
    except Exception as gen_err:
        print(f"[Translation] Neural generation fallback: {gen_err}")
        result = rule_based_asl_gloss(req_text) if request.direction == "en_to_asl" else rule_based_asl_to_english(req_text)
        active_engine = "linguistic-rule (fallback)"

    # Populate in-memory cache
    cache_key = (req_text, request.direction)
    with _TRANSLATION_LOCK:
        if len(_TRANSLATION_MEMORY_CACHE) >= _MAX_TRANSLATION_CACHE:
            _TRANSLATION_MEMORY_CACHE.clear()
        _TRANSLATION_MEMORY_CACHE[cache_key] = result

    # Asynchronously persist to database cache
    def _persist_cache_async(s_text, s_dir, t_res):
        try:
            p_conn = get_db()
            p_cur = p_conn.cursor()
            p_cur.execute(
                """INSERT INTO translations_cache (source_text, direction, translated_text, model_version)
                   VALUES (%s, %s, %s, 'mbart_int8_v1')
                   ON CONFLICT (source_text, direction, model_version) DO NOTHING""",
                (s_text, s_dir, t_res)
            )
            p_conn.commit()
            p_cur.close()
            p_conn.close()
        except Exception:
            pass

    threading.Thread(target=_persist_cache_async, args=(req_text, request.direction, result), daemon=True).start()

    elapsed_ms = round((time.time() - t_start) * 1000, 1)
    return {
        "result": result,
        "direction": request.direction,
        "engine": active_engine,
        "latency_ms": elapsed_ms,
        "neural": (active_engine == "mbart-50-lora")
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 5: Profile, Badges, Leaderboard & Teacher Analytics ─────────────────
# ══════════════════════════════════════════════════════════════════════════════

class UpdateProfileRequest(BaseModel):
    name: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.get("/student/{user_id}/profile-info")
def get_student_profile_info(user_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, name, username, avatar_url, last_avatar_changed_at FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="User not found.")
        total_stars = _get_total_stars(cur, user_id)
        cur.execute("SELECT current_streak FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        streak = streak_row["current_streak"] if streak_row else 0
        cur.close()
        conn.close()
        return {
            "id": u["id"],
            "name": u["name"],
            "username": u["username"],
            "avatar_url": u.get("avatar_url"),
            "last_avatar_changed_at": u.get("last_avatar_changed_at").isoformat() if u.get("last_avatar_changed_at") else None,
            "total_stars": total_stars,
            "streak": streak
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/avatar-status")
def get_student_avatar_status(user_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT avatar_url, last_avatar_changed_at FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        cur.close()
        conn.close()
        if not u:
            raise HTTPException(status_code=404, detail="User not found.")

        last_changed = u.get("last_avatar_changed_at")
        now = datetime.now()
        can_change = True
        remaining_seconds = 0
        next_change_allowed_at = None

        if last_changed:
            elapsed = (now - last_changed).total_seconds()
            one_day_seconds = 86400  # 24 hours
            if elapsed < one_day_seconds:
                can_change = False
                remaining_seconds = int(one_day_seconds - elapsed)
                next_change_allowed_at = (last_changed + timedelta(days=1)).isoformat()

        return {
            "avatar_url": u.get("avatar_url"),
            "last_avatar_changed_at": last_changed.isoformat() if last_changed else None,
            "can_change": can_change,
            "remaining_seconds": remaining_seconds,
            "next_change_allowed_at": next_change_allowed_at
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/student/{user_id}/upload-avatar")
def upload_student_avatar(user_id: int, request: Request, file: UploadFile = File(...)):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT avatar_url, last_avatar_changed_at FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found.")

        last_changed = u.get("last_avatar_changed_at")
        now = datetime.now()
        if last_changed:
            elapsed = (now - last_changed).total_seconds()
            one_day_seconds = 86400  # 24 hours
            if elapsed < one_day_seconds:
                remaining_sec = int(one_day_seconds - elapsed)
                hours = remaining_sec // 3600
                minutes = (remaining_sec % 3600) // 60
                cur.close()
                conn.close()
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile picture can only be changed once every 24 hours. Next change in {hours}h {minutes}m."
                )

        ext = os.path.splitext(file.filename or "")[1].lower()
        if not ext and file.content_type:
            if "png" in file.content_type:
                ext = ".png"
            elif "gif" in file.content_type:
                ext = ".gif"
            elif "webp" in file.content_type:
                ext = ".webp"
            else:
                ext = ".jpg"
        if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.")

        unique_filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        base_url = get_public_base_url(request).rstrip('/')
        avatar_url = f"{base_url}/static/{unique_filename}"

        cur.execute(
            "UPDATE users SET avatar_url = %s, last_avatar_changed_at = %s WHERE id = %s",
            (avatar_url, now, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        return {
            "success": True,
            "message": "Profile picture updated! It is now locked for 24 hours.",
            "avatar_url": avatar_url,
            "last_avatar_changed_at": now.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/student/{user_id}/update-profile")
def update_student_profile(user_id: int, req: UpdateProfileRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE users SET name = %s WHERE id = %s", (req.name.strip(), user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Profile updated successfully.", "name": req.name.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/student/{user_id}/change-password")
def change_student_password(user_id: int, req: ChangePasswordRequest):
    if not req.old_password.strip() or not req.new_password.strip():
        raise HTTPException(status_code=400, detail="All password fields are required.")
    if len(req.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u or not pwd_context.verify(req.old_password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect current password.")
        new_hashed = pwd_context.hash(req.new_password.strip())
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hashed, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": "Password changed successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/student/{user_id}/badges")
def get_student_badges(user_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. First Step: completed at least 1 quiz
        cur.execute("SELECT COUNT(*) AS cnt FROM student_quiz_attempts WHERE user_id = %s", (user_id,))
        quiz_attempts_count = cur.fetchone()["cnt"]
        first_step = quiz_attempts_count >= 1

        # 2. Streak Master: 3+ streak
        cur.execute("SELECT current_streak, longest_streak FROM student_streaks WHERE user_id = %s", (user_id,))
        streak_row = cur.fetchone()
        streak_master = (streak_row["current_streak"] >= 3 or streak_row["longest_streak"] >= 3) if streak_row else False

        # 3. Perfect Score: 100% on any quiz
        cur.execute("SELECT COUNT(*) AS cnt FROM student_quiz_attempts WHERE user_id = %s AND score = total_questions AND total_questions > 0", (user_id,))
        perfect_score = cur.fetchone()["cnt"] >= 1

        # 4. Daily Champion: completed 3 daily slots in a single day
        cur.execute("SELECT slot_date, COUNT(*) AS cnt FROM daily_quiz_slots WHERE user_id = %s AND completed = TRUE GROUP BY slot_date HAVING COUNT(*) = 3 LIMIT 1", (user_id,))
        daily_champ = cur.fetchone() is not None

        # 5. Story Explorer: passed Story Grammar easy
        cur.execute("""
            SELECT slp.easy_passed FROM student_lesson_progress slp 
            JOIN lesson_groups lg ON slp.lesson_group_id = lg.id 
            WHERE slp.user_id = %s AND lg.topic_id = 'story-grammar' AND slp.easy_passed = TRUE LIMIT 1
        """, (user_id,))
        story_explorer = cur.fetchone() is not None

        # 6. Curriculum Pioneer: passed any STEM/TLE/AP easy lesson
        cur.execute("""
            SELECT slp.easy_passed FROM student_lesson_progress slp 
            JOIN lesson_groups lg ON slp.lesson_group_id = lg.id 
            WHERE slp.user_id = %s AND lg.topic_id IN ('mathematics', 'technology-and-livelihood-education', 'araling-panlipunan') AND slp.easy_passed = TRUE LIMIT 1
        """, (user_id,))
        curriculum_pioneer = cur.fetchone() is not None

        cur.close()
        conn.close()

        badges = [
            {
                "id": "first_step",
                "title": "First Step",
                "description": "Complete your very first quiz attempt.",
                "icon": "footsteps-outline",
                "color": "#0284C7",
                "unlocked": bool(first_step),
            },
            {
                "id": "streak_master",
                "title": "Streak Master",
                "description": "Reach a 3-day active learning streak.",
                "icon": "flame",
                "color": "#EA580C",
                "unlocked": bool(streak_master),
            },
            {
                "id": "perfect_score",
                "title": "Perfect Score",
                "description": "Score 100% on any quiz.",
                "icon": "trophy",
                "color": "#F59E0B",
                "unlocked": bool(perfect_score),
            },
            {
                "id": "daily_champion",
                "title": "Daily Champion",
                "description": "Complete all 3 daily quiz slots in one day.",
                "icon": "calendar-outline",
                "color": "#10B981",
                "unlocked": bool(daily_champ),
            },
            {
                "id": "story_explorer",
                "title": "Story Explorer",
                "description": "Pass your first Story Grammar lesson.",
                "icon": "book-outline",
                "color": "#7C3AED",
                "unlocked": bool(story_explorer),
            },
            {
                "id": "literacy_champ",
                "title": "Curriculum Pioneer",
                "description": "Pass your first Mathematics, TLE, or Araling Panlipunan lesson.",
                "icon": "shapes-outline",
                "color": "#2563EB",
                "unlocked": bool(curriculum_pioneer),
            }
        ]
        return badges
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard")
def get_leaderboard(user_id: Optional[int] = None):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                u.id AS user_id,
                u.name,
                u.username,
                u.avatar_url,
                COALESCE(SUM(sp.total_stars), 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(SUM(sp.quizzes_completed), 0) AS quizzes_completed
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            WHERE COALESCE(u.role, 'student') = 'student'
            GROUP BY u.id, u.name, u.username, u.avatar_url, ss.current_streak
            ORDER BY total_stars DESC, current_streak DESC, u.id ASC
            LIMIT 20
        """)
        rows = cur.fetchall()
        leaderboard = []
        user_rank = None
        for rank, r in enumerate(rows, start=1):
            entry = {
                "rank": rank,
                "user_id": r["user_id"],
                "name": r["name"],
                "username": r["username"],
                "avatar_url": r.get("avatar_url"),
                "total_stars": int(r["total_stars"]),
                "current_streak": int(r["current_streak"]),
                "quizzes_completed": int(r["quizzes_completed"]),
                "is_current_user": bool(user_id and r["user_id"] == user_id)
            }
            leaderboard.append(entry)
            if user_id and r["user_id"] == user_id:
                user_rank = rank

        cur.close()
        conn.close()
        return {
            "leaderboard": leaderboard[:10],
            "user_rank": user_rank,
            "total_students": len(rows)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/analytics/overview")
@app.get("/admin/analytics")
def get_admin_analytics_overview(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 1. Total Students (excluding teachers and admins)
        cur.execute("SELECT COUNT(*) AS total FROM users WHERE COALESCE(role, 'student') = 'student'")
        total_students = cur.fetchone()["total"]

        # 2. Total Quiz Attempts & Class Avg Accuracy
        cur.execute("""
            SELECT 
                COUNT(*) AS total_attempts,
                COALESCE(AVG((score::FLOAT / NULLIF(total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM student_quiz_attempts
        """)
        quiz_stats = cur.fetchone()
        total_attempts = quiz_stats["total_attempts"]
        avg_accuracy = round(float(quiz_stats["avg_accuracy"]), 1)

        # 3. Topic Breakdown (Story Grammar vs English Literacy)
        cur.execute("""
            SELECT 
                COALESCE(q.topic_id, 'other') AS topic_id,
                COUNT(*) AS attempts,
                COALESCE(AVG((sqa.score::FLOAT / NULLIF(sqa.total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM student_quiz_attempts sqa
            JOIN quizzes q ON sqa.quiz_id = q.id
            GROUP BY q.topic_id
        """)
        topic_rows = cur.fetchall()
        topic_stats = {r["topic_id"]: {"attempts": r["attempts"], "avg_accuracy": round(float(r["avg_accuracy"]), 1)} for r in topic_rows}

        # 4. Weakest Knowledge Components across class
        cur.execute("""
            SELECT 
                kc.topic_id,
                kc.name,
                kc.display_name,
                COALESCE(AVG(skm.p_mastery), 0) AS avg_mastery,
                COUNT(skm.user_id) AS student_count
            FROM knowledge_components kc
            LEFT JOIN student_kc_mastery skm ON kc.name = skm.kc_name
            GROUP BY kc.topic_id, kc.name, kc.display_name
            ORDER BY avg_mastery ASC
            LIMIT 6
        """)
        weak_kcs = [
            {
                "topic_id": r["topic_id"],
                "name": r["name"],
                "display_name": r["display_name"],
                "avg_mastery_pct": round(float(r["avg_mastery"]) * 100, 1),
                "student_count": r["student_count"]
            }
            for r in cur.fetchall()
        ]

        # 5. Student Roster with progress (excluding teachers and admins)
        cur.execute("""
            SELECT 
                u.id AS user_id,
                u.name,
                u.username,
                u.avatar_url,
                COALESCE(stars_agg.total_stars, 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(attempts_agg.attempts_count, 0) AS attempts_count,
                COALESCE(attempts_agg.avg_accuracy, 0) AS avg_accuracy
            FROM users u
            LEFT JOIN (
                SELECT user_id, SUM(total_stars) AS total_stars
                FROM student_profiles
                GROUP BY user_id
            ) stars_agg ON u.id = stars_agg.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            LEFT JOIN (
                SELECT 
                    user_id,
                    COUNT(*) AS attempts_count,
                    ROUND(AVG((score::FLOAT / NULLIF(total_questions, 0)) * 100)::numeric, 1) AS avg_accuracy
                FROM student_quiz_attempts
                GROUP BY user_id
            ) attempts_agg ON u.id = attempts_agg.user_id
            WHERE COALESCE(u.role, 'student') = 'student'
            ORDER BY total_stars DESC, u.id ASC
        """)
        roster = [
            {
                "user_id": r["user_id"],
                "name": r["name"],
                "username": r["username"],
                "avatar_url": r.get("avatar_url"),
                "total_stars": int(r["total_stars"]),
                "current_streak": int(r["current_streak"]),
                "attempts_count": int(r["attempts_count"]),
                "avg_accuracy": round(float(r["avg_accuracy"]), 1)
            }
            for r in cur.fetchall()
        ]

        cur.close()
        conn.close()

        return {
            "total_students": total_students,
            "total_attempts": total_attempts,
            "class_avg_accuracy": avg_accuracy,
            "topic_stats": topic_stats,
            "weak_kcs": weak_kcs,
            "student_roster": roster
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/teacher/student/{user_id}/quiz-attempts")
def get_student_quiz_attempts(user_id: int):
    """
    Returns full chronological history of a student's quiz attempts
    with quiz title, topic, difficulty, score, total questions, accuracy, passed, and timestamps.
    """
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                sqa.id AS attempt_id,
                sqa.quiz_id,
                COALESCE(q.title, 'Curriculum Quiz #' || sqa.quiz_id) AS quiz_title,
                COALESCE(q.topic_id, 'story-grammar') AS topic_id,
                COALESCE(q.difficulty, 'easy') AS difficulty,
                sqa.score,
                sqa.total_questions,
                ROUND((sqa.score::FLOAT / NULLIF(sqa.total_questions, 0) * 100)::numeric, 1) AS accuracy_pct,
                (sqa.score::FLOAT / NULLIF(sqa.total_questions, 0) >= 0.70) AS passed,
                sqa.time_spent_seconds,
                sqa.completed_at,
                sqa.started_at
            FROM student_quiz_attempts sqa
            LEFT JOIN quizzes q ON sqa.quiz_id = q.id
            WHERE sqa.user_id = %s
            ORDER BY sqa.completed_at DESC NULLS LAST, sqa.id DESC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        attempts = []
        for r in rows:
            attempts.append({
                "attempt_id": r["attempt_id"],
                "quiz_id": r["quiz_id"],
                "quiz_title": r["quiz_title"],
                "topic_id": r["topic_id"],
                "difficulty": r["difficulty"],
                "score": r["score"],
                "total_questions": r["total_questions"],
                "accuracy_pct": float(r["accuracy_pct"]) if r["accuracy_pct"] is not None else 0.0,
                "passed": bool(r["passed"]),
                "time_spent_seconds": r["time_spent_seconds"] or 0,
                "completed_at": str(r["completed_at"]) if r["completed_at"] else None,
                "started_at": str(r["started_at"]) if r["started_at"] else None,
            })

        return {
            "user_id": user_id,
            "total_attempts": len(attempts),
            "passed_count": sum(1 for a in attempts if a["passed"]),
            "failed_count": sum(1 for a in attempts if not a["passed"]),
            "attempts": attempts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Phase 6: Visual Flashcards & Admin Quiz Question Editor ───────────────────
# ══════════════════════════════════════════════════════════════════════════════

FLASHCARDS_DATA = {
    "story-grammar": [
        {
            "id": 1,
            "term": "Character",
            "asl_gloss": "WHO STORY ABOUT (PERSON / ANIMAL)",
            "definition": "The person, animal, or creature the story is about.",
            "example": "Rad is a cheerful student who loves flying his red kite.",
            "category": "Story Element",
            "icon": "person-outline",
            "color": "#7C3AED"
        },
        {
            "id": 2,
            "term": "Setting",
            "asl_gloss": "WHERE + WHEN STORY HAPPEN",
            "definition": "The place and time where the story happens.",
            "example": "Rad walks across a sunny grassy hill with an oak tree on a breezy afternoon.",
            "category": "Story Element",
            "icon": "location-outline",
            "color": "#7C3AED"
        },
        {
            "id": 3,
            "term": "Problem",
            "asl_gloss": "TROUBLE / CONFLICT / SOMETHING WRONG",
            "definition": "The trouble or challenge that the character must solve.",
            "example": "Rad's red kite gets stuck high in the oak tree branches.",
            "category": "Story Element",
            "icon": "alert-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 4,
            "term": "Resolution",
            "asl_gloss": "PROBLEM SOLVE / ENDING HAPPY",
            "definition": "How the problem is solved and how the story ends.",
            "example": "A friendly helper uses a ladder to rescue the kite and safely returns it to Rad.",
            "category": "Story Element",
            "icon": "checkmark-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 5,
            "term": "First (Sequence)",
            "asl_gloss": "FIRST (BEGINNING)",
            "definition": "What happens at the beginning of the story.",
            "example": "First, Rad crafts his red kite at his wooden work table.",
            "category": "Sequence Word",
            "icon": "arrow-forward-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 6,
            "term": "Finally (Sequence)",
            "asl_gloss": "FINALLY (END RESULT)",
            "definition": "What happens at the very end of the story.",
            "example": "Finally, Rad runs joyfully across the hill as his red kite soars high in the sky.",
            "category": "Sequence Word",
            "icon": "flag-outline",
            "color": "#7C3AED"
        }
    ],
    "mathematics": [
        {
            "id": 201,
            "term": "Translation (Slide)",
            "asl_gloss": "SHAPE SLIDE (STRAIGHT LINE MOVE)",
            "definition": "Moving a shape in a straight line without turning or resizing it.",
            "example": "The blue triangle slides 4 units to the right in a straight line.",
            "category": "Transformation",
            "icon": "arrow-forward-outline",
            "color": "#2563EB"
        },
        {
            "id": 202,
            "term": "Reflection (Flip)",
            "asl_gloss": "SHAPE FLIP (MIRROR OPPOSITE)",
            "definition": "Flipping a shape across a line to produce a mirror image.",
            "example": "The shape flips across the red mirror line to create an opposite matching image.",
            "category": "Transformation",
            "icon": "swap-horizontal-outline",
            "color": "#2563EB"
        },
        {
            "id": 203,
            "term": "Rotation (Turn)",
            "asl_gloss": "SHAPE TURN (SPIN AROUND CENTER POINT)",
            "definition": "Turning a shape around a fixed center point by degrees (90° or 180°).",
            "example": "The purple shape turns 90 degrees clockwise around the red center point.",
            "category": "Transformation",
            "icon": "refresh-outline",
            "color": "#2563EB"
        },
        {
            "id": 204,
            "term": "Line of Symmetry",
            "asl_gloss": "MIDDLE LINE (BOTH SIDES MATCH SAME)",
            "definition": "The imaginary mirror line where a shape can be folded into two identical halves.",
            "example": "The dashed center line folds the shape into two matching halves.",
            "category": "Geometry",
            "icon": "git-commit-outline",
            "color": "#2563EB"
        },
        {
            "id": 205,
            "term": "Congruent Shapes",
            "asl_gloss": "SHAPE SAME-SIZE + SAME-SHAPE",
            "definition": "Shapes that have the exact same size and shape after transforming.",
            "example": "Shape A and Shape B are congruent because they have the exact same size and shape.",
            "category": "Geometry",
            "icon": "shapes-outline",
            "color": "#2563EB"
        },
        {
            "id": 206,
            "term": "Coordinate Grid",
            "asl_gloss": "GRID MAP (X HORIZONTAL + Y VERTICAL)",
            "definition": "A network of horizontal and vertical lines used to pinpoint shape positions.",
            "example": "The horizontal X-axis and vertical Y-axis help us find the exact position of points.",
            "category": "Measurement",
            "icon": "grid-outline",
            "color": "#2563EB"
        }
    ],
    "technology-and-livelihood-education": [
        {
            "id": 301,
            "term": "Webcam Privacy",
            "asl_gloss": "CAMERA PRIVACY (HIDE PERSONAL ROOM)",
            "definition": "Keeping personal living areas hidden during a video conference.",
            "example": "Slide your webcam privacy shutter closed to protect your private room.",
            "category": "Digital Privacy",
            "icon": "videocam-outline",
            "color": "#D97706"
        },
        {
            "id": 302,
            "term": "Mute Microphone",
            "asl_gloss": "MIC OFF (NO NOISE DISTURB)",
            "definition": "Turning off your microphone when listening to avoid background noise.",
            "example": "Always mute your microphone when the teacher or classmates are speaking.",
            "category": "Etiquette",
            "icon": "mic-off-outline",
            "color": "#D97706"
        },
        {
            "id": 303,
            "term": "Meeting Link",
            "asl_gloss": "CONFERENCE LINK (NEVER SHARE PUBLIC)",
            "definition": "The digital address used to join an online classroom.",
            "example": "Only share the meeting link with trusted school classmates.",
            "category": "Cybersecurity",
            "icon": "link-outline",
            "color": "#D97706"
        },
        {
            "id": 304,
            "term": "Password Protection",
            "asl_gloss": "SECRET CODE (LOCK ACCOUNT SAFE)",
            "definition": "A secret security code used to protect accounts and meetings from strangers.",
            "example": "Keep your secret password protected and confidential.",
            "category": "Cybersecurity",
            "icon": "lock-closed-outline",
            "color": "#D97706"
        },
        {
            "id": 305,
            "term": "Visual Clarity",
            "asl_gloss": "LIGHT GOOD + HAND CLEAR (EASY SEE SIGN)",
            "definition": "Good front-facing lighting so hand signs and facial expressions are easy to see.",
            "example": "Face the bright front light so your hand signs are clear and easy to see.",
            "category": "Visual Communication",
            "icon": "sunny-outline",
            "color": "#D97706"
        },
        {
            "id": 306,
            "term": "Chat Etiquette",
            "asl_gloss": "MESSAGE POLITE + RESPECTFUL (NO SPAM)",
            "definition": "Typing polite, relevant, and school-appropriate messages in the meeting chat.",
            "example": "Use the chat box only for polite and lesson-related questions.",
            "category": "Etiquette",
            "icon": "chatbubble-ellipses-outline",
            "color": "#D97706"
        }
    ],
    "araling-panlipunan": [
        {
            "id": 401,
            "term": "Katipunan (KKK)",
            "asl_gloss": "KATIPUNAN (SECRET BROTHERHOOD FOR FREEDOM)",
            "definition": "The secret revolutionary society founded to free the Philippines from Spanish rule.",
            "example": "The Katipunan united Filipinos under a common vision of liberty.",
            "category": "History",
            "icon": "shield-checkmark-outline",
            "color": "#059669"
        },
        {
            "id": 402,
            "term": "Andres Bonifacio",
            "asl_gloss": "ANDRES BONIFACIO (SUPREMO / FATHER OF REVOLUTION)",
            "definition": "The brave founder and leader (Supremo) of the Katipunan born in Tondo, Manila.",
            "example": "Andres Bonifacio inspired the people with his courage and love of country.",
            "category": "Historical Hero",
            "icon": "person-outline",
            "color": "#059669"
        },
        {
            "id": 403,
            "term": "Sanduguan (Blood Compact)",
            "asl_gloss": "BLOOD COMPACT (PROMISE BROTHERHOOD TOGETHER)",
            "definition": "A sacred ritual where members signed their oath in blood to seal their loyalty.",
            "example": "Katipuneros performed the Sanduguan to pledge their lives for freedom.",
            "category": "Historical Ritual",
            "icon": "heart-outline",
            "color": "#059669"
        },
        {
            "id": 404,
            "term": "Kartilya ng Katipunan",
            "asl_gloss": "KARTILYA (MORAL TEACHINGS / RULES FOR GOOD LIFE)",
            "definition": "The code of ethics written by Emilio Jacinto teaching equality, honor, and defending the weak.",
            "example": "The Kartilya taught that all human beings are equal regardless of wealth.",
            "category": "Moral Teachings",
            "icon": "document-text-outline",
            "color": "#059669"
        },
        {
            "id": 405,
            "term": "Kalayaan (Freedom)",
            "asl_gloss": "FREEDOM / INDEPENDENCE (NO OPPRESSION)",
            "definition": "The right to live in liberty, self-governance, and freedom from colonial rule.",
            "example": "The supreme goal of the Katipuneros was to achieve Kalayaan for the country.",
            "category": "Civic Concept",
            "icon": "flag-outline",
            "color": "#059669"
        },
        {
            "id": 406,
            "term": "Gregoria de Jesus",
            "asl_gloss": "GREGORIA DE JESUS (LAKAMBINI / BRAVE WOMAN LEADER)",
            "definition": "The Lakambini of the Katipunan who bravely guarded secret society archives and weapons.",
            "example": "Gregoria de Jesus led the women's chapter and protected the Katipunan seal.",
            "category": "Historical Hero",
            "icon": "star-outline",
            "color": "#059669"
        }
    ]
}

@app.get("/flashcards/{topic_id}")
def get_flashcards(topic_id: str):
    cards = FLASHCARDS_DATA.get(topic_id, [])
    if not cards:
        cards = FLASHCARDS_DATA.get("story-grammar", [])
    return {"topic_id": topic_id, "cards": cards}


class EditQuestionItem(BaseModel):
    id: Optional[int] = None
    question_text: str
    question_type: str = "multiple_choice"
    image_url: Optional[str] = None
    knowledge_component: Optional[str] = None
    options: List[str] = []
    correct_option_index: int = 0
    hint: Optional[str] = None

class UpdateQuizQuestionsRequest(BaseModel):
    questions: List[EditQuestionItem]
    teacher_name: Optional[str] = "Teacher"
    teacher_id: Optional[int] = None


@app.get("/admin/quiz/{quiz_id}/questions")
def get_admin_quiz_questions(quiz_id: int):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM questions WHERE quiz_id = %s ORDER BY id ASC", (quiz_id,))
        rows = cur.fetchall()
        
        result = []
        for r in rows:
            q_id = r["id"]
            cur.execute(
                "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                (q_id,)
            )
            opts = cur.fetchall()
            options_list = [o["option_text"] for o in opts]
            while len(options_list) < 4:
                options_list.append("")
                
            correct_letter = (r.get("correct_option_letter") or "A").strip().upper()
            correct_idx = max(0, min(3, ord(correct_letter[0]) - 65)) if correct_letter and correct_letter[0].isalpha() else 0
            
            result.append({
                "id": q_id,
                "quiz_id": r["quiz_id"],
                "question_text": r["question_text"],
                "question_type": "multiple_choice",
                "image_url": r["image_url"],
                "knowledge_component": r.get("knowledge_component") or "",
                "options": options_list[:4],
                "correct_option_index": correct_idx,
                "hint": r.get("hint") or "",
                "matching_pairs": [],
            })
            
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/quiz/{quiz_id}/questions")
def update_admin_quiz_questions(quiz_id: int, req: UpdateQuizQuestionsRequest):
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # 1. Fetch old question IDs to delete options and matches
        cur.execute("SELECT id FROM questions WHERE quiz_id = %s", (quiz_id,))
        old_ids = [row[0] for row in cur.fetchall()]
        if old_ids:
            cur.execute("DELETE FROM student_question_answers WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM question_matches WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM questions WHERE quiz_id = %s", (quiz_id,))
            
        # Resolve fallback auto-KC for this quiz if questions omit it
        cur.execute("""
            SELECT q.topic_id, q.title as quiz_title, lg.title as group_title, l.title as lesson_title
            FROM quizzes q
            LEFT JOIN lessons l ON q.lesson_id = l.id
            LEFT JOIN lesson_groups lg ON l.lesson_group_id = lg.id
            WHERE q.id = %s
        """, (quiz_id,))
        q_info = cur.fetchone()
        auto_kc = "reading_comprehension"
        if q_info:
            q_topic = q_info[0] or "english-1"
            base_t = q_info[2] or q_info[3] or q_info[1] or "Lesson"
            slug = re.sub(r'[^a-z0-9]+', '_', base_t.lower().strip()).strip('_')
            auto_kc = f"kc_{slug}"
            cur.execute("""
                INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
                VALUES (%s, %s, %s, 0.10, 0.20, 0.25, 0.10)
                ON CONFLICT (name) DO NOTHING
            """, (q_topic, auto_kc, f"{base_t} Mastery"))

        # 2. Insert new questions
        for q in req.questions:
            if not q.question_text.strip():
                continue
            if not q.options or len(q.options) < 4:
                raise HTTPException(status_code=400, detail="Each question must have exactly 4 choices (A, B, C, D).")
            for opt_idx, opt_text in enumerate(q.options[:4]):
                if not opt_text.strip():
                    raise HTTPException(status_code=400, detail=f"Option {chr(65 + opt_idx)} cannot be empty.")

            correct_idx = max(0, min(3, q.correct_option_index if q.correct_option_index is not None else 0))
            correct_letter = chr(65 + correct_idx)
            kc_val = q.knowledge_component.strip() if q.knowledge_component and q.knowledge_component.strip() else auto_kc
            cur.execute("""
                INSERT INTO questions 
                (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                quiz_id,
                q.question_text.strip(),
                correct_letter,
                "multiple_choice",
                q.image_url if q.image_url and q.image_url.strip() else None,
                kc_val,
                q.hint if q.hint and q.hint.strip() else None,
            ))
            new_q_id = cur.fetchone()[0]
            
            # Insert options
            for o_idx, opt_text in enumerate(q.options[:4]):
                opt_letter = chr(65 + o_idx)
                cur.execute("""
                    INSERT INTO question_options (question_id, option_letter, option_text)
                    VALUES (%s, %s, %s)
                """, (new_q_id, opt_letter, opt_text.strip()))
                
        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=req.teacher_name or "Teacher",
            action_type="edit_quiz",
            target_type="quiz",
            target_id=quiz_id,
            target_title=f"Quiz #{quiz_id}",
            details=f"Updated questions pool ({len(req.questions)} questions).",
            teacher_id=req.teacher_id
        )
        return {"success": True, "message": f"Successfully updated {len(req.questions)} questions."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/quiz/{quiz_id}")
def delete_quiz(quiz_id: int, teacher_name: str = "Teacher", teacher_id: Optional[int] = None):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, title, topic_id, difficulty FROM quizzes WHERE id = %s", (quiz_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Quiz not found.")

        # Soft delete quiz
        cur.execute(
            "UPDATE quizzes SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s",
            (teacher_name, quiz_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=teacher_name,
            action_type="trash_quiz",
            target_type="quiz",
            target_id=quiz_id,
            target_title=row["title"],
            topic_id=row["topic_id"],
            details=f"Moved quiz '{row['title']}' ({row.get('difficulty', 'easy').upper()}) to Trash.",
            teacher_id=teacher_id
        )
        return {"success": True, "message": f"Moved quiz '{row['title']}' to Trash."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/trash")
def get_trash():
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Fetch trashed lesson groups
        cur.execute("""
            SELECT id, title, topic_id, 'lesson_group' as item_type, deleted_at, deleted_by
            FROM lesson_groups
            WHERE is_deleted = TRUE
            ORDER BY deleted_at DESC
        """)
        trashed_groups = cur.fetchall()

        # Fetch trashed individual lessons if any
        cur.execute("""
            SELECT id, title, topic_id, difficulty, 'lesson' as item_type, deleted_at, deleted_by
            FROM lessons
            WHERE is_deleted = TRUE AND lesson_group_id IS NULL
            ORDER BY deleted_at DESC
        """)
        trashed_lessons = cur.fetchall()

        # Fetch trashed quizzes
        # Fetch trashed quizzes (filter out child quizzes whose parent lesson group is already trashed)
        cur.execute("""
            SELECT q.id, q.title, q.topic_id, q.difficulty, 'quiz' as item_type, q.deleted_at, q.deleted_by
            FROM quizzes q
            WHERE q.is_deleted = TRUE
              AND (
                  q.lesson_id IS NULL 
                  OR q.lesson_id NOT IN (
                      SELECT l.id FROM lessons l 
                      JOIN lesson_groups lg ON l.lesson_group_id = lg.id 
                      WHERE lg.is_deleted = TRUE
                  )
              )
            ORDER BY q.deleted_at DESC
        """)
        trashed_quizzes = cur.fetchall()

        cur.close()
        conn.close()
        all_items = [dict(g) for g in trashed_groups] + [dict(l) for l in trashed_lessons] + [dict(q) for q in trashed_quizzes]
        return {
            "success": True,
            "trash": all_items,
            "total_count": len(all_items)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _purge_quizzes(cur, quiz_ids: list[int]):
    if not quiz_ids:
        return
    cur.execute("SELECT id FROM questions WHERE quiz_id = ANY(%s)", (quiz_ids,))
    q_ids = [r["id"] for r in cur.fetchall()]
    if q_ids:
        cur.execute("DELETE FROM student_question_answers WHERE question_id = ANY(%s)", (q_ids,))
        cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (q_ids,))
        cur.execute("DELETE FROM question_matches WHERE question_id = ANY(%s)", (q_ids,))
        cur.execute("DELETE FROM questions WHERE id = ANY(%s)", (q_ids,))
    cur.execute("UPDATE daily_quiz_slots SET quiz_id = NULL WHERE quiz_id = ANY(%s)", (quiz_ids,))
    cur.execute("SELECT id FROM student_quiz_attempts WHERE quiz_id = ANY(%s)", (quiz_ids,))
    attempt_ids = [r["id"] for r in cur.fetchall()]
    if attempt_ids:
        cur.execute("DELETE FROM student_quiz_attempts WHERE id = ANY(%s)", (attempt_ids,))
    cur.execute("DELETE FROM quizzes WHERE id = ANY(%s)", (quiz_ids,))


@app.post("/admin/trash/restore")
def restore_trash(req: TrashActionRequest):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        target_title = ""
        topic_id = None

        if req.item_type == "lesson_group":
            cur.execute("SELECT id, title, topic_id FROM lesson_groups WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                raise HTTPException(status_code=404, detail="Item not found.")
            target_title = row["title"]
            topic_id = row["topic_id"]
            cur.execute("UPDATE lesson_groups SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = %s", (req.item_id,))
            cur.execute("UPDATE lessons SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE lesson_group_id = %s", (req.item_id,))
            cur.execute("UPDATE quizzes SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE lesson_id IN (SELECT id FROM lessons WHERE lesson_group_id = %s)", (req.item_id,))
            action = "restore_lesson"
            detail = f"Restored lesson story '{target_title}' and its quizzes from Trash."
        elif req.item_type == "lesson":
            cur.execute("SELECT id, title, topic_id FROM lessons WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                raise HTTPException(status_code=404, detail="Lesson not found.")
            target_title = row["title"]
            topic_id = row["topic_id"]
            cur.execute("UPDATE lessons SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = %s", (req.item_id,))
            cur.execute("UPDATE quizzes SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE lesson_id = %s", (req.item_id,))
            action = "restore_lesson"
            detail = f"Restored lesson '{target_title}' and its quiz from Trash."
        elif req.item_type == "quiz":
            cur.execute("SELECT id, title, topic_id FROM quizzes WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                raise HTTPException(status_code=404, detail="Quiz not found.")
            target_title = row["title"]
            topic_id = row["topic_id"]
            cur.execute("UPDATE quizzes SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = %s", (req.item_id,))
            action = "restore_quiz"
            detail = f"Restored quiz '{target_title}' from Trash."
        else:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid item_type.")

        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=req.teacher_name or "Teacher",
            action_type=action,
            target_type=req.item_type,
            target_id=req.item_id,
            target_title=target_title,
            topic_id=topic_id,
            details=detail,
            teacher_id=req.teacher_id
        )
        return {"success": True, "message": f"Successfully restored '{target_title}'."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/trash/permanent")
def permanent_delete_trash(req: TrashActionRequest):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        target_title = ""
        topic_id = None

        if req.item_type == "lesson_group":
            cur.execute("SELECT id, title, topic_id FROM lesson_groups WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if row:
                target_title = row["title"]
                topic_id = row["topic_id"]
            cur.execute("SELECT id FROM lessons WHERE lesson_group_id = %s", (req.item_id,))
            lesson_ids = [lr["id"] for lr in cur.fetchall()]
            if lesson_ids:
                cur.execute("SELECT id FROM quizzes WHERE lesson_id = ANY(%s)", (lesson_ids,))
                qz_ids = [qr["id"] for qr in cur.fetchall()]
                _purge_quizzes(cur, qz_ids)
                cur.execute("DELETE FROM lesson_slides WHERE lesson_id = ANY(%s)", (lesson_ids,))
                cur.execute("DELETE FROM lessons WHERE id = ANY(%s)", (lesson_ids,))
            cur.execute("DELETE FROM lesson_groups WHERE id = %s", (req.item_id,))
            action = "permanent_delete"
            detail = f"Permanently deleted lesson story '{target_title}' and all linked content."
        elif req.item_type == "lesson":
            cur.execute("SELECT id, title, topic_id FROM lessons WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if row:
                target_title = row["title"]
                topic_id = row["topic_id"]
            cur.execute("SELECT id FROM quizzes WHERE lesson_id = %s", (req.item_id,))
            qz_ids = [qr["id"] for qr in cur.fetchall()]
            _purge_quizzes(cur, qz_ids)
            cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (req.item_id,))
            cur.execute("DELETE FROM lessons WHERE id = %s", (req.item_id,))
            action = "permanent_delete"
            detail = f"Permanently deleted lesson '{target_title}' and its quiz."
        elif req.item_type == "quiz":
            cur.execute("SELECT id, title, topic_id FROM quizzes WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if row:
                target_title = row["title"]
                topic_id = row["topic_id"]
            _purge_quizzes(cur, [req.item_id])
            action = "permanent_delete"
            detail = f"Permanently deleted quiz '{target_title}'."
        else:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid item_type.")

        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name=req.teacher_name or "Teacher",
            action_type=action,
            target_type=req.item_type,
            target_id=req.item_id,
            target_title=target_title,
            topic_id=topic_id,
            details=detail,
            teacher_id=req.teacher_id
        )
        return {"success": True, "message": f"Permanently deleted '{target_title}'."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/teacher-history")
def get_teacher_history():
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT id, teacher_id, teacher_name, action_type, target_type, target_id, target_title, topic_id, details, created_at
            FROM teacher_activity_logs
            ORDER BY created_at DESC
            LIMIT 100
        """)
        logs = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "history": [dict(l) for l in logs]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# ── Serve Web Portal (Teacher & Admin) with SPA & HTML Route Support ──────────
# ══════════════════════════════════════════════════════════════════════════════
from starlette.exceptions import HTTPException as StarletteHTTPException

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
if not os.path.isdir(DIST_DIR):
    for candidate_dir in [os.path.abspath("dist"), "/home/site/wwwroot/dist"]:
        if os.path.isdir(candidate_dir):
            DIST_DIR = candidate_dir
            break

def get_dist_file(filename: str):
    if not DIST_DIR or not os.path.isdir(DIST_DIR):
        return None
    target = os.path.join(DIST_DIR, filename)
    return target if os.path.isfile(target) else None

@app.get("/teacher", response_class=FileResponse)
@app.get("/teacher/", response_class=FileResponse)
def serve_teacher_portal():
    f = get_dist_file("teacher.html") or get_dist_file("index.html")
    if f:
        return FileResponse(f)
    raise HTTPException(status_code=404, detail="Teacher portal build not found.")

@app.get("/admin", response_class=FileResponse)
@app.get("/admin/", response_class=FileResponse)
def serve_admin_portal():
    f = get_dist_file("admin.html") or get_dist_file("index.html")
    if f:
        return FileResponse(f)
    raise HTTPException(status_code=404, detail="Admin portal build not found.")

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (StarletteHTTPException, HTTPException, Exception) as ex:
            status_code = getattr(ex, "status_code", 404)
            if status_code == 404 or isinstance(ex, StarletteHTTPException):
                clean_path = path.strip("/")
                if clean_path.startswith("assets/uploads") or clean_path.startswith("api/"):
                    raise

                # 1. Match direct route to {clean_path}.html (e.g. /teacher -> teacher.html, /admin -> admin.html)
                html_file = os.path.join(self.directory, clean_path + ".html")
                if clean_path and os.path.isfile(html_file):
                    return FileResponse(html_file)

                # 2. Match directory index {clean_path}/index.html
                sub_index = os.path.join(self.directory, clean_path, "index.html")
                if clean_path and os.path.isfile(sub_index):
                    return FileResponse(sub_index)

                # 3. SPA Fallback to index.html for client-side routing
                index_file = os.path.join(self.directory, "index.html")
                if os.path.isfile(index_file):
                    return FileResponse(index_file)
            raise

if DIST_DIR and os.path.isdir(DIST_DIR):
    app.mount("/", SPAStaticFiles(directory=DIST_DIR, html=True), name="web-portal")
