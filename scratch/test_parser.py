"""
Test parser for lesson markdown packages.
"""
import re

def parse_lesson_artifact(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse slides
    slides = []
    slide_matches = re.findall(r"\*\s*\*\*Story Text:\*\*\s*\n\s*>\s*(.+)", content)
    for s in slide_matches:
        slides.append(s.strip())

    # Parse questions
    questions = []
    q_blocks = re.split(r"### Question \d+", content)[1:]
    for block in q_blocks:
        q_match = re.search(r"\*\s*\*\*Question:\*\*\s*(.+)", block)
        if not q_match:
            continue
        q_text = q_match.group(1).strip()

        opts = []
        opt_matches = re.findall(r"\*\s*[A-D]\)\s*(.+)", block)
        for opt in opt_matches:
            clean_opt = re.sub(r"\s*\*\(Correct\)\*", "", opt).strip()
            opts.append(clean_opt)

        ans_match = re.search(r"\*\s*\*\*Correct Answer:\*\*\s*`?([A-D])`?", block)
        ans = ans_match.group(1) if ans_match else "A"

        kc_match = re.search(r"\*\s*\*\*Knowledge Component:\*\*\s*`?([A-Za-z0-9_]+)`?", block)
        kc = kc_match.group(1) if kc_match else "reading_comprehension"

        hint_match = re.search(r"\*\s*\*\*ASL/Visual Hint:\*\*\s*(.+)", block)
        hint = hint_match.group(1).strip() if hint_match else ""

        questions.append({
            "q": q_text,
            "opts": opts[:4],
            "ans": ans,
            "kc": kc,
            "hint": hint
        })

    return slides, questions

if __name__ == "__main__":
    artifact_dir = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08"
    files = [
        "tle_camera_privacy_easy_lesson.md",
        "tle_camera_privacy_medium_lesson.md",
        "tle_camera_privacy_hard_lesson.md",
        "the_lost_pencil_easy_lesson.md",
        "the_lost_pencil_medium_lesson.md",
        "the_lost_pencil_hard_lesson.md",
    ]
    for fn in files:
        fp = f"{artifact_dir}\\{fn}"
        s, q = parse_lesson_artifact(fp)
        print(f"{fn}: {len(s)} slides, {len(q)} questions")
