"""
test_mbart_translation.py
CLI tool to test and compare mBART-50 LoRA vs Linguistic ASL Rule Engine
"""

import os
import sys
import time

# Ensure environment enables neural model
os.environ["ENABLE_NEURAL_MBART"] = "1"

print("=" * 70)
print("  BrightPath ASL Translation Engine Tester")
print("  Testing: mBART-50 LoRA Neural vs. Linguistic Rule Engine")
print("=" * 70)

# 1. Test Linguistic Rule Engine (Server/Offline Engine)
try:
    from server import rule_based_asl_gloss, rule_based_asl_to_english
    print("[OK] Linguistic ASL Rule Engine loaded successfully.")
except Exception as e:
    print(f"[!] Warning loading rule engine from server.py: {e}")
    rule_based_asl_gloss = None

# 2. Check PyTorch & Transformers
print("-" * 70)
try:
    import torch
    import transformers
    from transformers import MBart50TokenizerFast, MBartForConditionalGeneration
    print(f"[OK] PyTorch version: {torch.__version__}")
    print(f"[OK] Transformers version: {transformers.__version__}")
except ImportError as e:
    print(f"[ERROR] Required packages not found: {e}")
    print("Please run: pip install torch transformers")
    sys.exit(1)

# 3. Model path & loading
LOCAL_MODEL_PATH = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"
MODEL_REPO = "manohonsy/asl-mbart-50-lora"
source_path = LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else MODEL_REPO

print(f"Loading mBART-50 LoRA weights from: {source_path}")
print("Please wait, loading model into memory (~1.2 - 2.4 GB)...")
t_load_start = time.time()

try:
    torch.set_num_threads(2)
    tokenizer = MBart50TokenizerFast.from_pretrained(source_path)
    model = MBartForConditionalGeneration.from_pretrained(source_path, low_cpu_mem_usage=True)
    
    # Try INT8 quantization for CPU acceleration
    try:
        model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
        print("[OK] PyTorch Dynamic INT8 Quantization applied successfully!")
    except Exception as q_err:
        print(f"[*] Note on quantization: {q_err} (running FP32)")
    
    asl_id = tokenizer.convert_tokens_to_ids("asl_GL")
    tokenizer.lang_code_to_id["asl_GL"] = asl_id
    t_load_sec = round(time.time() - t_load_start, 2)
    print(f"[SUCCESS] mBART-50 LoRA loaded in {t_load_sec}s! Ready for inference.")
except Exception as err:
    print(f"[ERROR] Failed to load mBART-50 model: {err}")
    model = None
    tokenizer = None

def run_neural(text: str) -> tuple[str, float]:
    if not model or not tokenizer:
        return "MODEL NOT LOADED", 0.0
    t0 = time.time()
    with torch.inference_mode():
        tokenizer.src_lang = "en_XX"
        inputs = tokenizer(text, return_tensors="pt", max_length=128, truncation=True)
        out = model.generate(
            **inputs,
            forced_bos_token_id=tokenizer.convert_tokens_to_ids("asl_GL"),
            max_new_tokens=64,
            num_beams=1,
        )
        res = tokenizer.decode(out[0], skip_special_tokens=True)
    ms = round((time.time() - t0) * 1000, 1)
    return res, ms

def run_rule(text: str) -> tuple[str, float]:
    if not rule_based_asl_gloss:
        return "RULE ENGINE NOT AVAILABLE", 0.0
    t0 = time.time()
    res = rule_based_asl_gloss(text)
    ms = round((time.time() - t0) * 1000, 2)
    return res, ms

def compare_sentence(sentence: str):
    print("\n" + "=" * 70)
    print(f"INPUT: \"{sentence}\"")
    print("-" * 70)
    
    rule_out, rule_ms = run_rule(sentence)
    print(f"⚡ [LINGUISTIC RULE] ({rule_ms} ms):")
    print(f"   --> {rule_out}")
    print()
    
    neural_out, neural_ms = run_neural(sentence)
    print(f"🧠 [mBART-50 LoRA]  ({neural_ms} ms):")
    print(f"   --> {neural_out}")
    print("=" * 70)

# Run benchmark sample sentences
SAMPLE_SENTENCES = [
    "Leo placed his pencil on the brown desk.",
    "Where did Maria go yesterday?",
    "The students study mathematics in the morning.",
    "Why did you leave the classroom early?",
    "Mother baked a chocolate cake."
]

print("\nRunning benchmark tests...")
for s in SAMPLE_SENTENCES:
    compare_sentence(s)

# Interactive loop if running in terminal
if sys.stdin.isatty():
    print("\n" + "=" * 70)
    print("INTERACTIVE MODE: Type any sentence to translate (or 'exit' to quit)")
    print("=" * 70)

    while True:
        try:
            user_input = input("\nEnter English text: ").strip()
            if not user_input or user_input.lower() in ["exit", "quit", "q"]:
                print("Goodbye!")
                break
            compare_sentence(user_input)
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            break
else:
    print("\nBenchmark complete.")
