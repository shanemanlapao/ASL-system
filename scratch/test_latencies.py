import urllib.request
import time

endpoints = [
    "/health",
    "/student/7/streak",
    "/student/7/home-summary",
]

for ep in endpoints:
    url = f"https://brightpath.azurewebsites.net{ep}"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            duration = time.time() - t0
            print(f"{ep}: status {r.status} in {duration:.2f}s")
    except Exception as e:
        duration = time.time() - t0
        print(f"{ep}: ERROR {e} in {duration:.2f}s")
