import urllib.request
import json

base_url = "https://brightpath.azurewebsites.net"
user_id = 7

# 1. GET daily missions
req = urllib.request.Request(f"{base_url}/student/{user_id}/daily-missions")
try:
    with urllib.request.urlopen(req) as r:
        print("GET daily-missions:", r.status, json.loads(r.read().decode()))
except Exception as e:
    print("GET daily-missions ERROR:", e)

# 2. Claim mission test
payload = json.dumps({"mission_id": "test_mission", "stars_reward": 10, "client_date": "2026-10-12"}).encode()
req = urllib.request.Request(
    f"{base_url}/student/{user_id}/daily-missions/claim",
    data=payload,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req) as r:
        print("POST claim:", r.status, json.loads(r.read().decode()))
except Exception as e:
    print("POST claim ERROR:", e)

# 3. GET daily missions again
req = urllib.request.Request(f"{base_url}/student/{user_id}/daily-missions")
try:
    with urllib.request.urlopen(req) as r:
        print("GET daily-missions after claim:", r.status, json.loads(r.read().decode()))
except Exception as e:
    print("GET daily-missions after claim ERROR:", e)
