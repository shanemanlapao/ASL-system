import urllib.request
import json

url = "https://brightpath.azurewebsites.net/translate"
data = json.dumps({"text": "Hello, how are you?", "direction": "en_to_asl"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
