import os
import time

model_path = r"C:\Users\Radny\.cache\huggingface\hub\models--manohonsy--asl-mbart-50-lora\snapshots\d1cd3a2abdad5b6df6438be5b0a2ed388c622e9e"
print("Local model path exists:", os.path.exists(model_path))

try:
    import torch
    from transformers import MBart50TokenizerFast, MBartForConditionalGeneration
    print("PyTorch version:", torch.__version__)
    print("PyTorch threads:", torch.get_num_threads())
except ImportError as e:
    print("Import error:", e)
