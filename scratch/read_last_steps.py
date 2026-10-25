import json

path = r"C:\Users\Radny\.gemini\antigravity\brain\6187107e-679c-497a-af44-ebe206031b08\.system_generated\logs\transcript.jsonl"
with open(path, "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        idx = data.get("step_index", 0)
        if 12370 <= idx <= 12392:
            src = data.get("source", "")
            tp = data.get("type", "")
            content = str(data.get("content", ""))
            print(f"=== STEP {idx} [{src} / {tp}] ===")
            print(content[:300])
            print()
