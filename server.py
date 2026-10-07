from typing import Optional, List
from fastapi import FastAPI, HTTPException, File, UploadFile, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import MBart50TokenizerFast, MBartForConditionalGeneration
from passlib.context import CryptContext
import psycopg2
import psycopg2.extras
import re
import os
import shutil
import uuid
import random
from datetime import datetime

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
UPLOAD_DIR = "assets/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/static/{filename}")
def serve_uploaded_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    ext = os.path.splitext(filename)[1].lower()
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

# ── Database connection ───────────────────────────────────────────────────────
def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "bokeeer03"),
        port=int(os.getenv("DB_PORT", "5432")),
    )

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

init_db()

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
    Deducts from the topic_id profile if provided, otherwise from the first profile found.
    """
    if topic_id:
        cur.execute(
            "UPDATE student_profiles SET total_stars = GREATEST(0, total_stars - %s) WHERE user_id = %s AND topic_id = %s",
            (amount, user_id, topic_id)
        )
    else:
        # Deduct from first profile
        cur.execute(
            "UPDATE student_profiles SET total_stars = GREATEST(0, total_stars - %s) WHERE user_id = %s AND id = (SELECT id FROM student_profiles WHERE user_id = %s LIMIT 1)",
            (amount, user_id, user_id)
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

# ── Load model from local cache (already downloaded) ─────────────────────────
LOCAL_MODEL_PATH = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"
print("Loading tokenizer and model from local cache...")
tokenizer = MBart50TokenizerFast.from_pretrained(LOCAL_MODEL_PATH, local_files_only=True)
model = MBartForConditionalGeneration.from_pretrained(LOCAL_MODEL_PATH, local_files_only=True)

# Manually register asl_GL in case it isn't present
asl_id = tokenizer.convert_tokens_to_ids("asl_GL")
tokenizer.lang_code_to_id["asl_GL"] = asl_id

print(f"asl_GL token id: {asl_id}")
print("Model loaded and ready!")


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

class MatchingPairInput(BaseModel):
    left: str
    right: str

class QuestionInput(BaseModel):
    question_text: str
    question_type: str = "descriptive"
    image_url: Optional[str] = None
    knowledge_component: Optional[str] = None   # Phase 2: KC tag
    options: Optional[list[str]] = None
    correct_option_index: Optional[int] = None
    matching_pairs: Optional[list[MatchingPairInput]] = None

class QuizCreateRequest(BaseModel):
    title: str
    topic_id: str
    lesson_id: int
    difficulty: str = 'easy'        # inherited from lesson
    questions: list[QuestionInput]

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
    hashed = pwd_context.hash(req.password)
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO users (name, username, password_hash, role, plain_password) VALUES (%s, %s, %s, 'student', %s) RETURNING id, name, username, role",
            (req.name.strip(), req.username.strip().lower(), hashed, req.password.strip()),
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
            "SELECT id, name, username, password_hash, role FROM users WHERE username = %s",
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
                "role": user.get("role") or "student"
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
def delete_lesson_group(group_id: int, teacher_name: str = "Teacher"):
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, title, topic_id FROM lesson_groups WHERE id = %s", (group_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Lesson group not found.")
        
        # Soft delete lesson group and all its lessons
        cur.execute(
            "UPDATE lesson_groups SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE id = %s",
            (teacher_name, group_id)
        )
        cur.execute(
            "UPDATE lessons SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = %s WHERE lesson_group_id = %s",
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
            details=f"Moved lesson story '{row['title']}' to Trash."
        )
        return {"success": True, "message": f"Moved '{row['title']}' to Trash."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/lesson/{lesson_id}")
def delete_lesson(lesson_id: int, teacher_name: str = "Teacher"):
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
            details=f"Moved {row.get('difficulty', 'easy').upper()} tier to Trash."
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
            teacher_name="Teacher",
            action_type="edit_slides",
            target_type="lesson",
            target_id=lesson_id,
            target_title=f"Lesson #{lesson_id}",
            details=f"Updated slides ({len(req.slides)} slides)."
        )
        return {"success": True, "message": "Slides updated successfully."}
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
    if not ext:
        ext = ".jpg"

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        base_url = str(request.base_url).rstrip('/')
        url = f"{base_url}/static/{unique_filename}"
        return {"success": True, "url": url}
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
            correct_letter = 'A'
            if q.question_type != 'matching' and q.correct_option_index is not None:
                correct_letter = chr(65 + q.correct_option_index)

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
                "INSERT INTO questions (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (quiz_id, q.question_text.strip(), correct_letter, q.question_type, img_val, kc_val)
            )
            question_id = cur.fetchone()["id"]

            if q.question_type == 'matching':
                if q.matching_pairs:
                    for pair in q.matching_pairs:
                        cur.execute(
                            "INSERT INTO question_matches (question_id, left_item, right_item) VALUES (%s, %s, %s)",
                            (question_id, pair.left.strip(), pair.right.strip())
                        )
            else:
                if q.options:
                    for idx, opt_text in enumerate(q.options):
                        opt_letter = chr(65 + idx)
                        cur.execute(
                            "INSERT INTO question_options (question_id, option_letter, option_text) VALUES (%s, %s, %s)",
                            (question_id, opt_letter, opt_text.strip())
                        )

        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name="Teacher",
            action_type="create_quiz",
            target_type="quiz",
            target_id=quiz_id,
            target_title=req.title,
            topic_id=req.topic_id,
            details=f"Created {req.difficulty.upper()} quiz with {len(req.questions)} questions."
        )
        return {"success": True, "quiz_id": quiz_id}
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
        q_type = q["question_type"]
        options_list = []
        correct_idx = 0
        matching_pairs_list = []

        if q_type == 'matching':
            cur.execute(
                "SELECT left_item, right_item FROM question_matches WHERE question_id = %s ORDER BY id ASC",
                (q["id"],)
            )
            matches = cur.fetchall()
            matching_pairs_list = [dict(m) for m in matches]
        else:
            cur.execute(
                "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                (q["id"],)
            )
            opts = cur.fetchall()
            options_list = [o["option_text"] for o in opts]
            correct_idx = ord(q["correct_option_letter"]) - 65

        quiz_questions.append({
            "id": q["id"],
            "question_text": q["question_text"],
            "question_type": q_type,
            "image_url": q["image_url"],
            "knowledge_component": q.get("knowledge_component") or "reading_comprehension",
            "hint": q.get("hint") or "",
            "options": options_list,
            "correct_option_index": correct_idx,
            "matching_pairs": matching_pairs_list
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
def start_quiz_session(quiz_id: int, user_id: int):
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

        # ── Sequential lesson lock check ──────────────────────────────────────
        if lesson_group_id:
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

        # ── Difficulty lock check ─────────────────────────────────────────────
        if lesson_group_id:
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
            q_type = q["question_type"]
            options_list = []
            correct_idx = 0
            matching_pairs_list = []

            if q_type == 'matching':
                cur.execute(
                    "SELECT left_item, right_item FROM question_matches WHERE question_id = %s ORDER BY id ASC",
                    (q["id"],)
                )
                matches = cur.fetchall()
                matching_pairs_list = [dict(m) for m in matches]
            else:
                cur.execute(
                    "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                    (q["id"],)
                )
                opts = cur.fetchall()
                options_list = [o["option_text"] for o in opts]
                correct_idx = ord(q["correct_option_letter"]) - 65

            result_questions.append({
                "id": q["id"],
                "question_text": q["question_text"],
                "question_type": q_type,
                "image_url": q["image_url"],
                "knowledge_component": q.get("knowledge_component") or "reading_comprehension",
                "hint": q.get("hint") or "",
                "options": options_list,
                "correct_option_index": correct_idx,
                "matching_pairs": matching_pairs_list,
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
            else:
                score_col = f"{difficulty}_best_score"
                passed_col = f"{difficulty}_passed"
                curr_best = prog.get(score_col) or 0.0
                new_best = max(curr_best, accuracy_pct)
                already_passed = bool(prog.get(passed_col))
                new_passed = already_passed or passed

                cur.execute(
                    f"""UPDATE student_lesson_progress
                       SET {score_col} = %s, {passed_col} = %s,
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
               ORDER BY a.completed_at DESC LIMIT 10""",
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
    """Deletes a KC (and all student mastery records for it)."""
    try:
        conn = get_db()
        cur = conn.cursor()
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
                      COALESCE(plain_password, 'Not available (Legacy user)') as password,
                      created_at
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
    hashed = pwd_context.hash(req.password.strip())
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO users (name, username, password_hash, role, plain_password) VALUES (%s, %s, %s, 'teacher', %s) RETURNING id, name, username, role, plain_password as password, created_at",
            (req.name.strip(), req.username.strip().lower(), hashed, req.password.strip())
        )
        new_teacher = dict(cur.fetchone())
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user": new_teacher}
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Username already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/role")
def update_user_role(user_id: int, req: UpdateUserRoleRequest):
    """Admin updates a user's role (admin, teacher, student)."""
    if req.role not in ('admin', 'teacher', 'student'):
        raise HTTPException(status_code=400, detail="Role must be admin, teacher, or student.")
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE users SET role = %s WHERE id = %s", (req.role, user_id))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user_id": user_id, "role": req.role}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/admin/users/{user_id}/password")
def admin_reset_user_password(user_id: int, req: AdminResetPasswordRequest):
    """Admin resets or sets a user's password directly."""
    if not req.password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty.")
    hashed = pwd_context.hash(req.password.strip())
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s, plain_password = %s WHERE id = %s",
            (hashed, req.password.strip(), user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "user_id": user_id, "new_password": req.password.strip()}
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
    """Returns current streak, longest streak, repair eligibility and total stars."""
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
                "active_today": False,
            }
        can_repair = (row["pre_break_streak"] > 0 and row["current_streak"] <= 1 and total_stars >= 30)
        active_today = row["last_activity_date"] == today
        return {
            "user_id": user_id, "current_streak": row["current_streak"],
            "longest_streak": row["longest_streak"],
            "last_activity_date": str(row["last_activity_date"]) if row["last_activity_date"] else None,
            "pre_break_streak": row["pre_break_streak"],
            "can_repair": can_repair, "repair_cost": 30,
            "total_stars": total_stars, "active_today": active_today,
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
        if not row or row["pre_break_streak"] == 0:
            raise HTTPException(status_code=400, detail="No streak to repair.")
        total_stars = _get_total_stars(cur, user_id)
        if total_stars < 30:
            raise HTTPException(status_code=400, detail="Not enough stars. Need 30 stars to repair streak.")
        _deduct_stars(cur, user_id, 30)
        restored = row["pre_break_streak"]
        cur.execute(
            "UPDATE student_streaks SET current_streak = %s, pre_break_streak = 0, updated_at = NOW() WHERE user_id = %s",
            (restored, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "restored_streak": restored, "stars_spent": 30}
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
def get_daily_quizzes(user_id: int):
    """Returns today's 3 daily quiz slots for the student."""
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        today = date.today()
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
        slot_stars = DAILY_STAR_REWARDS.get(req.slot_difficulty, 10) if passed else 0
        cur.execute(
            "UPDATE daily_quiz_slots SET completed = TRUE, stars_earned = %s WHERE user_id = %s AND slot_date = %s AND slot_difficulty = %s",
            (slot_stars, user_id, today, req.slot_difficulty)
        )
        if slot_stars > 0 and req.topic_id:
            cur.execute(
                "INSERT INTO student_profiles (user_id, topic_id, total_stars) VALUES (%s, %s, %s) ON CONFLICT (user_id, topic_id) DO UPDATE SET total_stars = student_profiles.total_stars + %s",
                (user_id, req.topic_id, slot_stars, slot_stars)
            )
        _update_student_streak(cur, user_id)
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM daily_quiz_slots WHERE user_id = %s AND slot_date = %s AND completed = TRUE",
            (user_id, today)
        )
        completed_count = cur.fetchone()["cnt"]
        bonus_awarded = False
        if completed_count == 3:
            bonus_awarded = True
            if req.topic_id:
                cur.execute(
                    "INSERT INTO student_profiles (user_id, topic_id, total_stars) VALUES (%s, %s, %s) ON CONFLICT (user_id, topic_id) DO UPDATE SET total_stars = student_profiles.total_stars + %s",
                    (user_id, req.topic_id, DAILY_FULL_CLEAR_BONUS, DAILY_FULL_CLEAR_BONUS)
                )
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
# ── Translation endpoint ───────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════


@app.post("/translate")
def translate_text(request: TranslationRequest):
    if request.direction == "en_to_asl":
        tokenizer.src_lang = "en_XX"
        inputs = tokenizer(
            request.text,
            return_tensors="pt",
            max_length=128,
            truncation=True,
        )
        out = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids("asl_GL"),
            max_length=128,
            num_beams=4,
        )
        result = tokenizer.decode(out[0], skip_special_tokens=True)
        return {"result": result, "direction": "en_to_asl"}

    elif request.direction == "asl_to_en":
        tokenizer.src_lang = "asl_GL"
        inputs = tokenizer(
            request.text,
            return_tensors="pt",
            max_length=128,
            truncation=True,
        )
        out = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids("en_XX"),
            max_length=128,
            num_beams=4,
        )
        result = tokenizer.decode(out[0], skip_special_tokens=True)
        return {"result": result, "direction": "asl_to_en"}

    else:
        return {"error": "Invalid direction. Use 'en_to_asl' or 'asl_to_en'."}


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
        cur.execute("SELECT id, name, username FROM users WHERE id = %s", (user_id,))
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
            "total_stars": total_stars,
            "streak": streak
        }
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
    if len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters.")
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
        if not u or not pwd_context.verify(req.old_password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect current password.")
        new_hashed = pwd_context.hash(req.new_password.strip())
        cur.execute("UPDATE users SET password_hash = %s, plain_password = %s WHERE id = %s", (new_hashed, req.new_password.strip(), user_id))
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
            WHERE slp.user_id = %s AND lg.topic_id IN ('mathematics', 'technology-and-livelihood-education', 'araling-panlipunan', 'english-literacy') AND slp.easy_passed = TRUE LIMIT 1
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
                COALESCE(SUM(sp.total_stars), 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(SUM(sp.quizzes_completed), 0) AS quizzes_completed
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            WHERE COALESCE(u.role, 'student') = 'student'
            GROUP BY u.id, u.name, u.username, ss.current_streak
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
def get_admin_analytics_overview():
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
                COALESCE(SUM(sp.total_stars), 0) AS total_stars,
                COALESCE(ss.current_streak, 0) AS current_streak,
                COALESCE(COUNT(sqa.id), 0) AS attempts_count,
                COALESCE(AVG((sqa.score::FLOAT / NULLIF(sqa.total_questions, 0)) * 100), 0) AS avg_accuracy
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN student_streaks ss ON u.id = ss.user_id
            LEFT JOIN student_quiz_attempts sqa ON u.id = sqa.user_id
            WHERE COALESCE(u.role, 'student') = 'student'
            GROUP BY u.id, u.name, u.username, ss.current_streak
            ORDER BY total_stars DESC, u.id ASC
        """)
        roster = [
            {
                "user_id": r["user_id"],
                "name": r["name"],
                "username": r["username"],
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
            "example": "Leo the puppy is the main character in the story.",
            "category": "Story Element",
            "icon": "person-outline",
            "color": "#7C3AED"
        },
        {
            "id": 2,
            "term": "Setting",
            "asl_gloss": "WHERE + WHEN STORY HAPPEN",
            "definition": "The place and time where the story happens.",
            "example": "The story takes place in a sunny green park.",
            "category": "Story Element",
            "icon": "location-outline",
            "color": "#7C3AED"
        },
        {
            "id": 3,
            "term": "Problem",
            "asl_gloss": "TROUBLE / CONFLICT / SOMETHING WRONG",
            "definition": "The trouble or challenge that the character must solve.",
            "example": "Leo is lost after chasing a butterfly.",
            "category": "Story Element",
            "icon": "alert-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 4,
            "term": "Resolution",
            "asl_gloss": "PROBLEM SOLVE / ENDING HAPPY",
            "definition": "How the problem is solved and how the story ends.",
            "example": "Mia helps Leo find his way back home.",
            "category": "Story Element",
            "icon": "checkmark-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 5,
            "term": "First (Sequence)",
            "asl_gloss": "FIRST (BEGINNING)",
            "definition": "What happens at the beginning of the story.",
            "example": "First, Leo plays happily in the park.",
            "category": "Sequence Word",
            "icon": "arrow-forward-circle-outline",
            "color": "#7C3AED"
        },
        {
            "id": 6,
            "term": "Finally (Sequence)",
            "asl_gloss": "FINALLY (END RESULT)",
            "definition": "What happens at the very end of the story.",
            "example": "Finally, Leo is safe at home with his family.",
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
            "example": "Leo translated the blue triangle 4 units to the right.",
            "category": "Transformation",
            "icon": "arrow-forward-outline",
            "color": "#2563EB"
        },
        {
            "id": 202,
            "term": "Reflection (Flip)",
            "asl_gloss": "SHAPE FLIP (MIRROR OPPOSITE)",
            "definition": "Flipping a shape across a line to produce a mirror image.",
            "example": "The arrow flips across the vertical line of symmetry.",
            "category": "Transformation",
            "icon": "swap-horizontal-outline",
            "color": "#2563EB"
        },
        {
            "id": 203,
            "term": "Rotation (Turn)",
            "asl_gloss": "SHAPE TURN (SPIN AROUND CENTER POINT)",
            "definition": "Turning a shape around a fixed center point by degrees (90° or 180°).",
            "example": "Turning the yellow star 90 degrees clockwise.",
            "category": "Transformation",
            "icon": "refresh-outline",
            "color": "#2563EB"
        },
        {
            "id": 204,
            "term": "Line of Symmetry",
            "asl_gloss": "MIDDLE LINE (BOTH SIDES MATCH SAME)",
            "definition": "The imaginary mirror line where a shape can be folded into two identical halves.",
            "example": "The vertical mirror line shows both sides are identical.",
            "category": "Geometry",
            "icon": "git-commit-outline",
            "color": "#2563EB"
        },
        {
            "id": 205,
            "term": "Congruent Shapes",
            "asl_gloss": "SHAPE SAME-SIZE + SAME-SHAPE",
            "definition": "Shapes that have the exact same size and shape after transforming.",
            "example": "The translated triangle is congruent to the original triangle.",
            "category": "Geometry",
            "icon": "shapes-outline",
            "color": "#2563EB"
        },
        {
            "id": 206,
            "term": "Coordinate Grid",
            "asl_gloss": "GRID MAP (X HORIZONTAL + Y VERTICAL)",
            "definition": "A network of horizontal and vertical lines used to pinpoint shape positions.",
            "example": "Leo plotted the triangle vertices on the 2D grid.",
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
            "example": "Mia applies a blurred virtual background before turning on her camera.",
            "category": "Digital Privacy",
            "icon": "videocam-outline",
            "color": "#D97706"
        },
        {
            "id": 302,
            "term": "Mute Microphone",
            "asl_gloss": "MIC OFF (NO NOISE DISTURB)",
            "definition": "Turning off your microphone when listening to avoid background noise.",
            "example": "Always mute your mic when the teacher or classmates are signing or speaking.",
            "category": "Etiquette",
            "icon": "mic-off-outline",
            "color": "#D97706"
        },
        {
            "id": 303,
            "term": "Meeting Link",
            "asl_gloss": "CONFERENCE LINK (NEVER SHARE PUBLIC)",
            "definition": "The digital address used to join an online classroom.",
            "example": "Only share the class meeting link with trusted school classmates.",
            "category": "Cybersecurity",
            "icon": "link-outline",
            "color": "#D97706"
        },
        {
            "id": 304,
            "term": "Password Protection",
            "asl_gloss": "SECRET CODE (LOCK ACCOUNT SAFE)",
            "definition": "A secret security code used to protect accounts and meetings from strangers.",
            "example": "Mia keeps her meeting passcode confidential.",
            "category": "Cybersecurity",
            "icon": "lock-closed-outline",
            "color": "#D97706"
        },
        {
            "id": 305,
            "term": "Visual Clarity",
            "asl_gloss": "LIGHT GOOD + HAND CLEAR (EASY SEE SIGN)",
            "definition": "Good front-facing lighting so hand signs and facial expressions are easy to see.",
            "example": "Face the light source so your sign language is bright and clear.",
            "category": "Visual Communication",
            "icon": "sunny-outline",
            "color": "#D97706"
        },
        {
            "id": 306,
            "term": "Chat Etiquette",
            "asl_gloss": "MESSAGE POLITE + RESPECTFUL (NO SPAM)",
            "definition": "Typing polite, relevant, and school-appropriate messages in the meeting chat.",
            "example": "Use the chat box only for asking questions related to the lesson.",
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
    question_type: str = "descriptive"
    image_url: Optional[str] = None
    knowledge_component: Optional[str] = None
    options: List[str] = []
    correct_option_index: int = 0
    hint: Optional[str] = None
    matching_pairs: Optional[List[dict]] = None

class UpdateQuizQuestionsRequest(BaseModel):
    questions: List[EditQuestionItem]


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
            q_type = r["question_type"]
            options_list = []
            matching_pairs_list = []
            
            if q_type == 'matching':
                cur.execute(
                    "SELECT left_item, right_item FROM question_matches WHERE question_id = %s ORDER BY id ASC",
                    (q_id,)
                )
                matches = cur.fetchall()
                matching_pairs_list = [{"left": m["left_item"], "right": m["right_item"]} for m in matches]
            else:
                cur.execute(
                    "SELECT option_letter, option_text FROM question_options WHERE question_id = %s ORDER BY option_letter ASC",
                    (q_id,)
                )
                opts = cur.fetchall()
                options_list = [o["option_text"] for o in opts]
                
            correct_letter = r["correct_option_letter"] or "A"
            correct_idx = ord(correct_letter.upper()) - 65 if len(correct_letter) == 1 and correct_letter.isalpha() else 0
            
            result.append({
                "id": q_id,
                "quiz_id": r["quiz_id"],
                "question_text": r["question_text"],
                "question_type": q_type,
                "image_url": r["image_url"],
                "knowledge_component": r.get("knowledge_component") or "",
                "options": options_list,
                "correct_option_index": correct_idx,
                "hint": r.get("hint") or "",
                "matching_pairs": matching_pairs_list,
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
            cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM question_matches WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM questions WHERE quiz_id = %s", (quiz_id,))
            
        # 2. Insert new questions
        for q in req.questions:
            if not q.question_text.strip():
                continue
            correct_letter = chr(65 + (q.correct_option_index or 0))
            cur.execute("""
                INSERT INTO questions 
                (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                quiz_id,
                q.question_text.strip(),
                correct_letter,
                q.question_type or "descriptive",
                q.image_url if q.image_url and q.image_url.strip() else None,
                q.knowledge_component if q.knowledge_component and q.knowledge_component.strip() else None,
                q.hint if q.hint and q.hint.strip() else None,
            ))
            new_q_id = cur.fetchone()[0]
            
            # Insert options
            for o_idx, opt_text in enumerate(q.options):
                opt_letter = chr(65 + o_idx)
                cur.execute("""
                    INSERT INTO question_options (question_id, option_letter, option_text)
                    VALUES (%s, %s, %s)
                """, (new_q_id, opt_letter, opt_text.strip()))
                
        conn.commit()
        cur.close()
        conn.close()

        log_teacher_activity(
            teacher_name="Teacher",
            action_type="edit_quiz",
            target_type="quiz",
            target_id=quiz_id,
            target_title=f"Quiz #{quiz_id}",
            details=f"Updated questions pool ({len(req.questions)} questions)."
        )
        return {"success": True, "message": f"Successfully updated {len(req.questions)} questions."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/quiz/{quiz_id}")
def delete_quiz(quiz_id: int, teacher_name: str = "Teacher"):
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
            details=f"Moved quiz '{row['title']}' ({row.get('difficulty', 'easy').upper()}) to Trash."
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
        cur.execute("""
            SELECT id, title, topic_id, difficulty, 'quiz' as item_type, deleted_at, deleted_by
            FROM quizzes
            WHERE is_deleted = TRUE
            ORDER BY deleted_at DESC
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
            action = "restore_lesson"
            detail = f"Restored lesson story '{target_title}' from Trash."
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
            action = "restore_lesson"
            detail = f"Restored lesson '{target_title}' from Trash."
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
            l_rows = cur.fetchall()
            for lr in l_rows:
                cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (lr["id"],))
            cur.execute("DELETE FROM lessons WHERE lesson_group_id = %s", (req.item_id,))
            cur.execute("DELETE FROM lesson_groups WHERE id = %s", (req.item_id,))
            action = "permanent_delete"
            detail = f"Permanently deleted lesson story '{target_title}'."
        elif req.item_type == "lesson":
            cur.execute("SELECT id, title, topic_id FROM lessons WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if row:
                target_title = row["title"]
                topic_id = row["topic_id"]
            cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (req.item_id,))
            cur.execute("DELETE FROM lessons WHERE id = %s", (req.item_id,))
            action = "permanent_delete"
            detail = f"Permanently deleted lesson '{target_title}'."
        elif req.item_type == "quiz":
            cur.execute("SELECT id, title, topic_id FROM quizzes WHERE id = %s", (req.item_id,))
            row = cur.fetchone()
            if row:
                target_title = row["title"]
                topic_id = row["topic_id"]
            cur.execute("SELECT id FROM questions WHERE quiz_id = %s", (req.item_id,))
            q_ids = [r["id"] for r in cur.fetchall()]
            if q_ids:
                cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (q_ids,))
                cur.execute("DELETE FROM question_matches WHERE question_id = ANY(%s)", (q_ids,))
                cur.execute("DELETE FROM questions WHERE quiz_id = %s", (req.item_id,))
            cur.execute("UPDATE daily_quiz_slots SET quiz_id = NULL WHERE quiz_id = %s", (req.item_id,))
            cur.execute("SELECT id FROM student_quiz_attempts WHERE quiz_id = %s", (req.item_id,))
            attempt_ids = [r["id"] for r in cur.fetchall()]
            if attempt_ids:
                cur.execute("DELETE FROM student_quiz_attempt_answers WHERE attempt_id = ANY(%s)", (attempt_ids,))
                cur.execute("DELETE FROM student_quiz_attempts WHERE quiz_id = %s", (req.item_id,))
            cur.execute("DELETE FROM quizzes WHERE id = %s", (req.item_id,))
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




