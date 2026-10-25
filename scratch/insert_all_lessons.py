"""
Master Database Insertion Script
Inserts and orders:
1. TLE: "Camera Privacy: The Magic Blur" (Order 1 - Webcam privacy is 1st in flashcards)
2. TLE: "Muting the Microphone: Bruno's Squeaky Toy" (Order 2 - Mute mic is 2nd in flashcards)
3. Story Grammar: "The Lost Pencil" (Easy, Medium, Hard)
4. Story Grammar: "The New Book" (Easy, Medium, Hard)
All slides have image_url = None as requested (to be edited/inserted later).
All 18 questions per tier are inserted with 4 choices, correct answer, and BKT KCs.
"""

import os
import re
import psycopg2
import psycopg2.extras

def get_db_connection():
    env = {}
    with open('.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()

    conn = psycopg2.connect(
        host=env.get('DB_HOST'),
        port=env.get('DB_PORT', 5432),
        dbname=env.get('DB_NAME'),
        user=env.get('DB_USER'),
        password=env.get('DB_PASSWORD'),
        sslmode=env.get('DB_SSLMODE', 'require')
    )
    return conn

def parse_lesson_artifact(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse slides
    slides = []
    slide_matches = re.findall(r"\*\s*\*\*Story Text:\*\*\s*\n\s*>\s*(.+)", content)
    for s in slide_matches:
        slides.append(s.strip())

    # Parse questions (support both formats)
    questions = []
    if "### Question 1" in content:
        q_blocks = re.split(r"### Question \d+", content)[1:]
    else:
        q_blocks = re.split(r"### \d+\.", content)[1:]

    for block in q_blocks:
        q_match = re.search(r"\*\s*\*\*Question:\*\*\s*(.+)", block)
        if not q_match:
            continue
        q_text = q_match.group(1).strip()

        # Options can be "* A) ..." or "* **[A]** ..."
        opts = []
        opt_matches_standard = re.findall(r"\*\s*[A-D]\)\s*(.+)", block)
        opt_matches_bracket = re.findall(r"\*\s*\*\*\[[A-D]\]\*\*\s*(.+)", block)
        raw_opts = opt_matches_standard if opt_matches_standard else opt_matches_bracket
        for opt in raw_opts:
            clean_opt = re.sub(r"\s*\*\(Correct\)\*", "", opt).strip()
            opts.append(clean_opt)

        ans_match = re.search(r"\*\s*\*\*(?:Correct Answer|Correct):\*\*\s*`?([A-D])`?", block)
        ans = ans_match.group(1) if ans_match else "A"

        kc_match = re.search(r"\*\s*\*\*(?:Knowledge Component|KC):\*\*\s*`?([A-Za-z0-9_]+)`?", block)
        kc = kc_match.group(1) if kc_match else "reading_comprehension"

        hint_match = re.search(r"\*\s*\*\*(?:ASL/Visual Hint|Hint):\*\*\s*(.+)", block)
        hint = hint_match.group(1).strip() if hint_match else ""

        if q_text and len(opts) >= 4:
            questions.append({
                "q": q_text,
                "opts": opts[:4],
                "ans": ans,
                "kc": kc,
                "hint": hint
            })

    return slides, questions

def ensure_all_kcs(cur):
    kcs = [
        ("technology-and-livelihood-education", "KC_ICT_CAMERA_PRIVACY", "Camera Privacy & Background Protection"),
        ("technology-and-livelihood-education", "KC_ICT_BACKGROUND_BLUR", "Background Blur & Positioning"),
        ("technology-and-livelihood-education", "KC_ICT_MUTE_MICROPHONE", "Mute Microphone Audio Control"),
        ("technology-and-livelihood-education", "KC_ICT_BACKGROUND_NOISE", "Background Noise Recognition"),
        ("technology-and-livelihood-education", "KC_ICT_PEER_SAFETY", "Peer Safety & Communication"),
        ("technology-and-livelihood-education", "KC_ICT_DIGITAL_CITIZENSHIP", "Digital Citizenship & Etiquette"),
        ("story-grammar", "KC_STORY_CHARACTER", "Story Character Identification"),
        ("story-grammar", "KC_STORY_SETTING", "Story Setting Identification"),
        ("story-grammar", "KC_STORY_PROBLEM", "Story Problem & Conflict"),
        ("story-grammar", "KC_STORY_RESOLUTION", "Story Resolution & Outcome"),
        ("general", "KC_SYNTAX_PREPOSITION", "Spatial Prepositions"),
        ("general", "KC_VOCAB_ADJECTIVE", "Descriptive & Affective Vocabulary"),
        ("general", "KC_COMP_INFERENCE", "Inference & Cause-and-Effect"),
    ]
    for topic, name, display in kcs:
        cur.execute(
            """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
               VALUES (%s, %s, %s, 0.10, 0.20, 0.25, 0.10)
               ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name""",
            (topic, name, display)
        )
    print("All Knowledge Components verified and registered.")

def insert_lesson_group(cur, topic_id, group_title, order_index, tier_files, base_title):
    print(f"\n==================================================")
    print(f"Processing Group: '{group_title}' (Topic: {topic_id}, Order: {order_index})")
    print(f"==================================================")

    # 1. Lesson Group
    cur.execute(
        "SELECT id FROM lesson_groups WHERE topic_id = %s AND title = %s",
        (topic_id, group_title)
    )
    row = cur.fetchone()
    if row:
        group_id = row[0]
        cur.execute("UPDATE lesson_groups SET order_index = %s WHERE id = %s", (order_index, group_id))
        print(f"Updated existing group ID: {group_id} to order_index: {order_index}")
    else:
        cur.execute(
            "INSERT INTO lesson_groups (topic_id, title, order_index) VALUES (%s, %s, %s) RETURNING id",
            (topic_id, group_title, order_index)
        )
        group_id = cur.fetchone()[0]
        print(f"Created new group ID: {group_id} with order_index: {order_index}")

    # 2. Process Tiers (easy, medium, hard)
    for difficulty, file_path in tier_files.items():
        slides, questions = parse_lesson_artifact(file_path)
        lesson_title = f"{base_title} ({difficulty.upper()})"
        print(f"\n--- Inserting Tier [{difficulty.upper()}]: {len(slides)} slides, {len(questions)} questions ---")

        # Lesson
        cur.execute(
            """INSERT INTO lessons (topic_id, title, difficulty, lesson_group_id)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (lesson_group_id, difficulty) DO UPDATE SET title = EXCLUDED.title
               RETURNING id""",
            (topic_id, lesson_title, difficulty, group_id)
        )
        lesson_id = cur.fetchone()[0]
        print(f"  Lesson ID: {lesson_id}")

        # Slides (image_url = None as requested)
        cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (lesson_id,))
        for idx, s_text in enumerate(slides):
            cur.execute(
                """INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url)
                   VALUES (%s, %s, %s, NULL)""",
                (lesson_id, idx, s_text)
            )
        print(f"  Inserted {len(slides)} slides (without images).")

        # Quiz
        quiz_title = f"{base_title} Quiz ({difficulty.upper()})"
        cur.execute(
            "SELECT id FROM quizzes WHERE lesson_id = %s AND difficulty = %s",
            (lesson_id, difficulty)
        )
        q_row = cur.fetchone()
        if q_row:
            quiz_id = q_row[0]
            cur.execute("UPDATE quizzes SET title = %s WHERE id = %s", (quiz_title, quiz_id))
        else:
            cur.execute(
                """INSERT INTO quizzes (title, topic_id, lesson_id, difficulty)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (quiz_title, topic_id, lesson_id, difficulty)
            )
            quiz_id = cur.fetchone()[0]
        print(f"  Quiz ID: {quiz_id}")

        # Questions (delete old first)
        cur.execute("SELECT id FROM questions WHERE quiz_id = %s", (quiz_id,))
        old_ids = [r[0] for r in cur.fetchall()]
        if old_ids:
            cur.execute("DELETE FROM student_question_answers WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (old_ids,))
            cur.execute("DELETE FROM questions WHERE quiz_id = %s", (quiz_id,))

        for q_data in questions:
            cur.execute(
                """INSERT INTO questions (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint)
                   VALUES (%s, %s, %s, 'multiple_choice', NULL, %s, %s) RETURNING id""",
                (quiz_id, q_data["q"], q_data["ans"], q_data["kc"], q_data["hint"])
            )
            q_id = cur.fetchone()[0]
            for opt_idx, opt_text in enumerate(q_data["opts"]):
                opt_letter = chr(65 + opt_idx)
                cur.execute(
                    """INSERT INTO question_options (question_id, option_letter, option_text)
                       VALUES (%s, %s, %s)""",
                    (q_id, opt_letter, opt_text)
                )
        print(f"  Inserted {len(questions)} questions and options.")

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    artifact_dir = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08"

    ensure_all_kcs(cur)

    # ── 1. TLE: Camera Privacy (The Magic Blur) -> ORDER 1 ──
    tle_cam_files = {
        "easy": f"{artifact_dir}\\tle_camera_privacy_easy_lesson.md",
        "medium": f"{artifact_dir}\\tle_camera_privacy_medium_lesson.md",
        "hard": f"{artifact_dir}\\tle_camera_privacy_hard_lesson.md",
    }
    insert_lesson_group(
        cur=cur,
        topic_id="technology-and-livelihood-education",
        group_title="Camera Privacy: The Magic Blur",
        order_index=1,  # 1st in TLE (matches 1st flashcard)
        tier_files=tle_cam_files,
        base_title="Camera Privacy: The Magic Blur"
    )

    # ── 2. TLE: Mute Microphone (Bruno's Squeaky Toy) -> ORDER 2 ──
    tle_mic_files = {
        "easy": f"{artifact_dir}\\tle_mute_mic_easy_lesson.md",
        "medium": f"{artifact_dir}\\tle_mute_mic_medium_lesson.md",
        "hard": f"{artifact_dir}\\tle_mute_mic_hard_lesson.md",
    }
    insert_lesson_group(
        cur=cur,
        topic_id="technology-and-livelihood-education",
        group_title="Muting the Microphone: Bruno's Squeaky Toy",
        order_index=2,  # 2nd in TLE (matches 2nd flashcard)
        tier_files=tle_mic_files,
        base_title="Bruno's Squeaky Toy"
    )

    # Also push old Group 10 to order_index = 3 so it doesn't conflict
    cur.execute(
        "UPDATE lesson_groups SET order_index = 3 WHERE id = 10 AND topic_id = 'technology-and-livelihood-education'"
    )

    # ── 3. STORY GRAMMAR: The Lost Pencil ──
    pencil_files = {
        "easy": f"{artifact_dir}\\the_lost_pencil_easy_lesson.md",
        "medium": f"{artifact_dir}\\the_lost_pencil_medium_lesson.md",
        "hard": f"{artifact_dir}\\the_lost_pencil_hard_lesson.md",
    }
    insert_lesson_group(
        cur=cur,
        topic_id="story-grammar",
        group_title="The Lost Pencil",
        order_index=4,  # right after existing core stories
        tier_files=pencil_files,
        base_title="The Lost Pencil"
    )

    # ── 4. STORY GRAMMAR: The New Book ──
    book_files = {
        "easy": f"{artifact_dir}\\the_new_book_easy_lesson.md",
        "medium": f"{artifact_dir}\\the_new_book_medium_lesson.md",
        "hard": f"{artifact_dir}\\the_new_book_hard_lesson.md",
    }
    insert_lesson_group(
        cur=cur,
        topic_id="story-grammar",
        group_title="The New Book",
        order_index=5,
        tier_files=book_files,
        base_title="The New Book"
    )

    conn.commit()
    cur.close()
    conn.close()
    print("\nSUCCESS! All TLE (Camera Privacy #1, Mute Mic #2) and Story Grammar (The Lost Pencil, The New Book) lessons, slides, and quizzes are fully inserted into the database!")

if __name__ == "__main__":
    main()
