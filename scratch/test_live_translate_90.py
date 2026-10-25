import urllib.request
import json
import time

url = "https://brightpath.azurewebsites.net/translate"
data = json.dumps({"text": "Hello, how are you?", "direction": "en_to_asl"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

t0 = time.time()
print("Sending request to /translate...")
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        duration = time.time() - t0
        print(f"Status: {resp.status} in {duration:.2f}s")
        print("Response:", resp.read().decode('utf-8'))
except Exception as e:
    duration = time.time() - t0
    print(f"Error after {duration:.2f}s:", e)
