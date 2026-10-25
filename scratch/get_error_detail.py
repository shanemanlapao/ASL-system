import urllib.request
import urllib.error
import json

base_url = "https://brightpath.azurewebsites.net"
user_id = 7

url = f"{base_url}/student/{user_id}/daily-missions?client_date=2026-10-12"
try:
    with urllib.request.urlopen(url) as r:
        print("Success:", r.status, r.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)
