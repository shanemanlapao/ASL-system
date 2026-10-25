import urllib.request
import json
import time

url = "https://brightpath.azurewebsites.net/translate"
payload = json.dumps({"text": "Hello world", "direction": "en_to_asl"}).encode("utf-8")

req = urllib.request.Request(
    url,
    data=payload,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
)

t0 = time.time()
with urllib.request.urlopen(req, timeout=10) as r:
    data = json.loads(r.read().decode())
    dur = time.time() - t0
    print(f"Translate endpoint: status {r.status} in {dur:.2f}s -> {data}")
