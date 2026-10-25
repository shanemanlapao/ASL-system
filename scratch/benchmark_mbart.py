import os
import time
import torch
from transformers import MBart50TokenizerFast, MBartForConditionalGeneration

model_path = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"

print("Loading tokenizer and model...")
t0 = time.time()
tokenizer = MBart50TokenizerFast.from_pretrained(model_path)
model = MBartForConditionalGeneration.from_pretrained(model_path, low_cpu_mem_usage=True)
asl_id = tokenizer.convert_tokens_to_ids("asl_GL")
tokenizer.lang_code_to_id["asl_GL"] = asl_id
print(f"Loaded in {time.time() - t0:.2f}s")

# Test sentence
sentence = "Hello, how are you today?"
tokenizer.src_lang = "en_XX"
inputs = tokenizer(sentence, return_tensors="pt", max_length=128, truncation=True)

# Test 1: Greedy decoding with inference_mode
t0 = time.time()
with torch.inference_mode():
    out = model.generate(
        **inputs,
        forced_bos_token_id=asl_id,
        max_new_tokens=32,
        num_beams=1,
    )
res1 = tokenizer.decode(out[0], skip_special_tokens=True)
d1 = time.time() - t0
print(f"Greedy FP32: {d1:.2f}s -> '{res1}'")

# Test 2: Dynamic INT8 Quantization
print("\nQuantizing model with dynamic INT8...")
t0 = time.time()
quantized_model = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear}, dtype=torch.qint8
)
print(f"Quantized in {time.time() - t0:.2f}s")

t0 = time.time()
with torch.inference_mode():
    out2 = quantized_model.generate(
        **inputs,
        forced_bos_token_id=asl_id,
        max_new_tokens=32,
        num_beams=1,
    )
res2 = tokenizer.decode(out2[0], skip_special_tokens=True)
d2 = time.time() - t0
print(f"Quantized INT8: {d2:.2f}s -> '{res2}'")
print(f"Speedup: {d1 / d2:.2f}x")
